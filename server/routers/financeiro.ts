import { z } from "zod";
import * as XLSX from "xlsx";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { financeiroMensal, custoMarketing, custoMarketingItens, custosFixos, dividasParcelamentos, dreMensal, historicoOs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { perguntarSobreFinanceiro, type MensagemChat } from "../integrations/anthropic-client";
import { isOsNormalDb } from "./performanceComercial";
import { TRPCError } from "@trpc/server";

const MESES_NOMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Agrega historico_os por mês e por vendedor — mesma base usada pela aba
 *  Radar de Margens e pelo contexto do chat de IA (ambos precisam do mesmo
 *  cálculo de resultado líquido / margem de contribuição por O.S.). */
async function calcularRadarMargens(db: Db) {
  const rows = await db.select({
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
    vendedor: historicoOs.vendedor,
    valorOs: historicoOs.valorOs,
    materiaPrima: historicoOs.materiaPrima,
    custoFixo: historicoOs.custoFixo,
    maoDeObra: historicoOs.maoDeObra,
    tarifasFinanceiras: historicoOs.tarifasFinanceiras,
    comissoesInternas: historicoOs.comissoesInternas,
    comissoesExternas: historicoOs.comissoesExternas,
    terceirizados: historicoOs.terceirizados,
    tributos: historicoOs.tributos,
    resultadoReais: historicoOs.resultadoReais,
    contribuicaoReais: historicoOs.contribuicaoReais,
  }).from(historicoOs);

  const num = (v: string | null | undefined) => parseFloat(String(v ?? "0")) || 0;

  interface MesAcc {
    mes: number; ano: number; count: number; valorOs: number;
    materiaPrima: number; custoFixo: number; maoDeObra: number; tarifasFinanceiras: number;
    comissoes: number; terceirizados: number; tributos: number;
    resultado: number; contribuicao: number;
  }
  const novoMesAcc = (mes: number, ano: number): MesAcc => ({
    mes, ano, count: 0, valorOs: 0, materiaPrima: 0, custoFixo: 0, maoDeObra: 0,
    tarifasFinanceiras: 0, comissoes: 0, terceirizados: 0, tributos: 0, resultado: 0, contribuicao: 0,
  });

  const porMes = new Map<string, MesAcc>();
  const porVendedor = new Map<string, { vendedor: string; count: number; valorOs: number; resultado: number; contribuicao: number }>();
  // Status de todas as O.S. "normais" (exclui só retrabalho/amostra/cortesia,
  // mantém canceladas) por ano — para o card "Situação das O.S.", que precisa
  // mostrar as canceladas mesmo elas ficando fora do cálculo de margem abaixo.
  const porAnoStatus = new Map<string, { ano: number; status: string; count: number }>();

  for (const os of rows) {
    const tipo = (os.tipoOs ?? "").toLowerCase();
    const tipoNormal = os.tipoOs != null && !tipo.startsWith("retrabalho") && tipo !== "amostra" && tipo !== "cortesia";
    if (tipoNormal) {
      const status = os.status || "Sem status";
      const chaveStatus = `${os.ano}-${status}`;
      const sAcc = porAnoStatus.get(chaveStatus) ?? { ano: os.ano, status, count: 0 };
      sAcc.count += 1;
      porAnoStatus.set(chaveStatus, sAcc);
    }

    if (!isOsNormalDb(os)) continue;
    const valorOs = num(os.valorOs);

    const chaveMes = `${os.ano}-${String(os.mes).padStart(2, "0")}`;
    const acc = porMes.get(chaveMes) ?? novoMesAcc(os.mes, os.ano);
    acc.count += 1;
    acc.valorOs += valorOs;
    acc.materiaPrima += num(os.materiaPrima);
    acc.custoFixo += num(os.custoFixo);
    acc.maoDeObra += num(os.maoDeObra);
    acc.tarifasFinanceiras += num(os.tarifasFinanceiras);
    acc.comissoes += num(os.comissoesInternas) + num(os.comissoesExternas);
    acc.terceirizados += num(os.terceirizados);
    acc.tributos += num(os.tributos);
    acc.resultado += num(os.resultadoReais);
    acc.contribuicao += num(os.contribuicaoReais);
    porMes.set(chaveMes, acc);

    const vendedor = os.vendedor || "Sem vendedor";
    const vAcc = porVendedor.get(vendedor) ?? { vendedor, count: 0, valorOs: 0, resultado: 0, contribuicao: 0 };
    vAcc.count += 1;
    vAcc.valorOs += valorOs;
    vAcc.resultado += num(os.resultadoReais);
    vAcc.contribuicao += num(os.contribuicaoReais);
    porVendedor.set(vendedor, vAcc);
  }

  const meses = [...porMes.values()]
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
    .map(m => {
      const variavel = m.materiaPrima + m.tributos + m.comissoes + m.terceirizados;
      const fixo = m.custoFixo + m.maoDeObra + m.tarifasFinanceiras;
      const pct = (v: number) => (m.valorOs ? (v / m.valorOs) * 100 : 0);
      return {
        mes: m.mes,
        ano: m.ano,
        label: `${MESES_NOMES[m.mes].slice(0, 3)}/${String(m.ano).slice(2)}`,
        count: m.count,
        valorOs: m.valorOs,
        variavel,
        fixo,
        materiaPrima: m.materiaPrima,
        custoFixoPuro: m.custoFixo,
        maoDeObra: m.maoDeObra,
        tributos: m.tributos,
        comissoes: m.comissoes,
        terceirizados: m.terceirizados,
        resultado: m.resultado,
        contribuicao: m.contribuicao,
        resultadoPct: pct(m.resultado),
        contribuicaoPct: pct(m.contribuicao),
        ticketMedio: m.count ? m.valorOs / m.count : 0,
        fixoPorOS: m.count ? fixo / m.count : 0,
        variavelPct: pct(variavel),
        fixoPct: pct(fixo),
        materiaPrimaPct: pct(m.materiaPrima),
        tributosPct: pct(m.tributos),
        comissoesPct: pct(m.comissoes),
        terceirizadosPct: pct(m.terceirizados),
        custoFixoPuroPct: pct(m.custoFixo),
        maoDeObraPct: pct(m.maoDeObra),
      };
    });

  const vendedores = [...porVendedor.values()]
    .filter(v => v.count >= 5)
    .sort((a, b) => b.valorOs - a.valorOs)
    .map(v => ({
      ...v,
      resultadoPct: v.valorOs ? (v.resultado / v.valorOs) * 100 : 0,
      contribuicaoPct: v.valorOs ? (v.contribuicao / v.valorOs) * 100 : 0,
    }));

  const statusPorAno = [...porAnoStatus.values()].sort((a, b) =>
    a.ano !== b.ano ? a.ano - b.ano : b.count - a.count);

  return { meses, vendedores, statusPorAno };
}

/** Monta o contexto de dados financeiros (texto) enviado como system message ao Claude.
 *  Reconstruído a cada pergunta para refletir o estado mais recente do banco. */
async function montarContextoFinanceiro(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<string> {
  const [mensal, dre, fixosAtivos, marketingRows, dividasAtivas, radar] = await Promise.all([
    db.select().from(financeiroMensal),
    db.select().from(dreMensal),
    db.select().from(custosFixos).where(eq(custosFixos.ativo, true)),
    db.select().from(custoMarketing),
    db.select().from(dividasParcelamentos).where(eq(dividasParcelamentos.ativo, true)),
    calcularRadarMargens(db),
  ]);

  const linhasMensal = mensal
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
    .map(r => {
      const campos: string[] = [];
      const add = (label: string, v: string | number | null) => { if (v != null) campos.push(`${label}=${fmtR(Number(v))}`); };
      add("Faturamento", r.faturamentoOficial);
      add("DespFixas", r.despesasFixas);
      add("DespVariaveis", r.despesasVariaveis);
      add("LucroLiquido", r.lucroLiquido);
      add("SaldoMes", r.saldoMes);
      add("TL1", r.tl1); add("TL2", r.tl2); add("TL3", r.tl3);
      add("ImpostoDAS", r.impostoDas); add("ICMS_DIFAL", r.impostoIcmsDifal); add("DAEMS", r.impostoDaems);
      add("ComissoesBV", r.comissoesBv); add("ProdutividadeSolda", r.produtividadeSolda);
      add("FreteRetrabalho", r.freteRetrabalho); add("DevSoftware", r.devSoftware);
      if (r.numColaboradores != null) campos.push(`Colaboradores=${r.numColaboradores}`);
      return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados preenchidos)"}`;
    });

  const linhasDre = dre
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
    .map(r => {
      const campos: string[] = [];
      const add = (label: string, v: string | number | null) => { if (v != null) campos.push(`${label}=${fmtR(Number(v))}`); };
      add("ReceitaOpBruta", r.receitaOperacionalBruta);
      add("LucroBruto", r.lucroBruto);
      add("LucroOperacional", r.lucroOperacional);
      add("LucroLiquido", r.lucroLiquido);
      add("MateriaPrima", r.materiaPrima);
      add("DespesasFixas", r.despesasFixas);
      return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados)"}`;
    });

  const totalCustosFixos = fixosAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalMarketing = marketingRows.reduce((s, m) => s + Number(m.investimento || 0), 0);

  // Resumo do Radar de Margens (historico_os): totais por ano + ranking de vendedores,
  // pra que o chat consiga responder perguntas sobre margem/vendedor sem inventar números.
  const porAno = new Map<number, { count: number; valorOs: number; resultado: number; contribuicao: number }>();
  for (const m of radar.meses) {
    const a = porAno.get(m.ano) ?? { count: 0, valorOs: 0, resultado: 0, contribuicao: 0 };
    a.count += m.count; a.valorOs += m.valorOs; a.resultado += m.resultado; a.contribuicao += m.contribuicao;
    porAno.set(m.ano, a);
  }
  const linhasRadarAno = [...porAno.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ano, a]) => {
      const resPct = a.valorOs ? (a.resultado / a.valorOs) * 100 : 0;
      const conPct = a.valorOs ? (a.contribuicao / a.valorOs) * 100 : 0;
      return `${ano}: ${a.count} O.S. vendidas, ValorVendido=${fmtR(a.valorOs)}, ResultadoLiquido=${fmtR(a.resultado)} (${resPct.toFixed(1)}%), MargemContribuicao=${fmtR(a.contribuicao)} (${conPct.toFixed(1)}%)`;
    });
  const linhasVendedores = radar.vendedores
    .slice(0, 8)
    .map(v => `${v.vendedor}: ${v.count} O.S., ValorVendido=${fmtR(v.valorOs)}, MargemLiquida=${v.resultadoPct.toFixed(1)}%, MargemContribuicao=${v.contribuicaoPct.toFixed(1)}%`);

  return `## DADOS FINANCEIROS DISPONÍVEIS (banco de produção, consultado agora)

### Painel Financeiro mensal (financeiro_mensal) — fonte oficial de faturamento
${linhasMensal.length ? linhasMensal.join("\n") : "Nenhum mês cadastrado."}

### DRE Gerencial mensal (dre_mensal) — alimentado pelo ERP (MubiSys), pode divergir do faturamento oficial acima
${linhasDre.length ? linhasDre.join("\n") : "Nenhum mês cadastrado."}

### Custos Fixos ativos cadastrados
Total mensal previsto: ${fmtR(totalCustosFixos)} (${fixosAtivos.length} itens ativos)

### Marketing
Investimento total acumulado (todos os meses cadastrados): ${fmtR(totalMarketing)}

### Dívidas e Parcelamentos ativos
${dividasAtivas.length} registro(s) ativo(s).

### Radar de Margens (historico_os) — resultado líquido e margem de contribuição por O.S., agrupado pelo mês em que a O.S. foi vendida/aprovada (não pela data de faturamento). Exclui retrabalho, amostra, cortesia e canceladas.
Totais por ano:
${linhasRadarAno.length ? linhasRadarAno.join("\n") : "Sem histórico de O.S. sincronizado."}

Ranking de vendedores (histórico completo, mínimo 5 O.S.):
${linhasVendedores.length ? linhasVendedores.join("\n") : "Sem vendedores com volume suficiente."}

## O QUE NÃO ESTÁ DISPONÍVEL NESTE CONTEXTO (não invente estes números)
- Orçado/Budget mensal (não existe cadastro de metas no sistema hoje)
- Depreciação/amortização e juros separados de despesas fixas (portanto EBITDA calculado aqui é aproximado e coincide com Lucro Líquido)
- Dados por produto/canal (o Radar de Margens acima cobre vendedor, mas não produto/canal — necessários para Pareto, LTV/CAC completos)
- Capital investido e patrimônio líquido (necessários para ROIC/ROE)
- Prazos de recebimento/pagamento (necessários para Capital de Giro e Ciclo de Caixa)`;
}

// ─── Upload da planilha de Fechamento Financeiro Mensal (aba "Fluxo de Caixa") ──
// Substitui o processo manual (ver _import_financeiro_mensal.mts na raiz do
// projeto) de copiar valores linha a linha do export "Fechamento -AAAA.MM.xlsx"
// (Google Sheets) para financeiro_mensal.

const MESES_ABREV_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const LABEL_DESPESAS_FIXAS = "(-) Despesas Fixas (Exceto Dívidas e Investimentos)";
const LABEL_DESPESAS_VARIAVEIS = "(-) Despesas Variáveis";
const LABEL_TL1 = "(=) TL1";
const LABEL_TL2 = "(=) TL2";
const LABEL_TL3 = "(=) TL3";
const LABEL_RESULTADO = "Resultado";

// Mapeamento validado com o usuário para abr-jul/2026 (ver _import_financeiro_mensal.mts).
// A busca pela linha usa a primeira ocorrência exata do texto na coluna A, o que
// naturalmente ignora o bloco de percentuais duplicado mais abaixo na planilha.
const CAMPOS_FECHAMENTO: Array<{ campo: string; label: string }> = [
  { campo: "despesasFixas", label: LABEL_DESPESAS_FIXAS },
  { campo: "despesasVariaveis", label: LABEL_DESPESAS_VARIAVEIS },
  { campo: "tl1", label: LABEL_TL1 },
  { campo: "tl2", label: LABEL_TL2 },
  { campo: "impostoDas", label: "2 . 1 . 1 . 1 - DAS Simples Nacional" },
  { campo: "impostoIcmsDifal", label: "2 . 1 . 1 . 3 - ICMS DIFAL e EQUALIZADOR" },
  { campo: "impostoDaems", label: "2 . 1 . 1 . 4 - DAEMS" },
  { campo: "comissoesBv", label: "2 . 1 . 2 . 1 - Comissões BV | Vendas Externas" },
  { campo: "freteRetrabalho", label: "2 . 1 . 2 . 3 - Frete Retrabalho" },
  { campo: "produtividadeSolda", label: "2 . 4 . 4 - Produtividade Solda" },
  { campo: "devSoftware", label: "2 . 9 . 6 - Desenvolvimento de Software" },
];

const CAMPOS_LABELS_PT: Record<string, string> = {
  despesasFixas: "Despesas Fixas",
  despesasVariaveis: "Despesas Variáveis",
  tl1: "TL1",
  tl2: "TL2",
  tl3: "TL3 (Resultado)",
  saldoMes: "Saldo do Mês",
  impostoDas: "DAS Simples Nacional",
  impostoIcmsDifal: "ICMS DIFAL",
  impostoDaems: "DAEMS",
  comissoesBv: "Comissões BV",
  freteRetrabalho: "Frete Retrabalho",
  produtividadeSolda: "Produtividade Solda",
  devSoftware: "Desenvolvimento de Software",
};

/** Converte uma célula de valor monetário da planilha em número.
 *  "R$ -" ou "-" isolado significa zero real, nunca "sem dado" — só uma célula
 *  genuinamente vazia (defval null do sheet_to_json) vira null. */
function parseValorMonetario(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (s === "") return null;
  if (/^-?\s*(r\$)?\s*-\s*$/i.test(s)) return 0;
  const limpo = s.replace(/r\$/i, "").replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n;
}

interface MesFechamento {
  mes: number;
  ano: number;
  valores: Record<string, number | null>;
}

function parsePlanilhaFechamento(buffer: Buffer): { meses: MesFechamento[]; camposAusentes: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nomeAba = wb.SheetNames.find(n => n.trim().toLowerCase() === "fluxo de caixa")
    ?? wb.SheetNames.find(n => n.toLowerCase().includes("fluxo de caixa"));
  if (!nomeAba) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Aba "Fluxo de Caixa" não encontrada no arquivo. Abas disponíveis: ${wb.SheetNames.join(", ")}` });
  }
  const ws = wb.Sheets[nomeAba];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (rows.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `A aba "Fluxo de Caixa" está vazia.` });
  }

  // Colunas de mês: cabeçalho no formato "Jan/2026" (a planilha pode ter espaços
  // de padding em volta, tratados pelo trim; várias colunas de mês coexistem).
  const header = rows[0] ?? [];
  const colunasMes: Array<{ col: number; mes: number; ano: number }> = [];
  for (let col = 1; col < header.length; col++) {
    const raw = header[col];
    if (typeof raw !== "string") continue;
    const m = /^([A-Za-z]{3})\/(\d{4})$/.exec(raw.trim());
    if (!m) continue;
    const mes = MESES_ABREV_PT[m[1].toLowerCase()];
    if (!mes) continue;
    colunasMes.push({ col, mes, ano: parseInt(m[2], 10) });
  }
  if (colunasMes.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Não encontrei colunas de mês (ex: "Jan/2026") no cabeçalho da aba "Fluxo de Caixa".` });
  }

  const linhaPorLabel = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const cel = rows[i]?.[0];
    if (typeof cel !== "string") continue;
    const texto = cel.trim();
    if (!linhaPorLabel.has(texto)) linhaPorLabel.set(texto, i);
  }

  const camposAusentes = CAMPOS_FECHAMENTO
    .filter(({ label }) => !linhaPorLabel.has(label))
    .map(({ campo }) => campo);
  const linhaResultado = linhaPorLabel.get(LABEL_RESULTADO);
  const linhaTl3 = linhaPorLabel.get(LABEL_TL3);
  if (linhaResultado == null && linhaTl3 == null) camposAusentes.push("tl3");

  const meses: MesFechamento[] = colunasMes.map(({ col, mes, ano }) => {
    const valores: Record<string, number | null> = {};
    for (const { campo, label } of CAMPOS_FECHAMENTO) {
      const linha = linhaPorLabel.get(label);
      valores[campo] = linha != null ? parseValorMonetario(rows[linha]?.[col]) : null;
    }
    // TL3/Saldo do mês: prioriza a linha "Resultado" (mais casas decimais),
    // cai para "(=) TL3" se ela não existir ou vier vazia para este mês.
    let tl3: number | null = linhaResultado != null ? parseValorMonetario(rows[linhaResultado]?.[col]) : null;
    if (tl3 == null && linhaTl3 != null) tl3 = parseValorMonetario(rows[linhaTl3]?.[col]);
    valores.tl3 = tl3;
    valores.saldoMes = tl3;
    return { mes, ano, valores };
  });

  return { meses, camposAusentes };
}

export const financeiroRouter = router({
  // Buscar dados financeiros de um mês/ano específico
  get: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano)))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Listar todos os registros financeiros
  list: publicProcedure
    .input(z.object({ ano: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(financeiroMensal);
      if (input?.ano) return rows.filter(r => r.ano === input.ano);
      return rows.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
    }),

  // Criar ou atualizar registro financeiro mensal
  upsert: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      faturamentoOficial: z.number().nullable().optional(),
      despesasFixas: z.number().nullable().optional(),
      despesasVariaveis: z.number().nullable().optional(),
      numColaboradores: z.number().int().nullable().optional(),
      lucroBruto: z.number().nullable().optional(),
      lucroLiquido: z.number().nullable().optional(),
      notas: z.string().nullable().optional(),
      // Novos campos a partir de Abr/2026
      impostoDas: z.number().nullable().optional(),
      impostoIcmsDifal: z.number().nullable().optional(),
      impostoDaems: z.number().nullable().optional(),
      comissoesBv: z.number().nullable().optional(),
      produtividadeSolda: z.number().nullable().optional(),
      freteRetrabalho: z.number().nullable().optional(),
      devSoftware: z.number().nullable().optional(),
      receitaOperacionalOs: z.number().nullable().optional(),
      resultadoEfetivo: z.number().nullable().optional(),
      saldoMes: z.number().nullable().optional(),
      tl1: z.number().nullable().optional(),
      tl2: z.number().nullable().optional(),
      tl3: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const existing = await db
        .select()
        .from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano)))
        .limit(1);

      const toStr = (v: number | null | undefined) => v != null ? String(v) : null;
      const data = {
        faturamentoOficial: toStr(input.faturamentoOficial),
        despesasFixas: toStr(input.despesasFixas),
        despesasVariaveis: toStr(input.despesasVariaveis),
        numColaboradores: input.numColaboradores ?? null,
        lucroBruto: toStr(input.lucroBruto),
        lucroLiquido: toStr(input.lucroLiquido),
        notas: input.notas ?? null,
        // Novos campos a partir de Abr/2026
        impostoDas: toStr(input.impostoDas),
        impostoIcmsDifal: toStr(input.impostoIcmsDifal),
        impostoDaems: toStr(input.impostoDaems),
        comissoesBv: toStr(input.comissoesBv),
        produtividadeSolda: toStr(input.produtividadeSolda),
        freteRetrabalho: toStr(input.freteRetrabalho),
        devSoftware: toStr(input.devSoftware),
        receitaOperacionalOs: toStr(input.receitaOperacionalOs),
        resultadoEfetivo: toStr(input.resultadoEfetivo),
        saldoMes: toStr(input.saldoMes),
        tl1: toStr(input.tl1),
        tl2: toStr(input.tl2),
        tl3: toStr(input.tl3),
      };

      if (existing.length > 0) {
        await db.update(financeiroMensal).set(data).where(eq(financeiroMensal.id, existing[0].id));
        return { ...existing[0], ...data };
      } else {
        const [result] = await db.insert(financeiroMensal).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: financeiroMensal.id });
        return { id: result.id, mes: input.mes, ano: input.ano, ...data };
      }
    }),

  // Upload da planilha de fechamento mensal ("Fechamento -AAAA.MM.xlsx", aba
  // "Fluxo de Caixa") — processa no servidor e faz upsert por mês/ano em
  // financeiro_mensal, com os mesmos campos que o formulário/`upsert` já usa.
  // faturamentoOficial nunca é tocado aqui: continua exclusivamente manual.
  uploadFechamentoMensal: publicProcedure
    .input(z.object({
      arquivoBase64: z.string().min(1),
      nomeArquivo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let buffer: Buffer;
      try {
        buffer = Buffer.from(input.arquivoBase64, "base64");
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido." });
      }

      const { meses, camposAusentes } = parsePlanilhaFechamento(buffer);

      const mesesProcessados: Array<{
        mes: number; ano: number; status: "criado" | "atualizado"; camposVazios: string[];
      }> = [];

      for (const { mes, ano, valores } of meses) {
        const existing = await db
          .select()
          .from(financeiroMensal)
          .where(and(eq(financeiroMensal.mes, mes), eq(financeiroMensal.ano, ano)))
          .limit(1);

        const data: Record<string, string | null> = {};
        const camposVazios: string[] = [];
        for (const [campo, valor] of Object.entries(valores)) {
          if (valor == null) {
            camposVazios.push(CAMPOS_LABELS_PT[campo] ?? campo);
            data[campo] = null;
          } else {
            data[campo] = valor.toFixed(2);
          }
        }

        // lucroBruto/lucroLiquido = faturamentoOficial - despesasFixas - despesasVariaveis,
        // só recalculado se faturamentoOficial já estiver cadastrado manualmente para o mês.
        const faturamentoAtual = existing[0]?.faturamentoOficial != null
          ? parseFloat(existing[0].faturamentoOficial) : null;
        if (faturamentoAtual != null && valores.despesasFixas != null && valores.despesasVariaveis != null) {
          const lucro = faturamentoAtual - valores.despesasFixas - valores.despesasVariaveis;
          data.lucroBruto = lucro.toFixed(2);
          data.lucroLiquido = lucro.toFixed(2);
        }

        if (existing.length > 0) {
          await db.update(financeiroMensal).set(data).where(eq(financeiroMensal.id, existing[0].id));
          mesesProcessados.push({ mes, ano, status: "atualizado", camposVazios });
        } else {
          await db.insert(financeiroMensal).values({ mes, ano, ...data });
          mesesProcessados.push({ mes, ano, status: "criado", camposVazios });
        }
      }

      return {
        nomeArquivo: input.nomeArquivo ?? null,
        mesesProcessados: mesesProcessados.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes),
        camposNaoEncontradosNaPlanilha: camposAusentes.map(c => CAMPOS_LABELS_PT[c] ?? c),
      };
    }),

  // ─── Custo Marketing ─────────────────────────────────────────────────────────
  getCustoMarketing: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(custoMarketing)
        .where(and(eq(custoMarketing.mes, input.mes), eq(custoMarketing.ano, input.ano)))
        .limit(1);
      return rows[0] ?? null;
    }),

  getCustoMarketingAno: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(custoMarketing)
        .where(eq(custoMarketing.ano, input.ano));
      return rows.sort((a, b) => a.mes - b.mes);
    }),

  upsertCustoMarketing: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      investimentoAquisicao: z.number().min(0),
      investimentoReativacao: z.number().min(0),
      observacao: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existing = await db
        .select()
        .from(custoMarketing)
        .where(and(eq(custoMarketing.mes, input.mes), eq(custoMarketing.ano, input.ano)))
        .limit(1);
      const data = {
        investimentoAquisicao: String(input.investimentoAquisicao),
        investimentoReativacao: String(input.investimentoReativacao),
        investimento: String(input.investimentoAquisicao + input.investimentoReativacao),
        observacao: input.observacao ?? null,
      };
      if (existing.length > 0) {
        await db.update(custoMarketing).set(data).where(eq(custoMarketing.id, existing[0].id));
        return { ...existing[0], ...data };
      } else {
        const [result] = await db.insert(custoMarketing).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: custoMarketing.id });
        return { id: result.id, mes: input.mes, ano: input.ano, ...data };
      }
    }),

  // Importação em lote (planilha): agrega valores por mês/ano/categoria e faz upsert
  importCustoMarketingLote: publicProcedure
    .input(z.array(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      categoria: z.enum(["aquisicao", "reativacao"]),
      valor: z.number().min(0),
    })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const agregados = new Map<string, { mes: number; ano: number; aquisicao: number; reativacao: number }>();
      for (const linha of input) {
        const chave = `${linha.ano}-${linha.mes}`;
        const atual = agregados.get(chave) ?? { mes: linha.mes, ano: linha.ano, aquisicao: 0, reativacao: 0 };
        if (linha.categoria === "aquisicao") atual.aquisicao += linha.valor;
        else atual.reativacao += linha.valor;
        agregados.set(chave, atual);
      }

      const resultados = [];
      for (const { mes, ano, aquisicao, reativacao } of agregados.values()) {
        const existing = await db
          .select()
          .from(custoMarketing)
          .where(and(eq(custoMarketing.mes, mes), eq(custoMarketing.ano, ano)))
          .limit(1);

        const aquisicaoTotal = (existing[0] ? Number(existing[0].investimentoAquisicao) : 0) + aquisicao;
        const reativacaoTotal = (existing[0] ? Number(existing[0].investimentoReativacao) : 0) + reativacao;
        const data = {
          investimentoAquisicao: String(aquisicaoTotal),
          investimentoReativacao: String(reativacaoTotal),
          investimento: String(aquisicaoTotal + reativacaoTotal),
        };

        if (existing.length > 0) {
          await db.update(custoMarketing).set(data).where(eq(custoMarketing.id, existing[0].id));
          resultados.push({ id: existing[0].id, mes, ano, ...data });
        } else {
          const [result] = await db.insert(custoMarketing).values({ mes, ano, ...data }).returning({ id: custoMarketing.id });
          resultados.push({ id: result.id, mes, ano, ...data });
        }
      }
      return resultados;
    }),

  // ─── Lançamentos detalhados de Marketing (fornecedor/despesa) ────────────────
  getCustoMarketingItensAno: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(custoMarketingItens)
        .where(eq(custoMarketingItens.ano, input.ano));
      return rows
        .map(r => ({ ...r, valor: Number(r.valor) }))
        .sort((a, b) => a.mes !== b.mes ? a.mes - b.mes : (a.dataVencimento?.getTime() ?? 0) - (b.dataVencimento?.getTime() ?? 0));
    }),

  // ─── Custos Fixos ────────────────────────────────────────────────────────────
  getCustosFixos: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(custosFixos).where(eq(custosFixos.ativo, true));
      return rows.map(r => ({ ...r, valor: Number(r.valor) }));
    }),

  upsertCustoFixo: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      plano: z.string(),
      categoria: z.string(),
      grupoCategoria: z.string(),
      fornecedor: z.string(),
      tipo: z.string(),
      valor: z.number().min(0),
      vencimento: z.number().nullable().optional(),
      observacao: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const data = {
        plano: input.plano,
        categoria: input.categoria,
        grupoCategoria: input.grupoCategoria,
        fornecedor: input.fornecedor,
        tipo: input.tipo,
        valor: String(input.valor),
        vencimento: input.vencimento ?? null,
        observacao: input.observacao ?? null,
      };
      if (input.id) {
        await db.update(custosFixos).set(data).where(eq(custosFixos.id, input.id));
        return { id: input.id, ...data };
      } else {
        const [result] = await db.insert(custosFixos).values(data).returning({ id: custosFixos.id });
        return { id: result.id, ...data };
      }
    }),

  deleteCustoFixo: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(custosFixos).set({ ativo: false }).where(eq(custosFixos.id, input.id));
      return { ok: true };
    }),

  // ─── Dívidas e Parcelamentos ─────────────────────────────────────────────────
  getDividas: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dividasParcelamentos).where(eq(dividasParcelamentos.ativo, true));
      return rows.map(r => ({
        ...r,
        media: r.media ? Number(r.media) : null,
        janValor: r.janValor ? Number(r.janValor) : null,
        fevValor: r.fevValor ? Number(r.fevValor) : null,
        marValor: r.marValor ? Number(r.marValor) : null,
        abrValor: r.abrValor ? Number(r.abrValor) : null,
        maiValor: r.maiValor ? Number(r.maiValor) : null,
        junValor: r.junValor ? Number(r.junValor) : null,
        julValor: r.julValor ? Number(r.julValor) : null,
        agoValor: r.agoValor ? Number(r.agoValor) : null,
        setValor: r.setValor ? Number(r.setValor) : null,
        outValor: r.outValor ? Number(r.outValor) : null,
        novValor: r.novValor ? Number(r.novValor) : null,
        dezValor: r.dezValor ? Number(r.dezValor) : null,
      }));
    }),

  // ─── DRE Mensal ──────────────────────────────────────────────────────────────
  getDreMensal: publicProcedure
    .input(z.object({ ano: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dreMensal);
      const filtered = input.ano ? rows.filter(r => r.ano === input.ano) : rows;
      return filtered
        .sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)
        .map(r => ({
          ...r,
          receitaOperacionalBruta: r.receitaOperacionalBruta ? Number(r.receitaOperacionalBruta) : null,
          receitaFinanceira: r.receitaFinanceira ? Number(r.receitaFinanceira) : null,
          receitaNaoOperacional: r.receitaNaoOperacional ? Number(r.receitaNaoOperacional) : null,
          totalEntradas: r.totalEntradas ? Number(r.totalEntradas) : null,
          impostosVendas: r.impostosVendas ? Number(r.impostosVendas) : null,
          despesaVariavel: r.despesaVariavel ? Number(r.despesaVariavel) : null,
          despesaOperacional: r.despesaOperacional ? Number(r.despesaOperacional) : null,
          materiaPrima: r.materiaPrima ? Number(r.materiaPrima) : null,
          gastosGeraisFabricacao: r.gastosGeraisFabricacao ? Number(r.gastosGeraisFabricacao) : null,
          despesasPessoal: r.despesasPessoal ? Number(r.despesasPessoal) : null,
          despesasFixas: r.despesasFixas ? Number(r.despesasFixas) : null,
          despesasFinanceiras: r.despesasFinanceiras ? Number(r.despesasFinanceiras) : null,
          despesasNaoOperacionais: r.despesasNaoOperacionais ? Number(r.despesasNaoOperacionais) : null,
          totalSaidas: r.totalSaidas ? Number(r.totalSaidas) : null,
          receitaBrutaOperacional: r.receitaBrutaOperacional ? Number(r.receitaBrutaOperacional) : null,
          lucroBruto: r.lucroBruto ? Number(r.lucroBruto) : null,
          lucroOperacional: r.lucroOperacional ? Number(r.lucroOperacional) : null,
          lucroLiquido: r.lucroLiquido ? Number(r.lucroLiquido) : null,
          valorPedidos: r.valorPedidos ? Number(r.valorPedidos) : null,
          resultadoEfetivo: r.resultadoEfetivo ? Number(r.resultadoEfetivo) : null,
          margemResultadoEfetivo: r.margemResultadoEfetivo ? Number(r.margemResultadoEfetivo) : null,
          percMateriaPrima: r.percMateriaPrima ? Number(r.percMateriaPrima) : null,
          percFixoRateado: r.percFixoRateado ? Number(r.percFixoRateado) : null,
          percTributos: r.percTributos ? Number(r.percTributos) : null,
          percComissaoInterna: r.percComissaoInterna ? Number(r.percComissaoInterna) : null,
          percDescontos: r.percDescontos ? Number(r.percDescontos) : null,
        }));
    }),

  // ─── Radar de Margens (histórico completo por O.S. em historico_os, agrupado
  // pelo mês/ano em que a O.S. foi vendida — mesma base do backfill do dre_mensal,
  // mas com resultado líquido e margem de contribuição por O.S., que dre_mensal
  // não tem, e ranking por vendedor) ──────────────────────────────────────────
  getRadarMargens: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { meses: [], vendedores: [], statusPorAno: [] };
    return calcularRadarMargens(db);
  }),

  // ─── Retenção de clientes (compra única × recompra × intervalo entre compras,
  // por ano de venda — mesma base do Radar de Margens) ──────────────────────────
  getRetencaoClientes: publicProcedure
    .input(z.object({
      // Restringe todos os anos ao mesmo recorte jan-mesLimite — sem isso, um ano
      // corrente parcial (poucos meses) parece ter menos recompra só por ainda não
      // ter tido tempo de o cliente voltar, não porque a retenção caiu de verdade.
      mesLimite: z.number().min(1).max(12).optional(),
    }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { anos: [] };
    const mesLimite = input?.mesLimite;

    const rows = await db.select({
      ano: historicoOs.ano,
      mes: historicoOs.mes,
      empresa: historicoOs.empresa,
      dataAprovacao: historicoOs.dataAprovacao,
      valorOs: historicoOs.valorOs,
      tipoOs: historicoOs.tipoOs,
      status: historicoOs.status,
    }).from(historicoOs);

    const num = (v: string | null | undefined) => parseFloat(String(v ?? "0")) || 0;

    // dataAprovacao tem dois formatos no banco: ISO "2026-09-01 07:42:07" (sync
    // recente) e BR "22/05/2023 18:29" (importação antiga) — trata os dois.
    function parseData(s: string | null): Date | null {
      if (!s) return null;
      let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return null;
    }

    interface ClienteAcc { count: number; valor: number; datas: Date[] }
    const porAno = new Map<number, Map<string, ClienteAcc>>();

    for (const os of rows) {
      if (!isOsNormalDb(os)) continue;
      if (mesLimite && os.mes > mesLimite) continue;
      const empresa = (os.empresa ?? "").trim();
      if (!empresa) continue;
      const dt = parseData(os.dataAprovacao);
      if (!dt) continue;

      const ano = os.ano;
      if (!porAno.has(ano)) porAno.set(ano, new Map());
      const clientes = porAno.get(ano)!;
      const c = clientes.get(empresa) ?? { count: 0, valor: 0, datas: [] };
      c.count += 1;
      c.valor += num(os.valorOs);
      c.datas.push(dt);
      clientes.set(empresa, c);
    }

    const anos = [...porAno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, clientes]) => {
        let unicos = 0, unicosValor = 0, recompra = 0, recompraValor = 0;
        const intervalos: number[] = [];
        for (const c of clientes.values()) {
          if (c.count === 1) {
            unicos += 1;
            unicosValor += c.valor;
          } else {
            recompra += 1;
            recompraValor += c.valor;
            const datasOrdenadas = [...c.datas].sort((a, b) => a.getTime() - b.getTime());
            for (let i = 1; i < datasOrdenadas.length; i++) {
              const dias = (datasOrdenadas[i].getTime() - datasOrdenadas[i - 1].getTime()) / 86_400_000;
              if (dias >= 0) intervalos.push(dias);
            }
          }
        }
        intervalos.sort((a, b) => a - b);
        const totalClientes = unicos + recompra;
        return {
          ano,
          totalClientes,
          unicos,
          unicosValor,
          unicosPct: totalClientes ? (unicos / totalClientes) * 100 : 0,
          recompra,
          recompraValor,
          recompraPct: totalClientes ? (recompra / totalClientes) * 100 : 0,
          intervaloMedioDias: intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : null,
          intervaloMedianaDias: intervalos.length ? intervalos[Math.floor(intervalos.length / 2)] : null,
          amostraIntervalos: intervalos.length,
        };
      });

    return { anos };
  }),

  // ─── Chat de IA (CFO virtual) ──────────────────────────────────────────────
  perguntarIA: publicProcedure
    .input(z.object({
      pergunta: z.string().min(1),
      historico: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        texto: z.string(),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const contexto = await montarContextoFinanceiro(db);
      const historico: MensagemChat[] = input.historico;
      const resposta = await perguntarSobreFinanceiro(contexto, historico, input.pergunta);
      return { resposta };
    }),
});
