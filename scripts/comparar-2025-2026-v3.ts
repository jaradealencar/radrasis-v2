import { createAppDatabase } from "../server/db/db-connection";
import { historicoOs } from "../drizzle/schema";
import { eq, ne, and, lte, sql } from "drizzle-orm";

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

async function buscarMetricasAno(ano: number, mesLimite: number): Promise<MetricasAno> {
  const db = createAppDatabase();

  // Buscar todos os registros do ano (não cancelados) com ano/mes <= limite
  // Usar ano/mes da tabela (preenchidos pelo sync), não dataFaturamento
  const rows = await db
    .select({
      empresa: historicoOs.empresa,
      ano: historicoOs.ano,
      mes: historicoOs.mes,
      valorOs: historicoOs.valorOs,
      contribuicaoReais: historicoOs.contribuicaoReais,
      contribuicaoPct: historicoOs.contribuicaoPct,
      resultadoReais: historicoOs.resultadoReais,
      resultadoPct: historicoOs.resultadoPct,
      custoFixo: historicoOs.custoFixo,
      materiaPrima: historicoOs.materiaPrima,
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
    return {
      ano,
      clientesUnicos: 0,
      numeroPedidos: 0,
      numeroRecompras: 0,
      faturamento: 0,
      clientesNovos: 0,
      ticketMedio: 0,
      margemContribuicaoMediaPct: 0,
      margemLucroMediaPct: 0,
      contribuicaoTotal: 0,
      custoFixoTotal: 0,
      resultadoTotal: 0,
      pctContribuicaoCobreCustoFixo: 0,
      pctContribuicaoSobreFaturamento: 0,
      pctResultadoSobreFaturamento: 0,
    };
  }

  // Clientes únicos
  const empresasUnicas = new Set(rows.map((r) => r.empresa?.trim()).filter(Boolean));
  const clientesUnicos = empresasUnicas.size;

  // Número de pedidos
  const numeroPedidos = rows.length;

  // Faturamento total (valorOs = valor líquido pós-desconto)
  const faturamento = rows.reduce((sum, r) => sum + (parseFloat(String(r.valorOs)) || 0), 0);

  // Ticket médio
  const ticketMedio = numeroPedidos > 0 ? faturamento / numeroPedidos : 0;

  // Contribuição total, custo fixo total, resultado total
  const contribuicaoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.contribuicaoReais)) || 0), 0);
  const custoFixoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.custoFixo)) || 0), 0);
  const resultadoTotal = rows.reduce((sum, r) => sum + (parseFloat(String(r.resultadoReais)) || 0), 0);

  // Margem de contribuição média ponderada pelo faturamento
  let somaPonderadaContrib = 0;
  let pesoTotalContrib = 0;
  for (const r of rows) {
    const valor = parseFloat(String(r.valorOs)) || 0;
    const pct = parseFloat(String(r.contribuicaoPct)) || 0;
    if (valor > 0) {
      somaPonderadaContrib += valor * pct;
      pesoTotalContrib += valor;
    }
  }
  const margemContribuicaoMediaPct = pesoTotalContrib > 0 ? somaPonderadaContrib / pesoTotalContrib : 0;

  // Margem de lucro média ponderada pelo faturamento
  let somaPonderadaLucro = 0;
  let pesoTotalLucro = 0;
  for (const r of rows) {
    const valor = parseFloat(String(r.valorOs)) || 0;
    const pct = parseFloat(String(r.resultadoPct)) || 0;
    if (valor > 0) {
      somaPonderadaLucro += valor * pct;
      pesoTotalLucro += valor;
    }
  }
  const margemLucroMediaPct = pesoTotalLucro > 0 ? somaPonderadaLucro / pesoTotalLucro : 0;

  // % Contribuição cobre custo fixo
  const pctContribuicaoCobreCustoFixo = custoFixoTotal > 0 ? (contribuicaoTotal / custoFixoTotal) * 100 : 0;

  // % Contribuição sobre faturamento
  const pctContribuicaoSobreFaturamento = faturamento > 0 ? (contribuicaoTotal / faturamento) * 100 : 0;

  // % Resultado sobre faturamento
  const pctResultadoSobreFaturamento = faturamento > 0 ? (resultadoTotal / faturamento) * 100 : 0;

  // Clientes com recompra (2+ pedidos no período)
  const pedidosPorCliente = new Map<string, number>();
  for (const r of rows) {
    const key = r.empresa?.trim() || "";
    if (key) {
      pedidosPorCliente.set(key, (pedidosPorCliente.get(key) || 0) + 1);
    }
  }
  const numeroRecompras = Array.from(pedidosPorCliente.values()).filter((q) => q >= 2).length;

  // Clientes novos: primeira compra no histórico todo foi neste ano
  // Buscar primeiro ano de cada cliente no histórico completo (não canceladas)
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
    if (key && r.primeiroAno) {
      primeiroAnoPorCliente.set(key, r.primeiroAno);
    }
  }

  // Contar clientes novos: clientes do período cujo primeiro ano == ano analisado
  let clientesNovos = 0;
  for (const empresa of empresasUnicas) {
    if (primeiroAnoPorCliente.get(empresa) === ano) {
      clientesNovos++;
    }
  }

  return {
    ano,
    clientesUnicos,
    numeroPedidos,
    numeroRecompras,
    faturamento,
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

function calcularDiferenca(base: number, novo: number): number {
  if (base === 0) return novo > 0 ? 100 : 0;
  return Number((((novo - base) / base) * 100).toFixed(1));
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function formatarPct(valor: number): string {
  return `${valor.toFixed(1)}%`;
}

async function main() {
  // Limite: até novembro (mês 11)
  const mesLimite = 11;

  console.log(`Buscando métricas de 2025 (até mês ${mesLimite})...`);
  const m2025 = await buscarMetricasAno(2025, mesLimite);

  console.log(`Buscando métricas de 2026 (até mês ${mesLimite})...`);
  const m2026 = await buscarMetricasAno(2026, mesLimite);

  console.log("\n=== RESULTADO ===\n");

  const metricas: Array<{
    label: string;
    val2025: number | string;
    val2026: number | string;
    diffPct: number;
    isCurrency: boolean;
    isPct: boolean;
  }> = [
    {
      label: "a) Clientes únicos",
      val2025: m2025.clientesUnicos,
      val2026: m2026.clientesUnicos,
      diffPct: calcularDiferenca(m2025.clientesUnicos, m2026.clientesUnicos),
      isCurrency: false,
      isPct: false,
    },
    {
      label: "b) Número de pedidos",
      val2025: m2025.numeroPedidos,
      val2026: m2026.numeroPedidos,
      diffPct: calcularDiferenca(m2025.numeroPedidos, m2026.numeroPedidos),
      isCurrency: false,
      isPct: false,
    },
    {
      label: "c) Recompras (clientes com 2+ pedidos no período)",
      val2025: m2025.numeroRecompras,
      val2026: m2026.numeroRecompras,
      diffPct: calcularDiferenca(m2025.numeroRecompras, m2026.numeroRecompras),
      isCurrency: false,
      isPct: false,
    },
    {
      label: "d) Faturamento",
      val2025: m2025.faturamento,
      val2026: m2026.faturamento,
      diffPct: calcularDiferenca(m2025.faturamento, m2026.faturamento),
      isCurrency: true,
      isPct: false,
    },
    {
      label: "e) Clientes novos (1ª compra no ano)",
      val2025: m2025.clientesNovos,
      val2026: m2026.clientesNovos,
      diffPct: calcularDiferenca(m2025.clientesNovos, m2026.clientesNovos),
      isCurrency: false,
      isPct: false,
    },
    {
      label: "f) Ticket médio",
      val2025: m2025.ticketMedio,
      val2026: m2026.ticketMedio,
      diffPct: calcularDiferenca(m2025.ticketMedio, m2026.ticketMedio),
      isCurrency: true,
      isPct: false,
    },
    {
      label: "g) Margem de contribuição média (ponderada)",
      val2025: m2025.margemContribuicaoMediaPct,
      val2026: m2026.margemContribuicaoMediaPct,
      diffPct: calcularDiferenca(m2025.margemContribuicaoMediaPct, m2026.margemContribuicaoMediaPct),
      isCurrency: false,
      isPct: true,
    },
    {
      label: "h) Margem de lucro média (ponderada)",
      val2025: m2025.margemLucroMediaPct,
      val2026: m2026.margemLucroMediaPct,
      diffPct: calcularDiferenca(m2025.margemLucroMediaPct, m2026.margemLucroMediaPct),
      isCurrency: false,
      isPct: true,
    },
    {
      label: "i) Contribuição total (R$)",
      val2025: m2025.contribuicaoTotal,
      val2026: m2026.contribuicaoTotal,
      diffPct: calcularDiferenca(m2025.contribuicaoTotal, m2026.contribuicaoTotal),
      isCurrency: true,
      isPct: false,
    },
    {
      label: "j) Custo fixo total (R$)",
      val2025: m2025.custoFixoTotal,
      val2026: m2026.custoFixoTotal,
      diffPct: calcularDiferenca(m2025.custoFixoTotal, m2026.custoFixoTotal),
      isCurrency: true,
      isPct: false,
    },
    {
      label: "k) Resultado total / Lucro operacional (R$)",
      val2025: m2025.resultadoTotal,
      val2026: m2026.resultadoTotal,
      diffPct: calcularDiferenca(m2025.resultadoTotal, m2026.resultadoTotal),
      isCurrency: true,
      isPct: false,
    },
    {
      label: "l) % Contribuição cobre Custo Fixo",
      val2025: m2025.pctContribuicaoCobreCustoFixo,
      val2026: m2026.pctContribuicaoCobreCustoFixo,
      diffPct: calcularDiferenca(m2025.pctContribuicaoCobreCustoFixo, m2026.pctContribuicaoCobreCustoFixo),
      isCurrency: false,
      isPct: true,
    },
    {
      label: "m) % Contribuição / Faturamento",
      val2025: m2025.pctContribuicaoSobreFaturamento,
      val2026: m2026.pctContribuicaoSobreFaturamento,
      diffPct: calcularDiferenca(m2025.pctContribuicaoSobreFaturamento, m2026.pctContribuicaoSobreFaturamento),
      isCurrency: false,
      isPct: true,
    },
    {
      label: "n) % Resultado / Faturamento (Margem líquida real)",
      val2025: m2025.pctResultadoSobreFaturamento,
      val2026: m2026.pctResultadoSobreFaturamento,
      diffPct: calcularDiferenca(m2025.pctResultadoSobreFaturamento, m2026.pctResultadoSobreFaturamento),
      isCurrency: false,
      isPct: true,
    },
  ];

  // Gerar HTML do artifact
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comparativo 2025 vs 2026 (Jan-Nov) - Radrasis</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    .diff-positive { color: #16a34a; }
    .diff-negative { color: #dc2626; }
    .diff-neutral { color: #6b7280; }
    .section-header { background: #f3f4f6; font-weight: 600; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen p-6">
  <div class="max-w-5xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Comparativo: 2025 vs 2026 (Janeiro a Novembro)</h1>
      <p class="text-gray-600">Dados de <code>historico_os</code> — OS não canceladas com mês ≤ 11 (inclui "Não faturado")</p>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div class="section-header px-6 py-3 border-b border-gray-200 text-gray-700">📊 Volume e Clientes</div>
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Métrica</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2025</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2026</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Variação</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${metricas.slice(0, 6).map((m) => {
            const v2025 = m.isCurrency
              ? formatarMoeda(Number(m.val2025))
              : formatarNumero(Number(m.val2025));
            const v2026 = m.isCurrency
              ? formatarMoeda(Number(m.val2026))
              : formatarNumero(Number(m.val2026));
            const diffClass =
              m.diffPct > 0
                ? "diff-positive"
                : m.diffPct < 0
                ? "diff-negative"
                : "diff-neutral";
            const diffSign = m.diffPct > 0 ? "+" : "";
            return `
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-3 text-gray-900 font-medium">${m.label}</td>
              <td class="px-6 py-3 text-right text-gray-700 font-mono">${v2025}</td>
              <td class="px-6 py-3 text-right text-gray-700 font-mono">${v2026}</td>
              <td class="px-6 py-3 text-right font-semibold ${diffClass} font-mono">
                ${diffSign}${m.diffPct.toFixed(1)}%
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div class="section-header px-6 py-3 border-b border-gray-200 text-gray-700">💰 Financeiro (Margens e Contribuição)</div>
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Métrica</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2025</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2026</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Variação</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${metricas.slice(6).map((m) => {
            const v2025 = m.isCurrency
              ? formatarMoeda(Number(m.val2025))
              : m.isPct
              ? formatarPct(Number(m.val2025))
              : formatarNumero(Number(m.val2025));
            const v2026 = m.isCurrency
              ? formatarMoeda(Number(m.val2026))
              : m.isPct
              ? formatarPct(Number(m.val2026))
              : formatarNumero(Number(m.val2026));
            const diffClass =
              m.diffPct > 0
                ? "diff-positive"
                : m.diffPct < 0
                ? "diff-negative"
                : "diff-neutral";
            const diffSign = m.diffPct > 0 ? "+" : "";
            return `
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-3 text-gray-900 font-medium">${m.label}</td>
              <td class="px-6 py-3 text-right text-gray-700 font-mono">${v2025}</td>
              <td class="px-6 py-3 text-right text-gray-700 font-mono">${v2026}</td>
              <td class="px-6 py-3 text-right font-semibold ${diffClass} font-mono">
                ${diffSign}${m.diffPct.toFixed(1)}%
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">O que cada métrica financeira significa</h2>
      <ul class="text-sm text-gray-600 space-y-2">
        <li><strong>Margem de contribuição média (ponderada):</strong> Média de <code>contribuicaoPct</code> ponderada pelo <code>valorOs</code>. Quanto sobra da receita após custos variáveis para cobrir fixos e gerar lucro.</li>
        <li><strong>Margem de lucro média (ponderada):</strong> Média de <code>resultadoPct</code> ponderada pelo <code>valorOs</code>. Lucro operacional líquido (% da receita) após todos os custos.</li>
        <li><strong>Contribuição total:</strong> Soma de <code>contribuicaoReais</code> (receita − matéria-prima) de todas as OS.</li>
        <li><strong>Custo fixo total:</strong> Soma de <code>custoFixo</code> rateado nas OS do período.</li>
        <li><strong>Resultado total / Lucro operacional:</strong> Soma de <code>resultadoReais</code> (contribuição − custo fixo − demais despesas).</li>
        <li><strong>% Contribuição cobre Custo Fixo:</strong> <code>contribuicaoTotal / custoFixoTotal × 100</code>. Acima de 100% = sobra lucro; abaixo = prejuízo operacional.</li>
        <li><strong>% Contribuição / Faturamento:</strong> Margem de contribuição agregada do período.</li>
        <li><strong>% Resultado / Faturamento:</strong> Margem líquida operacional real do período.</li>
      </ul>
    </div>

    <div class="mt-4 text-center text-xs text-gray-500">
      Período: Janeiro a Novembro de cada ano | Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
    </div>
  </div>
</body>
</html>`;

  const fs = await import("fs");
  const path = await import("path");
  const outputPath = path.join(process.cwd(), "artifacts", "comparativo-2025-2026-jan-nov.html");
  fs.writeFileSync(outputPath, html);
  console.log(`\nArquivo salvo em: ${outputPath}`);

  console.log("\n=== TABELA RESUMO ===");
  console.log(
    metricas
      .map((m) => {
        const v2025 = m.isCurrency
          ? formatarMoeda(Number(m.val2025))
          : m.isPct
          ? formatarPct(Number(m.val2025))
          : formatarNumero(Number(m.val2025));
        const v2026 = m.isCurrency
          ? formatarMoeda(Number(m.val2026))
          : m.isPct
          ? formatarPct(Number(m.val2026))
          : formatarNumero(Number(m.val2026));
        const diffSign = m.diffPct > 0 ? "+" : "";
        return `${m.label}\n  2025: ${v2025} | 2026: ${v2026} | Var: ${diffSign}${m.diffPct.toFixed(1)}%`;
      })
      .join("\n\n")
  );
}

main().catch(console.error);