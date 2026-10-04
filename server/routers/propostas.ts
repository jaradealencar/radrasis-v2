/**
 * Proposta (cotação) gerada a partir do catálogo de Produtos — diferente de
 * `crm_propostas` (tabela órfã, nunca usada; ver drizzle/schema.ts). O
 * cliente acessa a proposta por um link público com token (sem login),
 * pode ligar/desligar item pra simular o valor (escolha fica salva) e ver
 * juros de parcelamento + condições comerciais configuradas em Admin.
 */
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requireRole, adminProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { propostas, propostaItens, produtos, configuracoesComerciais, vendedoresComerciais, estudioChapas, priceTableSections } from "../../drizzle/schema";
import { eq, asc, desc, and, inArray, sql, gte, lt } from "drizzle-orm";
import { consultarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";
import {
  aprovarPrecoCalculado,
  aprovarSugestaoPreco,
  precoContextoSchema,
  sugerirPrecoComGPT,
  verificarAprovacaoPreco,
  type ResultadoAprovacaoPreco,
} from "../services/cpqPrecoAssistente";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { calcularNestingMultiMaterial, type CpqNestingPeca } from "../services/cpqNesting";
import { decuparPreco, type DecupagemPreco } from "../services/decupadorPreco";

function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

const PREFIXO_COTACAO_ESTUDIO = "[ESTUDIO_COTACAO_V1]";

const medidasNestingSchema = z.object({
  areaTotalNestingM2: z.number().nonnegative().nullable(),
  areaM2: z.number().nonnegative().nullable(),
  areaGeralM2: z.number().nonnegative().nullable(),
  perimExtM: z.number().nonnegative().nullable(),
  perimTotalM: z.number().nonnegative().nullable(),
}).strict();

const materialConfiguracaoSchema = z.object({
  mubisysMateriaPrimaId: z.number().int().positive().nullable(),
  nome: z.string().min(1).max(256),
  unidade: z.string().max(80),
  custoUnitario: z.number().nonnegative(),
  quantidade: z.number().nonnegative(),
  custoTotal: z.number().nonnegative(),
  formulaType: z.enum(["areaTotal", "area", "areaGeral", "perimExt", "perimTotal", "fixo"]),
  multiplicador: z.number().nonnegative(),
  variacaoModeloId: z.number().int().positive().nullable(),
  variacaoModeloNome: z.string().max(256).nullable(),
  variacaoMaterial: z.object({
    nome: z.string().max(80),
    valor: z.string().max(120),
    materiaPrimaNome: z.string().max(256),
  }).nullable(),
  nesting: z.object({
    idChapa: z.number().int().positive(),
    nomeChapa: z.string().max(256),
    larguraMm: z.number().positive(),
    alturaMm: z.number().positive(),
    areaChapaM2: z.number().positive(),
    areaUtilizadaM2: z.number().positive(),
    aproveitamentoPct: z.number().min(0).max(100),
    criterio: z.enum(["menor_chapa_que_comporta", "menor_sobra_financeira", "maior_aproveitamento"]),
    custoUnitarioCatalogo: z.number().nonnegative(),
  }).nullable().optional(),
  incluir: z.boolean(),
}).strict();

const configuracaoItemSchema = z.object({
  nestingSourceId: z.string().max(80).nullable(),
  nestingNumero: z.string().max(40).nullable(),
  nestingModeloNome: z.string().max(256).nullable(),
  medidas: medidasNestingSchema,
  variacoesModelo: z.array(z.object({ id: z.number().int().positive(), nome: z.string().max(256) }).strict()).max(100),
  materiais: z.array(materialConfiguracaoSchema).max(500),
}).strict();

const aprovacaoPrecoInputSchema = z.object({
  recibo: z.string().min(20).max(6000),
  contexto: precoContextoSchema,
}).strict();

const basePrecoPropostaSchema = z.object({
  propostaId: z.number().int().positive(),
  produtoId: z.number().int().positive(),
  quantidade: z.number().finite().positive(),
  custoFinanceiroPct: z.number().min(0).max(100).default(0),
  parcelasFinanceira: z.number().int().positive().nullable().default(null),
  configuracao: configuracaoItemSchema,
}).strict();

async function validarCustosCatalogo(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  configuracao: z.infer<typeof configuracaoItemSchema>,
): Promise<void> {
  const linhas = configuracao.materiais.filter((material) => material.incluir);
  if (!linhas.length) return;
  const linhasCatalogo = linhas.filter((linha) => linha.mubisysMateriaPrimaId != null);
  const catalogo = linhasCatalogo.length
    ? new Map((await listarMateriasPrimas()).map((material) => [material.id, Number(material.valor_custo)]))
    : new Map<number, number>();
  let materiaisOrigem: z.infer<typeof materialConfiguracaoSchema>[] = [];
  if (linhas.some((linha) => linha.nesting)) {
    if (!configuracao.nestingSourceId) throw new Error("O material de nesting precisa estar vinculado a uma cotação CPQ salva.");
    const registros = await db.select({ observacoes: propostas.observacoes }).from(propostas)
      .where(sql`left(${propostas.observacoes}, ${PREFIXO_COTACAO_ESTUDIO.length}) = ${PREFIXO_COTACAO_ESTUDIO}`);
    const origem = registros.map((registro) => lerSnapshotEstudio(registro.observacoes))
      .find((snapshot) => snapshot?.sourceId === configuracao.nestingSourceId);
    if (!origem || !Array.isArray(origem.materiais)) throw new Error("A cotação de origem do nesting não foi encontrada.");
    materiaisOrigem = origem.materiais.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const parsed = materialConfiguracaoSchema.safeParse({ ...(item as Record<string, unknown>), incluir: true });
      return parsed.success ? [parsed.data] : [];
    });
  }
  for (const linha of linhas) {
    if (linha.nesting && linha.mubisysMateriaPrimaId == null) throw new Error("O nesting não identifica a matéria-prima de origem.");
    if (linha.mubisysMateriaPrimaId == null) continue; // Material manual fica sujeito à aprovação humana assinada.
    const custoAtual = catalogo.get(linha.mubisysMateriaPrimaId);
    if (custoAtual == null || !Number.isFinite(custoAtual) || custoAtual <= 0) {
      throw new Error(`O custo de ${linha.nome} não está disponível no catálogo atual. Atualize o material antes de aprovar o preço.`);
    }
    if (linha.nesting) {
      const original = materiaisOrigem.find((material) => material.mubisysMateriaPrimaId === linha.mubisysMateriaPrimaId
        && material.nesting?.idChapa === linha.nesting?.idChapa && material.nome === linha.nome
        && Math.abs(material.custoUnitario - linha.custoUnitario) <= 0.02);
      if (!original || !original.nesting
        || Math.abs(original.nesting.custoUnitarioCatalogo - linha.nesting.custoUnitarioCatalogo) > 0.02
        || Math.abs(custoAtual - original.nesting.custoUnitarioCatalogo) > 0.02) {
        throw new Error(`O custo de nesting de ${linha.nome} não corresponde à cotação de origem e ao catálogo atual.`);
      }
    } else if (Math.abs(custoAtual - linha.custoUnitario) > 0.02) {
      throw new Error(`O custo de ${linha.nome} mudou no MubiSys. Atualize a composição e solicite nova aprovação.`);
    }
  }
}

function calcularContextoPrecoProposta(args: {
  produto: { nome: string; custoMaoObra: string | null; idPrecificacao: number | null };
  configuracao: z.infer<typeof configuracaoItemSchema>;
  precoAtual: number;
  taxas: { custoFixoPct: number; comissaoPct: number; impostoPct: number; custoFinanceiroPct: number };
}) {
  const medidaPorFormula: Record<z.infer<typeof materialConfiguracaoSchema>["formulaType"], number | null> = {
    areaTotal: args.configuracao.medidas.areaTotalNestingM2 ?? args.configuracao.medidas.areaGeralM2,
    area: args.configuracao.medidas.areaM2,
    areaGeral: args.configuracao.medidas.areaGeralM2,
    perimExt: args.configuracao.medidas.perimExtM,
    perimTotal: args.configuracao.medidas.perimTotalM,
    fixo: 1,
  };
  for (const material of args.configuracao.materiais.filter((linha) => linha.incluir)) {
    const medida = medidaPorFormula[material.formulaType];
    if (material.formulaType !== "fixo" && (medida == null || (medida <= 0 && material.multiplicador > 0))) {
      throw new Error(`A medida usada pela fórmula de ${material.nome} está ausente ou zerada.`);
    }
    const quantidadeEsperada = (medida ?? 0) * material.multiplicador;
    if (Math.abs(material.quantidade - quantidadeEsperada) > 0.005) {
      throw new Error(`A quantidade de ${material.nome} não corresponde à fórmula e às medidas atuais.`);
    }
  }
  const itens = args.configuracao.materiais.filter((material) => material.incluir).map((material) => ({
    nome: material.nome,
    quantidade: material.quantidade,
    custoTotal: material.custoTotal,
    custoUnitario: material.custoUnitario,
  }));
  if (itens.some((material) => material.quantidade > 0 && material.custoUnitario <= 0)) {
    throw new Error("Há matéria-prima sem custo válido. Atualize os custos antes da análise ou aprovação.");
  }
  if (itens.some((material) => Math.abs(material.custoTotal - material.quantidade * material.custoUnitario) > 0.02)) {
    throw new Error("O subtotal de uma matéria-prima não corresponde à quantidade e ao custo unitário.");
  }
  if (args.produto.custoMaoObra == null) throw new Error("Cadastre o custo de mão de obra direta no produto antes de sugerir ou aprovar o preço.");
  const custoMateriais = itens.reduce((soma, material) => soma + material.custoTotal, 0);
  const custoMaoObra = Number(args.produto.custoMaoObra);
  const custoBase = custoMateriais + custoMaoObra;
  if (!Number.isFinite(custoBase) || custoBase <= 0) throw new Error("O custo direto está zerado. Revise a composição e os custos antes de continuar.");
  const somaTaxas = Object.values(args.taxas).reduce((total, taxa) => total + taxa, 0);
  if (!Number.isFinite(somaTaxas) || Object.values(args.taxas).some((taxa) => taxa < 0 || taxa > 100) || somaTaxas >= 100) {
    throw new Error("As taxas somadas impedem um preço com margem líquida não negativa. Revise os parâmetros comerciais.");
  }
  // Verificamos o piso bruto em centavos porque cada parcela da decupagem
  // é arredondada individualmente.
  const fracaoLiquida = 1 - somaTaxas / 100;
  let pisoPreco = Math.ceil((custoBase / fracaoLiquida - 0.00000001) * 100) / 100;
  if (!Number.isFinite(pisoPreco) || pisoPreco > 9_999_999_999.99) throw new Error("O preço mínimo excede o limite monetário da proposta.");
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const calculo = decuparPreco({ precoVenda: pisoPreco, materiaPrima: custoMateriais, maoDeObra: custoMaoObra, ...args.taxas });
    if (calculo.lucroLiquido.valor >= 0) break;
    pisoPreco = Math.round((pisoPreco + Math.max(0.01, Math.ceil(-calculo.lucroLiquido.valor / fracaoLiquida * 100) / 100)) * 100) / 100;
    if (pisoPreco > 9_999_999_999.99) throw new Error("O preço mínimo excede o limite monetário da proposta.");
  }
  if (decuparPreco({ precoVenda: pisoPreco, materiaPrima: custoMateriais, maoDeObra: custoMaoObra, ...args.taxas }).lucroLiquido.valor < 0) {
    throw new Error("Não foi possível determinar o preço mínimo com estas taxas.");
  }
  const custoDireto = custoBase;
  const margemAtual = args.precoAtual > 0
    ? decuparPreco({ precoVenda: args.precoAtual, materiaPrima: custoMateriais, maoDeObra: custoMaoObra, ...args.taxas }).lucroLiquido.percentual
    : null;
  return precoContextoSchema.parse({
    produto: args.produto.nome,
    custoDireto,
    precoMinimo: pisoPreco,
    taxasSobreVendaPct: somaTaxas,
    precoAtual: args.precoAtual,
    regra: `Custo direto real ${custoBase.toFixed(2)}; preço mínimo bruto ${pisoPreco.toFixed(2)} após taxas: fixo ${args.taxas.custoFixoPct}%, comissão ${args.taxas.comissaoPct}%, imposto ${args.taxas.impostoPct}%, financeiro ${args.taxas.custoFinanceiroPct}%${args.produto.idPrecificacao ? `; regra ${args.produto.idPrecificacao} da Tabela de Preços requer revisão da faixa` : ""}`,
    margemAtualPct: margemAtual != null && Math.abs(margemAtual) <= 1000 ? margemAtual : null,
    itens: [...itens.map(({ nome, quantidade, custoTotal }) => ({ nome, quantidade, custoTotal })), { nome: "Mão de obra direta", quantidade: 1, custoTotal: custoMaoObra }],
  });
}

function exigirMargemLiquidaNaoNegativa(
  precoVenda: number,
  configuracao: z.infer<typeof configuracaoItemSchema>,
  custoMaoObra: string | null,
  taxas: { custoFixoPct: number; comissaoPct: number; impostoPct: number; custoFinanceiroPct: number },
): void {
  if (custoMaoObra == null) throw new Error("Cadastre o custo de mão de obra direta antes de aprovar o preço.");
  const materiaPrima = configuracao.materiais.filter((material) => material.incluir)
    .reduce((total, material) => total + material.custoTotal, 0);
  const calculo = decuparPreco({ precoVenda, materiaPrima, maoDeObra: Number(custoMaoObra), ...taxas });
  if (calculo.lucroLiquido.valor < 0) throw new Error("O preço aprovado gera margem líquida negativa. Revise o preço e as taxas.");
}

function lerSnapshotEstudio(observacoes: string | null): Record<string, unknown> | null {
  if (!observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) return null;
  try {
    const snapshot: unknown = JSON.parse(observacoes.slice(PREFIXO_COTACAO_ESTUDIO.length));
    return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function nomesVariacoes(configuracao: unknown): { nome: string; valor: string }[] {
  if (!configuracao || typeof configuracao !== "object" || Array.isArray(configuracao)) return [];
  const dados = configuracao as Record<string, unknown>;
  const modelo = Array.isArray(dados.variacoesModelo) ? dados.variacoesModelo.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const linha = item as Record<string, unknown>;
    return typeof linha.nome === "string" && typeof linha.id === "number"
      ? [{ nome: "Variação do modelo", valor: linha.nome }]
      : [];
  }) : [];
  const materiais = Array.isArray(dados.materiais) ? dados.materiais.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const linha = item as Record<string, unknown>;
    if (!linha.variacaoMaterial || typeof linha.variacaoMaterial !== "object" || Array.isArray(linha.variacaoMaterial)) return [];
    const variacao = linha.variacaoMaterial as Record<string, unknown>;
    return typeof variacao.nome === "string" && typeof variacao.valor === "string"
      ? [{ nome: variacao.nome, valor: variacao.valor }]
      : [];
  }) : [];
  return [...new Map([...modelo, ...materiais].map((variacao) => [`${variacao.nome}:${variacao.valor}`, variacao])).values()];
}

function calcularTotal(itens: { ativo: boolean; precoUnitario: string; quantidade: string }[]): number {
  return itens
    .filter((i) => i.ativo)
    .reduce((soma, i) => soma + Number(i.precoUnitario) * Number(i.quantidade), 0);
}

/** Maior prazo de fabricação entre os itens ativos — item mais lento manda no prazo total. */
function calcularPrazo(itens: { ativo: boolean; prazoFabricacaoDiasUteis: number | null }[]): number | null {
  const prazos = itens.filter((i) => i.ativo).map((i) => i.prazoFabricacaoDiasUteis ?? 0);
  return prazos.length ? Math.max(...prazos) : null;
}

async function carregarItensComProduto(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, propostaId: number) {
  return db
    .select({
      id: propostaItens.id,
      produtoId: propostaItens.produtoId,
      produtoNome: propostaItens.produtoNome,
      descricao: propostaItens.descricao,
      configuracaoJson: propostaItens.configuracaoJson,
      grupoId: propostaItens.grupoId,
      grupoDescricao: propostaItens.grupoDescricao,
      quantidade: propostaItens.quantidade,
      precoUnitario: propostaItens.precoUnitario,
      ativo: propostaItens.ativo,
      ordem: propostaItens.ordem,
      prazoFabricacaoDiasUteis: produtos.prazoFabricacaoDiasUteis,
      instagramUrl: produtos.instagramUrl,
    })
    .from(propostaItens)
    .innerJoin(produtos, eq(propostaItens.produtoId, produtos.id))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));
}

function numeroSnapshot(snapshot: Record<string, unknown>, chave: string): number | null {
  const valor = snapshot[chave];
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

function percentualDaTabela(secoes: { contentJson: string }[], linhaId: number, custo: number): number | null {
  for (const secao of secoes) {
    try {
      const dados = JSON.parse(secao.contentJson) as { columns?: unknown; rows?: unknown };
      const columns = Array.isArray(dados.columns) ? dados.columns.filter((item): item is string => typeof item === "string") : [];
      const rows = Array.isArray(dados.rows) ? dados.rows as Array<{ id?: unknown; values?: unknown }> : [];
      const linha = rows.find((item) => Number(item.id) === linhaId);
      if (!linha || !Array.isArray(linha.values) || columns.length === 0) continue;
      const index = columns.findIndex((label) => {
        const faixa = label.replace(/R\$/g, "").trim();
        const valor = (texto: string) => /k$/i.test(texto.trim())
          ? Number.parseFloat(texto.trim().replace(/k$/i, "").replace(",", ".")) * 1000
          : Number.parseFloat(texto.trim().replace(/\./g, "").replace(",", ".")) || 0;
        if (/^at[eé]/i.test(faixa)) return custo <= valor(faixa.match(/[\d.,]+k?/i)?.[0] || "0");
        if (/\+\s*$/.test(faixa)) return custo >= valor(faixa.match(/[\d.,]+k?/i)?.[0] || "0");
        const partes = faixa.split("~");
        return partes.length === 2 && custo >= valor(partes[0]) && custo <= valor(partes[1]);
      });
      if (index < 0) return null;
      const value = String(linha.values[index] ?? "");
      const pct = Number.parseFloat(value.replace("%", "").replace(",", "."));
      if (Number.isFinite(pct) && pct >= 0 && pct < 100) return pct;
    } catch {
      continue;
    }
  }
  return null;
}

type ItemCarregado = Awaited<ReturnType<typeof carregarItensComProduto>>[number];
type ItemPublico = Omit<ItemCarregado, "grupoId" | "grupoDescricao" | "produtoId" | "ordem" | "configuracaoJson"> & {
  variacoes: { nome: string; valor: string }[];
};

/** Mantém os componentes separados no orçamento, mas entrega um único item por grupo ao cliente. */
function consolidarItensPublicos(itens: ItemCarregado[]) {
  const resultado: ItemPublico[] = [];
  const gruposProcessados = new Set<string>();

  for (const item of itens) {
    if (!item.grupoId) {
      const { grupoId: _grupoId, grupoDescricao: _grupoDescricao, produtoId: _produtoId, ordem: _ordem, configuracaoJson, ...publico } = item;
      resultado.push({ ...publico, variacoes: nomesVariacoes(configuracaoJson) });
      continue;
    }
    if (gruposProcessados.has(item.grupoId)) continue;

    const membros = itens.filter((membro) => membro.grupoId === item.grupoId);
    gruposProcessados.add(item.grupoId);
    const prazos = membros
      .map((membro) => membro.prazoFabricacaoDiasUteis)
      .filter((prazo): prazo is number => prazo != null);
    const valorConjunto = membros.reduce(
      (soma, membro) => soma + Number(membro.quantidade) * Number(membro.precoUnitario),
      0,
    );

    const variacoes = membros.flatMap((membro) => nomesVariacoes(membro.configuracaoJson));
    resultado.push({
      id: item.id,
      produtoNome: "Conjunto",
      descricao: item.grupoDescricao,
      quantidade: "1",
      precoUnitario: valorConjunto.toFixed(2),
      ativo: membros.every((membro) => membro.ativo),
      prazoFabricacaoDiasUteis: prazos.length ? Math.max(...prazos) : null,
      instagramUrl: null,
      variacoes: [...new Map(variacoes.map((variacao) => [variacao.valor, variacao])).values()],
    });
  }

  return resultado;
}

async function obterConfiguracoes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [config] = await db.select().from(configuracoesComerciais).limit(1);
  if (config) return config;
  const [criado] = await db.insert(configuracoesComerciais).values({}).returning();
  return criado;
}

type RegraTributaria = { categoria: string; impostoPct: number };

function lerRegrasTributarias(json: string): RegraTributaria[] {
  try {
    const parsed: unknown = JSON.parse(json || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const regra = item as Record<string, unknown>;
      const categoria = typeof regra.categoria === "string" ? regra.categoria.trim() : "";
      const impostoPct = Number(regra.impostoPct);
      return categoria && Number.isFinite(impostoPct) && impostoPct >= 0 && impostoPct <= 100
        ? [{ categoria, impostoPct }]
        : [];
    });
  } catch {
    return [];
  }
}

function taxaImpostoProduto(categoria: string | null, padraoPct: number, regras: RegraTributaria[]): number {
  const categoriaNormalizada = categoria?.trim().toLocaleLowerCase("pt-BR");
  const regra = regras.find((item) => item.categoria.toLocaleLowerCase("pt-BR") === categoriaNormalizada);
  return regra?.impostoPct ?? padraoPct;
}

async function buscarVendedorPorNome(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, nome: string) {
  const [vendedor] = await db.select({ id: vendedoresComerciais.id, comissaoPct: vendedoresComerciais.comissaoPct })
    .from(vendedoresComerciais)
    .where(and(sql`lower(trim(${vendedoresComerciais.nome})) = lower(trim(${nome}))`, eq(vendedoresComerciais.ativo, true)))
    .limit(1);
  return vendedor ?? null;
}

type PropostaParaPreco = { id: number; vendedorNome: string; vendedorComercialId: number | null };
type ProdutoParaPreco = { nome: string; categoria: string | null; custoMaoObra: string | null; idPrecificacao: number | null };

async function parametrosPrecoProposta(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  proposta: PropostaParaPreco,
  produto: ProdutoParaPreco,
  financeiro: { custoFinanceiroPct: number; parcelasFinanceira: number | null },
) {
  const [config, vendedor] = await Promise.all([
    obterConfiguracoes(db),
    proposta.vendedorComercialId
      ? db.select({ id: vendedoresComerciais.id, comissaoPct: vendedoresComerciais.comissaoPct, ativo: vendedoresComerciais.ativo })
        .from(vendedoresComerciais).where(eq(vendedoresComerciais.id, proposta.vendedorComercialId)).then(([row]) => row ?? null)
      : buscarVendedorPorNome(db, proposta.vendedorNome),
  ]);
  if (!vendedor || ("ativo" in vendedor && !vendedor.ativo)) {
    throw new Error("Cadastre e ative o vendedor com sua comissão antes de calcular o preço.");
  }
  if (financeiro.custoFinanceiroPct > 0 || financeiro.parcelasFinanceira != null) {
    let opcoes: unknown;
    try { opcoes = JSON.parse(config.jurosParcelamentoJson || "[]"); }
    catch { throw new Error("A configuração de parcelamento está inválida."); }
    const configurada = Array.isArray(opcoes) && opcoes.some((opcao) =>
      opcao && typeof opcao === "object" && opcao.parcelas === financeiro.parcelasFinanceira
      && Math.abs(Number(opcao.custoFinanceiroPct ?? 0) - financeiro.custoFinanceiroPct) < 0.0001,
    );
    if (!configurada) throw new Error("A taxa financeira selecionada não está configurada para parcelamento.");
  }
  const taxas = {
    custoFixoPct: Number(config.custoFixoPct),
    comissaoPct: Number(vendedor.comissaoPct),
    impostoPct: taxaImpostoProduto(produto.categoria, Number(config.impostoPct), lerRegrasTributarias(config.impostosPorCategoriaJson)),
    custoFinanceiroPct: financeiro.custoFinanceiroPct,
  };
  return {
    taxas,
    assinatura: {
      vendedorComercialId: vendedor.id,
      vendedorNome: proposta.vendedorNome,
      categoria: produto.categoria,
      ...taxas,
      parcelasFinanceira: financeiro.parcelasFinanceira,
    },
  };
}

function criarSnapshotDecupagem(args: {
  precoVenda: number;
  quantidadeEmitida: number;
  custoMateriais: number;
  custoMaoObra: number | null;
  custoFixoPct: number;
  comissaoPct: number | null;
  impostoPct: number;
  custoFinanceiroPct: number;
  parcelasFinanceira: number | null;
  categoria: string | null;
  vendedorNome: string;
}): Record<string, unknown> {
  const pendencias: string[] = [];
  if (args.custoMaoObra == null) pendencias.push("Cadastre o custo de mão de obra direta no produto.");
  if (args.comissaoPct == null) pendencias.push(`Associe ${args.vendedorNome} a um vendedor cadastrado com comissão.`);
  if (!Number.isFinite(args.precoVenda) || args.precoVenda <= 0) pendencias.push("O preço de venda precisa ser maior que zero.");
  const base = {
    version: 1,
    calculadoEm: new Date().toISOString(),
    quantidadeEmitida: args.quantidadeEmitida,
    categoria: args.categoria,
    taxas: {
      custoFixoPct: args.custoFixoPct,
      comissaoPct: args.comissaoPct,
      impostoPct: args.impostoPct,
      custoFinanceiroPct: args.custoFinanceiroPct,
      parcelasFinanceira: args.parcelasFinanceira,
    },
    custos: { materiaPrima: Math.round(args.custoMateriais * 100) / 100, maoDeObra: args.custoMaoObra },
  };
  if (pendencias.length) return { ...base, complete: false, pendencias };
  const calculo = decuparPreco({
    precoVenda: args.precoVenda,
    materiaPrima: args.custoMateriais,
    maoDeObra: args.custoMaoObra!,
    custoFixoPct: args.custoFixoPct,
    comissaoPct: args.comissaoPct!,
    impostoPct: args.impostoPct,
    custoFinanceiroPct: args.custoFinanceiroPct,
  });
  return { ...calculo, taxas: { ...calculo.taxas, parcelasFinanceira: args.parcelasFinanceira }, complete: true, categoria: args.categoria, vendedorNome: args.vendedorNome };
}

export const propostasRouter = router({
  precoSugerir: protectedProcedure
    .input(basePrecoPropostaSchema.extend({ precoAtual: z.number().finite().nonnegative() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [proposta] = await db.select({ id: propostas.id, vendedorNome: propostas.vendedorNome, vendedorComercialId: propostas.vendedorComercialId }).from(propostas).where(eq(propostas.id, input.propostaId));
      const [produto] = await db.select({
        nome: produtos.nome,
        categoria: produtos.categoria,
        custoMaoObra: produtos.custoMaoObra,
        idPrecificacao: produtos.idPrecificacao,
      }).from(produtos).where(eq(produtos.id, input.produtoId));
      if (!proposta || !produto) throw new Error("Proposta ou produto não encontrado.");
      await validarCustosCatalogo(db, input.configuracao);
      const parametros = await parametrosPrecoProposta(db, proposta, produto, input);
      const contexto = calcularContextoPrecoProposta({ produto, configuracao: input.configuracao, precoAtual: input.precoAtual, taxas: parametros.taxas });
      const base = {
        propostaId: input.propostaId,
        produtoId: input.produtoId,
        quantidade: input.quantidade,
        custoFinanceiroPct: input.custoFinanceiroPct,
        parcelasFinanceira: input.parcelasFinanceira,
        parametros: parametros.assinatura,
        configuracao: input.configuracao,
      };
      const sugestao = await sugerirPrecoComGPT({ fluxo: "propostas", base, contexto, atorId: ctx.user.id });
      const impostoPct = parametros.taxas.impostoPct;
      const podeVerCustos = ["gestor", "admin", "master"].includes(ctx.user.role);
      if (!podeVerCustos) {
        // Não retornar contexto, parecer, alertas ou ticket: o payload assinado
        // é apenas autenticado (HMAC), não cifrado, e pode ser decodificado.
        return { precoSugerido: sugestao.precoSugerido, impostoPct };
      }
      return { ...sugestao, impostoPct, contexto };
    }),

  precoAprovar: protectedProcedure
    .use(requireRole("gestor", "admin", "master"))
    .input(basePrecoPropostaSchema.extend({
      precoAtual: z.number().finite().nonnegative(),
      precoAprovado: z.number().finite().nonnegative(),
      origem: z.enum(["calculado", "gpt"]),
      ticket: z.string().min(20).max(6000).nullable().default(null),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [proposta] = await db.select({ id: propostas.id, vendedorNome: propostas.vendedorNome, vendedorComercialId: propostas.vendedorComercialId }).from(propostas).where(eq(propostas.id, input.propostaId));
      const [produto] = await db.select({
        nome: produtos.nome,
        categoria: produtos.categoria,
        custoMaoObra: produtos.custoMaoObra,
        idPrecificacao: produtos.idPrecificacao,
      }).from(produtos).where(eq(produtos.id, input.produtoId));
      if (!proposta || !produto) throw new Error("Proposta ou produto não encontrado.");
      await validarCustosCatalogo(db, input.configuracao);
      const parametros = await parametrosPrecoProposta(db, proposta, produto, input);
      const contexto = calcularContextoPrecoProposta({ produto, configuracao: input.configuracao, precoAtual: input.precoAtual, taxas: parametros.taxas });
      const base = {
        propostaId: input.propostaId,
        produtoId: input.produtoId,
        quantidade: input.quantidade,
        custoFinanceiroPct: input.custoFinanceiroPct,
        parcelasFinanceira: input.parcelasFinanceira,
        parametros: parametros.assinatura,
        configuracao: input.configuracao,
      };
      const ator = { id: ctx.user.id, nome: ctx.user.name, role: ctx.user.role };
      let aprovacao: ResultadoAprovacaoPreco;
      if (input.origem === "gpt") {
        if (!input.ticket) throw new Error("A sugestão do GPT expirou ou não foi carregada. Faça a análise novamente.");
        aprovacao = aprovarSugestaoPreco({ ticket: input.ticket, fluxo: "propostas", base, contexto, ator });
      } else {
        aprovacao = aprovarPrecoCalculado({ fluxo: "propostas", base, contexto, preco: input.precoAprovado, ator });
      }
      if (Math.abs(aprovacao.precoAprovado - input.precoAprovado) >= 0.005) {
        throw new Error("O preço informado não corresponde ao preço que foi aprovado.");
      }
      exigirMargemLiquidaNaoNegativa(aprovacao.precoAprovado, input.configuracao, produto.custoMaoObra, parametros.taxas);
      return { ...aprovacao, contexto };
    }),

  nestingsEstudio: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const registros = await db.select({
      id: propostas.id,
      clienteNome: propostas.clienteNome,
      clienteCnpj: propostas.clienteCnpj,
      status: propostas.status,
      tituloProposta: propostas.tituloProposta,
      imagemReferenciaUrl: propostas.imagemReferenciaUrl,
      imagemRedesenhadaUrl: propostas.imagemRedesenhadaUrl,
      createdAt: propostas.createdAt,
      observacoes: propostas.observacoes,
    }).from(propostas)
      .where(sql`left(${propostas.observacoes}, ${PREFIXO_COTACAO_ESTUDIO.length}) = ${PREFIXO_COTACAO_ESTUDIO}`)
      .orderBy(desc(propostas.createdAt))
      .limit(100);

    const numeroOuNulo = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    return registros.flatMap((registro) => {
      const snapshot = lerSnapshotEstudio(registro.observacoes);
      if (!snapshot || typeof snapshot.sourceId !== "string" || typeof snapshot.modeloNome !== "string") return [];
      const variacoesModelo = Array.isArray(snapshot.variacoesModelo)
        ? snapshot.variacoesModelo.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const variacao = item as Record<string, unknown>;
            return typeof variacao.id === "number" && typeof variacao.nome === "string"
              ? [{ id: variacao.id, nome: variacao.nome }]
              : [];
          })
        : [];
      const medidas = {
        areaTotalNestingM2: numeroOuNulo(snapshot.areaTotalNestingM2),
        areaM2: numeroOuNulo(snapshot.areaM2),
        areaGeralM2: numeroOuNulo(snapshot.areaGeralM2),
        perimExtM: numeroOuNulo(snapshot.perimExtM),
        perimTotalM: numeroOuNulo(snapshot.perimTotalM),
      };
      const materiais = Array.isArray(snapshot.materiais)
        ? snapshot.materiais.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const parsed = materialConfiguracaoSchema.safeParse({ ...(item as Record<string, unknown>), incluir: true });
            return parsed.success ? [parsed.data] : [];
          })
        : [];
      const svg = typeof snapshot.nestingSvg === "string" ? snapshot.nestingSvg : null;
      return [{
        cotacaoId: registro.id,
        sourceId: snapshot.sourceId,
        numero: typeof snapshot.numeroCotacao === "string" ? snapshot.numeroCotacao : `COT-${String(registro.id).padStart(6, "0")}`,
        criadaEm: registro.createdAt,
        clienteNome: registro.clienteNome,
        clienteCnpj: registro.clienteCnpj,
        status: registro.status,
        tituloProposta: registro.tituloProposta || (typeof snapshot.tituloProposta === "string" ? snapshot.tituloProposta : ""),
        imagemReferenciaUrl: registro.imagemReferenciaUrl || (typeof snapshot.imagemReferenciaUrl === "string" ? snapshot.imagemReferenciaUrl : null),
        imagemRedesenhadaUrl: registro.imagemRedesenhadaUrl || (typeof snapshot.imagemRedesenhadaUrl === "string" ? snapshot.imagemRedesenhadaUrl : null),
        temVetor: !!svg && !!numeroSnapshot(snapshot, "larguraNestingMm") && !!numeroSnapshot(snapshot, "alturaNestingMm"),
        modeloNome: snapshot.modeloNome,
        mubisysProdutoId: typeof snapshot.mubisysProdutoId === "number" ? snapshot.mubisysProdutoId : null,
        mubisysModeloId: typeof snapshot.mubisysModeloId === "number" ? snapshot.mubisysModeloId : null,
        variacoesModelo,
        medidas,
        materiais,
      }];
    });
  }),

  juncaoSimular: protectedProcedure
    .input(z.object({ cotacaoIds: z.array(z.number().int().positive()).min(2).max(10), espacamentoMm: z.number().finite().min(0).max(50).default(3) }).strict())
    .mutation(async ({ input }) => {
      if (new Set(input.cotacaoIds).size !== input.cotacaoIds.length) throw new Error("Selecione cotações diferentes.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível.");
      const rows = await db.select({
        id: propostas.id,
        clienteNome: propostas.clienteNome,
        clienteCnpj: propostas.clienteCnpj,
        status: propostas.status,
        observacoes: propostas.observacoes,
      }).from(propostas).where(inArray(propostas.id, input.cotacaoIds));
      if (rows.length !== input.cotacaoIds.length) throw new Error("Uma ou mais cotações não foram encontradas.");
      if (rows.some((row) => row.status !== "aberta")) throw new Error("A junção aceita apenas propostas abertas.");
      const normalizarCliente = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, "").toLowerCase();
      const clienteBase = rows[0].clienteCnpj?.replace(/\D/g, "") || normalizarCliente(rows[0].clienteNome);
      if (rows.some((row) => (row.clienteCnpj?.replace(/\D/g, "") || normalizarCliente(row.clienteNome)) !== clienteBase)) {
        throw new Error("Para agrupar, as propostas precisam ser do mesmo cliente.");
      }
      const snapshots = rows.map((row) => {
        const snapshot = lerSnapshotEstudio(row.observacoes);
        if (!snapshot) throw new Error(`A proposta ${row.id} não contém um snapshot válido do CPQ.`);
        const nestingSvg = typeof snapshot.nestingSvg === "string" ? snapshot.nestingSvg : "";
        const larguraMm = numeroSnapshot(snapshot, "larguraNestingMm");
        const alturaMm = numeroSnapshot(snapshot, "alturaNestingMm");
        if (!nestingSvg || !larguraMm || !alturaMm) throw new Error(`A proposta ${row.id} não tem vetor validado com escala física. Regrave-a pelo CPQ antes da junção.`);
        return { row, snapshot, peca: { id: String(row.id), svg: nestingSvg, larguraMm, alturaMm } satisfies CpqNestingPeca };
      });
      const materialIdsComuns = snapshots.map(({ snapshot }) => new Set(
        (Array.isArray(snapshot.materiais) ? snapshot.materiais : []).flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const linha = item as Record<string, unknown>;
          return typeof linha.mubisysMateriaPrimaId === "number" && linha.mubisysMateriaPrimaId > 0 ? [linha.mubisysMateriaPrimaId] : [];
        }),
      ));
      const comuns = [...materialIdsComuns[0]].filter((id) => materialIdsComuns.every((ids) => ids.has(id)));
      if (!comuns.length) throw new Error("As propostas não compartilham uma matéria-prima para corte em chapa.");
      const [catalogo, chapasAtivas] = await Promise.all([
        listarMateriasPrimas(),
        db.select().from(estudioChapas).where(and(inArray(estudioChapas.mubisysMateriaPrimaId, comuns), eq(estudioChapas.ativo, true))),
      ]);
      const idsComChapas = comuns.filter((id) => chapasAtivas.some((chapa) => chapa.mubisysMateriaPrimaId === id));
      if (!idsComChapas.length) throw new Error("Cadastre chapas ativas para ao menos um material comum às propostas.");
      const materiaisCatalogo = new Map(catalogo.map((item) => [item.id, item]));
      const resultados = await calcularNestingMultiMaterial({
        espacamentoMm: input.espacamentoMm,
        materiais: idsComChapas.map((id) => {
          const material = materiaisCatalogo.get(id);
          if (!material) throw new Error(`A matéria-prima ${id} não existe no catálogo atual do MubiSys.`);
          return {
            id,
            nome: material.nome,
            custoUnitario: Number(material.valor_custo) || 0,
            unidadeCusto: material.unidade_custo || "",
            chapas: chapasAtivas.filter((chapa) => chapa.mubisysMateriaPrimaId === id),
            pecas: snapshots.map(({ peca }) => peca),
          };
        }),
      });
      const custoIndefinido = resultados.find((resultado) => resultado.custo_material_estimado == null);
      if (custoIndefinido) throw new Error(custoIndefinido.alerta_custo || `Não há regra de custo compatível para ${custoIndefinido.materia_prima}.`);

      const secoesPreco = await db.select({ contentJson: priceTableSections.contentJson }).from(priceTableSections);
      const distribuicaoPorCotacao = snapshots.map(({ row, snapshot, peca }) => {
        const areaPeca = peca.larguraMm * peca.alturaMm;
        const materiais = Array.isArray(snapshot.materiais) ? snapshot.materiais as Array<Record<string, unknown>> : [];
        let novoCustoMateriais = Number(snapshot.custoMateriais) || 0;
        let economiaMaterial = 0;
        for (const resultado of resultados) {
          const linhas = materiais.filter((item) => Number(item.mubisysMateriaPrimaId) === resultado.id_materia_prima);
          if (!linhas.length) continue;
          const somaAreas = snapshots.reduce((total, item) => total + item.peca.larguraMm * item.peca.alturaMm, 0);
          const novoSubtotal = resultado.custo_material_estimado! * areaPeca / Math.max(somaAreas, 1);
          const custoAnterior = linhas.reduce((total, linha) => total + (Number(linha.custoTotal) || 0), 0);
          novoCustoMateriais += novoSubtotal - custoAnterior;
          economiaMaterial += custoAnterior - novoSubtotal;
        }
        const percentualCustoFixo = Number(snapshot.custoMateriais) > 0 ? (Number(snapshot.custoFixo) || 0) / Number(snapshot.custoMateriais) : 0;
        const novoCustoDireto = novoCustoMateriais * (1 + percentualCustoFixo) + (Number(snapshot.custoServicos) || 0);
        const modoPreco = snapshot.modoPreco;
        const desconto = Number(snapshot.descontoPct) || 0;
        let margemPct: number | null = null;
        let novoPrecoCalculado: number | null = null;
        let regraReprecificacao: string;
        if (modoPreco === "fixo") {
          novoPrecoCalculado = (Number(snapshot.precoFixo) || 0) * (1 - desconto / 100);
          regraReprecificacao = "Preço fixo mantido; custo agrupado atualizado para revisão.";
        } else {
          const linhaId = Number(snapshot.linhaPrecificacaoId);
          margemPct = Number.isInteger(linhaId) && linhaId > 0
            ? percentualDaTabela(secoesPreco, linhaId, novoCustoDireto)
            : typeof snapshot.margemAplicadaPct === "number" ? snapshot.margemAplicadaPct : null;
          if (margemPct == null || margemPct >= 100) {
            regraReprecificacao = "Sem margem de tabela/manual válida para recalcular o preço automaticamente.";
          } else {
            novoPrecoCalculado = (novoCustoDireto / (1 - margemPct / 100) + (Number(snapshot.instalacao) || 0)) * (1 - desconto / 100);
            regraReprecificacao = Number.isInteger(linhaId) && linhaId > 0 ? `Tabela de Preços, linha ${linhaId}, recalculada pela faixa do novo custo` : `Margem manual preservada (${margemPct}%)`;
          }
        }
        return {
          cotacaoId: row.id,
          clienteNome: row.clienteNome,
          modeloNome: String(snapshot.modeloNome || "Projeto"),
          economiaMaterial: Math.round(economiaMaterial * 100) / 100,
          custoDiretoAnterior: Number(snapshot.custoDireto) || 0,
          custoDiretoAgrupado: Math.round(novoCustoDireto * 100) / 100,
          precoAnterior: Number(snapshot.precoFinal) || 0,
          precoCalculadoAgrupado: novoPrecoCalculado == null ? null : Math.round(novoPrecoCalculado * 100) / 100,
          regraReprecificacao,
        };
      });
      return {
        simulacao: true,
        exigeNovaAprovacaoHumana: true,
        cliente: rows[0].clienteNome,
        resultadosNesting: resultados,
        propostas: distribuicaoPorCotacao,
      };
    }),

  // ─── Admin ───────────────────────────────────────────────────────────────
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const lista = (await db.select().from(propostas).orderBy(desc(propostas.createdAt)))
      .filter((proposta) => !proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO));
    const resultado = [];
    for (const p of lista) {
      const itens = await db
        .select({ ativo: propostaItens.ativo, precoUnitario: propostaItens.precoUnitario, quantidade: propostaItens.quantidade })
        .from(propostaItens)
        .where(eq(propostaItens.propostaId, p.id));
      resultado.push({ ...p, valorTotal: calcularTotal(itens), qtdItens: itens.length });
    }
    return resultado;
  }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [proposta] = await db.select().from(propostas).where(eq(propostas.id, input.id));
      if (!proposta || proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) return null;
      const itens = await carregarItensComProduto(db, input.id);
      const podeVerCustos = ["admin", "master", "gestor"].includes(ctx.user.role);
      const itensVisiveis = podeVerCustos ? itens : itens.map((item) => {
        const configuracao = item.configuracaoJson as Record<string, unknown>;
        return {
          ...item,
          configuracaoJson: {
            variacoesModelo: configuracao?.variacoesModelo ?? [],
            medidas: configuracao?.medidas ?? null,
          },
        };
      });
      return {
        proposta,
        itens: itensVisiveis,
        valorTotal: calcularTotal(itens),
        prazoFabricacaoDiasUteis: calcularPrazo(itens),
      };
    }),

  criar: protectedProcedure
    .input(
      z.object({
        clienteNome: z.string().min(1),
        tituloProposta: z.string().max(256).optional().default(""),
        imagemReferenciaUrl: z.string().url().max(2048).nullable().optional().default(null),
        imagemRedesenhadaUrl: z.string().url().max(2048).nullable().optional().default(null),
        clienteCnpj: z.string().optional(),
        clienteContato: z.string().optional(),
        vendedorNome: z.string().min(1),
        formasPagamento: z.array(z.string()).optional().default([]),
        condicaoPagamentoObs: z.string().optional(),
        observacoes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const vendedor = await buscarVendedorPorNome(db, input.vendedorNome);
      const [result] = await db
        .insert(propostas)
        .values({
          token: gerarToken(),
          tituloProposta: input.tituloProposta,
          imagemReferenciaUrl: input.imagemReferenciaUrl,
          imagemRedesenhadaUrl: input.imagemRedesenhadaUrl,
          clienteNome: input.clienteNome,
          clienteCnpj: input.clienteCnpj || null,
          clienteContato: input.clienteContato || null,
          vendedorNome: input.vendedorNome,
          vendedorComercialId: vendedor?.id ?? null,
          formasPagamentoJson: JSON.stringify(input.formasPagamento),
          condicaoPagamentoObs: input.condicaoPagamentoObs || null,
          observacoes: input.observacoes || null,
        })
        .returning({ id: propostas.id, token: propostas.token });
      return { success: true, id: result.id, token: result.token };
    }),

  /** Consulta CNPJ na OpenCNPJ (mesma API já usada em outros módulos) pra
   *  autocompletar razão social/nome fantasia no formulário de proposta —
   *  não há endpoint de escrita no MubiSys, então isto não cria nada lá,
   *  só evita digitação manual do nome do cliente aqui. */
  consultarCnpj: protectedProcedure
    .input(z.object({ cnpj: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const dados = await consultarCnpj(input.cnpj);
        return { encontrado: true as const, razaoSocial: dados.razao_social, nomeFantasia: dados.nome_fantasia };
      } catch (e) {
        if (e instanceof CnpjNaoEncontradoError) return { encontrado: false as const };
        throw e;
      }
    }),

  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clienteNome: z.string().min(1),
        tituloProposta: z.string().max(256).optional().default(""),
        imagemReferenciaUrl: z.string().url().max(2048).nullable().optional().default(null),
        imagemRedesenhadaUrl: z.string().url().max(2048).nullable().optional().default(null),
        clienteCnpj: z.string().optional(),
        clienteContato: z.string().optional(),
        vendedorNome: z.string().min(1),
        formasPagamento: z.array(z.string()).optional().default([]),
        condicaoPagamentoObs: z.string().optional(),
        observacoes: z.string().optional(),
        status: z.enum(["aberta", "aceita", "recusada", "expirada"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [anterior] = await db.select({ id: propostas.id, vendedorNome: propostas.vendedorNome, vendedorComercialId: propostas.vendedorComercialId, observacoes: propostas.observacoes })
        .from(propostas).where(eq(propostas.id, input.id));
      if (!anterior || anterior.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) throw new Error("Proposta não encontrada.");
      const vendedor = await buscarVendedorPorNome(db, input.vendedorNome);
      const mudouVendedor = anterior.vendedorComercialId !== (vendedor?.id ?? null)
        || anterior.vendedorNome.trim().toLocaleLowerCase("pt-BR") !== input.vendedorNome.trim().toLocaleLowerCase("pt-BR");
      if (mudouVendedor) {
        const [item] = await db.select({ id: propostaItens.id }).from(propostaItens)
          .where(eq(propostaItens.propostaId, input.id)).limit(1);
        if (item) throw new Error("A proposta já tem itens aprovados. Para mudar o vendedor, crie outra proposta ou remova os itens e aprove os preços novamente.");
      }
      await db.update(propostas).set({
          tituloProposta: input.tituloProposta,
          imagemReferenciaUrl: input.imagemReferenciaUrl,
          imagemRedesenhadaUrl: input.imagemRedesenhadaUrl,
          clienteNome: input.clienteNome,
          clienteCnpj: input.clienteCnpj || null,
          clienteContato: input.clienteContato || null,
          vendedorNome: input.vendedorNome,
          vendedorComercialId: vendedor?.id ?? null,
          formasPagamentoJson: JSON.stringify(input.formasPagamento),
          condicaoPagamentoObs: input.condicaoPagamentoObs || null,
          observacoes: input.observacoes || null,
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date(),
        }).where(eq(propostas.id, input.id));
      return { success: true };
    }),

  remover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(propostas).where(eq(propostas.id, input.id));
      return { success: true };
    }),

  itemAdicionar: protectedProcedure
    .input(
      z.object({
        propostaId: z.number(),
        produtoId: z.number(),
        quantidade: z.number().min(0.0001).default(1),
        precoUnitario: z.number().min(0),
        custoFinanceiroPct: z.number().min(0).max(100).optional().default(0),
        parcelasFinanceira: z.number().int().positive().nullable().optional().default(null),
        descricao: z.string().max(5000).optional().default(""),
        configuracao: configuracaoItemSchema,
        aprovacaoPreco: aprovacaoPrecoInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [produto] = await db.select({
        nome: produtos.nome,
        categoria: produtos.categoria,
        custoMaoObra: produtos.custoMaoObra,
        percentualCustoFixo: produtos.percentualCustoFixo,
        idPrecificacao: produtos.idPrecificacao,
      }).from(produtos).where(eq(produtos.id, input.produtoId));
      if (!produto) throw new Error("Produto não encontrado");
      const [proposta] = await db.select({ id: propostas.id, vendedorNome: propostas.vendedorNome, vendedorComercialId: propostas.vendedorComercialId }).from(propostas).where(eq(propostas.id, input.propostaId));
      if (!proposta) throw new Error("Proposta não encontrada");
      const configuracao = input.configuracao;
      await validarCustosCatalogo(db, configuracao);
      const parametros = await parametrosPrecoProposta(db, proposta, produto, input);
      const contextoAtual = calcularContextoPrecoProposta({
        produto,
        configuracao,
        precoAtual: input.aprovacaoPreco.contexto.precoAtual,
        taxas: parametros.taxas,
      });
      const aprovacao = verificarAprovacaoPreco({
        recibo: input.aprovacaoPreco.recibo,
        fluxo: "propostas",
        base: { propostaId: input.propostaId, produtoId: input.produtoId, quantidade: input.quantidade, custoFinanceiroPct: input.custoFinanceiroPct, parcelasFinanceira: input.parcelasFinanceira, parametros: parametros.assinatura, configuracao },
        contexto: contextoAtual,
        preco: input.precoUnitario,
      });
      const custoMateriais = configuracao.materiais.filter((material) => material.incluir).reduce((total, material) => total + material.custoTotal, 0);
      const decupagem = criarSnapshotDecupagem({
        precoVenda: input.precoUnitario,
        quantidadeEmitida: input.quantidade,
        custoMateriais,
        custoMaoObra: produto.custoMaoObra == null ? null : Number(produto.custoMaoObra),
        ...parametros.taxas,
        parcelasFinanceira: input.parcelasFinanceira,
        categoria: produto.categoria,
        vendedorNome: proposta.vendedorNome,
      });
      if (decupagem.complete !== true || Number((decupagem as unknown as DecupagemPreco).lucroLiquido.valor) < 0) {
        throw new Error("A decupagem está incompleta ou a margem líquida é negativa. Revise e aprove novamente o preço.");
      }
      const existentes = await db
        .select({ id: propostaItens.id })
        .from(propostaItens)
        .where(eq(propostaItens.propostaId, input.propostaId));
      const [result] = await db
        .insert(propostaItens)
        .values({
          propostaId: input.propostaId,
          produtoId: input.produtoId,
          produtoNome: produto.nome,
          descricao: input.descricao,
          configuracaoJson: {
            ...configuracao,
            precificacaoIA: { ...aprovacao, contexto: contextoAtual },
          },
          decupagemJson: decupagem,
          custoMaoObraUnitario: produto.custoMaoObra,
          quantidade: String(input.quantidade),
          precoUnitario: String(input.precoUnitario),
          ordem: existentes.length,
        })
        .returning({ id: propostaItens.id });
      return { success: true, id: result.id };
    }),

  itemAtualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      quantidade: z.number().min(0.0001),
      precoUnitario: z.number().min(0),
      custoFinanceiroPct: z.number().min(0).max(100).optional(),
      parcelasFinanceira: z.number().int().positive().nullable().optional(),
      descricao: z.string().max(5000).optional(),
      configuracao: configuracaoItemSchema.optional(),
      aprovacaoPreco: aprovacaoPrecoInputSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [atual] = await db.select({
        id: propostaItens.id,
        propostaId: propostaItens.propostaId,
        produtoId: propostaItens.produtoId,
        quantidade: propostaItens.quantidade,
        precoUnitario: propostaItens.precoUnitario,
        decupagemJson: propostaItens.decupagemJson,
      }).from(propostaItens).where(eq(propostaItens.id, input.id));
      if (!atual) throw new Error("Item de proposta não encontrado.");
      const taxasAnteriores = atual.decupagemJson && typeof atual.decupagemJson.taxas === "object" && atual.decupagemJson.taxas
        ? atual.decupagemJson.taxas as Record<string, unknown> : {};
      const custoFinanceiroAnterior = Number(taxasAnteriores.custoFinanceiroPct ?? 0);
      const parcelasAnteriores = typeof taxasAnteriores.parcelasFinanceira === "number" ? taxasAnteriores.parcelasFinanceira : null;
      const financeiro = {
        custoFinanceiroPct: input.custoFinanceiroPct ?? custoFinanceiroAnterior,
        parcelasFinanceira: input.parcelasFinanceira === undefined ? parcelasAnteriores : input.parcelasFinanceira,
      };
      const mudouPreco = Math.abs(Number(atual.precoUnitario) - input.precoUnitario) >= 0.005;
      const mudouQuantidade = Math.abs(Number(atual.quantidade) - input.quantidade) >= 0.0001;
      const mudouFinanceiro = Math.abs(financeiro.custoFinanceiroPct - custoFinanceiroAnterior) >= 0.0001
        || financeiro.parcelasFinanceira !== parcelasAnteriores;
      if (mudouPreco || mudouQuantidade || mudouFinanceiro || input.configuracao !== undefined) {
        if (!input.aprovacaoPreco || !input.configuracao) {
          throw new Error("Alterar preço, quantidade, composição ou condição financeira exige nova aprovação humana do preço.");
        }
        const [produto] = await db.select({
          nome: produtos.nome,
          categoria: produtos.categoria,
          custoMaoObra: produtos.custoMaoObra,
          idPrecificacao: produtos.idPrecificacao,
        }).from(produtos).where(eq(produtos.id, atual.produtoId));
        const [proposta] = await db.select({ id: propostas.id, vendedorNome: propostas.vendedorNome, vendedorComercialId: propostas.vendedorComercialId })
          .from(propostas).where(eq(propostas.id, atual.propostaId));
        if (!produto || !proposta) throw new Error("Proposta ou produto não encontrado.");
        await validarCustosCatalogo(db, input.configuracao);
        const parametros = await parametrosPrecoProposta(db, proposta, produto, financeiro);
        const contexto = calcularContextoPrecoProposta({
          produto,
          configuracao: input.configuracao,
          precoAtual: input.aprovacaoPreco.contexto.precoAtual,
          taxas: parametros.taxas,
        });
        const aprovacao = verificarAprovacaoPreco({
          recibo: input.aprovacaoPreco.recibo,
          fluxo: "propostas",
          base: {
            propostaId: atual.propostaId,
            produtoId: atual.produtoId,
            quantidade: input.quantidade,
            ...financeiro,
            parametros: parametros.assinatura,
            configuracao: input.configuracao,
          },
          contexto,
          preco: input.precoUnitario,
        });
        const custoMateriais = input.configuracao.materiais.filter((material) => material.incluir)
          .reduce((total, material) => total + material.custoTotal, 0);
        const decupagem = criarSnapshotDecupagem({
          precoVenda: input.precoUnitario,
          quantidadeEmitida: input.quantidade,
          custoMateriais,
          custoMaoObra: produto.custoMaoObra == null ? null : Number(produto.custoMaoObra),
          ...parametros.taxas,
          parcelasFinanceira: financeiro.parcelasFinanceira,
          categoria: produto.categoria,
          vendedorNome: proposta.vendedorNome,
        });
        if (decupagem.complete !== true || Number((decupagem as unknown as DecupagemPreco).lucroLiquido.valor) < 0) {
          throw new Error("A decupagem está incompleta ou a margem líquida é negativa. Revise e aprove novamente o preço.");
        }
        await db
          .update(propostaItens)
          .set({
            quantidade: String(input.quantidade),
            precoUnitario: String(input.precoUnitario),
            ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
            configuracaoJson: { ...input.configuracao, precificacaoIA: { ...aprovacao, contexto } },
            decupagemJson: decupagem,
            custoMaoObraUnitario: produto.custoMaoObra,
          })
          .where(eq(propostaItens.id, input.id));
        return { success: true };
      }
      await db
        .update(propostaItens)
        .set({
          quantidade: String(input.quantidade),
          precoUnitario: String(input.precoUnitario),
          ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
          ...(input.configuracao !== undefined ? { configuracaoJson: input.configuracao } : {}),
        })
        .where(eq(propostaItens.id, input.id));
      return { success: true };
    }),

  grupoCriar: protectedProcedure
    .input(
      z.object({
        propostaId: z.number(),
        itemIds: z.array(z.number()).min(2).max(50).refine((ids) => new Set(ids).size === ids.length, "Itens repetidos"),
        descricao: z.string().max(5000).default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [proposta] = await db
        .select({ id: propostas.id, observacoes: propostas.observacoes })
        .from(propostas)
        .where(eq(propostas.id, input.propostaId));
      if (!proposta || proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) throw new Error("Proposta não encontrada");

      const itens = await db
        .select({ id: propostaItens.id, grupoId: propostaItens.grupoId, ativo: propostaItens.ativo })
        .from(propostaItens)
        .where(and(eq(propostaItens.propostaId, input.propostaId), inArray(propostaItens.id, input.itemIds)));
      if (itens.length !== input.itemIds.length) throw new Error("Um ou mais itens não pertencem a esta proposta");
      if (itens.some((item) => item.grupoId)) throw new Error("Desfaça os grupos existentes antes de agrupar esses itens");
      if (new Set(itens.map((item) => item.ativo)).size > 1) {
        throw new Error("Para agrupar, os itens precisam estar todos ativos ou todos desligados");
      }

      const grupoId = randomUUID();
      await db
        .update(propostaItens)
        .set({ grupoId, grupoDescricao: input.descricao })
        .where(and(eq(propostaItens.propostaId, input.propostaId), inArray(propostaItens.id, input.itemIds)));
      return { success: true, grupoId };
    }),

  grupoAtualizarDescricao: protectedProcedure
    .input(z.object({ propostaId: z.number(), grupoId: z.string().uuid(), descricao: z.string().max(5000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const itens = await db
        .select({ id: propostaItens.id })
        .from(propostaItens)
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      if (itens.length < 2) throw new Error("Grupo não encontrado");
      await db
        .update(propostaItens)
        .set({ grupoDescricao: input.descricao })
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      return { success: true };
    }),

  grupoDesfazer: protectedProcedure
    .input(z.object({ propostaId: z.number(), grupoId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(propostaItens)
        .set({ grupoId: null, grupoDescricao: "" })
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      return { success: true };
    }),

  itemRemover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [item] = await db
        .select({ propostaId: propostaItens.propostaId, grupoId: propostaItens.grupoId })
        .from(propostaItens)
        .where(eq(propostaItens.id, input.id));
      if (item?.grupoId) {
        const membros = await db
          .select({ id: propostaItens.id })
          .from(propostaItens)
          .where(and(eq(propostaItens.propostaId, item.propostaId), eq(propostaItens.grupoId, item.grupoId)));
        if (membros.length === 2) {
          await db
            .update(propostaItens)
            .set({ grupoId: null, grupoDescricao: "" })
            .where(and(eq(propostaItens.propostaId, item.propostaId), eq(propostaItens.grupoId, item.grupoId)));
        }
      }
      await db.delete(propostaItens).where(eq(propostaItens.id, input.id));
      return { success: true };
    }),

  // ─── Configurações comerciais globais (condições + juros) ────────────────
  configuracoesObter: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const config = await obterConfiguracoes(db);
    let jurosParcelamento: Array<{ parcelas: number; jurosPct: number; custoFinanceiroPct: number }> = [];
    try {
      const parsed: unknown = JSON.parse(config.jurosParcelamentoJson || "[]");
      if (Array.isArray(parsed)) jurosParcelamento = parsed.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const parcelas = Number(row.parcelas);
        const jurosPct = Number(row.jurosPct);
        const custoFinanceiroPct = Number(row.custoFinanceiroPct ?? 0);
        return Number.isInteger(parcelas) && parcelas > 0 && [jurosPct, custoFinanceiroPct].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
          ? [{ parcelas, jurosPct, custoFinanceiroPct }]
          : [];
      });
    } catch { /* configuração anterior inválida: inicia sem taxas */ }
    return {
      id: config.id,
      condicoesComerciaisUrl: config.condicoesComerciaisUrl,
      condicoesComerciaisNome: config.condicoesComerciaisNome,
      impostoPct: Number(config.impostoPct),
      custoFixoPct: Number(config.custoFixoPct),
      impostosPorCategoria: lerRegrasTributarias(config.impostosPorCategoriaJson),
      jurosParcelamento,
      updatedAt: config.updatedAt,
    };
  }),

  configuracoesSalvar: adminProcedure
    .input(
      z.object({
        condicoesComerciaisUrl: z.string().optional(),
        condicoesComerciaisNome: z.string().optional(),
        jurosParcelamento: z.array(z.object({ parcelas: z.number().int().min(1), jurosPct: z.number().min(0).max(100), custoFinanceiroPct: z.number().min(0).max(100).optional().default(0) })),
        impostoPct: z.number().min(0).max(100).optional(),
        custoFixoPct: z.number().min(0).max(100).optional(),
        impostosPorCategoria: z.array(z.object({ categoria: z.string().trim().min(1).max(128), impostoPct: z.number().min(0).max(100) })).max(100).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const atual = await obterConfiguracoes(db);
      await db
        .update(configuracoesComerciais)
        .set({
          condicoesComerciaisUrl: input.condicoesComerciaisUrl ?? atual.condicoesComerciaisUrl,
          condicoesComerciaisNome: input.condicoesComerciaisNome ?? atual.condicoesComerciaisNome,
          jurosParcelamentoJson: JSON.stringify(
            [...input.jurosParcelamento].sort((a, b) => a.parcelas - b.parcelas),
          ),
          impostoPct: input.impostoPct == null ? atual.impostoPct : String(input.impostoPct),
          custoFixoPct: input.custoFixoPct == null ? atual.custoFixoPct : String(input.custoFixoPct),
          impostosPorCategoriaJson: input.impostosPorCategoria == null ? atual.impostosPorCategoriaJson : JSON.stringify(input.impostosPorCategoria),
          updatedAt: new Date(),
        })
        .where(eq(configuracoesComerciais.id, atual.id));
      return { success: true };
    }),

  opcoesPagamento: protectedProcedure.use(requireRole("admin", "master", "gestor")).query(async () => {
    const db = await getDb();
    if (!db) return [];
    const config = await obterConfiguracoes(db);
    try {
      const parsed: unknown = JSON.parse(config.jurosParcelamentoJson || "[]");
      return Array.isArray(parsed) ? parsed.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const parcelas = Number(row.parcelas);
        const custoFinanceiroPct = Number(row.custoFinanceiroPct ?? 0);
        return Number.isInteger(parcelas) && parcelas > 0 && Number.isFinite(custoFinanceiroPct) && custoFinanceiroPct >= 0 && custoFinanceiroPct <= 100
          ? [{ parcelas, custoFinanceiroPct }]
          : [];
      }) : [];
    } catch { return []; }
  }),

  vendedoresAtivos: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({ id: vendedoresComerciais.id, nome: vendedoresComerciais.nome })
      .from(vendedoresComerciais).where(eq(vendedoresComerciais.ativo, true)).orderBy(asc(vendedoresComerciais.nome));
  }),

  vendedoresAdminListar: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(vendedoresComerciais).orderBy(asc(vendedoresComerciais.nome));
  }),

  vendedorSalvar: adminProcedure
    .input(z.object({ id: z.number().int().positive().optional(), nome: z.string().trim().min(1).max(256), comissaoPct: z.number().min(0).max(100), ativo: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [duplicado] = await db.select({ id: vendedoresComerciais.id }).from(vendedoresComerciais)
        .where(sql`lower(trim(${vendedoresComerciais.nome})) = lower(trim(${input.nome}))`).limit(1);
      if (duplicado && duplicado.id !== input.id) throw new Error("Já existe um vendedor com esse nome.");
      const dados = { nome: input.nome, comissaoPct: String(input.comissaoPct), ativo: input.ativo, updatedAt: new Date() };
      if (input.id) await db.update(vendedoresComerciais).set(dados).where(eq(vendedoresComerciais.id, input.id));
      else await db.insert(vendedoresComerciais).values(dados);
      return { success: true };
    }),

  vendedorRemover: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(vendedoresComerciais).where(eq(vendedoresComerciais.id, input.id));
      return { success: true };
    }),

  decupagemObter: protectedProcedure.use(requireRole("admin", "master", "gestor"))
    .input(z.object({ propostaId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const [proposta] = await db.select({ id: propostas.id, observacoes: propostas.observacoes }).from(propostas).where(eq(propostas.id, input.propostaId));
      if (!proposta || proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) return [];
      return db.select({ id: propostaItens.id, produtoNome: propostaItens.produtoNome, quantidade: propostaItens.quantidade, precoUnitario: propostaItens.precoUnitario, decupagem: propostaItens.decupagemJson })
        .from(propostaItens).where(eq(propostaItens.propostaId, input.propostaId)).orderBy(asc(propostaItens.ordem));
    }),

  dashboard: protectedProcedure.use(requireRole("admin", "master", "gestor"))
    .input(z.object({ de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const vazio = { propostas: 0, valorEmitido: 0, valorConvertido: 0, margemMediaValor: 0, margemMediaPct: 0, ticketMedio: 0, porMargem: [], produtos: [], materiais: [], servicos: [] as Array<{ nome: string; ocorrencias: number; quantidade: number }>, vendedores: [] };
      if (!db) return vazio;
      const inicio = new Date(`${input.de}T00:00:00`);
      const fim = new Date(`${input.ate}T00:00:00`);
      fim.setDate(fim.getDate() + 1);
      if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || inicio >= fim) throw new Error("Selecione um período válido.");
      const propostasPeriodo = await db.select().from(propostas).where(and(gte(propostas.createdAt, inicio), lt(propostas.createdAt, fim)));
      if (!propostasPeriodo.length) return vazio;
      const idsItens = propostasPeriodo.filter((proposta) => !proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)).map((proposta) => proposta.id);
      const linhas = idsItens.length ? await db.select().from(propostaItens).where(inArray(propostaItens.propostaId, idsItens)) : [];
      const produtoIds = [...new Set(linhas.map((item) => item.produtoId))];
      const categorias = produtoIds.length
        ? await db.select({ id: produtos.id, categoria: produtos.categoria }).from(produtos).where(inArray(produtos.id, produtoIds))
        : [];
      const categoriaPorProduto = new Map(categorias.map((produto) => [produto.id, produto.categoria]));
      type Resumo = { valor: number; valorFechado: number; lucro: number; valorComMargem: number; margemIncompleta: boolean; vendedorNome: string; vendedorId: number | null; aceito: boolean };
      const porProposta = new Map<number, Resumo>();
      for (const proposta of propostasPeriodo) porProposta.set(proposta.id, {
        valor: 0, valorFechado: 0, lucro: 0, valorComMargem: 0,
        margemIncompleta: false, vendedorNome: proposta.vendedorNome,
        vendedorId: proposta.vendedorComercialId, aceito: proposta.status === "aceita",
      });
      const rankingProdutos = new Map<string, { nome: string; ocorrencias: number; valor: number }>();
      const rankingMateriais = new Map<string, { nome: string; ocorrencias: number; quantidade: number }>();
      const rankingServicos = new Map<string, { nome: string; ocorrencias: number; quantidade: number }>();
      for (const proposta of propostasPeriodo) {
        if (!proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) continue;
        const resumo = porProposta.get(proposta.id)!;
        resumo.margemIncompleta = true; // O CPQ tem custo direto próprio, sem os mesmos tributos/comissões da decupagem.
        const snapshot = lerSnapshotEstudio(proposta.observacoes);
        const valor = typeof snapshot?.precoFinal === "number" && Number.isFinite(snapshot.precoFinal) && snapshot.precoFinal >= 0
          ? snapshot.precoFinal : 0;
        resumo.valor = valor;
        resumo.valorFechado = valor;
        const nomeProduto = typeof snapshot?.modeloNome === "string" ? snapshot.modeloNome : "CPQ Letreiros Express";
        const produto = rankingProdutos.get(nomeProduto) ?? { nome: nomeProduto, ocorrencias: 0, valor: 0 };
        produto.ocorrencias++;
        produto.valor += valor;
        rankingProdutos.set(nomeProduto, produto);
        if (Array.isArray(snapshot?.materiais)) for (const linha of snapshot.materiais) {
          if (!linha || typeof linha !== "object" || Array.isArray(linha)) continue;
          const material = linha as Record<string, unknown>;
          if (typeof material.nome !== "string") continue;
          const entrada = rankingMateriais.get(material.nome) ?? { nome: material.nome, ocorrencias: 0, quantidade: 0 };
          entrada.ocorrencias++;
          entrada.quantidade += Number(material.quantidade) || 0;
          rankingMateriais.set(material.nome, entrada);
        }
      }
      for (const item of linhas) {
        const quantidade = Number(item.quantidade);
        const valor = Number(item.precoUnitario) * quantidade;
        const resumo = porProposta.get(item.propostaId)!;
        resumo.valor += valor;
        if (item.ativo) resumo.valorFechado += valor;
        const produto = rankingProdutos.get(item.produtoNome) ?? { nome: item.produtoNome, ocorrencias: 0, valor: 0 };
        produto.ocorrencias++;
        produto.valor += valor;
        rankingProdutos.set(item.produtoNome, produto);
        if (/servi[cç]o|instala[cç][aã]o/i.test(categoriaPorProduto.get(item.produtoId) ?? "")) {
          const servico = rankingServicos.get(item.produtoNome) ?? { nome: item.produtoNome, ocorrencias: 0, quantidade: 0 };
          servico.ocorrencias++;
          servico.quantidade += quantidade;
          rankingServicos.set(item.produtoNome, servico);
        }
        const snapshot = item.decupagemJson as (DecupagemPreco & { complete?: boolean }) | null;
        const quantidadeSnapshot = (snapshot as (DecupagemPreco & { quantidadeEmitida?: number }) | null)?.quantidadeEmitida;
        if (snapshot?.complete === true && Number.isFinite(snapshot.precoVenda)
          && Number.isFinite(snapshot.lucroLiquido?.valor)
          && Math.abs(snapshot.precoVenda - Number(item.precoUnitario)) < 0.005
          && (quantidadeSnapshot == null || Math.abs(quantidadeSnapshot - quantidade) < 0.0001)) {
          resumo.lucro += snapshot.lucroLiquido.valor * quantidade;
          resumo.valorComMargem += snapshot.precoVenda * quantidade;
        } else resumo.margemIncompleta = true;
        const config = item.configuracaoJson as Record<string, unknown>;
        const materiais = Array.isArray(config?.materiais) ? config.materiais : [];
        for (const materialRaw of materiais) {
          if (!materialRaw || typeof materialRaw !== "object") continue;
          const material = materialRaw as Record<string, unknown>;
          if (material.incluir !== true || typeof material.nome !== "string") continue;
          const entrada = rankingMateriais.get(material.nome) ?? { nome: material.nome, ocorrencias: 0, quantidade: 0 };
          entrada.ocorrencias++;
          entrada.quantidade += (Number(material.quantidade) * quantidade) || 0;
          rankingMateriais.set(material.nome, entrada);
        }
      }
      const resumos = [...porProposta.values()];
      const valorEmitido = resumos.reduce((sum, item) => sum + item.valor, 0);
      const valorConvertido = resumos.filter((item) => item.aceito).reduce((sum, item) => sum + item.valorFechado, 0);
      const propostasComMargem = resumos.filter((item) => !item.margemIncompleta && item.valorComMargem > 0);
      const margemMediaValor = propostasComMargem.length ? propostasComMargem.reduce((sum, item) => sum + item.lucro, 0) / propostasComMargem.length : 0;
      const margemMediaPct = propostasComMargem.length ? propostasComMargem.reduce((sum, item) => sum + item.lucro / item.valorComMargem * 100, 0) / propostasComMargem.length : 0;
      const bins = [{ faixa: "< 15%", valor: 0 }, { faixa: "15–30%", valor: 0 }, { faixa: "> 30%", valor: 0 }];
      for (const item of propostasComMargem) {
        const pct = item.lucro / item.valorComMargem * 100;
        bins[pct < 15 ? 0 : pct <= 30 ? 1 : 2].valor += item.valorComMargem;
      }
      const vendedores = new Map<string, { nome: string; propostas: number; fechadas: number; valorOrcado: number; valorFechado: number; lucro: number; valorComMargem: number }>();
      for (const proposta of propostasPeriodo) {
        const resumo = porProposta.get(proposta.id)!;
        const chave = resumo.vendedorId == null ? `nome:${resumo.vendedorNome.trim().toLocaleLowerCase("pt-BR")}` : `id:${resumo.vendedorId}`;
        const vendedor = vendedores.get(chave) ?? { nome: resumo.vendedorNome, propostas: 0, fechadas: 0, valorOrcado: 0, valorFechado: 0, lucro: 0, valorComMargem: 0 };
        vendedor.propostas++;
        vendedor.fechadas += resumo.aceito ? 1 : 0;
        vendedor.valorOrcado += resumo.valor;
        vendedor.valorFechado += resumo.aceito ? resumo.valorFechado : 0;
        if (!resumo.margemIncompleta) {
          vendedor.lucro += resumo.lucro;
          vendedor.valorComMargem += resumo.valorComMargem;
        }
        vendedores.set(chave, vendedor);
      }
      return {
        propostas: propostasPeriodo.length,
        valorEmitido: Math.round(valorEmitido * 100) / 100,
        valorConvertido: Math.round(valorConvertido * 100) / 100,
        margemMediaValor: Math.round(margemMediaValor * 100) / 100,
        margemMediaPct: Math.round(margemMediaPct * 100) / 100,
        ticketMedio: Math.round(valorEmitido / propostasPeriodo.length * 100) / 100,
        porMargem: bins.map((item) => ({ ...item, valor: Math.round(item.valor * 100) / 100 })),
        produtos: [...rankingProdutos.values()].sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 10),
        materiais: [...rankingMateriais.values()].sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 10),
        servicos: [...rankingServicos.values()].sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 10),
        vendedores: [...vendedores.values()].map((item) => ({ ...item, conversaoPct: item.propostas ? Math.round(item.fechadas / item.propostas * 10000) / 100 : 0, margemMediaPct: item.valorComMargem ? Math.round(item.lucro / item.valorComMargem * 10000) / 100 : null })).sort((a, b) => b.valorOrcado - a.valorOrcado),
      };
    }),

  // ─── Público (sem login — posse do link no token é a autorização) ────────
  publico: router({
    obterPorToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [proposta] = await db.select().from(propostas).where(eq(propostas.token, input.token));
        if (!proposta) return null;
        const itens = await carregarItensComProduto(db, proposta.id);
        const config = await obterConfiguracoes(db);
        return {
          proposta: {
            id: proposta.id,
            tituloProposta: proposta.tituloProposta,
            imagemReferenciaUrl: proposta.imagemReferenciaUrl,
            imagemRedesenhadaUrl: proposta.imagemRedesenhadaUrl,
            clienteNome: proposta.clienteNome,
            vendedorNome: proposta.vendedorNome,
            formasPagamento: JSON.parse(proposta.formasPagamentoJson || "[]") as string[],
            condicaoPagamentoObs: proposta.condicaoPagamentoObs,
            status: proposta.status,
            createdAt: proposta.createdAt,
          },
          itens: consolidarItensPublicos(itens),
          valorTotal: calcularTotal(itens),
          prazoFabricacaoDiasUteis: calcularPrazo(itens),
          condicoesComerciaisUrl: config.condicoesComerciaisUrl,
          condicoesComerciaisNome: config.condicoesComerciaisNome,
          jurosParcelamento: (JSON.parse(config.jurosParcelamentoJson || "[]") as Array<{ parcelas?: number; jurosPct?: number }>)
            .filter((item) => Number.isInteger(item.parcelas) && Number.isFinite(item.jurosPct))
            .map((item) => ({ parcelas: item.parcelas!, jurosPct: item.jurosPct! })),
        };
      }),

    toggleItem: publicProcedure
      .input(z.object({ token: z.string().min(1), itemId: z.number(), ativo: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const [proposta] = await db.select({ id: propostas.id }).from(propostas).where(eq(propostas.token, input.token));
        if (!proposta) throw new Error("Proposta não encontrada");
        const [item] = await db
          .select({ id: propostaItens.id, propostaId: propostaItens.propostaId, grupoId: propostaItens.grupoId })
          .from(propostaItens)
          .where(eq(propostaItens.id, input.itemId));
        // O item precisa pertencer à proposta do token — senão qualquer link
        // válido poderia mexer em item de outra proposta pelo id.
        if (!item || item.propostaId !== proposta.id) throw new Error("Item não pertence a esta proposta");
        if (item.grupoId) {
          await db
            .update(propostaItens)
            .set({ ativo: input.ativo })
            .where(and(eq(propostaItens.propostaId, proposta.id), eq(propostaItens.grupoId, item.grupoId)));
        } else {
          await db.update(propostaItens).set({ ativo: input.ativo }).where(eq(propostaItens.id, input.itemId));
        }
        return { success: true };
      }),
  }),
});
