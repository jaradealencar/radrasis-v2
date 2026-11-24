import { z } from "zod";

export const COMPRADORES_RESPONSAVEIS = [
  "Daniel",
  "Débora",
  "Suellen",
  "Érick",
  "Henrique",
] as const;

export const dataCompraSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(s => {
    const data = new Date(`${s}T12:00:00Z`);
    return (
      Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === s
    );
  }, "Informe uma data válida.");

export function unidadeConsumo(valor: string): string {
  const u = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/²/g, "2");
  if (["M2", "METRO QUADRADO", "METROS QUADRADOS"].includes(u)) return "M2";
  if (["M", "MT", "ML", "METRO LINEAR", "METROS LINEARES"].includes(u))
    return "ML";
  if (["KG", "KGS", "QUILOGRAMA", "QUILOGRAMAS"].includes(u)) return "KG";
  if (["L", "LT", "LITRO", "LITROS"].includes(u)) return "LT";
  if (
    [
      "UN",
      "UND",
      "UNID",
      "PC",
      "PCS",
      "UNIDADE",
      "UNIDADES",
      "PECA",
      "PECAS",
    ].includes(u)
  )
    return "UN";
  return u;
}

export const itemCotacaoCompraSchema = z.object({
  codigo: z.string().max(128).nullish(),
  descricao: z.string().trim().min(1).max(2000),
  quantidade: z.number().finite().positive().max(1e8),
  unidade: z.string().trim().min(1).max(80),
  precoUnitario: z.number().finite().positive().max(1e9),
  materiaPrimaId: z.number().int().positive().nullable(),
  unidadeDestino: z.string().max(80).nullable(),
  fatorConversao: z.number().finite().positive().max(1e10).nullable(),
  unidadeOrigem: z.string().max(80).nullable(),
  formula: z.string().max(4000).nullable(),
});
export const cotacaoCompraSchema = z.object({
  chave: z.string().uuid(),
  fornecedor: z.string().trim().min(1).max(256),
  cnpjFornecedor: z.string().max(18).nullish(),
  dataCotacao: dataCompraSchema,
  validadeDias: z.number().int().min(0).max(365).nullable(),
  condicaoPagamento: z.string().max(256).nullable(),
  prazoEntrega: z.string().max(256).nullable(),
  frete: z.number().finite().nonnegative().max(1e9).nullable(),
  freteModo: z.enum(["valor_total", "por_kg", "gratis"]).default("valor_total"),
  freteValorInformado: z
    .number()
    .finite()
    .nonnegative()
    .max(1e9)
    .nullable()
    .default(null),
  pesoFreteKg: z.number().finite().positive().nullable().default(null),
  nomeArquivo: z.string().max(256).nullable(),
  arquivoPdfUrl: z.string().url().max(2048).nullable().default(null),
  arquivoPdfKey: z.string().max(256).nullable().default(null),
  arquivoPdfSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().default(null),
  arquivoPdfTamanho: z.number().int().positive().max(32 * 1024 * 1024).nullable().default(null),
  observacoes: z.string().max(4000).default(""),
  itens: z.array(itemCotacaoCompraSchema).min(1).max(300),
});

export const decisaoCotacaoCompraSchema = z.object({
  cotacoesComparadasIds: z.array(z.number().int().positive()).min(2).max(10),
  cotacaoEscolhidaId: z.number().int().positive(),
  motivoEscolha: z.string().trim().max(1000).default(""),
}).superRefine((v, ctx) => {
  if (new Set(v.cotacoesComparadasIds).size !== v.cotacoesComparadasIds.length) {
    ctx.addIssue({ code: "custom", path: ["cotacoesComparadasIds"], message: "Cotação repetida na comparação." });
  }
  if (!v.cotacoesComparadasIds.includes(v.cotacaoEscolhidaId)) {
    ctx.addIssue({ code: "custom", path: ["cotacaoEscolhidaId"], message: "A cotação escolhida precisa fazer parte da comparação." });
  }
});
export type DecisaoCotacaoCompra = z.infer<typeof decisaoCotacaoCompraSchema>;

export function quantidadeAceitaNoRecebimento(linha: {
  quantidadeRecebida: number;
  quantidadeRecusada: number;
}): number {
  return Math.max(0, linha.quantidadeRecebida - linha.quantidadeRecusada);
}

export type CotacaoComparadaSnapshot = {
  id: number;
  fornecedor: string;
  cnpjFornecedor: string | null;
  dataCotacao: string;
  validadeDias: number | null;
  condicaoPagamento: string | null;
  prazoEntrega: string | null;
  totalOriginalComFrete: string | number | null;
  subtotalCotado: number;
  freteEstimado: number | null;
  totalFinalEstimado: number | null;
  itens: Array<{
    materiaPrimaId: number | null;
    descricao: string;
    quantidade: string | number;
    unidade: string;
    unidadeDestino: string | null;
    precoUnitario: string | number;
  }>;
};
export type ComparacaoCotacoesSnapshot = {
  cotacaoEscolhidaId: number;
  comparacaoEquivalente: boolean;
  motivoEscolha: string;
  menorFinalEstimado: number | null;
  cotacoesComparadas: CotacaoComparadaSnapshot[];
};

export type ItemEscopoCotacao = {
  materiaPrimaId: number | null;
  codigo: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  unidadeDestino: string | null;
  fatorConversao: number | null;
};

export function cotacoesMesmoEscopo(cotacoes: Array<{ itens: ItemEscopoCotacao[] }>): boolean {
  if (cotacoes.length < 2) return false;
  const assinatura = (itens: ItemEscopoCotacao[]) => itens
    .map(item => {
      const identidade = item.materiaPrimaId != null
        ? `mp:${item.materiaPrimaId}`
        : item.codigo?.trim()
          ? `cod:${item.codigo.trim().toLocaleUpperCase("pt-BR")}`
          : `desc:${item.descricao.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR")}`;
      const unidadeOrigem = unidadeConsumo(item.unidade);
      const unidade = unidadeConsumo(item.unidadeDestino ?? item.unidade);
      const fator = item.fatorConversao;
      if (unidadeOrigem !== unidade && !(fator != null && Number.isFinite(fator) && fator > 0)) return null;
      const quantidade = item.quantidade * (fator ?? 1);
      return { chave: `${identidade}|${unidade}`, quantidade };
    })
    .filter((item): item is { chave: string; quantidade: number } => item != null)
    .sort((a, b) => a.chave.localeCompare(b.chave));
  const base = assinatura(cotacoes[0].itens);
  if (base.length !== cotacoes[0].itens.length) return false;
  return cotacoes.slice(1).every(cotacao => {
    const atual = assinatura(cotacao.itens);
    return atual.length === cotacao.itens.length && base.length === atual.length && base.every((item, indice) =>
      item.chave === atual[indice].chave && Math.abs(item.quantidade - atual[indice].quantidade) <= 1e-6
    );
  });
}

export const recebimentoCompraSchema = z.object({
  ordemId: z.number().int().positive(),
  dataRecebimento: dataCompraSchema,
  observacoes: z.string().max(2000).default(""),
  itens: z.array(z.object({
    itemId: z.number().int().positive(),
    quantidadeRecebida: z.number().finite().nonnegative().max(1e8),
    quantidadeRecusada: z.number().finite().nonnegative().max(1e8).default(0),
  })).min(1).max(300).superRefine((itens, ctx) => {
    if (!itens.some(item => item.quantidadeRecebida > 0)) {
      ctx.addIssue({ code: "custom", message: "Informe a quantidade recebida em pelo menos um item." });
    }
    if (new Set(itens.map(item => item.itemId)).size !== itens.length) {
      ctx.addIssue({ code: "custom", message: "Item duplicado no recebimento." });
    }
    itens.forEach((item, index) => {
      if (item.quantidadeRecusada > item.quantidadeRecebida) {
        ctx.addIssue({ code: "custom", path: [index, "quantidadeRecusada"], message: "A quantidade recusada não pode superar a recebida." });
      }
    });
  }),
});
export const compradorSchema = z
  .object({
    tipo: z.enum(["empresa", "pessoa"]),
    nome: z.string().trim().min(3).max(256),
    documento: z.string().trim().min(11).max(18),
    inscricaoEstadual: z.string().max(32).default(""),
    endereco: z.string().trim().min(10).max(512),
    emailNf: z.string().email().max(256),
  })
  .superRefine((v, ctx) => {
    const d = v.documento.replace(/\D/g, "");
    if (d.length !== (v.tipo === "empresa" ? 14 : 11))
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: "Confira o CPF/CNPJ do comprador.",
      });
  });
export const ordemCompraSchema = z
  .object({
    chave: z.string().uuid(),
    cotacaoId: z.number().int().positive(),
    // Interfaces antigas não enviam o responsável separado; a emissão usa o
    // nome do comprador legal como fallback.
    nomeComprador: z.string().trim().min(3).max(256).optional(),
    dataPrevistaEntrega: dataCompraSchema.nullable().default(null),
    comparacaoCotacoes: decisaoCotacaoCompraSchema.nullable().default(null),
    comprador: compradorSchema,
    pagamento: z.enum(["a_vista", "faturado"]),
    condicaoPagamento: z.string().max(256),
    transportadora: z.string().max(256),
    numeroColeta: z.string().max(128),
    frete: z.number().finite().nonnegative().max(1e9),
    descontoTotal: z.number().finite().nonnegative().max(1e9).default(0),
    freteModo: z
      .enum(["valor_total", "por_kg", "gratis"])
      .default("valor_total"),
    freteValorInformado: z
      .number()
      .finite()
      .nonnegative()
      .max(1e9)
      .nullable()
      .default(null),
    pesoPrevistoKg: z
      .number()
      .finite()
      .positive()
      .max(1e9)
      .nullable()
      .default(null),
    volumePrevistoM3: z
      .number()
      .finite()
      .positive()
      .max(1e9)
      .nullable()
      .default(null),
    observacoes: z.string().max(4000),
    itens: z
      .array(
        z.object({
          itemId: z.number().int().positive(),
          quantidade: z.number().finite().positive().max(1e8),
          // Interfaces antigas enviam só itemId/quantidade. O servidor resolve
          // o preço pela cotação persistida para preservar o valor aprovado.
          precoUnitario: z.number().finite().nonnegative().max(1e9).optional(),
        })
      )
      .min(1)
      .max(300),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.itens.map(i => i.itemId)).size !== v.itens.length)
      ctx.addIssue({ code: "custom", message: "Item duplicado na ordem." });
    if (v.pagamento === "faturado" && !v.condicaoPagamento.trim())
      ctx.addIssue({
        code: "custom",
        path: ["condicaoPagamento"],
        message: "Informe os prazos do faturamento.",
      });
  });
export const editarOrdemCompraSchema = z
  .object({
    id: z.number().int().positive(),
    nomeComprador: z.string().trim().min(3).max(256),
    dataPrevistaEntrega: dataCompraSchema.nullable().default(null),
    motivoAlteracao: z.string().trim().max(1000).default(""),
    descontoTotal: z.number().finite().nonnegative().max(1e9).optional(),
    comprador: compradorSchema,
    pagamento: z.enum(["a_vista", "faturado"]),
    condicaoPagamento: z.string().max(256),
    observacoes: z.string().max(4000),
    itens: z
      .array(
        z.object({
          itemId: z.number().int().positive(),
          quantidade: z.number().finite().positive().max(1e8),
          precoUnitario: z.number().finite().nonnegative().max(1e9),
        })
      )
      .min(1)
      .max(300),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.itens.map(i => i.itemId)).size !== v.itens.length)
      ctx.addIssue({ code: "custom", message: "Item duplicado na ordem." });
    if (v.pagamento === "faturado" && !v.condicaoPagamento.trim())
      ctx.addIssue({
        code: "custom",
        path: ["condicaoPagamento"],
        message: "Informe os prazos do faturamento.",
      });
  });
export type CompradorCompra = z.infer<typeof compradorSchema>;
export type LinhaOrdemCompra = {
  itemId: number;
  materiaPrimaId: number | null;
  descricao: string;
  codigo: string | null;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoCotadoUnitario?: number;
  total: number;
  unidadeDestino: string | null;
  fatorConversao: number | null;
  formula: string | null;
};

export function precoConsumo(
  preco: number,
  fator: number | null,
  destino: string | null
): number | null {
  if (
    !(preco > 0) ||
    !fator ||
    !Number.isFinite(fator) ||
    fator <= 0 ||
    !destino
  )
    return null;
  const resultado = preco / fator;
  return Number.isFinite(resultado) ? resultado : null;
}

export type ReferenciaPrecoCompra = {
  materiaPrimaId: number | null;
  unidade: string;
  preco: number | null;
  data: string;
  fornecedor: string;
  cotacaoId: number;
  validadeDias: number | null;
  quantidade: number;
  fator: number | null;
};
export function menorCotacaoDisponivel(
  referencias: ReferenciaPrecoCompra[],
  compra: {
    materiaPrimaId: number | null;
    unidade: string;
    data: string;
    quantidade: number;
  }
) {
  if (!compra.materiaPrimaId) return null;
  return (
    referencias
      .filter(r => {
        if (
          r.materiaPrimaId !== compra.materiaPrimaId ||
          unidadeConsumo(r.unidade) !== unidadeConsumo(compra.unidade) ||
          r.preco == null ||
          r.preco <= 0 ||
          r.data > compra.data
        )
          return false;
        // Sem validade declarada, não afirmar que o preço ainda podia ser contratado.
        if (
          r.validadeDias == null ||
          !r.fator ||
          compra.quantidade + 1e-6 < r.quantidade * r.fator
        )
          return false;
        const fim = new Date(r.data + "T12:00:00Z");
        fim.setUTCDate(fim.getUTCDate() + r.validadeDias);
        return compra.data <= fim.toISOString().slice(0, 10);
      })
      .sort((a, b) => a.preco! - b.preco!)[0] ?? null
  );
}
