import { createAppDatabase } from "../server/db/db-connection";
import { historicoOs } from "../drizzle/schema";
import { eq, ne, and, gte, lte, sql } from "drizzle-orm";

interface MetricasAno {
  ano: number;
  clientesUnicos: number;
  numeroPedidos: number;
  numeroRecompras: number;
  faturamento: number;
  clientesNovos: number;
  ticketMedio: number;
  margemContribuicaoMediaPct: number;
  margemLucroMediaPct: number;
  contribuicaoTotal: number;
  custoFixoTotal: number;
  resultadoTotal: number;
  pctContribuicaoCobreCustoFixo: number;
  pctContribuicaoSobreFaturamento: number;
  pctResultadoSobreFaturamento: number;
}

interface MetricasPeriodo {
  label: string;
  ano: number;
  mesInicio: number;
  mesFim: number;
  clientesUnicos: number;
  numeroPedidos: number;
  faturamento: number;
  ticketMedio: number;
  contribuicaoTotal: number;
  custoFixoTotal: number;
  resultadoTotal: number;
  margemContribuicaoPct: number;
  margemLucroPct: number;
  pctContribCobreFixo: number;
}

async function buscarMetricasAno(ano: number, mesLimite: number): Promise<MetricasAno> {
  const db = createAppDatabase();

  const rows = await db
    .select({
      empresa: historicoOs.empresa,
      mes: historicoOs.mes,
      valorOs: historicoOs.valorOs,
      contribuicaoReais: historicoOs.contribuicaoReais,
      contribuicaoPct: historicoOs.contribuicaoPct,
      resultadoReais: historicoOs.resultadoReais,
      resultadoPct: historicoOs.resultadoPct,
      custoFixo: historicoOs.custoFixo,
    })
    .from(historicoOs)
    .where(
      and(
        eq(historicoOs.ano, ano),
        ne(historicoOs.status, "Cancelada"),
        lte(historicoOs.mes, mesLimite)
      )
    );

  if (rows.length === 0) {
    return { ano, clientesUnicos: 0, numeroPedidos: 0, numeroRecompras: 0, faturamento: 0, clientesNovos: 0, ticketMedio: 0, margemContribuicaoMediaPct: 0, margemLucroMediaPct: 0, contribuicaoTotal: 0, custoFixoTotal: 0, resultadoTotal: 0, pctContribuicaoCobreCustoFixo: 0, pctContribuicaoSobreFaturamento: 0, pctResultadoSobreFaturamento: 0 };
  }

  const empresasUnicas = new Set(rows.map(r => r.empresa?.trim()).filter(Boolean));
  const clientesUnicos = empresasUnicas.size;
  const numeroPedidos = rows.length;
  const faturamento = rows.reduce((sum, r) => sum + (parseFloat(String(r.valorOs)) || 0), 0);
  const ticketMedio = numeroPedidos > 0 ? faturamento / numeroPedidos : 0;

  const contribuicaoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.contribuicaoReais)) || 0), 0);
  const custoFixoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.custoFixo)) || 0), 0);
  const resultadoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.resultadoReais)) || 0), 0);

  let somaPondContrib = 0, pesoContrib = 0;
  let somaPondLucro = 0, pesoLucro = 0;
  for (const r of rows) {
    const valor = parseFloat(String(r.valorOs)) || 0;
    const pctC = parseFloat(String(r.contribuicaoPct)) || 0;
    const pctL = parseFloat(String(r.resultadoPct)) || 0;
    if (valor > 0) {
      somaPondContrib += valor * pctC; pesoContrib += valor;
      somaPondLucro += valor * pctL; pesoLucro += valor;
    }
  }
  const margemContribuicaoMediaPct = pesoContrib > 0 ? somaPondContrib / pesoContrib : 0;
  const margemLucroMediaPct = pesoLucro > 0 ? somaPondLucro / pesoLucro : 0;

  const pctContribuicaoCobreCustoFixo = custoFixoTotal > 0 ? (contribuicaoTotal / custoFixoTotal) * 100 : 0;
  const pctContribuicaoSobreFaturamento = faturamento > 0 ? (contribuicaoTotal / faturamento) * 100 : 0;
  const pctResultadoSobreFaturamento = faturamento > 0 ? (resultadoTotal / faturamento) * 100 : 0;

  const pedidosPorCliente = new Map<string, number>();
  for (const r of rows) {
    const key = r.empresa?.trim() || "";
    if (key) pedidosPorCliente.set(key, (pedidosPorCliente.get(key) || 0) + 1);
  }
  const numeroRecompras = Array.from(pedidosPorCliente.values()).filter(q => q >= 2).length;

  // Clientes novos: primeira compra no histórico todo foi neste ano
  const primeiraCompraRows = await db
    .select({
      empresa: historicoOs.empresa,
      primeiroAno: sql<number>`min(${historicoOs.ano})`.as("primeiro_ano"),
    })
    .from(historicoOs)
    .where(ne(historicoOs.status, "Cancelada"))
    .groupBy(historicoOs.empresa);

  const primeiroAnoPorCliente = new Map<string, number>();
  for (const r of primeiraCompraRows) {
    const key = r.empresa?.trim() || "";
    if (key && r.primeiroAno) primeiroAnoPorCliente.set(key, r.primeiroAno);
  }

  let clientesNovos = 0;
  for (const empresa of empresasUnicas) {
    if (primeiroAnoPorCliente.get(empresa) === ano) clientesNovos++;
  }

  return {
    ano,
    clientesUnicos,
    numeroPedidos,
    numeroRecompras,
    faturamento: Number(faturamento.toFixed(2)),
    clientesNovos,
    ticketMedio: Number(ticketMedio.toFixed(2)),
    margemContribuicaoMediaPct: Number(margemContribuicaoMediaPct.toFixed(2)),
    margemLucroMediaPct: Number(margemLucroMediaPct.toFixed(2)),
    contribuicaoTotal: Number(contribuicaoTotal.toFixed(2)),
    custoFixoTotal: Number(custoFixoTotal.toFixed(2)),
    resultadoTotal: Number(resultadoTotal.toFixed(2)),
    pctContribuicaoCobreCustoFixo: Number(pctContribuicaoCobreCustoFixo.toFixed(1)),
    pctContribuicaoSobreFaturamento: Number(pctContribuicaoSobreFaturamento.toFixed(1)),
    pctResultadoSobreFaturamento: Number(pctResultadoSobreFaturamento.toFixed(1)),
  };
}

async function buscarMetricasPeriodo(ano: number, mesInicio: number, mesFim: number, label: string): Promise<MetricasPeriodo> {
  const db = createAppDatabase();

  const rows = await db
    .select({
      empresa: historicoOs.empresa,
      mes: historicoOs.mes,
      valorOs: historicoOs.valorOs,
      contribuicaoReais: historicoOs.contribuicaoReais,
      contribuicaoPct: historicoOs.contribuicaoPct,
      resultadoReais: historicoOs.resultadoReais,
      resultadoPct: historicoOs.resultadoPct,
      custoFixo: historicoOs.custoFixo,
    })
    .from(historicoOs)
    .where(
      and(
        eq(historicoOs.ano, ano),
        ne(historicoOs.status, "Cancelada"),
        gte(historicoOs.mes, mesInicio),
        lte(historicoOs.mes, mesFim)
      )
    );

  if (rows.length === 0) {
    return { label, ano, mesInicio, mesFim, clientesUnicos: 0, numeroPedidos: 0, faturamento: 0, ticketMedio: 0, contribuicaoTotal: 0, custoFixoTotal: 0, resultadoTotal: 0, margemContribuicaoPct: 0, margemLucroPct: 0, pctContribCobreFixo: 0 };
  }

  const empresasUnicas = new Set(rows.map(r => r.empresa?.trim()).filter(Boolean));
  const clientesUnicos = empresasUnicas.size;
  const numeroPedidos = rows.length;
  const faturamento = rows.reduce((sum, r) => sum + (parseFloat(String(r.valorOs)) || 0), 0);
  const ticketMedio = numeroPedidos > 0 ? faturamento / numeroPedidos : 0;

  const contribuicaoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.contribuicaoReais)) || 0), 0);
  const custoFixoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.custoFixo)) || 0), 0);
  const resultadoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.resultadoReais)) || 0), 0);

  let somaPondContrib = 0, pesoContrib = 0;
  let somaPondLucro = 0, pesoLucro = 0;
  for (const r of rows) {
    const valor = parseFloat(String(r.valorOs)) || 0;
    const pctC = parseFloat(String(r.contribuicaoPct)) || 0;
    const pctL = parseFloat(String(r.resultadoPct)) || 0;
    if (valor > 0) {
      somaPondContrib += valor * pctC; pesoContrib += valor;
      somaPondLucro += valor * pctL; pesoLucro += valor;
    }
  }
  const margemContribuicaoPct = pesoContrib > 0 ? somaPondContrib / pesoContrib : 0;
  const margemLucroPct = pesoLucro > 0 ? somaPondLucro / pesoLucro : 0;
  const pctContribCobreFixo = custoFixoTotal > 0 ? (contribuicaoTotal / custoFixoTotal) * 100 : 0;

  return {
    label,
    ano,
    mesInicio,
    mesFim,
    clientesUnicos,
    numeroPedidos,
    faturamento: Number(faturamento.toFixed(2)),
    ticketMedio: Number(ticketMedio.toFixed(2)),
    contribuicaoTotal: Number(contribuicaoTotal.toFixed(2)),
    custoFixoTotal: Number(custoFixoTotal.toFixed(2)),
    resultadoTotal: Number(resultadoTotal.toFixed(2)),
    margemContribuicaoPct: Number(margemContribuicaoPct.toFixed(2)),
    margemLucroPct: Number(margemLucroPct.toFixed(2)),
    pctContribCobreFixo: Number(pctContribCobreFixo.toFixed(1)),
  };
}

function calcDiff(base: number, novo: number, isPct: boolean = false): number {
  if (base === 0) return novo > 0 ? 100 : 0;
  if (isPct) return Number((novo - base).toFixed(1)); // diff em pp
  return Number((((novo - base) / base) * 100).toFixed(1));
}

function fmtMoeda(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v); }
function fmtNum(v: number) { return new Intl.NumberFormat("pt-BR").format(v); }
function fmtPct(v: number) { return v.toFixed(1) + "%"; }

async function main() {
  const mesLimite = 11;

  console.log("=== COLETANDO DADOS ===");
  const m2025 = await buscarMetricasAno(2025, mesLimite);
  const m2026 = await buscarMetricasAno(2026, mesLimite);
  const p1 = await buscarMetricasPeriodo(2026, 1, 5, "Jan-Mai");
  const p2 = await buscarMetricasPeriodo(2026, 6, 11, "Jun-Nov");

  // Custo fixo mensal para análise
  const db = createAppDatabase();
  const custoFixoMensal = await db
    .select({
      ano: historicoOs.ano,
      mes: historicoOs.mes,
      custoFixoTotal: sql<number>`sum(${historicoOs.custoFixo})`.as("custo_fixo_total"),
    })
    .from(historicoOs)
    .where(and(ne(historicoOs.status, "Cancelada"), sql`${historicoOs.ano} IN (2025, 2026)`))
    .groupBy(historicoOs.ano, historicoOs.mes)
    .orderBy(historicoOs.ano, historicoOs.mes);

  const totalCustoFixo2025 = custoFixoMensal.filter(x => x.ano === 2025 && x.mes <= 11).reduce((s, x) => s + Number(x.custoFixoTotal), 0);
  const totalCustoFixo2026 = custoFixoMensal.filter(x => x.ano === 2026 && x.mes <= 11).reduce((s, x) => s + Number(x.custoFixoTotal), 0);

  // Faturamento proporcional: volume 2025 × ticket 2026
  const fatProporcional = m2025.numeroPedidos * m2026.ticketMedio;
  const varFatProporcional = calcDiff(m2025.faturamento, fatProporcional);

  // Simulação +10% preço (base = 2ª metade 2026)
  const baseSim = p2;
  const ticketBase = baseSim.ticketMedio;
  const pedidosBase = baseSim.numeroPedidos;
  const fatBase = baseSim.faturamento;
  const contribBase = baseSim.contribuicaoTotal;
  const custoFixoBase = baseSim.custoFixoTotal;
  const resultadoBase = baseSim.resultadoTotal;
  const pctContribFat = baseSim.margemContribuicaoPct / 100;

  const cenariosSim = [
    { nome: "Atual", multP: 1.00, multV: 1.00 },
    { nome: "+5% preço, -5% vol", multP: 1.05, multV: 0.95 },
    { nome: "+10% preço, -5% vol", multP: 1.10, multV: 0.95 },
    { nome: "+10% preço, -10% vol", multP: 1.10, multV: 0.90 },
    { nome: "+10% preço, -15% vol", multP: 1.10, multV: 0.85 },
  ].map(c => {
    const novoTicket = ticketBase * c.multP;
    const novosPedidos = Math.round(pedidosBase * c.multV);
    const novoFat = novosPedidos * novoTicket;
    const novaContrib = novoFat * pctContribFat;
    const novoResultado = novaContrib - custoFixoBase;
    const novaMargemLucro = novoFat > 0 ? (novoResultado / novoFat) * 100 : 0;
    return { ...c, novoTicket, novosPedidos, novoFat, novaContrib, novoResultado, novaMargemLucro };
  });

  // ==================== HTML OUTPUT ====================
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Análise Completa 2025 vs 2026 - Radrasis</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif}.pos{color:#16a34a}.neg{color:#dc2626}.neu{color:#6b7280}.sec{bg:#f3f4f6;font-weight:600}.card{background:white;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.05)}</style></head>
<body class="bg-gray-50 p-6"><div class="max-w-6xl mx-auto space-y-6">

<!-- HEADER -->
<div class="card p-6"><h1 class="text-2xl font-bold text-gray-900 mb-1">Análise Completa: 2025 vs 2026 (Jan-Nov) + Semestral 2026</h1>
<p class="text-gray-600">Fonte: <code>historico_os</code> — OS não canceladas, mês ≤ 11 (inclui "Não faturado") | Gerado: ${new Date().toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}</p></div>

<!-- 1. COMPARATIVO 2025 vs 2026 -->
<div class="card overflow-hidden">
<div class="sec px-6 py-3 border-b">📊 1. Comparativo Anual: 2025 vs 2026 (Janeiro a Novembro)</div>
<table class="w-full"><thead class="bg-gray-50"><tr>
<th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Métrica</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">2025</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">2026</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">Variação</th></tr></thead>
<tbody class="divide-y">${[
  {l:"a) Clientes únicos", v25:m2025.clientesUnicos, v26:m2026.clientesUnicos, f:fmtNum, pct:false},
  {l:"b) Número de pedidos", v25:m2025.numeroPedidos, v26:m2026.numeroPedidos, f:fmtNum, pct:false},
  {l:"c) Recompras (clientes 2+ pedidos)", v25:m2025.numeroRecompras, v26:m2026.numeroRecompras, f:fmtNum, pct:false},
  {l:"d) Faturamento", v25:m2025.faturamento, v26:m2026.faturamento, f:fmtMoeda, pct:false},
  {l:"e) Faturamento proporcional (vol.2025 × ticket.2026)", v25:m2025.faturamento, v26:fatProporcional, f:fmtMoeda, pct:false, diff:varFatProporcional},
  {l:"f) Clientes novos (1ª compra no ano)", v25:m2025.clientesNovos, v26:m2026.clientesNovos, f:fmtNum, pct:false},
  {l:"g) Ticket médio", v25:m2025.ticketMedio, v26:m2026.ticketMedio, f:fmtMoeda, pct:false},
  {l:"h) Margem contrib. média (ponderada)", v25:m2025.margemContribuicaoMediaPct, v26:m2026.margemContribuicaoMediaPct, f:fmtPct, pct:true},
  {l:"i) Margem lucro média (ponderada)", v25:m2025.margemLucroMediaPct, v26:m2026.margemLucroMediaPct, f:fmtPct, pct:true},
  {l:"j) Contribuição total (R$)", v25:m2025.contribuicaoTotal, v26:m2026.contribuicaoTotal, f:fmtMoeda, pct:false},
  {l:"k) Custo fixo total (R$)", v25:m2025.custoFixoTotal, v26:m2026.custoFixoTotal, f:fmtMoeda, pct:false},
  {l:"l) Resultado / Lucro operacional (R$)", v25:m2025.resultadoTotal, v26:m2026.resultadoTotal, f:fmtMoeda, pct:false},
  {l:"m) % Contribuição cobre Custo Fixo", v25:m2025.pctContribuicaoCobreCustoFixo, v26:m2026.pctContribuicaoCobreCustoFixo, f:fmtPct, pct:true},
  {l:"n) % Contribuição / Faturamento", v25:m2025.pctContribuicaoSobreFaturamento, v26:m2026.pctContribuicaoSobreFaturamento, f:fmtPct, pct:true},
  {l:"o) % Resultado / Faturamento (Margem líquida)", v25:m2025.pctResultadoSobreFaturamento, v26:m2026.pctResultadoSobreFaturamento, f:fmtPct, pct:true},
].map(m => {
  const diff = m.diff !== undefined ? m.diff : calcDiff(m.v25, m.v26, m.pct);
  const cls = diff > 0 ? "pos" : diff < 0 ? "neg" : "neu";
  const sign = diff > 0 ? "+" : "";
  const unit = m.pct ? " pp" : "%";
  const v25f = m.f(m.v25), v26f = m.f(m.v26);
  return `<tr class="hover:bg-gray-50"><td class="px-4 py-2 font-medium">${m.l}</td><td class="px-4 py-2 text-right font-mono">${v25f}</td><td class="px-4 py-2 text-right font-mono">${v26f}</td><td class="px-4 py-2 text-right font-semibold ${cls} font-mono">${sign}${diff.toFixed(1)}${unit}</td></tr>`;
}).join("")}</tbody></table></div>

<!-- Faturamento Proporcional Destaque -->
<div class="card p-6 bg-blue-50 border-blue-200">
<h3 class="font-semibold text-blue-900 mb-3">📈 Faturamento Proporcional: "E se 2026 tivesse o volume de 2025?"</h3>
<div class="grid md:grid-cols-3 gap-4 text-sm">
<div class="bg-white p-4 rounded border"><p class="text-blue-900 font-semibold">Faturamento real 2025</p><p class="text-2xl font-bold text-blue-700">${fmtMoeda(m2025.faturamento)}</p></div>
<div class="bg-white p-4 rounded border"><p class="text-green-900 font-semibold">Faturamento proporcional 2026</p><p class="text-2xl font-bold text-green-700">${fmtMoeda(fatProporcional)}</p><p class="text-xs text-gray-500">${fmtNum(m2025.numeroPedidos)} pedidos × ${fmtMoeda(m2026.ticketMedio)}/ticket</p></div>
<div class="bg-${varFatProporcional >= 0 ? 'green' : 'red'}-100 p-4 rounded border border-${varFatProporcional >= 0 ? 'green' : 'red'}-300"><p class="font-semibold text-${varFatProporcional >= 0 ? 'green' : 'red'}-900">Ganho de faturamento</p><p class="text-2xl font-bold text-${varFatProporcional >= 0 ? 'green' : 'red'}-700">${varFatProporcional >= 0 ? '+' : ''}${varFatProporcional.toFixed(1)}%</p><p class="text-${varFatProporcional >= 0 ? 'green' : 'red'}-700">${varFatProporcional >= 0 ? 'R$ ' + fmtMoeda(fatProporcional - m2025.faturamento).replace('R$','').trim() : 'R$ ' + fmtMoeda(m2025.faturamento - fatProporcional).replace('R$','').trim()} ${varFatProporcional >= 0 ? 'a mais' : 'a menos'}</p></div>
</div></div>

<!-- 2. SEMESTRAL 2026 -->
<div class="card overflow-hidden">
<div class="sec px-6 py-3 border-b">📊 2. 2026 Semestral: Jan-Mai (5m) vs Jun-Nov (6m)</div>
<table class="w-full"><thead class="bg-gray-50"><tr>
<th class="px-4 py-2 text-left text-xs font-semibold text-gray-600">Métrica</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">${p1.label}</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">${p2.label}</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">Variação</th></tr></thead>
<tbody class="divide-y">${[
  {l:"Clientes únicos", v1:p1.clientesUnicos, v2:p2.clientesUnicos, f:fmtNum, pct:false},
  {l:"Pedidos", v1:p1.numeroPedidos, v2:p2.numeroPedidos, f:fmtNum, pct:false},
  {l:"Faturamento", v1:p1.faturamento, v2:p2.faturamento, f:fmtMoeda, pct:false},
  {l:"Ticket médio", v1:p1.ticketMedio, v2:p2.ticketMedio, f:fmtMoeda, pct:false},
  {l:"Contribuição total", v1:p1.contribuicaoTotal, v2:p2.contribuicaoTotal, f:fmtMoeda, pct:false},
  {l:"Custo fixo total", v1:p1.custoFixoTotal, v2:p2.custoFixoTotal, f:fmtMoeda, pct:false},
  {l:"Resultado (Lucro oper.)", v1:p1.resultadoTotal, v2:p2.resultadoTotal, f:fmtMoeda, pct:false},
  {l:"Margem contrib. (pond.)", v1:p1.margemContribuicaoPct, v2:p2.margemContribuicaoPct, f:fmtPct, pct:true},
  {l:"Margem lucro (pond.)", v1:p1.margemLucroPct, v2:p2.margemLucroPct, f:fmtPct, pct:true},
  {l:"% Contrib. cobre Fixo", v1:p1.pctContribCobreFixo, v2:p2.pctContribCobreFixo, f:fmtPct, pct:true},
].map(m => {
  const diff = m.pct ? (m.v2 - m.v1).toFixed(1) : (((m.v2 - m.v1) / m.v1) * 100).toFixed(1);
  const cls = parseFloat(diff) > 0 ? "pos" : parseFloat(diff) < 0 ? "neg" : "neu";
  const sign = parseFloat(diff) > 0 ? "+" : "";
  const unit = m.pct ? " pp" : "%";
  return `<tr class="hover:bg-gray-50"><td class="px-4 py-2 font-medium">${m.l}</td><td class="px-4 py-2 text-right font-mono">${m.f(m.v1)}</td><td class="px-4 py-2 text-right font-mono">${m.f(m.v2)}</td><td class="px-4 py-2 text-right font-semibold ${cls} font-mono">${sign}${diff}${unit}</td></tr>`;
}).join("")}</tbody></table></div>

<!-- ALERTA CRÍTICO -->
<div class="card p-6 bg-red-50 border-red-200">
<h3 class="font-semibold text-red-900 mb-2">🔴 ALERTA CRÍTICO: Margem de Contribuição Despencou na 2ª Metade</h3>
<div class="grid md:grid-cols-2 gap-4 text-sm">
<div class="bg-white p-4 rounded border"><p class="text-green-900 font-semibold">Jan-Mai: Margem contrib. 55,4%</p><p class="text-green-700">Cada R$ 100 faturados → R$ 55,40 para fixo + lucro</p></div>
<div class="bg-white p-4 rounded border"><p class="text-red-900 font-semibold">Jun-Nov: Margem contrib. 36,2%</p><p class="text-red-700">Cada R$ 100 faturados → R$ 36,20 para fixo + lucro (−19,2 pp)</p></div>
</div>
<p class="mt-3 text-red-800"><strong>Volume subiu 32%, faturamento subiu 34%, mas contribuição total CAIU 12% (R$ 933k → R$ 819k).</strong> Matéria-prima/terceiros/entregas estão consumindo a receita extra.</p></div>

<!-- 3. CUSTO FIXO 2025 vs 2026 -->
<div class="card overflow-hidden">
<div class="sec px-6 py-3 border-b">💰 3. Custo Fixo Rateado: 2025 vs 2026 (Jan-Nov)</div>
<table class="w-full"><thead class="bg-gray-50"><tr>
<th class="px-4 py-2 text-left text-xs font-semibold text-gray-600">Mês</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">2025</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">2026</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">Diff</th></tr></thead>
<tbody class="divide-y">${custoFixoMensal.filter(x => x.mes <= 11).map(x => {
  const v25 = custoFixoMensal.find(y => y.ano === 2025 && y.mes === x.mes);
  const v26 = custoFixoMensal.find(y => y.ano === 2026 && y.mes === x.mes);
  const val25 = v25 ? Number(v25.custoFixoTotal) : 0;
  const val26 = v26 ? Number(v26.custoFixoTotal) : 0;
  const diff = val25 > 0 ? (((val26 - val25) / val25) * 100).toFixed(1) : "—";
  const cls = parseFloat(diff) > 0 ? "pos" : parseFloat(diff) < 0 ? "neg" : "neu";
  return `<tr class="hover:bg-gray-50"><td class="px-4 py-2 font-mono">${x.ano}/${String(x.mes).padStart(2,'0')}</td><td class="px-4 py-2 text-right font-mono">${val25 > 0 ? fmtMoeda(val25) : '—'}</td><td class="px-4 py-2 text-right font-mono">${val26 > 0 ? fmtMoeda(val26) : '—'}</td><td class="px-4 py-2 text-right font-semibold ${cls} font-mono">${diff !== "—" ? (parseFloat(diff) >= 0 ? '+' : '') + diff + '%' : '—'}</td></tr>`;
}).join("")}
<tr class="bg-gray-50 font-semibold"><td class="px-4 py-2">TOTAL Jan-Nov</td><td class="px-4 py-2 text-right font-mono">${fmtMoeda(totalCustoFixo2025)}</td><td class="px-4 py-2 text-right font-mono">${fmtMoeda(totalCustoFixo2026)}</td><td class="px-4 py-2 text-right font-semibold neg font-mono">${(((totalCustoFixo2026 - totalCustoFixo2025) / totalCustoFixo2025) * 100).toFixed(1)}%</td></tr></tbody></table>
<div class="p-4 bg-gray-50 border-t"><p><strong>Conclusão:</strong> Custo fixo rateado <span class="pos">CAIU 8,7% (R$ 110k)</span> em 2026 vs 2025. A rescisão de R$ 106k <strong>não pesa no agregado</strong> (se tirar, 2026 fica R$ 1,048M vs R$ 1,264M de 2025 = −17%).</p></div></div>

<!-- 4. SIMULAÇÃO +10% PREÇO -->
<div class="card overflow-hidden">
<div class="sec px-6 py-3 border-b">🎯 4. Simulação: Aumentar Preço +10% (base = 2ª metade 2026)</div>
<div class="p-6 grid md:grid-cols-3 gap-4">${cenariosSim.map(c => {
  const varFat = calcDiff(fatBase, c.novoFat);
  const varRes = calcDiff(resultadoBase, c.novoResultado);
  const cls = varFat >= 0 ? "green" : "red";
  const clsR = varRes >= 0 ? "green" : "red";
  return `<div class="bg-${cls}-50 p-4 rounded border border-${cls}-200"><p class="font-semibold text-${cls}-900">${c.nome}</p><p class="text-xs text-gray-600">Ticket: ${fmtMoeda(c.novoTicket)} | Pedidos: ${fmtNum(c.novosPedidos)}</p><p class="text-xl font-bold text-${cls}-700">${fmtMoeda(c.novoFat)}</p><p class="text-${cls}-700 text-sm">${varFat >= 0 ? '+' : ''}${varFat.toFixed(1)}% faturamento</p><p class="text-${clsR}-700 text-sm mt-1">${varRes >= 0 ? '+' : ''}${varRes.toFixed(1)}% lucro (${fmtMoeda(c.novoResultado)})</p><p class="text-gray-600 text-xs mt-1">Margem lucro: ${c.novaMargemLucro.toFixed(1)}%</p></div>`;
}).join("")}</div>
<p class="px-6 pb-6 text-xs text-gray-600">Assumindo: margem contribuição % constante (${(pctContribFat*100).toFixed(1)}%), custo fixo inalterado (${fmtMoeda(custoFixoBase)}). Volume cai por elasticidade-preço.</p></div>

<!-- 5. DIAGNÓSTICO E RECOMENDAÇÃO -->
<div class="card p-6">
<h2 class="text-xl font-bold text-gray-900 mb-4">📋 5. Diagnóstico Completo & Recomendação</h2>

<div class="space-y-4 text-sm">
<div class="bg-blue-50 p-4 rounded border border-blue-200"><h4 class="font-semibold text-blue-900 mb-2">✅ O que MELHOROU (2025 → 2026)</h4>
<ul class="list-disc pl-5 space-y-1 text-blue-800">
<li>Ticket médio: +23% (R$ 1.916 → R$ 2.361) — precificação melhor</li>
<li>Margem de lucro (pond.): +44% (17,7% → 25,6%) — cada venda rende mais líquido</li>
<li>Resultado operacional total: +46% (R$ 688k → R$ 1.007M) — lucro contábil das OS subiu muito</li>
<li>Faturamento proporcional: +23% — se mantivesse volume, faturaria R$ 4,79M</li>
<li>Custo fixo rateado: −8,7% — estrutura mais enxuta nas OS</li>
</ul></div>

<div class="bg-red-50 p-4 rounded border border-red-200"><h4 class="font-semibold text-red-900 mb-2">❌ O que PIOROU (2025 → 2026)</h4>
<ul class="list-disc pl-5 space-y-1 text-red-800">
<li><strong>Margem de contribuição: −10% (49,5% → 44,4%)</strong> — cada R$ 100 deixa R$ 5,10 MENOS para cobrir fixo</li>
<li>Contribuição total: −9% (R$ 1,92M → R$ 1,75M) — mesmo com faturamento estável</li>
<li>Clientes únicos: −2%, Pedidos: −18%, Novos clientes: −5% — volume caindo</li>
<li><strong>2ª metade 2026: margem contrib. DESPENCOU para 36,2% (−19 pp vs 1ª metade)</strong></li>
</ul></div>

<div class="bg-amber-50 p-4 rounded border border-amber-200"><h4 class="font-semibold text-amber-900 mb-2">💡 Por que "não sobra lucro no caixa" se resultado subiu 46%?</h4>
<ul class="list-disc pl-5 space-y-1 text-amber-800">
<li>O "resultado" das OS é <strong>contábil</strong> (rateio de custo fixo nas OS). Seu custo fixo REAL (folha, aluguel, impostos, financiamentos, rescisões) provavelmente é MAIOR que o rateio.</li>
<li>Custo fixo rateado 2026: R$ 1,15M/ano (Jan-Nov). Se sua folha + aluguel + empréstimos + rescisão 106k somam > R$ 1,15M, o caixa aperta.</li>
<li>A margem de contribuição caindo (49,5% → 44,4% → 36,2%) significa que <strong>cada venda nova contribui menos</strong> para pagar esse fixo real.</li>
</ul></div>

<div class="bg-green-50 p-4 rounded border border-green-200"><h4 class="font-semibold text-green-900 mb-2">✅ RESPOSTA: Vale aumentar mais 10% no preço?</h4>
<p class="text-green-800 font-medium mb-2"><strong>SIM, estatisticamente compensa</strong> — mesmo com −10 a −15% volume, lucro operacional sobe 24-33% (simulação acima).</p>
<p class="text-amber-800 font-medium mb-2"><strong>MAS a ordem importa:</strong></p>
<ol class="list-decimal pl-5 space-y-1 text-amber-800">
<li><strong>1º — Cortar custo fixo REAL</strong> (renegociar aluguel/empréstimos, ajustar folha, eliminar desperdícios). Meta: fixo real ≤ rateio das OS.</li>
<li><strong>2º — Recuperar margem de contribuição para 49-50%</strong> (negociar matéria-prima, reduzir perda/retrabalho, rever terceiros, otimizar logística). <em>Isso é o alavanca principal.</em></li>
<li><strong>3º — Subir preço +10%</strong> (se volume aguentar −10%). Com margem contrib. em 49%, o +10% vira lucro MUITO maior.</li>
</ol>
<p class="text-green-700 font-medium mt-2">Se pular direto pro passo 3 sem fazer 1 e 2, você ganha pouco e arrisca perder volume num momento que margem contrib. está frágil (36%).</p></div>

<div class="bg-gray-50 p-4 rounded"><h4 class="font-semibold text-gray-900 mb-2">📌 Números-chave para acompanhar mensalmente</h4>
<div class="grid md:grid-cols-4 gap-2 text-xs">
<div class="bg-white p-3 rounded border"><p class="text-gray-500">Margem Contrib. (pond.)</p><p class="font-bold text-xl">> 49%</p></div>
<div class="bg-white p-3 rounded border"><p class="text-gray-500">% Contrib. cobre Fixo</p><p class="font-bold text-xl">> 160%</p></div>
<div class="bg-white p-3 rounded border"><p class="text-gray-500">Custo Fixo Real / Mês</p><p class="font-bold text-xl">≤ Rateio OS</p></div>
<div class="bg-white p-3 rounded border"><p class="text-gray-500">Ticket Médio</p><p class="font-bold text-xl">≥ R$ 2.300</p></div>
</div></div>
</div></div>

<div class="text-center text-xs text-gray-500 mt-6">Período: Jan-Nov cada ano | 2026 semestral: Jan-Mai vs Jun-Nov | Gerado em ${new Date().toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}</div>
</div></body></html>`;

  const fs = await import("fs");
  const path = await import("path");
  const outputPath = path.join(process.cwd(), "artifacts", "analise-completa-2025-2026.html");
  fs.writeFileSync(outputPath, html);
  console.log(`\n\n✅ HTML completo salvo em: ${outputPath}`);

  // Console summary
  console.log("\n=== RESUMO EXECUTIVO ===");
  console.log(`2025 (Jan-Nov): ${fmtNum(m2025.numeroPedidos)} pedidos | ${fmtMoeda(m2025.faturamento)} | Ticket ${fmtMoeda(m2025.ticketMedio)} | Margem Contrib ${fmtPct(m2025.margemContribuicaoMediaPct)} | Lucro ${fmtMoeda(m2025.resultadoTotal)}`);
  console.log(`2026 (Jan-Nov): ${fmtNum(m2026.numeroPedidos)} pedidos | ${fmtMoeda(m2026.faturamento)} | Ticket ${fmtMoeda(m2026.ticketMedio)} | Margem Contrib ${fmtPct(m2026.margemContribuicaoMediaPct)} | Lucro ${fmtMoeda(m2026.resultadoTotal)}`);
  console.log(`\nClientes novos: 2025=${m2025.clientesNovos} | 2026=${m2026.clientesNovos} (diff: ${calcDiff(m2025.clientesNovos, m2026.clientesNovos)}%)`);
  console.log(`\n2026 Semestral: Jan-Mai margem contrib ${fmtPct(p1.margemContribuicaoPct)} → Jun-Nov ${fmtPct(p2.margemContribuicaoPct)} (${(p2.margemContribuicaoPct - p1.margemContribuicaoPct).toFixed(1)} pp)`);
  console.log(`Custo fixo rateado: 2025=${fmtMoeda(totalCustoFixo2025)} | 2026=${fmtMoeda(totalCustoFixo2026)} (${(((totalCustoFixo2026-totalCustoFixo2025)/totalCustoFixo2025)*100).toFixed(1)}%)`);
  console.log(`\nSimulação +10% preço (base 2ª metade):`);
  cenariosSim.forEach(c => {
    const vf = calcDiff(fatBase, c.novoFat);
    const vr = calcDiff(resultadoBase, c.novoResultado);
    console.log(`  ${c.nome}: Fat ${vf>=0?'+':''}${vf.toFixed(1)}% | Lucro ${vr>=0?'+':''}${vr.toFixed(1)}% (${fmtMoeda(c.novoResultado)})`);
  });
}

main().catch(console.error);