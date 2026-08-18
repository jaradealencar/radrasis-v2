import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { historicoOs, historicoOrcamentos, dreMensal, financeiroMensal } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { isOsNormalDb, buscarTodasComprasValidas, ultimaCompraAntesDe, isClienteNovoPorRecencia } from "./performanceComercial";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_NOMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

/** Coleta os dados comerciais e financeiros de um mês, 100% do banco local
 * (historico_os / historico_orcamentos / dre_mensal / financeiro_mensal) —
 * deliberadamente sem chamar a API ao vivo do Mubisys, que é lenta e instável
 * (ver docs/integracao-mubisys.md); os Insights de IA precisam responder rápido
 * e de forma confiável, não travar esperando uma listagem de 25-45s. */
async function coletarDados(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, mes: number, ano: number) {
  const osRows = await db.select().from(historicoOs).where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano)));
  const orcRows = await db.select().from(historicoOrcamentos).where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));
  const osNormais = osRows.filter(isOsNormalDb);

  let faturamento = 0, custo = 0, resultado = 0;
  const porVendedor: Record<string, { total: number; faturamento: number }> = {};
  const faturamentoPorCliente: Record<string, number> = {};
  for (const os of osNormais) {
    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const c = parseFloat(String(os.custosTotal ?? "0")) || 0;
    const r = parseFloat(String(os.resultadoReais ?? "0")) || 0;
    faturamento += valor;
    custo += c;
    resultado += r;
    const vendedor = os.vendedor || "Sem Vendedor";
    if (!porVendedor[vendedor]) porVendedor[vendedor] = { total: 0, faturamento: 0 };
    porVendedor[vendedor].total++;
    porVendedor[vendedor].faturamento += valor;
    const empresa = (os.empresa ?? "").trim();
    if (empresa) faturamentoPorCliente[empresa] = (faturamentoPorCliente[empresa] ?? 0) + valor;
  }

  let valorOrcado = 0;
  for (const orc of orcRows) valorOrcado += parseFloat(String(orc.total ?? "0")) || 0;

  const margemPct = faturamento > 0 ? (resultado / faturamento) * 100 : 0;
  const ticketMedio = osNormais.length > 0 ? faturamento / osNormais.length : 0;
  const taxaConversao = orcRows.length > 0 ? (osNormais.length / orcRows.length) * 100 : 0;
  const taxaFaturamento = valorOrcado > 0 ? (faturamento / valorOrcado) * 100 : 0;

  // Novo vs. já-cliente, usando a mesma regra canônica do getMes (ver performanceComercial.ts)
  const todasCompras = await buscarTodasComprasValidas(db);
  const ultimaMap = ultimaCompraAntesDe(todasCompras, mes, ano);
  const clientesUnicos = new Set<string>();
  const clientesNovos = new Set<string>();
  for (const os of osNormais) {
    const empresa = (os.empresa ?? "").toLowerCase().trim();
    if (!empresa) continue;
    clientesUnicos.add(empresa);
    if (isClienteNovoPorRecencia(ultimaMap.get(empresa), mes, ano)) clientesNovos.add(empresa);
  }

  const topClientes = Object.entries(faturamentoPorCliente)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cliente, valor]) => ({ cliente, valor }));

  const topVendedores = Object.entries(porVendedor)
    .sort((a, b) => b[1].faturamento - a[1].faturamento)
    .map(([vendedor, v]) => ({ vendedor, ...v }));

  // Financeiro (DRE + financeiro_mensal), mesma fonte que observacoesFinanceiras
  const dreRows = await db.select().from(dreMensal).where(and(eq(dreMensal.ano, ano), eq(dreMensal.mes, mes))).limit(1);
  const dre = dreRows[0] ?? null;
  const finRows = await db.select().from(financeiroMensal).where(and(eq(financeiroMensal.mes, mes), eq(financeiroMensal.ano, ano))).limit(1);
  const fin = finRows[0] ?? null;

  return {
    comercial: {
      totalOs: osNormais.length, faturamento, custo, resultado, margemPct, ticketMedio,
      totalOrcamentos: orcRows.length, valorOrcado, taxaConversao, taxaFaturamento,
      clientesUnicos: clientesUnicos.size, clientesNovos: clientesNovos.size,
      topClientes, topVendedores,
    },
    dre, fin,
  };
}

function montarPrompt(mes: number, ano: number, atual: Awaited<ReturnType<typeof coletarDados>>, anterior: Awaited<ReturnType<typeof coletarDados>>, perguntaExtra?: string) {
  const c = atual.comercial;
  const cAnt = anterior.comercial;
  const varFat = cAnt.faturamento > 0 ? ((c.faturamento - cAnt.faturamento) / cAnt.faturamento) * 100 : null;
  const { mes: mesAnt, ano: anoAnt } = mesAnterior(mes, ano);

  return `Você é um consultor comercial e financeiro sênior da Radrasis (Letreiros Express), uma indústria de comunicação visual (letreiros, placas, painéis de LED) no Brasil.

Analise os dados reais de ${MESES_NOMES[mes]}/${ano}, comparados ao mês anterior, e gere um diagnóstico prático focado em DUAS perguntas: como vender mais, e como lucrar mais.

## DESEMPENHO COMERCIAL — ${MESES_NOMES[mes]}/${ano}
- OS aprovadas (vendas): ${c.totalOs}
- Faturamento: ${fmtR(c.faturamento)}${varFat !== null ? ` (${varFat >= 0 ? "+" : ""}${varFat.toFixed(1)}% vs. ${MESES_NOMES[mesAnt]}/${anoAnt})` : ""}
- Custo total: ${fmtR(c.custo)}
- Resultado (lucro operacional das OS): ${fmtR(c.resultado)} (margem de ${c.margemPct.toFixed(1)}%)
- Ticket médio: ${fmtR(c.ticketMedio)}
- Orçamentos emitidos: ${c.totalOrcamentos}, somando ${fmtR(c.valorOrcado)}
- Taxa de conversão (orçamento → venda): ${c.taxaConversao.toFixed(1)}%
- Taxa de faturamento (venda / orçado): ${c.taxaFaturamento.toFixed(1)}%
- Clientes únicos atendidos: ${c.clientesUnicos} (${c.clientesNovos} novos ou reativados após 6+ meses de inatividade)

### Top 5 Clientes por Faturamento
${c.topClientes.length > 0 ? c.topClientes.map((t, i) => `${i + 1}. ${t.cliente} — ${fmtR(t.valor)}`).join("\n") : "(sem dados)"}

### Faturamento por Vendedor
${c.topVendedores.length > 0 ? c.topVendedores.map(v => `- ${v.vendedor}: ${v.total} OS, ${fmtR(v.faturamento)}`).join("\n") : "(sem dados)"}

## MÊS ANTERIOR (${MESES_NOMES[mesAnt]}/${anoAnt}) — PARA COMPARAÇÃO
- Faturamento: ${fmtR(cAnt.faturamento)}
- Resultado: ${fmtR(cAnt.resultado)} (margem de ${cAnt.margemPct.toFixed(1)}%)
- Taxa de conversão: ${cAnt.taxaConversao.toFixed(1)}%
- Clientes únicos: ${cAnt.clientesUnicos} (${cAnt.clientesNovos} novos/reativados)

## DADOS FINANCEIROS DO MÊS
${atual.dre ? `- Receita Operacional Bruta (DRE): ${fmtR(Number(atual.dre.receitaOperacionalBruta || 0))}
- Despesas Fixas: ${fmtR(Number(atual.dre.despesasFixas || 0))}
- Despesas com Pessoal: ${fmtR(Number(atual.dre.despesasPessoal || 0))}
- Lucro Líquido (DRE): ${fmtR(Number(atual.dre.lucroLiquido || 0))}` : "- DRE não disponível para este mês."}
${atual.fin ? `- Resultado Efetivo: ${fmtR(Number(atual.fin.resultadoEfetivo || 0))}
- Saldo do Mês (caixa): ${fmtR(Number(atual.fin.saldoMes || 0))}` : "- Financeiro mensal não disponível para este mês."}

## INSTRUÇÕES

${perguntaExtra
    ? `O gestor fez a seguinte pergunta específica sobre este mês: "${perguntaExtra}"\n\nResponda essa pergunta primeiro, com base nos dados acima, e depois complemente com o que achar relevante.`
    : `Produza uma análise estruturada em tópicos:

1. **Diagnóstico Rápido**: 2-3 frases sobre o resultado do mês (vendas e lucro), comparado ao anterior.
2. **Oportunidades de Aumentar Vendas**: com base na taxa de conversão, ticket médio, clientes novos/reativados e concentração nos top clientes/vendedores, aponte 2-4 oportunidades concretas (ex: vendedor com baixa conversão, cliente grande que sumiu, ticket médio caindo).
3. **Oportunidades de Aumentar o Lucro**: com base na margem, custo e despesas fixas, aponte 2-4 oportunidades concretas (ex: margem menor que o mês anterior, custo fixo desproporcional ao faturamento).
4. **Riscos**: concentração de receita em poucos clientes, queda de conversão, etc.
5. **Plano de Ação — Próximos 30 dias**: 3-5 ações priorizadas e específicas, cada uma ligada a um número dos dados acima.

Seja direto e específico com os números fornecidos. Não invente dados que não estão aqui.`}

Use linguagem profissional mas direta. Formate com Markdown (negrito, listas).`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const insightsComerciaisRouter = router({
  // Diagnóstico completo do mês: vendas + lucro
  gerarDiagnostico: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const { mes: mesAnt, ano: anoAnt } = mesAnterior(input.mes, input.ano);
      const [atual, anterior] = await Promise.all([
        coletarDados(db, input.mes, input.ano),
        coletarDados(db, mesAnt, anoAnt),
      ]);

      const prompt = montarPrompt(input.mes, input.ano, atual, anterior);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um consultor comercial e financeiro especializado em pequenas e médias indústrias brasileiras. Responda sempre em português brasileiro, com foco em ações práticas para vender mais e lucrar mais." },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const analise: string = typeof rawContent === "string" ? rawContent : "Não foi possível gerar a análise.";

      return { analise, resumo: atual.comercial };
    }),

  // Pergunta livre com o mesmo contexto de dados do mês
  perguntar: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020), pergunta: z.string().min(3) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const { mes: mesAnt, ano: anoAnt } = mesAnterior(input.mes, input.ano);
      const [atual, anterior] = await Promise.all([
        coletarDados(db, input.mes, input.ano),
        coletarDados(db, mesAnt, anoAnt),
      ]);

      const prompt = montarPrompt(input.mes, input.ano, atual, anterior, input.pergunta);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um consultor comercial e financeiro especializado em pequenas e médias indústrias brasileiras. Responda sempre em português brasileiro, com foco em ações práticas para vender mais e lucrar mais." },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const resposta: string = typeof rawContent === "string" ? rawContent : "Não foi possível gerar a resposta.";

      return { resposta };
    }),
});
