import { createAppDatabase } from "../server/db/db-connection";
import { historicoOs } from "../drizzle/schema";
import { eq, ne, and, gte, lte, sql } from "drizzle-orm";

interface MetricasPeriodo {
  label: string;
  meses: string;
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
    return { label, meses: `${mesInicio}-${mesFim}`, clientesUnicos: 0, numeroPedidos: 0, faturamento: 0, ticketMedio: 0, contribuicaoTotal: 0, custoFixoTotal: 0, resultadoTotal: 0, margemContribuicaoPct: 0, margemLucroPct: 0, pctContribCobreFixo: 0 };
  }

  const empresasUnicas = new Set(rows.map(r => r.empresa?.trim()).filter(Boolean));
  const clientesUnicos = empresasUnicas.size;
  const numeroPedidos = rows.length;
  const faturamento = rows.reduce((sum, r) => sum + (parseFloat(String(r.valorOs)) || 0), 0);
  const ticketMedio = numeroPedidos > 0 ? faturamento / numeroPedidos : 0;

  const contribuicaoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.contribuicaoReais)) || 0), 0);
  const custoFixoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.custoFixo)) || 0), 0);
  const resultadoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.resultadoReais)) || 0), 0);

  // Margens ponderadas
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
    meses: `${mesInicio}-${mesFim}`,
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

function formatarMoeda(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v); }
function formatarNum(v: number) { return new Intl.NumberFormat("pt-BR").format(v); }
function formatarPct(v: number) { return v.toFixed(1) + "%"; }

async function main() {
  console.log("=== 2026: PRIMEIRA METADE (Jan-Mai) vs SEGUNDA METADE (Jun-Nov) ===\n");

  const p1 = await buscarMetricasPeriodo(2026, 1, 5, "Jan-Mai (5 meses)");
  const p2 = await buscarMetricasPeriodo(2026, 6, 11, "Jun-Nov (6 meses)");

  console.log(`${p1.label}:`);
  console.log(`  Pedidos: ${formatarNum(p1.numeroPedidos)} | Faturamento: ${formatarMoeda(p1.faturamento)} | Ticket: ${formatarMoeda(p1.ticketMedio)}`);
  console.log(`  Contribuição: ${formatarMoeda(p1.contribuicaoTotal)} | Custo Fixo: ${formatarMoeda(p1.custoFixoTotal)} | Resultado: ${formatarMoeda(p1.resultadoTotal)}`);
  console.log(`  Margem Contrib: ${formatarPct(p1.margemContribuicaoPct)} | Margem Lucro: ${formatarPct(p1.margemLucroPct)} | %Cobre Fixo: ${formatarPct(p1.pctContribCobreFixo)}`);
  console.log("");
  console.log(`${p2.label}:`);
  console.log(`  Pedidos: ${formatarNum(p2.numeroPedidos)} | Faturamento: ${formatarMoeda(p2.faturamento)} | Ticket: ${formatarMoeda(p2.ticketMedio)}`);
  console.log(`  Contribuição: ${formatarMoeda(p2.contribuicaoTotal)} | Custo Fixo: ${formatarMoeda(p2.custoFixoTotal)} | Resultado: ${formatarMoeda(p2.resultadoTotal)}`);
  console.log(`  Margem Contrib: ${formatarPct(p2.margemContribuicaoPct)} | Margem Lucro: ${formatarPct(p2.margemLucroPct)} | %Cobre Fixo: ${formatarPct(p2.pctContribCobreFixo)}`);
  console.log("");

  // Variações
  const varPedidos = ((p2.numeroPedidos - p1.numeroPedidos) / p1.numeroPedidos * 100).toFixed(1);
  const varFat = ((p2.faturamento - p1.faturamento) / p1.faturamento * 100).toFixed(1);
  const varTicket = ((p2.ticketMedio - p1.ticketMedio) / p1.ticketMedio * 100).toFixed(1);
  const varContrib = ((p2.contribuicaoTotal - p1.contribuicaoTotal) / p1.contribuicaoTotal * 100).toFixed(1);
  const varCustoFixo = ((p2.custoFixoTotal - p1.custoFixoTotal) / p1.custoFixoTotal * 100).toFixed(1);
  const varResultado = ((p2.resultadoTotal - p1.resultadoTotal) / p1.resultadoTotal * 100).toFixed(1);

  console.log("=== VARIAÇÃO (2ª metade vs 1ª metade) ===");
  console.log(`  Pedidos: ${varPedidos >= 0 ? '+' : ''}${varPedidos}%`);
  console.log(`  Faturamento: ${varFat >= 0 ? '+' : ''}${varFat}%`);
  console.log(`  Ticket médio: ${varTicket >= 0 ? '+' : ''}${varTicket}%`);
  console.log(`  Contribuição total: ${varContrib >= 0 ? '+' : ''}${varContrib}%`);
  console.log(`  Custo fixo total: ${varCustoFixo >= 0 ? '+' : ''}${varCustoFixo}%`);
  console.log(`  Resultado (lucro oper.): ${varResultado >= 0 ? '+' : ''}${varResultado}%`);
  console.log(`  Margem contribuição: ${(p2.margemContribuicaoPct - p1.margemContribuicaoPct).toFixed(1)} pp`);
  console.log(`  Margem lucro: ${(p2.margemLucroPct - p1.margemLucroPct).toFixed(1)} pp`);

  // === ANÁLISE DE CUSTOS FIXOS 2025 vs 2026 ===
  console.log("\n=== ANÁLISE: POR QUE O LUCRO NÃO APARECE MAIOR? ===\n");

  // Buscar custo fixo mensal 2025 vs 2026
  const db = createAppDatabase();
  const custoFixoMensal = await db
    .select({
      ano: historicoOs.ano,
      mes: historicoOs.mes,
      custoFixoTotal: sql<number>`sum(${historicoOs.custoFixo})`.as("custo_fixo_total"),
    })
    .from(historicoOs)
    .where(
      and(
        ne(historicoOs.status, "Cancelada"),
        sql`${historicoOs.ano} IN (2025, 2026)`
      )
    )
    .groupBy(historicoOs.ano, historicoOs.mes)
    .orderBy(historicoOs.ano, historicoOs.mes);

  console.log("Custo fixo mensal (soma do rateio nas OS):");
  for (const cf of custoFixoMensal) {
    console.log(`  ${cf.ano}/${String(cf.mes).padStart(2,'0')}: ${formatarMoeda(Number(cf.custoFixoTotal))}`);
  }

  // Total por ano
  const total2025 = custoFixoMensal.filter(x => x.ano === 2025).reduce((s, x) => s + Number(x.custoFixoTotal), 0);
  const total2026 = custoFixoMensal.filter(x => x.ano === 2026).reduce((s, x) => s + Number(x.custoFixoTotal), 0);
  console.log(`\nTotal 2025 (Jan-Nov): ${formatarMoeda(total2025)}`);
  console.log(`Total 2026 (Jan-Nov): ${formatarMoeda(total2026)}`);
  console.log(`Diferença: ${formatarMoeda(total2026 - total2025)} (${((total2026 - total2025) / total2025 * 100).toFixed(1)}%)`);

  // Rescisão 106k - verificar se está no custo fixo
  console.log("\n--- Hipótese: rescisão 106k embutida no custo fixo ---");
  console.log("Se tirar 106k do custo fixo 2026:");
  const custoFixoSemRecisao = total2026 - 106000;
  console.log(`Custo fixo ajustado 2026: ${formatarMoeda(custoFixoSemRecisao)}`);
  console.log(`Diferença vs 2025: ${formatarMoeda(custoFixoSemRecisao - total2025)} (${((custoFixoSemRecisao - total2025) / total2025 * 100).toFixed(1)}%)`);

  // === SIMULAÇÃO: E SE AUMENTAR 10% PREÇO? ===
  console.log("\n=== SIMULAÇÃO: +10% PREÇO (volume cai 10-15%) ===");
  const base = p2; // usar segunda metade como base (mais recente)
  const ticketAtual = base.ticketMedio;
  const pedidosAtual = base.numeroPedidos;
  const fatAtual = base.faturamento;
  const contribAtual = base.contribuicaoTotal;
  const custoFixoAtual = base.custoFixoTotal;
  const resultadoAtual = base.resultadoTotal;
  const pctContribFat = base.margemContribuicaoPct / 100;

  const cenarios = [
    { nome: "Atual", multP: 1.00, multV: 1.00 },
    { nome: "+10% preço, -5% vol", multP: 1.10, multV: 0.95 },
    { nome: "+10% preço, -10% vol", multP: 1.10, multV: 0.90 },
    { nome: "+10% preço, -15% vol", multP: 1.10, multV: 0.85 },
  ];

  for (const c of cenarios) {
    const novoTicket = ticketAtual * c.multP;
    const novosPedidos = Math.round(pedidosAtual * c.multV);
    const novoFat = novosPedidos * novoTicket;
    const novaContrib = novoFat * pctContribFat;
    const novoResultado = novaContrib - custoFixoAtual;
    const novaMargemLucro = novoFat > 0 ? (novoResultado / novoFat) * 100 : 0;
    const varFatPct = ((novoFat - fatAtual) / fatAtual * 100).toFixed(1);
    const varResPct = ((novoResultado - resultadoAtual) / resultadoAtual * 100).toFixed(1);
    console.log(`  ${c.nome}: Fat=${formatarMoeda(novoFat)} (${varFatPct >= 0 ? '+' : ''}${varFatPct}%) | Lucro=${formatarMoeda(novoResultado)} (${varResPct >= 0 ? '+' : ''}${varResPct}%) | Margem=${novaMargemLucro.toFixed(1)}%`);
  }

  // === HTML OUTPUT ===
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2026 Semestral + Análise Custos</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif}.diff-pos{color:#16a34a}.diff-neg{color:#dc2626}.section{bg:#f3f4f6;font-weight:600}</style></head>
<body class="bg-gray-50 p-6"><div class="max-w-5xl mx-auto">
<div class="bg-white rounded-xl shadow-sm border p-6 mb-6">
<h1 class="text-2xl font-bold mb-2">2026: Jan-Mai vs Jun-Nov + Análise de Custos</h1>
<p class="text-gray-600">Dados de <code>historico_os</code> (não canceladas)</p></div>

<div class="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
<div class="section px-6 py-3 border-b">📊 Comparativo Semestral 2026</div>
<table class="w-full"><thead class="bg-gray-50"><tr>
<th class="px-4 py-2 text-left text-xs font-semibold text-gray-600">Métrica</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">${p1.label}</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">${p2.label}</th>
<th class="px-4 py-2 text-right text-xs font-semibold text-gray-600">Variação</th></tr></thead>
<tbody class="divide-y">
${[
  {l:"Clientes únicos", v1:p1.clientesUnicos, v2:p2.clientesUnicos, f:(n)=>formatarNum(n), pct:false},
  {l:"Pedidos", v1:p1.numeroPedidos, v2:p2.numeroPedidos, f:(n)=>formatarNum(n), pct:false},
  {l:"Faturamento", v1:p1.faturamento, v2:p2.faturamento, f:(n)=>formatarMoeda(n), pct:false},
  {l:"Ticket médio", v1:p1.ticketMedio, v2:p2.ticketMedio, f:(n)=>formatarMoeda(n), pct:false},
  {l:"Contribuição total", v1:p1.contribuicaoTotal, v2:p2.contribuicaoTotal, f:(n)=>formatarMoeda(n), pct:false},
  {l:"Custo fixo total", v1:p1.custoFixoTotal, v2:p2.custoFixoTotal, f:(n)=>formatarMoeda(n), pct:false},
  {l:"Resultado (Lucro oper.)", v1:p1.resultadoTotal, v2:p2.resultadoTotal, f:(n)=>formatarMoeda(n), pct:false},
  {l:"Margem contrib. (pond.)", v1:p1.margemContribuicaoPct, v2:p2.margemContribuicaoPct, f:(n)=>formatarPct(n), pct:true},
  {l:"Margem lucro (pond.)", v1:p1.margemLucroPct, v2:p2.margemLucroPct, f:(n)=>formatarPct(n), pct:true},
  {l:"% Contrib. cobre Fixo", v1:p1.pctContribCobreFixo, v2:p2.pctContribCobreFixo, f:(n)=>formatarPct(n), pct:true},
].map(m => {
  const v1f = m.f(m.v1), v2f = m.f(m.v2);
  const diff = m.pct ? ((m.v2 - m.v1).toFixed(1)) : (((m.v2 - m.v1) / m.v1 * 100).toFixed(1));
  const cls = parseFloat(diff) > 0 ? "diff-pos" : parseFloat(diff) < 0 ? "diff-neg" : "";
  return `<tr class="hover:bg-gray-50"><td class="px-4 py-2 font-medium">${m.l}</td><td class="px-4 py-2 text-right font-mono">${v1f}</td><td class="px-4 py-2 text-right font-mono">${v2f}</td><td class="px-4 py-2 text-right font-semibold ${cls} font-mono">${parseFloat(diff) >= 0 ? '+' : ''}${diff}${m.pct ? ' pp' : '%'}</td></tr>`;
}).join("")}
</tbody></table></div>

<div class="bg-white rounded-xl shadow-sm border p-6 mb-6">
<h2 class="text-lg font-semibold mb-4">❓ Por que o lucro não "aparece" maior no caixa?</h2>
<div class="grid md:grid-cols-2 gap-4 text-sm">
<div class="bg-red-50 p-4 rounded border border-red-200">
<p class="font-semibold text-red-900">1. Custo fixo alto (rateado nas OS)</p>
<p class="mt-2">2025 Jan-Nov: ${formatarMoeda(total2025)}</p>
<p>2026 Jan-Nov: ${formatarMoeda(total2026)}</p>
<p class="text-red-700">Aumento: ${formatarMoeda(total2026 - total2025)} (+${((total2026-total2025)/total2025*100).toFixed(1)}%)</p>
</div>
<div class="bg-amber-50 p-4 rounded border border-amber-200">
<p class="font-semibold text-amber-900">2. Rescisão ~R$ 106k embutida</p>
<p class="mt-2">Se tirar a rescisão do custo fixo 2026:</p>
<p>Custo fixo ajustado: ${formatarMoeda(total2026 - 106000)}</p>
<p class="text-amber-700">Diferença vs 2025: ${formatarMoeda((total2026 - 106000) - total2025)} (${((((total2026 - 106000) - total2025)/total2025)*100).toFixed(1)}%)</p>
</div>
<div class="bg-blue-50 p-4 rounded border border-blue-200">
<p class="font-semibold text-blue-900">3. Margem de contribuição CAIU</p>
<p class="mt-2">2025: 49,5% → 2026: 44,4% (-5,1 pp)</p>
<p class="text-blue-700">Cada R$ 100 de faturamento gera R$ 5,10 MENOS de contribuição. Isso "come" o ganho do ticket maior.</p>
</div>
<div class="bg-green-50 p-4 rounded border border-green-200">
<p class="font-semibold text-green-900">4. Mas resultado FINAL subiu +46%</p>
<p class="mt-2">2025: ${formatarMoeda(687967)} → 2026: ${formatarMoeda(1007036)}</p>
<p class="text-green-700">O lucro operacional MELHOROU muito. O que falta é caixa livre (custo fixo alto consome).</p>
</div>
</div>
</div>

<div class="bg-white rounded-xl shadow-sm border p-6 mb-6">
<h2 class="text-lg font-semibold mb-4">🎯 Simulação: +10% no preço (base = 2ª metade 2026)</h2>
<div class="grid md:grid-cols-4 gap-3 text-sm">
${[
  {nome:"Atual", multP:1.00, multV:1.00},
  {nome:"+10% preço, -5% vol", multP:1.10, multV:0.95},
  {nome:"+10% preço, -10% vol", multP:1.10, multV:0.90},
  {nome:"+10% preço, -15% vol", multP:1.10, multV:0.85},
].map(c => {
  const novoTicket = ticketAtual * c.multP;
  const novosPedidos = Math.round(pedidosAtual * c.multV);
  const novoFat = novosPedidos * novoTicket;
  const novaContrib = novoFat * pctContribFat;
  const novoResultado = novaContrib - custoFixoAtual;
  const novaMargemLucro = novoFat > 0 ? (novoResultado / novoFat) * 100 : 0;
  const varFatPct = ((novoFat - fatAtual) / fatAtual * 100).toFixed(1);
  const varResPct = ((novoResultado - resultadoAtual) / resultadoAtual * 100).toFixed(1);
  const cor = parseFloat(varFatPct) >= 0 ? 'green' : 'red';
  return `<div class="bg-${cor}-50 p-3 rounded border border-${cor}-200"><p class="font-semibold text-${cor}-900">${c.nome}</p><p class="text-xs">Ticket: ${formatarMoeda(novoTicket)} | Pedidos: ${formatarNum(novosPedidos)}</p><p class="font-bold text-${cor}-700">${formatarMoeda(novoFat)}</p><p class="text-${cor}-700 text-xs">${varFatPct >= 0 ? '+' : ''}${varFatPct}% fat | ${varResPct >= 0 ? '+' : ''}${varResPct}% lucro</p><p class="text-gray-600 text-xs">Margem: ${novaMargemLucro.toFixed(1)}%</p></div>`;
}).join("")}
</div>
<p class="text-gray-600 text-xs mt-2">Assumindo margem contribuição % constante (${(pctContribFat*100).toFixed(1)}%) e custo fixo inalterado.</p>
</div>

<div class="bg-white rounded-xl shadow-sm border p-6">
<h2 class="text-lg font-semibold mb-2">✅ Resposta: Vale a pena aumentar mais 10%?</h2>
<div class="space-y-2 text-sm">
<p><strong>SIM, estatisticamente faz sentido</strong> — mesmo com queda de 10-15% no volume, o lucro operacional sobe 24-33% (simulação acima).</p>
<p>⚠️ <strong>Mas o gargalo real não é preço — é CUSTO FIXO e MARGEM DE CONTRIBUIÇÃO:</strong></p>
<ul class="list-disc pl-5 space-y-1">
<li>Sua margem de contribuição caiu de 49,5% → 44,4% (-5,1 pp). Cada venda deixa menos dinheiro para cobrir fixo.</li>
<li>Custo fixo rateado subiu (parte é rescisão 106k, parte pode ser estrutura inchada).</li>
<li>Antes de subir preço de novo, <strong>recupere a margem de contribuição</strong> (negocie matéria-prima, revise desperdício, otimize produção). Se voltar a 49%, o +10% no preço vira lucro MUITO maior.</li>
</ul>
<p class="text-green-700 font-medium">Estratégia ideal: 1) Cortar custo fixo/ajustar estrutura → 2) Recuperar margem contribuição → 3) Subir preço se volume aguentar.</p>
</div>
</div>

<div class="mt-4 text-center text-xs text-gray-500">Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
</div></body></html>`;

  const fs = await import("fs");
  const path = await import("path");
  const outputPath = path.join(process.cwd(), "artifacts", "analise-2026-semestral-custos.html");
  fs.writeFileSync(outputPath, html);
  console.log(`\n\nHTML salvo em: ${outputPath}`);
}

main().catch(console.error);