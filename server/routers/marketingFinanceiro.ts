import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb, insertAuditLogMarketingConfig } from "../db/db";
import { marketingConfig, custoMarketing, historicoOs, financeiroMensal, dreMensal } from "../../drizzle/schema";
import { isOsNormalDb, normalizeEmpresaKey } from "./performanceComercial";
import { calcularRadarMargens } from "./financeiro";
import { classificarAno, agregarMes, calcularReativacaoAnual } from "../services/marketingFinanceiroClientes";
import {
  cacPonderado, custoReativacaoPonderado, calcularResultadoGrupo, calcularResultadoConsolidado,
  mediana, participacaoTopN, conciliar,
} from "../../shared/marketing-financeiro";
import {
  calcularPontoEquilibrio, calcularDesvioMargem, montarPonteResultado, calcularIndicadoresPorFuncionario,
  custoFixoMedioPorPedido, resultadoMedioPorPedido, ratearCustoFixo, type DirecionadorRateio,
} from "../../shared/resultado-geral";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface MarketingConfigResolvida {
  mesesInatividadeReativacao: number;
  percentualMargemFallback: number;
  cacMaximo: number | null;
  custoReativacaoMaximo: number | null;
  roiMinimoPct: number | null;
  ticketMedioMinimo: number | null;
  metaClientesNovosMes: number | null;
  metaClientesReativadosMes: number | null;
  aumentoMaximoCacMensalPct: number | null;
  janelaAtribuicaoDias: number;
  direcionadorRateio: DirecionadorRateio;
  custosFinanceirosIncluemMarketing: boolean;
}

// ─── Configuração ────────────────────────────────────────────────────────────
// Defaults idênticos ao comportamento hardcoded que o relatório tinha antes de
// existir marketing_config — com a config em branco, os números não mudam.
const CONFIG_DEFAULTS: MarketingConfigResolvida = {
  mesesInatividadeReativacao: 6,
  percentualMargemFallback: 51,
  cacMaximo: null,
  custoReativacaoMaximo: null,
  roiMinimoPct: null,
  ticketMedioMinimo: null,
  metaClientesNovosMes: null,
  metaClientesReativadosMes: null,
  aumentoMaximoCacMensalPct: null,
  janelaAtribuicaoDias: 0,
  direcionadorRateio: "faturamento",
  custosFinanceirosIncluemMarketing: false,
};

async function buscarConfig(db: Db | null): Promise<MarketingConfigResolvida> {
  if (!db) return CONFIG_DEFAULTS;
  const rows = await db.select().from(marketingConfig).limit(1);
  if (rows.length === 0) return CONFIG_DEFAULTS;
  const r = rows[0];
  return {
    mesesInatividadeReativacao: r.mesesInatividadeReativacao,
    percentualMargemFallback: Number(r.percentualMargemFallback),
    cacMaximo: r.cacMaximo != null ? Number(r.cacMaximo) : null,
    custoReativacaoMaximo: r.custoReativacaoMaximo != null ? Number(r.custoReativacaoMaximo) : null,
    roiMinimoPct: r.roiMinimoPct != null ? Number(r.roiMinimoPct) : null,
    ticketMedioMinimo: r.ticketMedioMinimo != null ? Number(r.ticketMedioMinimo) : null,
    metaClientesNovosMes: r.metaClientesNovosMes,
    metaClientesReativadosMes: r.metaClientesReativadosMes,
    aumentoMaximoCacMensalPct: r.aumentoMaximoCacMensalPct != null ? Number(r.aumentoMaximoCacMensalPct) : null,
    janelaAtribuicaoDias: r.janelaAtribuicaoDias,
    direcionadorRateio: r.direcionadorRateio as MarketingConfigResolvida["direcionadorRateio"],
    custosFinanceirosIncluemMarketing: r.custosFinanceirosIncluemMarketing,
  };
}

const configInputSchema = z.object({
  mesesInatividadeReativacao: z.number().min(1).max(24),
  percentualMargemFallback: z.number().min(0).max(100),
  cacMaximo: z.number().min(0).nullable(),
  custoReativacaoMaximo: z.number().min(0).nullable(),
  roiMinimoPct: z.number().nullable(),
  ticketMedioMinimo: z.number().min(0).nullable(),
  metaClientesNovosMes: z.number().int().min(0).nullable(),
  metaClientesReativadosMes: z.number().int().min(0).nullable(),
  aumentoMaximoCacMensalPct: z.number().nullable(),
  janelaAtribuicaoDias: z.number().int().min(0),
  direcionadorRateio: z.enum(["pedidos", "faturamento", "custo_direto", "rateio_erp", "personalizado"]),
  custosFinanceirosIncluemMarketing: z.boolean(),
});

function configParaLinhaBanco(input: z.infer<typeof configInputSchema>) {
  return {
    mesesInatividadeReativacao: input.mesesInatividadeReativacao,
    percentualMargemFallback: String(input.percentualMargemFallback),
    cacMaximo: input.cacMaximo != null ? String(input.cacMaximo) : null,
    custoReativacaoMaximo: input.custoReativacaoMaximo != null ? String(input.custoReativacaoMaximo) : null,
    roiMinimoPct: input.roiMinimoPct != null ? String(input.roiMinimoPct) : null,
    ticketMedioMinimo: input.ticketMedioMinimo != null ? String(input.ticketMedioMinimo) : null,
    metaClientesNovosMes: input.metaClientesNovosMes,
    metaClientesReativadosMes: input.metaClientesReativadosMes,
    aumentoMaximoCacMensalPct: input.aumentoMaximoCacMensalPct != null ? String(input.aumentoMaximoCacMensalPct) : null,
    janelaAtribuicaoDias: input.janelaAtribuicaoDias,
    direcionadorRateio: input.direcionadorRateio,
    custosFinanceirosIncluemMarketing: input.custosFinanceirosIncluemMarketing,
  };
}

// ─── Helpers de conversão numérica (decimal do banco -> number|null) ─────────
const toNum = (v: string | number | null | undefined): number | null => v == null ? null : Number(v);

/** Situação "Cancelada" de uma O.S. normal (mesmo critério de tipo de
 * isOsNormalDb, mas SEM excluir status=cancelada — é exatamente o
 * complemento, para a linha informativa de cancelamentos). */
function isCanceladaNormal(os: { tipoOs?: string | null; status?: string | null }): boolean {
  if (os.tipoOs == null) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho") || tipo === "amostra" || tipo === "cortesia") return false;
  return (os.status ?? "").toLowerCase() === "cancelada";
}

export const marketingFinanceiroRouter = router({
  // ─── Configuração (metas, semáforos, parâmetros) ───────────────────────────
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    return buscarConfig(db);
  }),

  saveConfig: protectedProcedure
    .input(configInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const usuario = { usuarioId: ctx.user?.id ?? null, usuarioNome: ctx.user?.name ?? null, usuarioRole: ctx.user?.role ?? null };
      const data = configParaLinhaBanco(input);
      const existing = await db.select().from(marketingConfig).limit(1);
      if (existing.length > 0) {
        await db.update(marketingConfig).set(data).where(eq(marketingConfig.id, existing[0].id));
        insertAuditLogMarketingConfig({ acao: "EDICAO", ...usuario, valoresAnteriores: existing[0], valoresNovos: { ...existing[0], ...data } }).catch(() => {});
      } else {
        const [result] = await db.insert(marketingConfig).values(data).returning({ id: marketingConfig.id });
        insertAuditLogMarketingConfig({ acao: "CRIACAO", ...usuario, valoresAnteriores: null, valoresNovos: { id: result.id, ...data } }).catch(() => {});
      }
      return buscarConfig(db);
    }),

  getAuditoriaConfig: protectedProcedure.query(async () => {
    const { listAuditLogsMarketingConfig } = await import("../db/db");
    return listAuditLogsMarketingConfig();
  }),

  // ─── Relatório anual (Aba Marketing, Clientes e Receita) ───────────────────
  getRelatorioAno: publicProcedure
    .input(z.object({
      ano: z.number().min(2020),
      // Filtros gerenciais opcionais — o investimento em marketing (mensal,
      // não quebrado por vendedor/cidade) não muda com esses filtros, só o
      // faturamento/margem/clientes resultantes. Ver tooltip no client.
      vendedor: z.string().nullable().optional(),
      cidade: z.string().nullable().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const config = await buscarConfig(db);
      if (!db) {
        return { meses: [], reativacaoAnual: { clientesReativadosUnicosAno: 0, eventosReativacaoAno: 0 }, config, origem: "indisponivel" as const };
      }

      const [classificadasBrutas, custoMarketingRows] = await Promise.all([
        classificarAno(db, input.ano, config.mesesInatividadeReativacao),
        db.select().from(custoMarketing).where(eq(custoMarketing.ano, input.ano)),
      ]);
      const custoMktMap = new Map(custoMarketingRows.map(r => [r.mes, r]));
      const classificadas = classificadasBrutas.filter(c =>
        (input.vendedor == null || c.vendedor === input.vendedor) &&
        (input.cidade == null || c.cidade === input.cidade)
      );

      const now = new Date();
      const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;

      const meses = [];
      for (let mes = 1; mes <= mesLimite; mes++) {
        const resumo = agregarMes(mes, input.ano, classificadas, config.percentualMargemFallback);
        const mk = custoMktMap.get(mes);
        const investimentoAquisicao = toNum(mk?.investimentoAquisicao);
        const investimentoReativacao = toNum(mk?.investimentoReativacao);
        const mesParcial = input.ano === now.getFullYear() && mes === now.getMonth() + 1;

        const resultadoNovo = calcularResultadoGrupo(investimentoAquisicao, resumo.porCategoria.novo.margem.margemTotal, resumo.porCategoria.novo.faturamento);
        const resultadoReativado = calcularResultadoGrupo(investimentoReativacao, resumo.porCategoria.reativado.margem.margemTotal, resumo.porCategoria.reativado.faturamento);
        const consolidado = calcularResultadoConsolidado([
          { investimento: investimentoAquisicao, margemContribuicao: resumo.porCategoria.novo.margem.margemTotal },
          { investimento: investimentoReativacao, margemContribuicao: resumo.porCategoria.reativado.margem.margemTotal },
        ]);

        meses.push({
          mes, ano: input.ano, mesParcial,
          investimentoAquisicao, investimentoReativacao,
          investimentoTotal: investimentoAquisicao == null && investimentoReativacao == null ? null : (investimentoAquisicao ?? 0) + (investimentoReativacao ?? 0),
          novo: { ...resumo.porCategoria.novo, ...resultadoNovo, cacPonderado: cacPonderado(investimentoAquisicao, resumo.porCategoria.novo.qtdClientesUnicos) },
          recorrenteAtivo: resumo.porCategoria.recorrenteAtivo,
          reativado: { ...resumo.porCategoria.reativado, ...resultadoReativado, custoReativacaoPonderado: custoReativacaoPonderado(investimentoReativacao, resumo.porCategoria.reativado.qtdClientesUnicos) },
          naoClassificado: resumo.porCategoria.naoClassificado,
          faturamentoTotalValido: resumo.faturamentoTotalValido,
          consolidado,
        });
      }

      const reativacaoAnual = calcularReativacaoAnual(classificadas);
      return { meses, reativacaoAnual, config, origem: "local" as const };
    }),

  // ─── Opções de filtro (vendedor/cidade disponíveis no ano) ─────────────────
  getFiltrosDisponiveis: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { vendedores: [], cidades: [] };
      const rows = await db.select({ vendedor: historicoOs.vendedor, cidade: historicoOs.cidade })
        .from(historicoOs).where(eq(historicoOs.ano, input.ano));
      const vendedores = new Set<string>();
      const cidades = new Set<string>();
      for (const r of rows) {
        if (r.vendedor) vendedores.add(r.vendedor);
        if (r.cidade) cidades.add(r.cidade);
      }
      return { vendedores: [...vendedores].sort(), cidades: [...cidades].sort() };
    }),

  // ─── Drill-down (detalhamento de pedidos) ──────────────────────────────────
  getDetalhamentoPedidos: publicProcedure
    .input(z.object({
      ano: z.number().min(2020),
      mes: z.number().min(1).max(12).nullable().optional(),
      categoria: z.enum(["novo", "recorrenteAtivo", "reativado", "naoClassificado"]).nullable().optional(),
      vendedor: z.string().nullable().optional(),
      cidade: z.string().nullable().optional(),
      estado: z.string().nullable().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const config = await buscarConfig(db);
      const classificadas = await classificarAno(db, input.ano, config.mesesInatividadeReativacao);
      return classificadas.filter(c =>
        (input.mes == null || c.mes === input.mes) &&
        (input.categoria == null || c.categoria === input.categoria) &&
        (input.vendedor == null || c.vendedor === input.vendedor) &&
        (input.cidade == null || c.cidade === input.cidade) &&
        (input.estado == null || c.estado === input.estado)
      );
    }),

  // ─── Mediana / outliers do período ─────────────────────────────────────────
  getMedianaOutliers: publicProcedure
    .input(z.object({ ano: z.number().min(2020), mes: z.number().min(1).max(12).nullable().optional(), categoria: z.enum(["novo", "reativado"]).nullable().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const config = await buscarConfig(db);
      const classificadas = await classificarAno(db, input.ano, config.mesesInatividadeReativacao);
      const filtradas = classificadas.filter(c =>
        (input.mes == null || c.mes === input.mes) &&
        (input.categoria == null ? (c.categoria === "novo" || c.categoria === "reativado") : c.categoria === input.categoria)
      );
      const valores = filtradas.map(c => c.valorOs);
      return {
        qtdPedidos: valores.length,
        ticketMedio: valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100 : null,
        ticketMediano: mediana(valores),
        maiorPedido: valores.length ? Math.max(...valores) : null,
        participacaoTop5: participacaoTopN(valores, 5),
      };
    }),

  // ─── Resultado Geral e Ponto de Equilíbrio (Parte 2) ───────────────────────
  getResultadoGeralAno: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const config = await buscarConfig(db);
      if (!db) return { meses: [], config, origem: "indisponivel" as const };

      const [finRows, dreRows, mktRows, osAno] = await Promise.all([
        db.select().from(financeiroMensal).where(eq(financeiroMensal.ano, input.ano)),
        db.select().from(dreMensal).where(eq(dreMensal.ano, input.ano)),
        db.select().from(custoMarketing).where(eq(custoMarketing.ano, input.ano)),
        db.select({
          mes: historicoOs.mes, ano: historicoOs.ano, tipoOs: historicoOs.tipoOs, status: historicoOs.status,
          valorOs: historicoOs.valorOs, valorTotal: historicoOs.valorTotal, empresa: historicoOs.empresa,
        }).from(historicoOs).where(eq(historicoOs.ano, input.ano)),
      ]);

      const finMap = new Map(finRows.map(r => [r.mes, r]));
      const dreMap = new Map(dreRows.map(r => [r.mes, r]));
      const mktMap = new Map(mktRows.map(r => [r.mes, r]));

      // Agregação leve por mês direto de historico_os: qtd de pedidos válidos,
      // clientes únicos, faturamento válido e cancelamentos (informativo) —
      // independente da classificação novo/recorrente/reativado da aba de Marketing.
      const porMes = new Map<number, { qtdPedidos: number; faturamento: number; cancelamentos: number; clientes: Set<string>; valores: number[] }>();
      for (const os of osAno) {
        const acc = porMes.get(os.mes) ?? { qtdPedidos: 0, faturamento: 0, cancelamentos: 0, clientes: new Set<string>(), valores: [] as number[] };
        if (isOsNormalDb(os)) {
          const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
          acc.qtdPedidos++;
          acc.faturamento += valor;
          acc.valores.push(valor);
          const chave = normalizeEmpresaKey(os.empresa ?? "");
          if (chave) acc.clientes.add(chave);
        } else if (isCanceladaNormal(os)) {
          acc.cancelamentos += parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
        }
        porMes.set(os.mes, acc);
      }

      const now = new Date();
      const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;
      const meses = [];

      for (let mes = 1; mes <= mesLimite; mes++) {
        const fin = finMap.get(mes);
        const dre = dreMap.get(mes);
        const mkt = mktMap.get(mes);
        const opsMes = porMes.get(mes) ?? { qtdPedidos: 0, faturamento: 0, cancelamentos: 0, clientes: new Set<string>(), valores: [] as number[] };
        const mesParcial = input.ano === now.getFullYear() && mes === now.getMonth() + 1;

        // Fonte REAL (financeiro_mensal) é sempre principal na ponte consolidada.
        // dre_mensal só entra como complemento quando o campo real está ausente,
        // e mesmo assim é rotulado "rateado"/"aproximado" no payload (selo).
        const faturamentoLiquido = toNum(fin?.faturamentoOficial) ?? (dre?.receitaBrutaOperacional != null ? Number(dre.receitaBrutaOperacional) : null);
        const custosVariaveis = toNum(fin?.despesasVariaveis) ?? (dre?.despesaVariavel != null ? Number(dre.despesaVariavel) : null);
        const custosFixos = toNum(fin?.despesasFixas); // nunca cai para dre_mensal (que é rateio por pedido, não total real)
        const investimentoMarketingBruto = (toNum(mkt?.investimentoAquisicao) ?? 0) + (toNum(mkt?.investimentoReativacao) ?? 0);
        const investimentoMarketing = config.custosFinanceirosIncluemMarketing ? 0 : investimentoMarketingBruto;

        const ponte = montarPonteResultado({
          faturamentoBruto: faturamentoLiquido != null ? faturamentoLiquido + opsMes.cancelamentos : null,
          cancelamentosInformativo: opsMes.cancelamentos || null,
          faturamentoLiquido,
          custosVariaveis,
          investimentoMarketing,
          custosFixos,
          // financeiro_mensal não tem despesasFinanceiras própria hoje — só dre_mensal
          // tem a coluna, e ela nunca é preenchida pelo backfill (não vem do ERP de
          // vendas, só de folha/banco) — ver Parte 2 "O que fica fora por falta de dado".
          despesasFinanceiras: dre?.despesasFinanceiras != null ? Number(dre.despesasFinanceiras) : null,
          despesasNaoOperacionais: null,
          receitasNaoOperacionais: null,
        });

        const pontoEquilibrio = calcularPontoEquilibrio(
          custosFixos, investimentoMarketing, ponte.margemContribuicaoPct, faturamentoLiquido,
          opsMes.qtdPedidos > 0 ? opsMes.faturamento / opsMes.qtdPedidos : null,
        );
        const margemRealPct = ponte.margemContribuicaoPct;
        const desvioMargem = calcularDesvioMargem(config.percentualMargemFallback / 100, margemRealPct, faturamentoLiquido);
        const porFuncionario = calcularIndicadoresPorFuncionario(faturamentoLiquido, ponte.margemContribuicao, ponte.resultadoOperacional, fin?.numColaboradores);

        meses.push({
          mes, ano: input.ano, mesParcial,
          qtdPedidos: opsMes.qtdPedidos,
          qtdClientesUnicos: opsMes.clientes.size,
          ticketMedio: opsMes.qtdPedidos > 0 ? Math.round((opsMes.faturamento / opsMes.qtdPedidos) * 100) / 100 : null,
          ticketMediano: mediana(opsMes.valores),
          maiorPedido: opsMes.valores.length ? Math.max(...opsMes.valores) : null,
          participacaoTop5: participacaoTopN(opsMes.valores, 5),
          ponte,
          investimentoMarketingBruto,
          custosFinanceirosIncluemMarketing: config.custosFinanceirosIncluemMarketing,
          pontoEquilibrio,
          desvioMargem,
          porFuncionario,
          custoFixoMedioPorPedido: custoFixoMedioPorPedido(custosFixos, opsMes.qtdPedidos),
          resultadoMedioPorPedido: resultadoMedioPorPedido(ponte.resultadoOperacional, opsMes.qtdPedidos),
          origemDados: {
            faturamentoLiquido: fin?.faturamentoOficial != null ? "real" : dre?.receitaBrutaOperacional != null ? "rateado" : "sem-dado",
            custosVariaveis: fin?.despesasVariaveis != null ? "real" : dre?.despesaVariavel != null ? "rateado" : "sem-dado",
            custosFixos: fin?.despesasFixas != null ? "real" : "sem-dado",
          } as const,
        });
      }

      return { meses, config, origem: "local" as const };
    }),

  // ─── Resultado por vendedor (reaproveita calcularRadarMargens) ─────────────
  getResultadoPorVendedor: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    // Agregação histórica completa (todos os anos) — mesma base já usada pela
    // aba Radar de Margens, não filtrada por ano (limitação herdada da função
    // reaproveitada, documentada no plano de implementação).
    const { vendedores } = await calcularRadarMargens(db);
    return vendedores;
  }),

  // ─── Rateio de custo fixo por dimensão (gerencial) ─────────────────────────
  getRateioCustoFixoPorVendedor: publicProcedure
    .input(z.object({ ano: z.number().min(2020), mes: z.number().min(1).max(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};
      const config = await buscarConfig(db);
      const [finRow] = await db.select().from(financeiroMensal).where(and(eq(financeiroMensal.ano, input.ano), eq(financeiroMensal.mes, input.mes))).limit(1);
      const custosFixosTotais = toNum(finRow?.despesasFixas);
      if (custosFixosTotais == null) return {};

      const osMes = await db.select({
        vendedor: historicoOs.vendedor, tipoOs: historicoOs.tipoOs, status: historicoOs.status,
        valorOs: historicoOs.valorOs, valorTotal: historicoOs.valorTotal, custoFixo: historicoOs.custoFixo,
      }).from(historicoOs).where(and(eq(historicoOs.ano, input.ano), eq(historicoOs.mes, input.mes)));

      const porVendedor = new Map<string, { qtdPedidos: number; faturamento: number; custoDireto: number; rateadoErp: number }>();
      for (const os of osMes) {
        if (!isOsNormalDb(os)) continue;
        const vendedor = os.vendedor || "Sem vendedor";
        const acc = porVendedor.get(vendedor) ?? { qtdPedidos: 0, faturamento: 0, custoDireto: 0, rateadoErp: 0 };
        acc.qtdPedidos++;
        acc.faturamento += parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
        acc.rateadoErp += parseFloat(String(os.custoFixo ?? "0")) || 0;
        porVendedor.set(vendedor, acc);
      }

      const dimensoes = [...porVendedor.entries()].map(([chave, v]) => ({
        chave,
        valorDirecionador: config.direcionadorRateio === "pedidos" ? v.qtdPedidos : config.direcionadorRateio === "custo_direto" ? v.custoDireto : v.faturamento,
        valorJaRateado: v.rateadoErp,
      }));
      return ratearCustoFixo(custosFixosTotais, config.direcionadorRateio, dimensoes);
    }),

  // ─── Conciliação (novo + recorrente ativo + reativado + não-classificado = faturamento oficial) ──
  getConciliacaoAno: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const config = await buscarConfig(db);
      const [classificadas, finRows] = await Promise.all([
        classificarAno(db, input.ano, config.mesesInatividadeReativacao),
        db.select().from(financeiroMensal).where(eq(financeiroMensal.ano, input.ano)),
      ]);
      const finMap = new Map(finRows.map(r => [r.mes, r]));

      const now = new Date();
      const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;
      const resultado = [];
      for (let mes = 1; mes <= mesLimite; mes++) {
        const resumo = agregarMes(mes, input.ano, classificadas, config.percentualMargemFallback);
        const faturamentoOficial = toNum(finMap.get(mes)?.faturamentoOficial);
        if (faturamentoOficial == null) {
          resultado.push({ mes, ano: input.ano, disponivel: false as const });
          continue;
        }
        const valoresPorCategoria = [
          resumo.porCategoria.novo.faturamento,
          resumo.porCategoria.recorrenteAtivo.faturamento,
          resumo.porCategoria.reativado.faturamento,
          resumo.porCategoria.naoClassificado.faturamento,
        ];
        resultado.push({ mes, ano: input.ano, disponivel: true as const, ...conciliar(faturamentoOficial, valoresPorCategoria) });
      }
      return resultado;
    }),
});
