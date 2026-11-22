import { createAppDatabase } from "../server/db/db-connection";
import { historicoOs } from "../drizzle/schema";
import { eq, and, sql, desc, ne } from "drizzle-orm";

interface MetricasAno {
  ano: number;
  clientesUnicos: number;
  numeroPedidos: number;
  numeroRecompras: number; // clientes com 2+ pedidos no ano
  faturamento: number;
  clientesNovos: number; // clientes cuja primeira compra foi neste ano
  ticketMedio: number;
}

async function buscarMetricasAno(ano: number): Promise<MetricasAno> {
  const db = createAppDatabase();

  // 1. Clientes únicos, número de pedidos, faturamento total do ano
  const resumoAno = await db
    .select({
      clientesUnicos: sql<number>`count(DISTINCT ${historicoOs.empresa})`.as("clientes_unicos"),
      numeroPedidos: sql<number>`count(*)`.as("num_pedidos"),
      faturamento: sql<number>`sum(${historicoOs.valorOs})`.as("faturamento"),
    })
    .from(historicoOs)
    .where(
      and(
        eq(historicoOs.ano, ano),
        ne(historicoOs.status, "Cancelada")
      )
    );

  // 2. Clientes com recompra (2+ pedidos no mesmo ano)
  const clientesComRecompra = await db
    .select({
      cliente: historicoOs.empresa,
      qtd: sql<number>`count(*)`.as("qtd"),
    })
    .from(historicoOs)
    .where(
      and(
        eq(historicoOs.ano, ano),
        ne(historicoOs.status, "Cancelada")
      )
    )
    .groupBy(historicoOs.empresa)
    .having(sql`count(*) >= 2`);

  const numeroRecompras = clientesComRecompra.length;

  // 3. Clientes novos: primeira compra do cliente foi neste ano
  // Buscar a primeira compra de cada cliente no histórico completo
  const primeiraCompraPorCliente = await db
    .select({
      cliente: historicoOs.empresa,
      primeiraAno: sql<number>`min(${historicoOs.ano})`.as("primeira_ano"),
    })
    .from(historicoOs)
    .where(ne(historicoOs.status, "Cancelada"))
    .groupBy(historicoOs.empresa);

  const clientesNovos = primeiraCompraPorCliente.filter(
    (c) => c.primeiraAno === ano
  ).length;

  const { clientesUnicos, numeroPedidos, faturamento } = resumoAno[0] || {
    clientesUnicos: 0,
    numeroPedidos: 0,
    faturamento: 0,
  };

  const ticketMedio =
    numeroPedidos > 0 ? Number(faturamento) / numeroPedidos : 0;

  return {
    ano,
    clientesUnicos: Number(clientesUnicos),
    numeroPedidos: Number(numeroPedidos),
    numeroRecompras,
    faturamento: Number(faturamento),
    clientesNovos,
    ticketMedio: Number(ticketMedio.toFixed(2)),
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

async function main() {
  console.log("Buscando métricas de 2025...");
  const m2025 = await buscarMetricasAno(2025);

  console.log("Buscando métricas de 2026...");
  const m2026 = await buscarMetricasAno(2026);

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
      label: "c) Número de recompras (clientes com 2+ pedidos no ano)",
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
      label: "f) Ticket médio (faturamento / pedidos)",
      val2025: m2025.ticketMedio,
      val2026: m2026.ticketMedio,
      diffPct: calcularDiferenca(m2025.ticketMedio, m2026.ticketMedio),
      isCurrency: true,
      isPct: false,
    },
  ];

  // Gerar HTML do artifact
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comparativo 2025 vs 2026 - Radrasis</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    .diff-positive { color: #16a34a; }
    .diff-negative { color: #dc2626; }
    .diff-neutral { color: #6b7280; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen p-6">
  <div class="max-w-4xl mx-auto">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Comparativo Anual: 2025 vs 2026</h1>
      <p class="text-gray-600">Dados extraídos de <code>historico_os</code> (OS não canceladas)</p>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Métrica</th>
            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2025</th>
            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">2026</th>
            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Variação</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${metricas
            .map((m) => {
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
              <td class="px-6 py-4 text-gray-900 font-medium">${m.label}</td>
              <td class="px-6 py-4 text-right text-gray-700 font-mono">${v2025}</td>
              <td class="px-6 py-4 text-right text-gray-700 font-mono">${v2026}</td>
              <td class="px-6 py-4 text-right font-semibold ${diffClass} font-mono">
                ${diffSign}${m.diffPct.toFixed(1)}%
              </td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Observações</h2>
      <ul class="text-sm text-gray-600 space-y-2">
        <li>• <strong>Clientes únicos:</strong> Contagem distinta de empresas (nome normalizado) com pelo menos 1 OS válida no ano.</li>
        <li>• <strong>Recompras:</strong> Clientes que fizeram 2 ou mais pedidos (OS válidas) dentro do mesmo ano.</li>
        <li>• <strong>Clientes novos:</strong> Clientes cuja primeira compra registrada no histórico (qualquer ano) ocorreu no ano em questão.</li>
        <li>• <strong>Faturamento:</strong> Soma de <code>valorOs</code> (valor líquido pós-desconto) das OS não canceladas.</li>
        <li>• <strong>Ticket médio:</strong> Faturamento total ÷ número de pedidos do ano.</li>
        <li>• Dados de 2026 refletem o ano até a data atual (pode estar incompleto dependendo do mês).</li>
      </ul>
    </div>

    <div class="mt-4 text-center text-xs text-gray-500">
      Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
    </div>
  </div>
</body>
</html>`;

  // Salvar arquivo HTML
  const fs = await import("fs");
  const path = await import("path");
  const outputPath = path.join(process.cwd(), "artifacts", "comparativo-2025-2026.html");
  fs.writeFileSync(outputPath, html);
  console.log(`\nArquivo salvo em: ${outputPath}`);

  // Log no console também
  console.log("\n=== TABELA RESUMO ===");
  console.log(
    metricas
      .map((m) => {
        const v2025 = m.isCurrency
          ? formatarMoeda(Number(m.val2025))
          : formatarNumero(Number(m.val2025));
        const v2026 = m.isCurrency
          ? formatarMoeda(Number(m.val2026))
          : formatarNumero(Number(m.val2026));
        const diffSign = m.diffPct > 0 ? "+" : "";
        return `${m.label}\n  2025: ${v2025} | 2026: ${v2026} | Var: ${diffSign}${m.diffPct.toFixed(1)}%`;
      })
      .join("\n\n")
  );
}

main().catch(console.error);