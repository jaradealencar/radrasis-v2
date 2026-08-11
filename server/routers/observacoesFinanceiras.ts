import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import {
  observacoesFinanceirasMensais,
  custosFixos,
  cteImportacoes,
  empacotamentoPedidos,
  empacotamentoConsumoCaixa,
  empacotamentoInsumos,
  dreMensal,
  financeiroMensal,
} from "../../drizzle/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mesRange(mes: number, ano: number) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  return { inicio, fim };
}

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const observacoesFinanceirasRouter = router({
  // Carregar observações de um mês
  get: protectedProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(observacoesFinanceirasMensais)
        .where(and(
          eq(observacoesFinanceirasMensais.mes, input.mes),
          eq(observacoesFinanceirasMensais.ano, input.ano)
        ))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Salvar observações manuais
  salvar: protectedProcedure
    .input(z.object({
      mes: z.number(),
      ano: z.number(),
      observacoesManuais: z.string().optional(),
      contextosEspecificos: z.string().optional(), // JSON string
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const existing = await db
        .select()
        .from(observacoesFinanceirasMensais)
        .where(and(
          eq(observacoesFinanceirasMensais.mes, input.mes),
          eq(observacoesFinanceirasMensais.ano, input.ano)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(observacoesFinanceirasMensais)
          .set({
            observacoesManuais: input.observacoesManuais ?? null,
            contextosEspecificos: input.contextosEspecificos ?? null,
          })
          .where(eq(observacoesFinanceirasMensais.id, existing[0].id));
      } else {
        await db.insert(observacoesFinanceirasMensais).values({
          mes: input.mes,
          ano: input.ano,
          observacoesManuais: input.observacoesManuais ?? null,
          contextosEspecificos: input.contextosEspecificos ?? null,
        });
      }
      return { ok: true };
    }),

  // Buscar dados complementares do mês (custos fixos, transportadoras, embalagem)
  getDadosComplementares: protectedProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const { inicio, fim } = mesRange(input.mes, input.ano);

      // 1. Custos fixos previstos (ativos)
      const cfAtivos = await db
        .select()
        .from(custosFixos)
        .where(eq(custosFixos.ativo, true));

      const totalCustosFixosPrevistos = cfAtivos.reduce((sum, cf) => sum + Number(cf.valor || 0), 0);
      const custosFixosPorCategoria = cfAtivos.reduce((acc, cf) => {
        const cat = cf.grupoCategoria || "Outros";
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += Number(cf.valor || 0);
        return acc;
      }, {} as Record<string, number>);

      // 2. DRE do mês (custos fixos reais = despesasFixas)
      const dreRows = await db
        .select()
        .from(dreMensal)
        .where(and(eq(dreMensal.ano, input.ano), eq(dreMensal.mes, input.mes)))
        .limit(1);
      const dre = dreRows[0] ?? null;
      const custosFixosReais = dre ? Number(dre.despesasFixas || 0) : 0;

      // 3. Financeiro mensal
      const finRows = await db
        .select()
        .from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano)))
        .limit(1);
      const fin = finRows[0] ?? null;

      // 4. Gastos com transportadoras no mês (CTe)
      const cteRows = await db
        .select()
        .from(cteImportacoes)
        .where(and(
          gte(cteImportacoes.dataEmissao, inicio),
          lt(cteImportacoes.dataEmissao, fim)
        ));
      const totalTransportadoras = cteRows.reduce((sum, c) => sum + Number(c.valor || 0), 0);
      const transportadorasPorNome = cteRows.reduce((acc, c) => {
        const nome = c.transportadoraNome || "Desconhecida";
        if (!acc[nome]) acc[nome] = { total: 0, qtd: 0 };
        acc[nome].total += Number(c.valor || 0);
        acc[nome].qtd += 1;
        return acc;
      }, {} as Record<string, { total: number; qtd: number }>);

      // 5. Custo de embalagem no mês (pedidos finalizados × consumo de insumos)
      const pedidosFinalizados = await db
        .select()
        .from(empacotamentoPedidos)
        .where(and(
          gte(empacotamentoPedidos.finalizadoEm, inicio),
          lt(empacotamentoPedidos.finalizadoEm, fim)
        ));

      // Buscar consumo por modelo de caixa e insumos
      const consumos = await db.select().from(empacotamentoConsumoCaixa);
      const insumos = await db.select().from(empacotamentoInsumos);
      const insumosMap = new Map(insumos.map(i => [i.id, i]));

      let custoEmbalagemTotal = 0;
      const custoEmbalagemPorInsumo: Record<string, number> = {};

      for (const ped of pedidosFinalizados) {
        if (!ped.modeloCaixaId) continue;
        const consumosCaixa = consumos.filter(c => c.modeloCaixaId === ped.modeloCaixaId);

        for (const cons of consumosCaixa) {
          const insumo = insumosMap.get(cons.insumoId);
          if (!insumo) continue;

          let qtd = Number(cons.quantidadePorCaixa || 0);
          const fator = Number(cons.fator || 1);

          // Calcular quantidade baseada na fórmula
          if (cons.formulaConsumo === "area_externa_m2" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
            const L = Number(ped.larguraCm) / 100;
            const A = Number(ped.alturaCm) / 100;
            const P = Number(ped.profundidadeCm) / 100;
            qtd = 2 * (L * A + L * P + A * P);
          } else if (cons.formulaConsumo === "volume_interno_m3" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
            const L = Number(ped.larguraCm) / 100;
            const A = Number(ped.alturaCm) / 100;
            const P = Number(ped.profundidadeCm) / 100;
            qtd = L * A * P;
          } else if (cons.formulaConsumo === "perimetro_m" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
            const L = Number(ped.larguraCm) / 100;
            const A = Number(ped.alturaCm) / 100;
            const P = Number(ped.profundidadeCm) / 100;
            qtd = 4 * (L + A + P) / 2;
          }

          const custoItem = qtd * fator * Number(insumo.custoUnitario || 0);
          custoEmbalagemTotal += custoItem;
          const nomeInsumo = insumo.nome || "Desconhecido";
          custoEmbalagemPorInsumo[nomeInsumo] = (custoEmbalagemPorInsumo[nomeInsumo] || 0) + custoItem;
        }
      }

      return {
        custosFixos: {
          previstos: totalCustosFixosPrevistos,
          reais: custosFixosReais,
          variacao: custosFixosReais - totalCustosFixosPrevistos,
          porCategoria: custosFixosPorCategoria,
        },
        transportadoras: {
          total: totalTransportadoras,
          qtdCtes: cteRows.length,
          porNome: transportadorasPorNome,
        },
        embalagem: {
          total: custoEmbalagemTotal,
          qtdPedidos: pedidosFinalizados.length,
          porInsumo: custoEmbalagemPorInsumo,
        },
        dre: dre ? {
          receitaOperacionalBruta: Number(dre.receitaOperacionalBruta || 0),
          totalEntradas: Number(dre.totalEntradas || 0),
          totalSaidas: Number(dre.totalSaidas || 0),
          lucroLiquido: Number(dre.lucroLiquido || 0),
          materiaPrima: Number(dre.materiaPrima || 0),
          despesasPessoal: Number(dre.despesasPessoal || 0),
          despesasFixas: Number(dre.despesasFixas || 0),
          impostosVendas: Number(dre.impostosVendas || 0),
          despesaVariavel: Number(dre.despesaVariavel || 0),
        } : null,
        financeiro: fin ? {
          faturamentoOficial: Number(fin.faturamentoOficial || 0),
          despesasFixas: Number(fin.despesasFixas || 0),
          despesasVariaveis: Number(fin.despesasVariaveis || 0),
          lucroLiquido: Number(fin.lucroLiquido || 0),
          resultadoEfetivo: Number(fin.resultadoEfetivo || 0),
          saldoMes: Number(fin.saldoMes || 0),
          impostoDas: Number(fin.impostoDas || 0),
          impostoIcmsDifal: Number(fin.impostoIcmsDifal || 0),
          freteRetrabalho: Number(fin.freteRetrabalho || 0),
        } : null,
      };
    }),

  // Gerar análise por IA
  gerarAnalise: protectedProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const MESES_NOMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      // Buscar observações manuais
      const obsRows = await db
        .select()
        .from(observacoesFinanceirasMensais)
        .where(and(
          eq(observacoesFinanceirasMensais.mes, input.mes),
          eq(observacoesFinanceirasMensais.ano, input.ano)
        ))
        .limit(1);
      const obs = obsRows[0];
      const observacoesManuais = obs?.observacoesManuais || "";
      const contextosEspecificos = obs?.contextosEspecificos || "[]";

      // Buscar dados financeiros
      const { inicio, fim } = mesRange(input.mes, input.ano);

      // DRE
      const dreRows = await db.select().from(dreMensal)
        .where(and(eq(dreMensal.ano, input.ano), eq(dreMensal.mes, input.mes))).limit(1);
      const dre = dreRows[0];

      // Financeiro mensal
      const finRows = await db.select().from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano))).limit(1);
      const fin = finRows[0];

      // Custos fixos previstos
      const cfAtivos = await db.select().from(custosFixos).where(eq(custosFixos.ativo, true));
      const totalCFPrevistos = cfAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);

      // Transportadoras
      const cteRows = await db.select().from(cteImportacoes)
        .where(and(gte(cteImportacoes.dataEmissao, inicio), lt(cteImportacoes.dataEmissao, fim)));
      const totalTransp = cteRows.reduce((s, c) => s + Number(c.valor || 0), 0);

      // Embalagem
      const pedidos = await db.select().from(empacotamentoPedidos)
        .where(and(gte(empacotamentoPedidos.finalizadoEm, inicio), lt(empacotamentoPedidos.finalizadoEm, fim)));
      const consumos = await db.select().from(empacotamentoConsumoCaixa);
      const insumosAll = await db.select().from(empacotamentoInsumos);
      const insumosMap = new Map(insumosAll.map(i => [i.id, i]));
      let custoEmb = 0;
      for (const ped of pedidos) {
        if (!ped.modeloCaixaId) continue;
        const consumosCaixa = consumos.filter(c => c.modeloCaixaId === ped.modeloCaixaId);
        for (const cons of consumosCaixa) {
          const insumo = insumosMap.get(cons.insumoId);
          if (!insumo) continue;
          let qtd = Number(cons.quantidadePorCaixa || 0);
          const fator = Number(cons.fator || 1);
          if (cons.formulaConsumo === "area_externa_m2" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
            const L = Number(ped.larguraCm)/100, A = Number(ped.alturaCm)/100, P = Number(ped.profundidadeCm)/100;
            qtd = 2*(L*A + L*P + A*P);
          }
          custoEmb += qtd * fator * Number(insumo.custoUnitario || 0);
        }
      }

      // Montar prompt
      const prompt = `Você é um analista financeiro sênior da empresa Letreiros Express, uma indústria de comunicação visual (letreiros, placas, painéis de LED).

Analise detalhadamente o mês de ${MESES_NOMES[input.mes]}/${input.ano} com base nos dados abaixo e nas observações do gestor.

## DADOS FINANCEIROS DO MÊS

### DRE (Demonstrativo de Resultado)
${dre ? `- Receita Operacional Bruta: ${fmtR(Number(dre.receitaOperacionalBruta || 0))}
- Total de Entradas: ${fmtR(Number(dre.totalEntradas || 0))}
- Impostos sobre Vendas: ${fmtR(Number(dre.impostosVendas || 0))}
- Matéria-Prima: ${fmtR(Number(dre.materiaPrima || 0))}
- Despesas com Pessoal: ${fmtR(Number(dre.despesasPessoal || 0))}
- Despesas Fixas: ${fmtR(Number(dre.despesasFixas || 0))}
- Despesas Financeiras: ${fmtR(Number(dre.despesasFinanceiras || 0))}
- Total de Saídas: ${fmtR(Number(dre.totalSaidas || 0))}
- Lucro Bruto: ${fmtR(Number(dre.lucroBruto || 0))}
- Lucro Operacional: ${fmtR(Number(dre.lucroOperacional || 0))}
- Lucro Líquido: ${fmtR(Number(dre.lucroLiquido || 0))}` : "Dados da DRE não disponíveis para este mês."}

### Financeiro Mensal
${fin ? `- Faturamento Oficial: ${fmtR(Number(fin.faturamentoOficial || 0))}
- Despesas Fixas (lançadas): ${fmtR(Number(fin.despesasFixas || 0))}
- Despesas Variáveis: ${fmtR(Number(fin.despesasVariaveis || 0))}
- Lucro Líquido: ${fmtR(Number(fin.lucroLiquido || 0))}
- Resultado Efetivo: ${fmtR(Number(fin.resultadoEfetivo || 0))}
- Saldo do Mês (caixa): ${fmtR(Number(fin.saldoMes || 0))}
- DAS (Simples Nacional): ${fmtR(Number(fin.impostoDas || 0))}
- ICMS DIFAL: ${fmtR(Number(fin.impostoIcmsDifal || 0))}
- Frete de Retrabalho: ${fmtR(Number(fin.freteRetrabalho || 0))}` : "Dados financeiros não disponíveis para este mês."}

### Custos Fixos: Previsto vs Real
- Total Previsto (cadastro ativo): ${fmtR(totalCFPrevistos)}
- Total Real (DRE): ${fmtR(Number(dre?.despesasFixas || 0))}
- Variação: ${fmtR(Number(dre?.despesasFixas || 0) - totalCFPrevistos)} (${Number(dre?.despesasFixas || 0) > totalCFPrevistos ? "ACIMA do previsto" : "abaixo do previsto"})

### Gastos com Transportadoras
- Total gasto: ${fmtR(totalTransp)}
- Quantidade de CTe emitidos: ${cteRows.length}
${cteRows.length > 0 ? `- Observação: Os fretes são CIF (pagos pela empresa), mas o valor do frete é cobrado do cliente à vista. Quando o faturamento do mês anterior é alto, os fretes do mês seguinte também serão maiores.` : ""}

### Custo de Embalagem (Matérias-Primas)
- Total estimado: ${fmtR(custoEmb)}
- Pedidos embalados no mês: ${pedidos.length}

## OBSERVAÇÕES DO GESTOR
${observacoesManuais || "(Nenhuma observação manual registrada)"}

## CONTEXTOS ESPECÍFICOS INFORMADOS
${(() => {
  try {
    const ctxs = JSON.parse(contextosEspecificos);
    if (Array.isArray(ctxs) && ctxs.length > 0) return ctxs.map((c: string) => `- ${c}`).join("\n");
    return "(Nenhum contexto específico)";
  } catch { return "(Nenhum contexto específico)"; }
})()}

## INSTRUÇÕES PARA A ANÁLISE

Produza uma análise financeira detalhada e estruturada em tópicos, cobrindo:

1. **Resumo Executivo**: Visão geral do resultado do mês em 2-3 frases.
2. **Análise de Receitas**: Avalie o faturamento, se houve crescimento ou queda, e possíveis causas.
3. **Custos Fixos — Previsto vs Real**: Compare o previsto com o real, destaque desvios e possíveis causas (pagamentos em duplicidade, honorários extras, etc.).
4. **Gastos com Transportadoras**: Destaque o total gasto, se está compatível com o faturamento, e o impacto do frete CIF no caixa.
5. **Custo de Embalagem**: Avalie o custo de matérias-primas de embalagem em relação ao volume de pedidos.
6. **Impostos e Tributação**: Analise o impacto dos impostos (DAS, ICMS DIFAL) no resultado.
7. **Fluxo de Caixa**: Analise o saldo do mês, recebíveis pendentes, e impacto de pagamentos atrasados.
8. **Pontos de Atenção**: Liste os 3-5 pontos mais críticos que merecem ação imediata.
9. **Recomendações**: Sugira 2-3 ações concretas para o próximo mês.

Use linguagem profissional mas acessível. Formate com Markdown (negrito, listas, etc.). Seja específico com números.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um analista financeiro especializado em pequenas e médias indústrias brasileiras. Responda sempre em português brasileiro." },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const analise: string = typeof rawContent === "string" ? rawContent : "Não foi possível gerar a análise.";

      // Salvar a análise no banco
      if (obs) {
        await db
          .update(observacoesFinanceirasMensais)
          .set({ analiseIa: analise })
          .where(eq(observacoesFinanceirasMensais.id, obs.id));
      } else {
        await db.insert(observacoesFinanceirasMensais).values({
          mes: input.mes,
          ano: input.ano,
          analiseIa: analise,
        });
      }

      return { analise };
    }),
});
