import { and, eq, inArray } from "drizzle-orm";
import {
  estudioCotacaoSnapshots,
  metasComerciais,
  metasOperacionais,
  mubisysVendasItens,
  mubisysVariacoes,
  priceTableAffiliations,
  priceTableBlockPairs,
  priceTableMeta,
  priceTableSections,
} from "../../drizzle/schema";
import { getDb } from "../db/db";
import { obterCurvaVendasMubiSys } from "./mubisysVendas";

type Table = "principal" | "novo_cliente";
export type PriceRevenueAnalysisRow = {
  tabela: string;
  sectionId: number;
  bloco: string;
  productId: number | null;
  produto: string;
  modelId: number | null;
  modelo: string;
  categoria: string | null;
  classeAbc: "A" | "B" | "C" | null;
  linha?: string;
  faixa: string;
  margemAtualPct: number | null;
  margemCotadaPct?: number | null;
  precoCotado: number | null;
  faturamentoRealizado: number | null;
  faturamentoPrevisto: number | null;
  contribuicaoMetaPct: number | null;
  versaoTabela: string | null;
  versoesCotacoes: string | null;
  amostrasCotacao: number;
  origemPreco?: string;
  situacao: string;
};
export type PriceRevenueAnalysis = {
  periodo: {
    mes: number;
    ano: number;
    diasDecorridos: number;
    diasRestantes: number;
  };
  meta: number | null;
  realizado: number;
  previsto: number | null;
  diferencaMeta: number | null;
  diferencaMetaPct: number | null;
  ritmoDiarioNecessario: number | null;
  ritmoDiarioAtual: number | null;
  coberturaAfiliaçãoPct: number;
  abc: Array<{ classe: "A" | "B" | "C"; faturamento: number }>;
  categorias: Array<{
    categoria: string;
    faturamento: number;
    previsto: number | null;
  }>;
  rows: PriceRevenueAnalysisRow[];
  receitaSemAfiliação: number;
  receitaComAtribuiçãoAmbígua: number;
  sincronizadoEm: Date | null;
  dadosDesatualizados: boolean;
  erroSync: string | null;
  versaoAtual: string | null;
  fontes: string[];
  limitacoes: string[];
};
function snapshotMatchesItem(
  snapshotJson: string,
  productId: number,
  modelId: number | null
): boolean {
  try {
    const snapshot = JSON.parse(snapshotJson) as {
      mubisysProdutoId?: unknown;
      mubisysModeloId?: unknown;
    };
    return (
      snapshot.mubisysProdutoId === productId &&
      (snapshot.mubisysModeloId ?? null) === modelId
    );
  } catch {
    return false;
  }
}
const percentual = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

/** Análise comum dos painéis: receita vinculada somente por IDs ERP e afiliações cadastradas. */
export async function obterAnaliseReceitaTabela(input: {
  mes: number;
  ano: number;
  tabela?: Table;
  sectionId?: number;
  produtoId?: number;
  modeloId?: number;
}): Promise<PriceRevenueAnalysis> {
  const db = await getDb();
  if (!db) throw new Error("Banco local indisponível.");
  const [
    sections,
    pairs,
    affiliations,
    catalog,
    metas,
    fallbackRows,
    versions,
  ] = await Promise.all([
    db.select().from(priceTableSections),
    db.select().from(priceTableBlockPairs),
    db.select().from(priceTableAffiliations),
    db.select().from(mubisysVariacoes),
    db
      .select()
      .from(metasComerciais)
      .where(
        and(
          eq(metasComerciais.mes, input.mes),
          eq(metasComerciais.ano, input.ano)
        )
      ),
    db
      .select()
      .from(metasOperacionais)
      .where(eq(metasOperacionais.ativo, true)),
    db.select().from(priceTableMeta).limit(1),
  ]);
  let curvaItens: Array<{
    produtoId: number | null;
    modeloId: number | null;
    variacaoId: number | null;
    classe: "A" | "B" | "C";
  }> = [];
  let sincronizadoEm: Date | null = null;
  let dadosDesatualizados = false;
  let erroSync: string | null = null;
  try {
    const curva = await obterCurvaVendasMubiSys(input.mes, input.ano);
    curvaItens = curva.itens;
    sincronizadoEm = curva.sincronizadoEm;
    dadosDesatualizados = curva.stale;
    erroSync = curva.syncError ?? null;
  } catch (error) {
    dadosDesatualizados = true;
    erroSync =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar as vendas MubiSys.";
  }
  const vendas = await db
    .select()
    .from(mubisysVendasItens)
    .where(
      and(
        eq(mubisysVendasItens.mes, input.mes),
        eq(mubisysVendasItens.ano, input.ano)
      )
    );
  const osIdsPeriodo = [...new Set(vendas.map(v => v.osId))];
  const snapshots = osIdsPeriodo.length
    ? await db
        .select()
        .from(estudioCotacaoSnapshots)
        .where(inArray(estudioCotacaoSnapshots.mubisysOsId, osIdsPeriodo))
    : [];
  const pairForSection = new Map<number, number>();
  for (const pair of pairs) {
    pairForSection.set(pair.principalSectionId, pair.id);
    pairForSection.set(pair.novoClienteSectionId, pair.id);
  }
  const affiliatesByPair = new Map<number, typeof affiliations>();
  for (const item of affiliations)
    affiliatesByPair.set(item.blockPairId, [
      ...(affiliatesByPair.get(item.blockPairId) ?? []),
      item,
    ]);
  const modelInfo = new Map<number, { productId: number; name: string }>();
  const variantInfo = new Map<
    number,
    { productId: number; modelId: number | null }
  >();
  for (const c of catalog) {
    if (c.tipo === "modelo" && c.mubisysModeloId)
      modelInfo.set(c.mubisysModeloId, {
        productId: c.mubisysProdutoId,
        name: c.modeloNome,
      });
    if (c.mubisysVariacaoId)
      variantInfo.set(c.mubisysVariacaoId, {
        productId: c.mubisysProdutoId,
        modelId: c.mubisysModeloId,
      });
  }
  const ids = (v: (typeof vendas)[number]) => ({
    productId:
      v.produtoId ??
      (v.variacaoId ? variantInfo.get(v.variacaoId)?.productId : undefined) ??
      (v.modeloId ? modelInfo.get(v.modeloId)?.productId : undefined) ??
      null,
    modelId:
      v.modeloId ??
      (v.variacaoId ? variantInfo.get(v.variacaoId)?.modelId : undefined) ??
      null,
  });
  const abc = new Map<string, "A" | "B" | "C">();
  for (const i of curvaItens) {
    const key = i.variacaoId
      ? `v${i.variacaoId}`
      : i.modeloId
        ? `m${i.modeloId}`
        : i.produtoId
          ? `p${i.produtoId}`
          : "";
    if (key) abc.set(key, i.classe);
  }
  const tables: Table[] = input.tabela
    ? [input.tabela]
    : ["principal", "novo_cliente"];
  const pages = (t: Table) => (t === "principal" ? [1, 2, 3] : [11, 12, 13]);
  const today = new Date();
  const days = new Date(input.ano, input.mes, 0).getDate();
  const elapsed =
    input.ano === today.getFullYear() && input.mes === today.getMonth() + 1
      ? today.getDate()
      : input.ano * 12 + input.mes <
          today.getFullYear() * 12 + today.getMonth() + 1
        ? days
        : 0;
  const remaining = Math.max(0, days - elapsed);
  const actual = vendas.reduce((sum, v) => sum + Number(v.faturamento), 0);
  const forecast = elapsed > 0 ? (actual / elapsed) * days : null;
  const geral = metas.filter(m => m.vendedor.trim().toUpperCase() === "GERAL");
  const commercialGoal = (geral.length ? geral : metas).reduce(
    (sum, m) => sum + Number(m.metaFaturamento ?? 0),
    0
  );
  const fallback = fallbackRows
    .filter(m => m.anoVigencia == null || m.anoVigencia === input.ano)
    .sort((a, b) => (b.anoVigencia ?? 0) - (a.anoVigencia ?? 0))[0];
  const goal =
    commercialGoal > 0
      ? commercialGoal
      : Number(fallback?.metaFaturamentoMensal ?? 0) || null;
  const rows: PriceRevenueAnalysisRow[] = [];
  const ambiguousSaleIds = new Set<number>();
  for (const table of tables)
    for (const section of sections.filter(
      s =>
        pages(table).includes(s.page) &&
        (!input.sectionId || input.sectionId === s.id)
    )) {
      const pairId = pairForSection.get(section.id);
      const linked = pairId ? (affiliatesByPair.get(pairId) ?? []) : [];
      if (!linked.length && !input.produtoId)
        rows.push({
          tabela: table === "principal" ? "Clientes Antigos" : "Novo Cliente",
          sectionId: section.id,
          bloco: section.sectionTitle,
          productId: null,
          produto: "Sem produto afiliado",
          modelId: null,
          modelo: "—",
          categoria: null,
          classeAbc: null,
          faixa: "—",
          margemAtualPct: null,
          precoCotado: null,
          faturamentoRealizado: null,
          faturamentoPrevisto: null,
          contribuicaoMetaPct: null,
          versaoTabela: versions[0]?.versao ?? null,
          versoesCotacoes: null,
          amostrasCotacao: 0,
          situacao:
            pairId == null
              ? "bloco sem par cadastrado"
              : "sem afiliação explícita cadastrada",
        });
      let content: any = {};
      try {
        content = JSON.parse(section.contentJson);
      } catch {
        content = {};
      }
      for (const affiliation of linked) {
        if (input.produtoId && input.produtoId !== affiliation.mubisysProdutoId)
          continue;
        const modelScope = affiliation.mubisysModeloIds as number[] | null;
        const matching = vendas.filter(v => {
          const id = ids(v);
          return (
            id.productId === affiliation.mubisysProdutoId &&
            (!modelScope ||
              (id.modelId != null && modelScope.includes(id.modelId))) &&
            (!input.modeloId || id.modelId === input.modeloId)
          );
        });

        const grouped = new Map<number | null, typeof matching>();
        for (const v of matching) {
          const id = ids(v).modelId;
          grouped.set(id, [...(grouped.get(id) ?? []), v]);
        }
        if (!grouped.size) grouped.set(null, []);
        for (const [modelId, modelSales] of grouped) {
          const revenue = modelSales.reduce(
            (sum, v) => sum + Number(v.faturamento),
            0
          );
          const applicableAffiliations = affiliations.filter(
            a =>
              a.mubisysProdutoId === affiliation.mubisysProdutoId &&
              (a.mubisysModeloIds == null ||
                (modelId != null &&
                  (a.mubisysModeloIds as number[]).includes(modelId)))
          );
          const unique =
            applicableAffiliations.length === 1 &&
            applicableAffiliations[0].blockPairId === pairId;
          if (!unique)
            for (const sale of modelSales) ambiguousSaleIds.add(sale.id);
          const osIds = new Set(modelSales.map(v => v.osId));
          const modelName =
            modelId == null
              ? modelScope?.length
                ? `${modelScope.length} modelos afiliados`
                : "Todos os modelos afiliados"
              : (modelInfo.get(modelId)?.name ?? `Modelo ${modelId}`);
          const revenueAttributed = unique ? revenue : null;
          const rowForecast =
            revenueAttributed != null && forecast != null && actual > 0
              ? (forecast * revenueAttributed) / actual
              : null;
          const rowAbc = modelId
            ? (abc.get(`m${modelId}`) ??
              (modelScope == null
                ? abc.get(`p${affiliation.mubisysProdutoId}`)
                : null))
            : (abc.get(`p${affiliation.mubisysProdutoId}`) ?? null);
          const base: PriceRevenueAnalysisRow = {
            tabela: table === "principal" ? "Clientes Antigos" : "Novo Cliente",
            sectionId: section.id,
            bloco: section.sectionTitle,
            productId: affiliation.mubisysProdutoId,
            produto: affiliation.nomeProduto,
            modelId: modelId,
            modelo: modelName,
            categoria: affiliation.categoria,
            classeAbc: rowAbc ?? null,
            faixa: "—",
            margemAtualPct: null,
            precoCotado: null,
            versaoTabela: versions[0]?.versao ?? null,
            versoesCotacoes: null,
            amostrasCotacao: 0,
            faturamentoRealizado: revenueAttributed,
            faturamentoPrevisto: rowForecast,
            contribuicaoMetaPct:
              revenueAttributed != null && goal
                ? (revenueAttributed / goal) * 100
                : null,
            situacao:
              pairId == null
                ? "bloco sem par cadastrado"
                : !linked.length
                  ? "sem afiliação explícita"
                  : !unique
                    ? "atribuição ambígua"
                    : matching.length
                      ? "ID ERP + afiliação explícita"
                      : "sem venda no período",
          };
          const columns: string[] = Array.isArray(content.columns)
            ? content.columns
            : [];
          const dataRows: any[] = Array.isArray(content.rows)
            ? content.rows
            : [];
          const bandIds: any[] = Array.isArray(content.faixaIds)
            ? content.faixaIds
            : [];
          const offset = content.type === "margin_table_multi" ? 1 : 0;
          const bands = dataRows.flatMap((r: any) =>
            (Array.isArray(r.values) ? r.values : []).map(
              (v: unknown, index: number) => ({
                linha: String(r.label ?? "—"),
                margem: percentual(v),
                faixa: String(columns[index + offset] ?? `Faixa ${index + 1}`),
                faixaId: bandIds[index] ?? null,
              })
            )
          );
          rows.push({
            ...base,
            faixa: "Faixa não informada pela venda",
            margemAtualPct: null,
            margemCotadaPct: null,
            precoCotado: null,
            faturamentoRealizado: base.faturamentoRealizado,
            faturamentoPrevisto: base.faturamentoPrevisto,
            versaoTabela: versions[0]?.versao ?? null,
            versoesCotacoes: null,
            amostrasCotacao: 0,
          });
          for (const band of bands) {
            const quoteCandidates =
              band.faixaId == null
                ? []
                : snapshots
                    .filter(
                      s =>
                        s.secaoId === section.id &&
                        s.faixaId === band.faixaId &&
                        s.mubisysOsId != null &&
                        osIds.has(s.mubisysOsId) &&
                        snapshotMatchesItem(
                          s.snapshotJson,
                          affiliation.mubisysProdutoId,
                          modelId
                        )
                    )
                    .sort(
                      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
                    );
            const latestQuotes = new Map<
              string,
              (typeof quoteCandidates)[number]
            >();
            for (const quote of quoteCandidates) {
              const key = `${quote.propostaId}:${quote.linhaId ?? ""}:${quote.faixaId ?? ""}`;
              if (!latestQuotes.has(key)) latestQuotes.set(key, quote);
            }
            const quotes = [...latestQuotes.values()];
            const prices = quotes.length
              ? quotes.reduce((sum, q) => sum + Number(q.precoFinal), 0) /
                quotes.length
              : null;
            const quoteMargins = quotes.filter(q => q.margemPct != null);
            rows.push({
              ...base,
              linha: band.linha,
              faixa: band.faixa,
              margemAtualPct: band.margem,
              margemCotadaPct: quoteMargins.length
                ? quoteMargins.reduce(
                    (sum, q) => sum + Number(q.margemPct),
                    0
                  ) / quoteMargins.length
                : null,
              precoCotado: prices,
              faturamentoRealizado: null,
              faturamentoPrevisto: null,
              contribuicaoMetaPct: null,
              versaoTabela: versions[0]?.versao ?? null,
              versoesCotacoes:
                [
                  ...new Set(
                    quotes.map(q => q.tabelaPrecoVersao).filter(Boolean)
                  ),
                ].join(", ") || null,
              amostrasCotacao: quotes.length,
              origemPreco:
                prices == null
                  ? "não armazenado; depende do custo"
                  : "snapshot vinculado à OS",
            });
          }
        }
      }
    }
  const matchingAffiliations = (sale: (typeof vendas)[number]) => {
    const id = ids(sale);
    return affiliations.filter(
      a =>
        a.mubisysProdutoId === id.productId &&
        (a.mubisysModeloIds == null ||
          (id.modelId != null &&
            (a.mubisysModeloIds as number[]).includes(id.modelId)))
    );
  };
  const unmatched = vendas
    .filter(sale => matchingAffiliations(sale).length !== 1)
    .reduce((sum, v) => sum + Number(v.faturamento), 0);
  const ambiguousRevenue = vendas
    .filter(v => ambiguousSaleIds.has(v.id))
    .reduce((sum, v) => sum + Number(v.faturamento), 0);
  const vendasAfiliadas = new Map<string, PriceRevenueAnalysisRow>();
  for (const row of rows)
    if (
      row.faixa === "Faixa não informada pela venda" &&
      row.faturamentoRealizado != null &&
      row.productId != null
    )
      vendasAfiliadas.set(`${row.productId}:${row.modelId ?? "*"}`, row);
  const abcSummary = (["A", "B", "C"] as const).map(classe => ({
    classe,
    faturamento: [...vendasAfiliadas.values()]
      .filter(r => r.classeAbc === classe)
      .reduce((sum, r) => sum + Number(r.faturamentoRealizado), 0),
  }));
  const categoriasMap = new Map<
    string,
    { categoria: string; faturamento: number; previsto: number | null }
  >();
  for (const row of vendasAfiliadas.values()) {
    const categoria = row.categoria?.trim() || "Sem categoria cadastrada";
    const prev = categoriasMap.get(categoria);
    categoriasMap.set(categoria, {
      categoria,
      faturamento: (prev?.faturamento ?? 0) + Number(row.faturamentoRealizado),
      previsto: !prev
        ? row.faturamentoPrevisto
        : prev.previsto == null || row.faturamentoPrevisto == null
          ? null
          : prev.previsto + row.faturamentoPrevisto,
    });
  }
  const categorias = [...categoriasMap.values()].sort(
    (a, b) => b.faturamento - a.faturamento
  );
  return {
    periodo: {
      mes: input.mes,
      ano: input.ano,
      diasDecorridos: elapsed,
      diasRestantes: remaining,
    },
    meta: goal,
    realizado: actual,
    previsto: forecast,
    diferencaMeta: forecast != null && goal != null ? forecast - goal : null,
    diferencaMetaPct:
      forecast != null && goal ? ((forecast - goal) / goal) * 100 : null,
    ritmoDiarioNecessario:
      goal != null && remaining > 0
        ? Math.max(0, goal - actual) / remaining
        : null,
    ritmoDiarioAtual: elapsed > 0 ? actual / elapsed : null,
    coberturaAfiliaçãoPct:
      actual > 0 ? ((actual - unmatched) / actual) * 100 : 0,
    abc: abcSummary,
    categorias,
    rows,
    receitaSemAfiliação: unmatched,
    receitaComAtribuiçãoAmbígua: ambiguousRevenue,
    sincronizadoEm,
    dadosDesatualizados,
    erroSync,
    versaoAtual: versions[0]?.versao ?? null,
    fontes: [
      "mubisys_vendas_itens e Curva ABC MubiSys",
      "metas_comerciais, fallback explícito para metas_operacionais",
      "price_table_sections + pares/afiliações explícitas",
      "estudio_cotacao_snapshots ligados à OS",
    ],
    limitacoes: [
      "A projeção mensal extrapola o ritmo de faturamento observado; não é uma estimativa causal de preço.",
      "A venda não identifica qual das tabelas equivalentes (Clientes Antigos/Novo Cliente) foi usada. A afiliação pareia opções de preço; o faturamento é do produto/modelo no ERP.",
      "O ERP não informa a faixa por item. Receita só é ligada ao produto/modelo por IDs e afiliação explícita; preço/margem cotados exigem snapshot vinculado à OS.",
      "A Tabela de Preços guarda margens, não um preço absoluto. Preço médio aparece apenas em snapshots e depende do custo da cotação.",
      "Não há conversão/elasticidade por faixa; cenário de preço sem essa base não prevê volume nem prova causalidade.",
    ],
  };
}
