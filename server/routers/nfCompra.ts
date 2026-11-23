import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db/db";
import {
  materiasPrimas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
  estudioChapas,
  nfCompraImportacoes,
  nfCompraItens,
  nfMpVinculos,
} from "../../drizzle/schema";
import { eq, inArray, ilike, or, and, desc, sql, isNotNull } from "drizzle-orm";
import { parseNfXml } from "../services/nfXmlParser";
import {
  sugerirVinculoItem,
  resolverFatorUnidadeParaChapaM2,
  normalizarUnidadeErp,
  type CandidatoMateriaPrima,
  type MemoriaVinculo,
} from "../services/nfSugestaoVinculo";
import { calcularNfCompra, type ItemCalculoEntrada } from "../services/nfCalculo";
import { sincronizarCatalogoMubiSys } from "../services/mubisysEspelho";

function digitosCnpj(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

function normalizarNomeFornecedor(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SA|S A|LTDA|LIMITADA|EIRELI|ME|EPP|MATRIZ|FILIAL)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mesmoFornecedor(
  fornecedorAtual: { cnpjFornecedor?: string | null; nomeFornecedor?: string | null },
  fornecedorAnterior: { cnpjFornecedor?: string | null; nomeFornecedor?: string | null }
): boolean {
  const cnpjAtual = digitosCnpj(fornecedorAtual.cnpjFornecedor);
  const cnpjAnterior = digitosCnpj(fornecedorAnterior.cnpjFornecedor);
  if (cnpjAtual.length === 14 && cnpjAnterior.length === 14) return cnpjAtual === cnpjAnterior;

  const nomeAtual = normalizarNomeFornecedor(fornecedorAtual.nomeFornecedor);
  const nomeAnterior = normalizarNomeFornecedor(fornecedorAnterior.nomeFornecedor);
  return Boolean(nomeAtual && nomeAnterior && nomeAtual === nomeAnterior);
}

function normalizarUnidadeCotacao(unidade: string | null | undefined): string {
  const texto = (unidade ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/²/g, "2");
  if (["UN", "UND", "UNID", "UNIDADE", "PC", "PCS", "PCE", "PECA", "PECAS"].includes(texto)) return "UN";
  if (["KG", "KGS", "KGM"].includes(texto)) return "KG";
  if (["M", "MT", "ML", "METRO", "METROS"].includes(texto)) return "ML";
  if (["M2", "MTS2"].includes(texto)) return "M2";
  if (["L", "LT", "LITRO", "LITROS"].includes(texto)) return "LT";
  if (["CX", "CXS", "CAIXA", "CAIXAS"].includes(texto)) return "CX";
  if (["PCT", "PACOTE", "PACOTES"].includes(texto)) return "PCT";
  if (["RL", "ROLO", "ROLOS"].includes(texto)) return "RL";
  return texto;
}

function tokensDescricao(valor: string | null | undefined): string[] {
  return Array.from(new Set(
    (valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .split(/\s+/)
      .filter(token => token.length >= 2 && !["DE", "DA", "DO", "DAS", "DOS", "COM", "PARA", "POR", "UND"].includes(token))
  ));
}

function pontuarDescricao(a: string, b: string): number {
  const tokensA = tokensDescricao(a);
  const tokensB = tokensDescricao(b);
  if (!tokensA.length || !tokensB.length) return 0;
  const conjuntoB = new Set(tokensB);
  const iguais = tokensA.filter(token => conjuntoB.has(token)).length;
  return (2 * iguais) / (tokensA.length + tokensB.length);
}

function mapearCompraHistorica(row: {
  valorUnitarioOriginal: unknown;
  unidadeCompra: string;
  dataEmissao: string | null;
  dataImportacao: Date;
  fornecedorNome: string | null;
  fornecedorCnpj: string;
}) {
  return {
    precoUnitario: Number(row.valorUnitarioOriginal),
    unidade: row.unidadeCompra,
    data: row.dataEmissao || row.dataImportacao.toISOString().slice(0, 10),
    fornecedor: row.fornecedorNome || "Fornecedor sem nome",
    cnpjFornecedor: row.fornecedorCnpj,
  };
}

function calcularVariacaoCotada(
  precoCotado: number,
  unidadeCotada: string,
  compra: { precoUnitario: number; unidade: string } | null
): number | null {
  if (!compra || compra.precoUnitario <= 0 || precoCotado < 0) return null;
  if (normalizarUnidadeCotacao(unidadeCotada) !== normalizarUnidadeCotacao(compra.unidade)) return null;
  return Number((((precoCotado - compra.precoUnitario) / compra.precoUnitario) * 100).toFixed(2));
}

function resumirComprasCotacao(
  compras: Array<{
    valorUnitarioOriginal: unknown;
    unidadeCompra: string;
    dataEmissao: string | null;
    dataImportacao: Date;
    fornecedorNome: string | null;
    fornecedorCnpj: string;
  }>,
  fornecedorAtual: { cnpjFornecedor?: string | null; nomeFornecedor?: string | null },
  precoCotado: number,
  unidadeCotada: string,
  comprasFornecedor?: Array<{
    valorUnitarioOriginal: unknown;
    unidadeCompra: string;
    dataEmissao: string | null;
    dataImportacao: Date;
    fornecedorNome: string | null;
    fornecedorCnpj: string;
  }>
) {
  const compraAtual = compras[0] ?? null;
  const compraFornecedor = (comprasFornecedor ?? compras).find(compra => mesmoFornecedor(fornecedorAtual, {
    cnpjFornecedor: compra.fornecedorCnpj,
    nomeFornecedor: compra.fornecedorNome,
  })) ?? null;
  const ultimaCompraGeral = compraAtual ? mapearCompraHistorica(compraAtual) : null;
  const ultimaCompraFornecedor = compraFornecedor ? mapearCompraHistorica(compraFornecedor) : null;
  return {
    ultimaCompraFornecedor,
    ultimaCompraGeral,
    variacaoPrecoCotadoVsFornecedor: calcularVariacaoCotada(precoCotado, unidadeCotada, ultimaCompraFornecedor),
    variacaoPrecoCotadoVsUltimaCompra: calcularVariacaoCotada(precoCotado, unidadeCotada, ultimaCompraGeral),
    historicoUnidadeCompativel: Boolean(
      ultimaCompraGeral && normalizarUnidadeCotacao(unidadeCotada) === normalizarUnidadeCotacao(ultimaCompraGeral.unidade)
    ),
  };
}

async function buscarHistoricoComprasCotacao(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  materiaPrimaId: number,
  fornecedorAtual: { cnpjFornecedor?: string | null; nomeFornecedor?: string | null }
) {
  const selecionarCompras = () => db
    .select({
      valorUnitarioOriginal: nfCompraItens.valorUnitario,
      unidadeCompra: nfCompraItens.unidadeCompra,
      dataEmissao: nfCompraImportacoes.dataEmissao,
      dataImportacao: nfCompraImportacoes.createdAt,
      fornecedorNome: nfCompraImportacoes.nomeFornecedor,
      fornecedorCnpj: nfCompraImportacoes.cnpjFornecedor,
    })
    .from(nfCompraItens)
    .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId));
  const filtroBase = and(
    eq(nfCompraItens.materiaPrimaId, materiaPrimaId),
    eq(nfCompraImportacoes.status, "concluida")
  );
  const comprasGerais = await selecionarCompras()
    .where(filtroBase)
    .orderBy(desc(nfCompraImportacoes.createdAt))
    .limit(200);

  let comprasFornecedor = comprasGerais.filter(compra => mesmoFornecedor(fornecedorAtual, {
    cnpjFornecedor: compra.fornecedorCnpj,
    nomeFornecedor: compra.fornecedorNome,
  }));
  const cnpj = digitosCnpj(fornecedorAtual.cnpjFornecedor);
  if (cnpj.length === 14) {
    comprasFornecedor = await selecionarCompras()
      .where(and(
        filtroBase,
        sql`regexp_replace(${nfCompraImportacoes.cnpjFornecedor}, '[^0-9]', '', 'g') = ${cnpj}`
      ))
      .orderBy(desc(nfCompraImportacoes.createdAt))
      .limit(200);
  } else {
    const chaveNome = normalizarNomeFornecedor(fornecedorAtual.nomeFornecedor).split(" ")[0];
    if (chaveNome) {
      const comprasNome = await selecionarCompras()
        .where(and(filtroBase, ilike(nfCompraImportacoes.nomeFornecedor, `%${chaveNome}%`)))
        .orderBy(desc(nfCompraImportacoes.createdAt))
        .limit(200);
      comprasFornecedor = comprasNome.filter(compra => mesmoFornecedor(fornecedorAtual, {
        cnpjFornecedor: compra.fornecedorCnpj,
        nomeFornecedor: compra.fornecedorNome,
      }));
    }
  }

  return { comprasGerais, comprasFornecedor };
}

export const nfCompraRouter = router({
  /**
   * Passo 1: Recebe o XML cru da NF (texto ou payload do upload), faz o parse
   * de cada item (<det>), consulta a memória para aquele fornecedor e devolve
   * a NF estruturada com os itens já pré-sugeridos.
   */
  processarXml: protectedProcedure
    .input(
      z.object({
        xmlConteudo: z.string().min(20, "XML vazio ou inválido"),
        freteModo: z.enum(["gratis", "por_kg", "valor_total"]).default("por_kg"),
        freteValor: z.number().nonnegative().default(0), // se por_kg: R$/kg; se valor_total: R$ total
        percentualIcms: z.number().min(0).max(100).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const nf = parseNfXml(input.xmlConteudo);

      // 1. Buscar memórias existentes para este fornecedor (aprendizado prévio)
      const codigos = nf.itens.map(i => i.codigoFornecedor);
      const memoriasRows = await db
        .select()
        .from(nfMpVinculos)
        .where(
          and(
            eq(nfMpVinculos.cnpjFornecedor, nf.cnpjFornecedor),
            inArray(nfMpVinculos.codigoFornecedor, codigos)
          )
        );

      const memoriasPorCodigo = new Map<string, MemoriaVinculo>();
      for (const m of memoriasRows) {
        memoriasPorCodigo.set(m.codigoFornecedor, {
          materiaPrimaId: m.materiaPrimaId,
          unidadeCompraNf: m.unidadeCompraNf,
          unidadeCompraConversao: m.unidadeCompraConversao,
          unidadeErp: m.unidadeErp as any,
          fatorConversao: Number(m.fatorConversao),
          origemFator: m.origemFator,
          baseCalculoTexto: m.baseCalculoTexto,
          vezesUsado: m.vezesUsado,
        });
      }

      // 2. Para os itens sem memória, tentar achar candidatos pelo nome no cadastro de MPs
      const idsMpsParaCarregar = new Set<number>();
      for (const m of memoriasRows) idsMpsParaCarregar.add(m.materiaPrimaId);

      // Buscar as MPs que estão na memória
      const mpsMemoria = idsMpsParaCarregar.size > 0
        ? await db
            .select()
            .from(materiasPrimas)
            .where(inArray(materiasPrimas.id, Array.from(idsMpsParaCarregar)))
        : [];

      const mpsPorId = new Map(mpsMemoria.map(m => [m.id, m]));

      // Carregar cadastros técnicos das MPs de memória
      const cadTecnicos = idsMpsParaCarregar.size > 0
        ? await db
            .select({
              mpId: materiasPrimas.id,
              mubisysId: materiasPrimas.mubisysMateriaPrimaId,
              catNome: materiaPrimaCategorias.nome,
              usaChapa: materiaPrimaCategorias.usaDadosChapa,
              usaPerfil: materiaPrimaCategorias.usaDadosPerfil,
              usaBobina: materiaPrimaCategorias.usaDadosBobina,
              espessuraMm: materiaPrimaCadastros.espessuraMm,
              densidadeKgM3: materiaPrimaCadastros.densidadeKgM3,
              perfilFormato: materiaPrimaCadastros.perfilFormato,
              perfilAlturaMm: materiaPrimaCadastros.perfilAlturaMm,
              perfilLarguraMm: materiaPrimaCadastros.perfilLarguraMm,
              pesoEspecificoKg: materiaPrimaCadastros.pesoEspecificoKg,
            })
            .from(materiasPrimas)
            .leftJoin(materiaPrimaCadastros, eq(materiaPrimaCadastros.mubisysMateriaPrimaId, materiasPrimas.mubisysMateriaPrimaId))
            .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCategorias.id, materiaPrimaCadastros.categoriaId))
            .where(inArray(materiasPrimas.id, Array.from(idsMpsParaCarregar)))
        : [];

      const cadPorMpId = new Map(cadTecnicos.map(c => [c.mpId, c]));

      // 3. Montar a lista de itens com as sugestões
      const itensComSugestao = nf.itens.map(item => {
        const memoria = memoriasPorCodigo.get(item.codigoFornecedor) ?? null;
        let candidatos: CandidatoMateriaPrima[] = [];

        if (memoria && mpsPorId.has(memoria.materiaPrimaId)) {
          const mp = mpsPorId.get(memoria.materiaPrimaId)!;
          const cad = cadPorMpId.get(mp.id);
          candidatos = [
            {
              id: mp.id,
              nome: mp.nome,
              mubisysMateriaPrimaId: mp.mubisysMateriaPrimaId,
              unidadeMedida: mp.unidadeMedida,
              custoUnitarioCadastrado: mp.custoUnitario ? Number(mp.custoUnitario) : null,
              dadosTecnicos: cad
                ? {
                    tipo: cad.usaPerfil ? "perfil" : cad.usaChapa ? "chapa" : cad.usaBobina ? "bobina" : "outro",
                    espessuraMm: cad.espessuraMm ? Number(cad.espessuraMm) : null,
                    densidadeGCm3: cad.densidadeKgM3 ? Number(cad.densidadeKgM3) / 1000 : null,
                    perfilFormato: cad.perfilFormato,
                    perfilAlturaMm: cad.perfilAlturaMm ? Number(cad.perfilAlturaMm) : null,
                    perfilLarguraMm: cad.perfilLarguraMm ? Number(cad.perfilLarguraMm) : null,
                  }
                : null,
            },
          ];
        }

        const sugestao = sugerirVinculoItem(
          {
            codigoFornecedor: item.codigoFornecedor,
            descricao: item.descricao,
            unidadeCompra: item.unidadeCompra as any,
          },
          memoria,
          candidatos
        );

        return {
          numeroItem: item.numeroItem,
          codigoFornecedor: item.codigoFornecedor,
          descricaoNf: item.descricao,
          ncm: item.ncm,
          unidadeCompra: item.unidadeCompra,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotalItem: item.valorTotalItem,
          valorIpi: item.valorIpi,
          unidadeCompraConversao: sugestao.unidadeCompraConversao,
          unidadeErpCadastro: sugestao.unidadeErp,
          pesoUnitarioFreteKg:
            sugestao.unidadeErp === "UN" && sugestao.fatorConversao === 1 &&
            /^(UN|UND|UNID|PC|PÇ)$/i.test(item.unidadeCompra.trim())
              ? Number(cadPorMpId.get(sugestao.materiaPrimaId ?? -1)?.pesoEspecificoKg ?? 0) || null
              : null,
          // Sugestão resolvida (memória ou vazio)
          materiaPrimaId: sugestao.materiaPrimaId,
          nomeMateriaPrima: sugestao.nomeMateriaPrima,
          unidadeErp: sugestao.unidadeErp,
          fatorConversao: sugestao.fatorConversao,
          origemFator: sugestao.origemFator,
          baseCalculoTexto: sugestao.baseCalculoTexto,
          confianca: sugestao.confianca,
          pendencias: sugestao.pendencias,
          custoCadastrado: candidatos[0]?.custoUnitarioCadastrado ?? null,
          // Dados tecnicos da MP para calculo de peso (frete por kg)
          espessuraMm: candidatos[0]?.dadosTecnicos?.espessuraMm ?? null,
          densidadeKgM3: candidatos[0]?.dadosTecnicos?.densidadeGCm3
            ? Number(candidatos[0].dadosTecnicos.densidadeGCm3) * 1000
            : null,
          larguraMm: candidatos[0]?.dadosTecnicos?.perfilLarguraMm ?? null,
          alturaMm: candidatos[0]?.dadosTecnicos?.perfilAlturaMm ?? null,
          perfilFormato: candidatos[0]?.dadosTecnicos?.perfilFormato ?? null,
        };
      });

      return {
        cabecalho: {
          numero: nf.numero,
          serie: nf.serie,
          chaveAcesso: nf.chaveAcesso,
          dataEmissao: nf.dataEmissao,
          cnpjFornecedor: nf.cnpjFornecedor,
          nomeFornecedor: nf.nomeFornecedor,
          valorProdutos: nf.valorProdutos,
          valorFreteNf: nf.valorFreteNf,
          pesoLiquidoTotalKg: nf.pesoLiquidoTotalKg,
        },
        itens: itensComSugestao,
      };
    }),

  /**
   * Autocomplete/busca de matérias-primas cadastradas no Radrasys (espelho Mubisys).
   * Traz junto os dados técnicos de conversão se já estiverem preenchidos.
   */
  buscarMateriasPrimas: protectedProcedure
    .input(z.object({ busca: z.string().default(""), limite: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const termo = input.busca.trim();
      const rows = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
          catNome: materiaPrimaCategorias.nome,
          usaChapa: materiaPrimaCategorias.usaDadosChapa,
          usaPerfil: materiaPrimaCategorias.usaDadosPerfil,
          usaBobina: materiaPrimaCategorias.usaDadosBobina,
          espessuraMm: materiaPrimaCadastros.espessuraMm,
          densidadeKgM3: materiaPrimaCadastros.densidadeKgM3,
          perfilFormato: materiaPrimaCadastros.perfilFormato,
          perfilAlturaMm: materiaPrimaCadastros.perfilAlturaMm,
          perfilLarguraMm: materiaPrimaCadastros.perfilLarguraMm,
          pesoEspecificoKg: materiaPrimaCadastros.pesoEspecificoKg,
        })
        .from(materiasPrimas)
        .leftJoin(materiaPrimaCadastros, eq(materiaPrimaCadastros.mubisysMateriaPrimaId, materiasPrimas.mubisysMateriaPrimaId))
        .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCategorias.id, materiaPrimaCadastros.categoriaId))
        .where(
          termo ? or(ilike(materiasPrimas.nome, `%${termo}%`), ilike(materiasPrimas.skuErp, `%${termo}%`)) : undefined
        )
        .limit(input.limite);

      return rows.map(r => ({
        id: r.id,
        nome: r.nome,
        mubisysId: r.mubisysId,
        unidadeMedida: r.unidadeMedida,
        custoUnitario: r.custoUnitario ? Number(r.custoUnitario) : null,
        categoria: r.catNome,
        tecnico: {
          tipo: r.usaPerfil ? "perfil" : r.usaChapa ? "chapa" : r.usaBobina ? "bobina" : "outro",
          espessuraMm: r.espessuraMm ? Number(r.espessuraMm) : null,
          densidadeGCm3: r.densidadeKgM3 ? Number(r.densidadeKgM3) / 1000 : null,
          perfilFormato: r.perfilFormato,
          perfilAlturaMm: r.perfilAlturaMm ? Number(r.perfilAlturaMm) : null,
          perfilLarguraMm: r.perfilLarguraMm ? Number(r.perfilLarguraMm) : null,
          pesoEspecificoKg: r.pesoEspecificoKg ? Number(r.pesoEspecificoKg) : null,
        },
      }));
    }),

  /**
   * Simula o cálculo em tempo real quando o usuário edita a linkagem, o frete
   * ou o fator na tela, sem gravar nada ainda.
   */
  calcularPrevia: protectedProcedure
    .input(
      z.object({
        valorMercadoria: z.number().positive(),
        modoRateioFrete: z.enum(["gratis", "por_kg", "valor_total", "total_peso", "total_qtd", "total_valor", "total_valor_ipi"]),
        freteValor: z.number().nonnegative(),
        criterioRateioFrete: z.enum(["peso", "quantidade", "valor"]).optional(),
        baseValorRateioFrete: z.enum(["valor_total", "valor_total_ipi"]).optional(),
        percentualIcms: z.number().min(0).max(100).default(10),
        itens: z.array(
          z.object({
            descricao: z.string(),
            quantidade: z.number().positive(),
            unidadeCompra: z.enum(["KG", "UN", "LT", "ML", "M2"]),
            valorUnitario: z.number().nonnegative(),
            valorTotalItem: z.number().nonnegative(),
            valorIpi: z.number().nonnegative().optional(),
            materiaPrimaId: z.number().optional().nullable(),
            unidadeErp: z.enum(["KG", "ML", "M2", "UN", "LT"]).optional().nullable(),
            fatorConversao: z.number().positive().optional().nullable(),
            custoCadastrado: z.number().nonnegative().optional().nullable(),
            pesoKg: z.number().optional().nullable(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      const criterioRateioFrete = input.criterioRateioFrete ?? (
        input.modoRateioFrete === "total_peso" ? "peso" :
        input.modoRateioFrete === "total_qtd" ? "quantidade" : "valor"
      );
      const baseValorRateioFrete = input.baseValorRateioFrete ?? (
        input.modoRateioFrete === "total_valor_ipi" ? "valor_total_ipi" : "valor_total"
      );
      const modoFrete = input.modoRateioFrete === "gratis"
        ? "gratis"
        : input.modoRateioFrete === "por_kg"
          ? "por_kg"
          : "valor_total";
      const freteValorPorKg = modoFrete === "por_kg" ? input.freteValor : undefined;
      const valorFrete = modoFrete === "valor_total" ? input.freteValor : 0;

      const entradaCalculo: Parameters<typeof calcularNfCompra>[0] = {
        valorMercadoria: input.valorMercadoria,
        valorFrete,
        modoFrete,
        criterioRateioFrete,
        baseValorRateioFrete,
        freteValorPorKg,
        percentualIcms: input.percentualIcms,
        itens: input.itens.map(i => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeCompra: i.unidadeCompra,
          valorUnitario: i.valorUnitario,
          valorTotalItem: i.valorTotalItem,
          valorIpi: i.valorIpi,
          materiaPrimaId: i.materiaPrimaId ?? undefined,
          unidadeErp: i.unidadeErp ?? undefined,
          fatorConversao: i.fatorConversao ?? undefined,
          custoCadastrado: i.custoCadastrado ?? undefined,
          pesoKg: i.pesoKg ?? undefined,
        })),
      };

      return calcularNfCompra(entradaCalculo);
    }),

  /**
   * Confirmação final: grava o cabeçalho, os itens com o cálculo definitivo
   * e faz o upsert na tabela de memória `nf_mp_vinculos` para cada item
   * linkado. É aqui que o sistema "aprende" e fica mais hábil sozinho.
   */
  salvarEGravarMemoria: protectedProcedure
    .input(
      z.object({
        cabecalho: z.object({
          numero: z.string().optional(),
          serie: z.string().optional(),
          chaveAcesso: z.string().optional(),
          cnpjFornecedor: z.string(),
          nomeFornecedor: z.string().optional(),
          dataEmissao: z.string().optional(),
          valorProdutos: z.number(),
          valorFreteNf: z.number().default(0),
          pesoLiquidoTotalKg: z.number().optional().nullable(),
          modoRateioFrete: z.enum(["gratis", "por_kg", "valor_total", "total_peso", "total_qtd", "total_valor", "total_valor_ipi"]),
          freteValorPorKg: z.number().optional().nullable(),
          percentualIcms: z.number().default(10),
          arquivoOriginalUrl: z.string().optional().nullable(),
          arquivoTipo: z.string().optional().nullable(),
        }),
        itens: z.array(
          z.object({
            numeroItem: z.number(),
            codigoFornecedor: z.string(),
            descricaoNf: z.string(),
            ncm: z.string().optional().nullable(),
            unidadeCompra: z.string(),
            unidadeCompraConversao: z.string().optional().nullable(),
            quantidade: z.number(),
            valorUnitario: z.number(),
            valorTotalItem: z.number(),
            materiaPrimaId: z.number().optional().nullable(),
            origemVinculo: z.string().optional().nullable(),
            unidadeErp: z.string().optional().nullable(),
            fatorConversao: z.number().optional().nullable(),
            origemFator: z.string().optional().nullable(),
            baseCalculoTexto: z.string().optional().nullable(),
            rateioFrete: z.number(),
            rateioIcms: z.number(),
            custoItemTotal: z.number(),
            quantidadeErp: z.number().optional().nullable(),
            custoRealErp: z.number(),
            custoCadastradoErp: z.number().optional().nullable(),
            divergenciaPct: z.number().optional().nullable(),
            defasado: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Confere o destino com o espelho atual do MubiSys também no servidor.
      // A tela já faz esta validação; repetir aqui impede gravar uma memória
      // que compare custos em unidades diferentes via chamada direta.
      const idsMps = Array.from(new Set(
        input.itens.flatMap(item => item.materiaPrimaId ? [item.materiaPrimaId] : [])
      ));
      if (idsMps.length > 0) {
        const mps = await db
          .select({ id: materiasPrimas.id, unidadeMedida: materiasPrimas.unidadeMedida })
          .from(materiasPrimas)
          .where(inArray(materiasPrimas.id, idsMps));
        const unidadesPorMp = new Map(mps.map(mp => [mp.id, normalizarUnidadeErp(mp.unidadeMedida)]));
        const destinoDivergente = input.itens.some(item => {
          if (!item.materiaPrimaId || !item.unidadeErp) return false;
          const unidadeAtual = unidadesPorMp.get(item.materiaPrimaId);
          return !unidadeAtual || normalizarUnidadeErp(item.unidadeErp) !== unidadeAtual;
        });
        if (destinoDivergente) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O destino da conversão precisa corresponder à unidade atual da matéria-prima no MubiSys.",
          });
        }
      }

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      // 1. Gravar cabeçalho
      const [importacao] = await db
        .insert(nfCompraImportacoes)
        .values({
          numero: input.cabecalho.numero ?? null,
          serie: input.cabecalho.serie ?? null,
          chaveAcesso: input.cabecalho.chaveAcesso ?? null,
          cnpjFornecedor: input.cabecalho.cnpjFornecedor,
          nomeFornecedor: input.cabecalho.nomeFornecedor ?? null,
          dataEmissao: input.cabecalho.dataEmissao ?? null,
          valorProdutos: String(input.cabecalho.valorProdutos),
          valorFreteNf: String(input.cabecalho.valorFreteNf),
          pesoLiquidoTotalKg: input.cabecalho.pesoLiquidoTotalKg ? String(input.cabecalho.pesoLiquidoTotalKg) : null,
          modoRateioFrete: input.cabecalho.modoRateioFrete,
          freteValorPorKg: input.cabecalho.freteValorPorKg ? String(input.cabecalho.freteValorPorKg) : null,
          percentualIcms: String(input.cabecalho.percentualIcms),
          arquivoOriginalUrl: input.cabecalho.arquivoOriginalUrl ?? null,
          arquivoTipo: input.cabecalho.arquivoTipo ?? null,
          status: "concluida",
          criadoPor: userId,
          concluidoEm: new Date(),
        })
        .returning();

      // 2. Gravar itens da importação
      for (const item of input.itens) {
        await db.insert(nfCompraItens).values({
          importacaoId: importacao.id,
          numeroItem: item.numeroItem,
          codigoFornecedor: item.codigoFornecedor,
          descricaoNf: item.descricaoNf,
          ncm: item.ncm ?? null,
          unidadeCompra: item.unidadeCompra,
          unidadeCompraConversao: item.unidadeCompraConversao ?? item.unidadeCompra,
          quantidade: String(item.quantidade),
          valorUnitario: String(item.valorUnitario),
          valorTotalItem: String(item.valorTotalItem),
          materiaPrimaId: item.materiaPrimaId ?? null,
          origemVinculo: item.origemVinculo ?? null,
          unidadeErp: item.unidadeErp ?? null,
          fatorConversao: item.fatorConversao ? String(item.fatorConversao) : null,
          origemFator: item.origemFator ?? null,
          baseCalculoTexto: item.baseCalculoTexto ?? null,
          rateioFrete: String(item.rateioFrete),
          rateioIcms: String(item.rateioIcms),
          custoItemTotal: String(item.custoItemTotal),
          quantidadeErp: item.quantidadeErp ? String(item.quantidadeErp) : null,
          custoRealErp: String(item.custoRealErp),
          custoCadastradoErp: item.custoCadastradoErp ? String(item.custoCadastradoErp) : null,
          divergenciaPct: item.divergenciaPct ? String(item.divergenciaPct) : null,
          defasado: item.defasado,
        });

        // 3. MEMÓRIA: se o item foi linkado a uma MP com fator válido, salvar/atualizar
        if (item.materiaPrimaId && item.unidadeErp && item.fatorConversao) {
          const valoresMemoria = {
            cnpjFornecedor: input.cabecalho.cnpjFornecedor,
            codigoFornecedor: item.codigoFornecedor,
            descricaoReferencia: item.descricaoNf,
            materiaPrimaId: item.materiaPrimaId,
            unidadeCompraNf: item.unidadeCompra,
            unidadeCompraConversao: item.unidadeCompraConversao ?? item.unidadeCompra,
            unidadeErp: item.unidadeErp,
            fatorConversao: String(item.fatorConversao),
            origemFator: item.origemFator ?? "manual",
            baseCalculoTexto: item.baseCalculoTexto ?? null,
            confirmadoPor: userId,
            updatedAt: new Date(),
          };

          // Upsert por (cnpjFornecedor, codigoFornecedor)
          await db
            .insert(nfMpVinculos)
            .values({ ...valoresMemoria, vezesUsado: 1 })
            .onConflictDoUpdate({
              target: [nfMpVinculos.cnpjFornecedor, nfMpVinculos.codigoFornecedor],
              set: {
                ...valoresMemoria,
                vezesUsado: sql`${nfMpVinculos.vezesUsado} + 1`,
              },
            });
        }
      }

      return { importacaoId: importacao.id, ok: true };
    }),

  /**
   * Painel de Auditoria da Memória: lista todos os vínculos aprendidos
   * para um fornecedor, mostrando o cálculo guardado para conferência.
   */
  listarMemoriaPorFornecedor: protectedProcedure
    .input(z.object({ cnpjFornecedor: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db
        .select({
          id: nfMpVinculos.id,
          cnpjFornecedor: nfMpVinculos.cnpjFornecedor,
          codigoFornecedor: nfMpVinculos.codigoFornecedor,
          descricaoReferencia: nfMpVinculos.descricaoReferencia,
          materiaPrimaId: nfMpVinculos.materiaPrimaId,
          nomeMateriaPrima: materiasPrimas.nome,
          unidadeCompraNf: nfMpVinculos.unidadeCompraNf,
          unidadeCompraConversao: nfMpVinculos.unidadeCompraConversao,
          unidadeErp: nfMpVinculos.unidadeErp,
          fatorConversao: nfMpVinculos.fatorConversao,
          origemFator: nfMpVinculos.origemFator,
          baseCalculoTexto: nfMpVinculos.baseCalculoTexto,
          vezesUsado: nfMpVinculos.vezesUsado,
          updatedAt: nfMpVinculos.updatedAt,
        })
        .from(nfMpVinculos)
        .innerJoin(materiasPrimas, eq(materiasPrimas.id, nfMpVinculos.materiaPrimaId))
        .orderBy(desc(nfMpVinculos.updatedAt));

      if (input.cnpjFornecedor) {
        return query.where(eq(nfMpVinculos.cnpjFornecedor, input.cnpjFornecedor));
      }
      return query.limit(100);
    }),

  /**
   * Histórico de NFs importadas e conferidas.
   */
  listarImportacoes: protectedProcedure
    .input(z.object({ limite: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(nfCompraImportacoes)
        .orderBy(desc(nfCompraImportacoes.createdAt))
        .limit(input.limite);
    }),

  /**
   * Função 1 para o Comprador: Histórico de Compras de uma Matéria-Prima
   * Mostra se o sistema já processou a MP, qual foi o último preço pago na unidade
   * original da NF (ex: R$/kg) e histórico das compras passadas.
   */
  historicoPorMateriaPrima: protectedProcedure
    .input(z.object({ materiaPrimaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Buscar cadastro atual da MP no Mubisys
      const [mp] = await db
        .select()
        .from(materiasPrimas)
        .where(eq(materiasPrimas.id, input.materiaPrimaId))
        .limit(1);

      if (!mp) return null;

      // Buscar todos os itens de NF que foram vinculados a essa MP
      const itensComprados = await db
        .select({
          itemId: nfCompraItens.id,
          numeroItem: nfCompraItens.numeroItem,
          codigoFornecedor: nfCompraItens.codigoFornecedor,
          descricaoNf: nfCompraItens.descricaoNf,
          quantidade: nfCompraItens.quantidade,
          unidadeCompra: nfCompraItens.unidadeCompra,
          valorUnitarioOriginal: nfCompraItens.valorUnitario,
          valorTotalItem: nfCompraItens.valorTotalItem,
          custoRealErp: nfCompraItens.custoRealErp,
          custoCadastradoErp: nfCompraItens.custoCadastradoErp,
          unidadeErp: nfCompraItens.unidadeErp,
          fatorConversao: nfCompraItens.fatorConversao,
          divergenciaPct: nfCompraItens.divergenciaPct,
          baseCalculoTexto: nfCompraItens.baseCalculoTexto,
          // Dados da NF
          numeroNf: nfCompraImportacoes.numero,
          fornecedorNome: nfCompraImportacoes.nomeFornecedor,
          fornecedorCnpj: nfCompraImportacoes.cnpjFornecedor,
          dataEmissao: nfCompraImportacoes.dataEmissao,
          dataImportacao: nfCompraImportacoes.createdAt,
        })
        .from(nfCompraItens)
        .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
        .where(eq(nfCompraItens.materiaPrimaId, input.materiaPrimaId))
        .orderBy(desc(nfCompraImportacoes.createdAt))
        .limit(20);

      const ultimaCompra = itensComprados[0] ?? null;

      return {
        materiaPrima: {
          id: mp.id,
          nome: mp.nome,
          mubisysId: mp.mubisysMateriaPrimaId,
          unidadeMedida: mp.unidadeMedida,
          custoUnitarioAtual: mp.custoUnitario ? Number(mp.custoUnitario) : null,
          referenciaCusto: mp.referenciaCusto,
        },
        jaProcessado: itensComprados.length > 0,
        totalComprasRegistradas: itensComprados.length,
        ultimaCompra: ultimaCompra
          ? {
              data: ultimaCompra.dataEmissao || ultimaCompra.dataImportacao,
              fornecedor: ultimaCompra.fornecedorNome,
              precoUnitarioOriginal: Number(ultimaCompra.valorUnitarioOriginal),
              unidadeOriginal: ultimaCompra.unidadeCompra,
              custoRealErp: Number(ultimaCompra.custoRealErp),
              unidadeErp: ultimaCompra.unidadeErp,
              divergenciaPct: Number(ultimaCompra.divergenciaPct),
            }
          : null,
        historico: itensComprados.map(i => ({
          ...i,
          quantidade: Number(i.quantidade),
          valorUnitarioOriginal: Number(i.valorUnitarioOriginal),
          valorTotalItem: Number(i.valorTotalItem),
          custoRealErp: Number(i.custoRealErp),
          custoCadastradoErp: i.custoCadastradoErp ? Number(i.custoCadastradoErp) : null,
          divergenciaPct: i.divergenciaPct ? Number(i.divergenciaPct) : null,
        })),
      };
    }),

  /**
   * Purchase history summary for an item linked manually in the quote.
   */
  historicoCotacaoPorMateriaPrima: protectedProcedure
    .input(z.object({
      materiaPrimaId: z.number().int().positive(),
      cnpjFornecedor: z.string().optional(),
      fornecedor: z.string().optional(),
      precoCotado: z.number().nonnegative(),
      unidadeCotada: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const fornecedorAtual = {
        cnpjFornecedor: input.cnpjFornecedor,
        nomeFornecedor: input.fornecedor,
      };
      const { comprasGerais, comprasFornecedor } = await buscarHistoricoComprasCotacao(
        db,
        input.materiaPrimaId,
        fornecedorAtual
      );

      return resumirComprasCotacao(
        comprasGerais,
        fornecedorAtual,
        input.precoCotado,
        input.unidadeCotada,
        comprasFornecedor
      );
    }),

  analisarCotacaoPdf: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string().min(100, "Arquivo PDF em base64 obrigatório"),
        nomeArquivo: z.string().default("cotacao.pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const { extrairCotacaoDePdf } = await import("../services/nfCotacaoPdf");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const buffer = Buffer.from(input.pdfBase64, "base64");
      const cotacao = await extrairCotacaoDePdf(buffer, input.nomeArquivo);

      // Carregar todas as MPs para busca de correspondência por similaridade de nome
      const todasMps = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
        })
        .from(materiasPrimas)
        .where(eq(materiasPrimas.ativa, true));

      const fornecedorAtual = {
        cnpjFornecedor: cotacao.cnpjFornecedor,
        nomeFornecedor: cotacao.fornecedor,
      };
      const catalogoPorId = new Map(todasMps.map(mp => [mp.id, mp]));

      // Para cada item da cotação, buscar histórico de última compra e comparar
      const itensAnalisados = await Promise.all(
        cotacao.itens.map(async itemCotado => {
          const tokensBusca = tokensDescricao(itemCotado.descricao).filter(token => token.length >= 3).slice(0, 8);
          const condicoesHistorico = [
            ...(itemCotado.codigo?.trim() ? [eq(nfCompraItens.codigoFornecedor, itemCotado.codigo.trim())] : []),
            ...tokensBusca.map(token => ilike(nfCompraItens.descricaoNf, `%${token}%`)),
          ];
          const cnpjCotacao = digitosCnpj(cotacao.cnpjFornecedor);
          const chaveNomeFornecedor = normalizarNomeFornecedor(cotacao.fornecedor).split(" ")[0];
          const comprasCodigoFornecedor = itemCotado.codigo?.trim() && cnpjCotacao.length === 14
            ? await db
                .select({
                  materiaPrimaId: nfCompraItens.materiaPrimaId,
                  codigoFornecedor: nfCompraItens.codigoFornecedor,
                  descricaoNf: nfCompraItens.descricaoNf,
                  cnpjFornecedor: nfCompraImportacoes.cnpjFornecedor,
                  fornecedorNome: nfCompraImportacoes.nomeFornecedor,
                })
                .from(nfCompraItens)
                .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
                .where(and(
                  eq(nfCompraImportacoes.status, "concluida"),
                  isNotNull(nfCompraItens.materiaPrimaId),
                  eq(nfCompraItens.codigoFornecedor, itemCotado.codigo.trim()),
                  sql`regexp_replace(${nfCompraImportacoes.cnpjFornecedor}, '[^0-9]', '', 'g') = ${cnpjCotacao}`
                ))
                .orderBy(desc(nfCompraImportacoes.createdAt))
                .limit(50)
            : itemCotado.codigo?.trim() && chaveNomeFornecedor
              ? await db
                  .select({
                    materiaPrimaId: nfCompraItens.materiaPrimaId,
                    codigoFornecedor: nfCompraItens.codigoFornecedor,
                    descricaoNf: nfCompraItens.descricaoNf,
                    cnpjFornecedor: nfCompraImportacoes.cnpjFornecedor,
                    fornecedorNome: nfCompraImportacoes.nomeFornecedor,
                  })
                  .from(nfCompraItens)
                  .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
                  .where(and(
                    eq(nfCompraImportacoes.status, "concluida"),
                    isNotNull(nfCompraItens.materiaPrimaId),
                    eq(nfCompraItens.codigoFornecedor, itemCotado.codigo.trim()),
                    ilike(nfCompraImportacoes.nomeFornecedor, `%${chaveNomeFornecedor}%`)
                  ))
                  .orderBy(desc(nfCompraImportacoes.createdAt))
                  .limit(50)
              : [];
          const comprasParaCorrespondencia = condicoesHistorico.length
            ? await db
                .select({
                  materiaPrimaId: nfCompraItens.materiaPrimaId,
                  codigoFornecedor: nfCompraItens.codigoFornecedor,
                  descricaoNf: nfCompraItens.descricaoNf,
                  cnpjFornecedor: nfCompraImportacoes.cnpjFornecedor,
                  fornecedorNome: nfCompraImportacoes.nomeFornecedor,
                })
                .from(nfCompraItens)
                .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
                .where(and(
                  eq(nfCompraImportacoes.status, "concluida"),
                  isNotNull(nfCompraItens.materiaPrimaId),
                  or(...condicoesHistorico)
                ))
                .orderBy(desc(nfCompraImportacoes.createdAt))
                .limit(300)
            : [];

          const candidatosPorId = new Map<number, { pontuacao: number; origem: string }>();
          const codigosExatosDoFornecedor = new Set<number>();
          for (const compra of [...comprasCodigoFornecedor, ...comprasParaCorrespondencia]) {
            if (compra.materiaPrimaId == null) continue;
            const fornecedorIgual = mesmoFornecedor(fornecedorAtual, {
              cnpjFornecedor: compra.cnpjFornecedor,
              nomeFornecedor: compra.fornecedorNome,
            });
            const codigoIgual = Boolean(
              fornecedorIgual && itemCotado.codigo?.trim() &&
              compra.codigoFornecedor.trim().toUpperCase() === itemCotado.codigo.trim().toUpperCase()
            );
            const pontuacaoTexto = pontuarDescricao(itemCotado.descricao, compra.descricaoNf);
            const pontuacao = codigoIgual ? 2 : pontuacaoTexto;
            if (codigoIgual) codigosExatosDoFornecedor.add(compra.materiaPrimaId);
            const origem = codigoIgual
              ? "código do fornecedor"
              : fornecedorIgual
                ? "histórico deste fornecedor"
                : "histórico de outros fornecedores";
            const anterior = candidatosPorId.get(compra.materiaPrimaId);
            if (!anterior || pontuacao > anterior.pontuacao) {
              candidatosPorId.set(compra.materiaPrimaId, { pontuacao, origem });
            }
          }

          for (const mp of todasMps) {
            const pontuacao = pontuarDescricao(itemCotado.descricao, mp.nome);
            const anterior = candidatosPorId.get(mp.id);
            if (!anterior || pontuacao > anterior.pontuacao) {
              candidatosPorId.set(mp.id, { pontuacao, origem: "cadastro de matérias-primas" });
            }
          }

          const candidatosOrdenados = Array.from(candidatosPorId.entries())
            .filter(([id, candidato]) => catalogoPorId.has(id) && candidato.pontuacao > 0)
            .sort((a, b) => b[1].pontuacao - a[1].pontuacao);
          const candidatosCodigo = candidatosOrdenados.filter(([id]) => codigosExatosDoFornecedor.has(id));
          const topo = candidatosOrdenados[0] ?? null;
          const segundo = candidatosOrdenados[1] ?? null;
          const margem = topo ? topo[1].pontuacao - (segundo?.[1].pontuacao ?? 0) : 0;
          let idVinculado: number | null = null;
          if (candidatosCodigo.length === 1) {
            idVinculado = candidatosCodigo[0][0];
          } else if (candidatosCodigo.length === 0 && topo) {
            const limite = topo[1].origem === "histórico deste fornecedor" ? 0.62 : 0.78;
            if (topo[1].pontuacao >= limite && (segundo == null || margem >= 0.12)) {
              idVinculado = topo[0];
            }
          }

          const melhorMp = idVinculado == null ? null : catalogoPorId.get(idVinculado) ?? null;
          const origemVinculo = idVinculado == null
            ? null
            : candidatosPorId.get(idVinculado)?.origem ?? null;
          let comprasResumo = {
            ultimaCompraFornecedor: null as ReturnType<typeof mapearCompraHistorica> | null,
            ultimaCompraGeral: null as ReturnType<typeof mapearCompraHistorica> | null,
            variacaoPrecoCotadoVsFornecedor: null as number | null,
            variacaoPrecoCotadoVsUltimaCompra: null as number | null,
            historicoUnidadeCompativel: false,
          };
          let variacaoPrecoCotadoVsMubisys: number | null = null;

          if (melhorMp) {
            const { comprasGerais, comprasFornecedor } = await buscarHistoricoComprasCotacao(
              db,
              melhorMp.id,
              fornecedorAtual
            );
            comprasResumo = resumirComprasCotacao(
              comprasGerais,
              fornecedorAtual,
              itemCotado.precoUnitario,
              itemCotado.unidade,
              comprasFornecedor
            );

            const custoErp = melhorMp.custoUnitario ? Number(melhorMp.custoUnitario) : null;
            if (
              custoErp && custoErp > 0 &&
              normalizarUnidadeCotacao(melhorMp.unidadeMedida) === normalizarUnidadeCotacao(itemCotado.unidade)
            ) {
              variacaoPrecoCotadoVsMubisys = Number(
                (((itemCotado.precoUnitario - custoErp) / custoErp) * 100).toFixed(2)
              );
            }
          }

          return {
            ...itemCotado,
            materiaPrimaVinculada: melhorMp
              ? {
                  id: melhorMp.id,
                  nome: melhorMp.nome,
                  mubisysId: melhorMp.mubisysId,
                  custoUnitarioMubisys: melhorMp.custoUnitario ? Number(melhorMp.custoUnitario) : null,
                  unidadeMubisys: melhorMp.unidadeMedida,
                }
              : null,
            candidatosMateriaPrima: candidatosOrdenados.slice(0, 5).map(([id, candidato]) => ({
              id,
              nome: catalogoPorId.get(id)!.nome,
              origem: candidato.origem,
              pontuacao: Number(candidato.pontuacao.toFixed(3)),
            })),
            origemVinculo,
            ...comprasResumo,
            variacaoPrecoCotadoVsMubisys,
            semHistoricoCompras: Boolean(melhorMp && !comprasResumo.ultimaCompraGeral),
          };
        })
      );
      return {
        fornecedor: cotacao.fornecedor,
        cnpjFornecedor: cotacao.cnpjFornecedor,
        dataCotacao: cotacao.dataCotacao,
        valorTotalCotado: cotacao.valorTotal,
        itens: itensAnalisados,
      };
    }),

  /**
   * Função 3 para o Comprador / Gestor: Painel Inteligente de Defasagens
   * Agrega estatísticas completas das divergências de preços entre o custo real
   * das NFs e o valor cadastrado no Mubisys.
   */
  obterPainelDivergencias: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    // Buscar todos os itens de NF que foram vinculados e calculados
    const itens = await db
      .select({
        id: nfCompraItens.id,
        materiaPrimaId: nfCompraItens.materiaPrimaId,
        descricaoNf: nfCompraItens.descricaoNf,
        custoRealErp: nfCompraItens.custoRealErp,
        custoCadastradoErp: nfCompraItens.custoCadastradoErp,
        divergenciaPct: nfCompraItens.divergenciaPct,
        defasado: nfCompraItens.defasado,
        unidadeErp: nfCompraItens.unidadeErp,
        dataImportacao: nfCompraImportacoes.createdAt,
        fornecedorNome: nfCompraImportacoes.nomeFornecedor,
        mpNome: materiasPrimas.nome,
        mpMubisysId: materiasPrimas.mubisysMateriaPrimaId,
      })
      .from(nfCompraItens)
      .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
      .leftJoin(materiasPrimas, eq(materiasPrimas.id, nfCompraItens.materiaPrimaId))
      .where(sql`${nfCompraItens.materiaPrimaId} IS NOT NULL AND ${nfCompraItens.divergenciaPct} IS NOT NULL`)
      .orderBy(desc(nfCompraImportacoes.createdAt));

    if (itens.length === 0) {
      return {
        totalItensAuditados: 0,
        defasagemMediaGeralPct: 0,
        faixas: [],
        maioresDivergencias: [],
      };
    }

    const divergencias = itens.map(i => Number(i.divergenciaPct));
    const somaDivergencias = divergencias.reduce((a, b) => a + b, 0);
    const mediaGeral = somaDivergencias / divergencias.length;

    // Distribuição por faixas percentuais
    let faixaMaisDe25 = 0; // Crítico: mercado subiu > 25% acima do Mubisys
    let faixa10a25 = 0;   // Alto: subiu 10% a 25%
    let faixa2a10 = 0;    // Moderado: subiu 2% a 10%
    let faixaEstavel = 0; // Estável: entre -2% e +2%
    let faixaMaisBarato = 0; // Mercado está mais barato que o Mubisys (< -2%)

    for (const d of divergencias) {
      if (d > 25) faixaMaisDe25++;
      else if (d >= 10) faixa10a25++;
      else if (d >= 2) faixa2a10++;
      else if (d >= -2) faixaEstavel++;
      else faixaMaisBarato++;
    }

    const total = itens.length;
    const faixas = [
      {
        faixa: "Crítica (+25% ou mais defasado no Mubisys)",
        cor: "vermelho_escuro",
        quantidade: faixaMaisDe25,
        percentualItens: Number(((faixaMaisDe25 / total) * 100).toFixed(1)),
        descricao: "Preço de mercado muito acima do cadastro do ERP. Risco de prejuízo direto em cotações!",
      },
      {
        faixa: "Alta (+10% a +25% defasado)",
        cor: "laranja",
        quantidade: faixa10a25,
        percentualItens: Number(((faixa10a25 / total) * 100).toFixed(1)),
        descricao: "Recomenda-se ajuste rápido no Mubisys.",
      },
      {
        faixa: "Moderada (+2% a +10% defasado)",
        cor: "amarelo",
        quantidade: faixa2a10,
        percentualItens: Number(((faixa2a10 / total) * 100).toFixed(1)),
        descricao: "Pequena defasagem acumulada.",
      },
      {
        faixa: "Estável (-2% a +2%)",
        cor: "verde",
        quantidade: faixaEstavel,
        percentualItens: Number(((faixaEstavel / total) * 100).toFixed(1)),
        descricao: "Custo cadastrado no Mubisys condiz com as compras reais.",
      },
      {
        faixa: "Mercado mais barato que o Mubisys (abaixo de -2%)",
        cor: "azul",
        quantidade: faixaMaisBarato,
        percentualItens: Number(((faixaMaisBarato / total) * 100).toFixed(1)),
        descricao: "Você pagou menos na NF do que está cadastrado. Propostas podem estar com preço acima do mercado.",
      },
    ];

    // Ordenar itens com maiores desvios absolutos
    const maioresDivergencias = [...itens]
      .sort((a, b) => Math.abs(Number(b.divergenciaPct)) - Math.abs(Number(a.divergenciaPct)))
      .slice(0, 10)
      .map(i => ({
        id: i.id,
        materiaPrimaNome: i.mpNome || i.descricaoNf,
        mubisysId: i.mpMubisysId,
        fornecedor: i.fornecedorNome,
        data: i.dataImportacao,
        custoRealErp: Number(i.custoRealErp),
        custoCadastradoErp: Number(i.custoCadastradoErp),
        unidadeErp: i.unidadeErp,
        divergenciaPct: Number(i.divergenciaPct),
      }));

    return {
      totalItensAuditados: total,
      defasagemMediaGeralPct: Number(mediaGeral.toFixed(2)),
      faixas,
      maioresDivergencias,
    };
  }),
  sincronizarEspelhoMubiSys: protectedProcedure.mutation(async ({ ctx }) => {
    const role = String(ctx.user?.role ?? "");
    if (!["admin", "master", "gestor"].includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Somente gestor, admin ou master pode atualizar o espelho do MubiSys.",
      });
    }
    const resultado = await sincronizarCatalogoMubiSys();
    return { ok: true, ...resultado };
  }),
  buscarMateriasPrimasPorIds: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
          ativa: materiasPrimas.ativa,
        })
        .from(materiasPrimas)
        .where(inArray(materiasPrimas.id, input.ids));
      return rows.map(row => ({
        ...row,
        custoUnitario: row.custoUnitario == null ? null : Number(row.custoUnitario),
      }));
    }),
});
