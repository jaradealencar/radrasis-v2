import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "./server/db/db";
import { financeiroMensal } from "./drizzle/schema";

/**
 * Importação pontual dos meses Abr-Jul/2026 no Painel Financeiro (financeiro_mensal).
 *
 * despesasFixas/despesasVariaveis/impostos/comissões/saldoMes/tl1/tl2/tl3 vêm de
 * "Fechamento -2026.07.xlsx" (aba Fluxo de Caixa), planilha gerencial consolidada
 * baixada do Google Drive — saldoMes/tl3 batem exatamente com a Auditoria bancária
 * de cada mês (exceto junho, com divergência de R$ 3.350,00 entre Fechamento e
 * Auditoria; usa o valor do Fechamento por decisão do usuário em 08/09/2026).
 *
 * faturamentoOficial vem da tela de Performance/DRE do próprio Radrasis, informado
 * diretamente pelo usuário em 08/09/2026 — tentativas de reproduzir esse número via
 * planilhas baixadas ("Receitas" do Fluxo de Caixa é caixa, não faturamento oficial)
 * e via soma direta da API MubiSys (valor_total - valor_desconto) ficaram próximas
 * mas não bateram exato, então não foram usadas.
 * lucroBruto/lucroLiquido = faturamentoOficial - despesasFixas - despesasVariaveis
 * (mesma fórmula do auto-cálculo do formulário em Financeiro.tsx).
 *
 * numColaboradores, receitaOperacionalOs e resultadoEfetivo ficam de fora (sem fonte
 * confiável nesses arquivos). dre_mensal não é tocado — é alimentado só pelo ERP
 * (ver server/scripts/backfill-dre-mensal.ts).
 */

const dados = [
  {
    mes: 4, ano: 2026,
    faturamentoOficial: 356766.90, despesasFixas: 177689.00, despesasVariaveis: 194769.00,
    lucroBruto: -15691.10, lucroLiquido: -15691.10, saldoMes: -68624.84,
    tl1: 171996.59, tl2: -5692.41, tl3: -68624.84,
    impostoDas: 21402.49, impostoIcmsDifal: 0.00, impostoDaems: 0.00,
    comissoesBv: 12562.43, freteRetrabalho: 4800.00, produtividadeSolda: 16005.46, devSoftware: 2309.96,
  },
  {
    mes: 5, ano: 2026,
    faturamentoOficial: 331632.55, despesasFixas: 159196.00, despesasVariaveis: 198160.00,
    lucroBruto: -25723.45, lucroLiquido: -25723.45, saldoMes: -32911.10,
    tl1: 153879.12, tl2: -5316.88, tl3: -32911.10,
    impostoDas: 31696.66, impostoIcmsDifal: 12129.65, impostoDaems: 0.00,
    comissoesBv: 10960.59, freteRetrabalho: 0.00, produtividadeSolda: 21484.15, devSoftware: 3884.97,
  },
  {
    mes: 6, ano: 2026,
    faturamentoOficial: 399961.83, despesasFixas: 162289.00, despesasVariaveis: 213245.00,
    lucroBruto: 24427.83, lucroLiquido: 24427.83, saldoMes: 41439.95,
    tl1: 225777.98, tl2: 63488.98, tl3: 41439.95,
    impostoDas: 18324.79, impostoIcmsDifal: 9198.94, impostoDaems: 0.00,
    comissoesBv: 10297.02, freteRetrabalho: 0.00, produtividadeSolda: 16194.62, devSoftware: 0.00,
  },
  {
    mes: 7, ano: 2026,
    faturamentoOficial: 305170.55, despesasFixas: 212582.00, despesasVariaveis: 188719.00,
    lucroBruto: -96130.45, lucroLiquido: -96130.45, saldoMes: 27429.93,
    tl1: 341505.92, tl2: 128923.92, tl3: 27429.93,
    impostoDas: 1309.53, impostoIcmsDifal: 5284.50, impostoDaems: 0.00,
    comissoesBv: 12273.90, freteRetrabalho: 267.75, produtividadeSolda: 15438.29, devSoftware: 0.00,
  },
];

const toStr = (v: number) => v.toFixed(2);

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

  for (const d of dados) {
    const { mes, ano, ...campos } = d;
    const data = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, toStr(v)]));

    const existing = await db
      .select()
      .from(financeiroMensal)
      .where(and(eq(financeiroMensal.mes, mes), eq(financeiroMensal.ano, ano)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(financeiroMensal).set(data).where(eq(financeiroMensal.id, existing[0].id));
      console.log(`🔄 financeiro_mensal ${mes}/${ano}: atualizado (id=${existing[0].id})`);
    } else {
      const [result] = await db.insert(financeiroMensal).values({ mes, ano, ...data }).returning({ id: financeiroMensal.id });
      console.log(`✅ financeiro_mensal ${mes}/${ano}: inserido (id=${result.id})`);
    }
  }

  console.log(`\n${dados.length} mes(es) gravado(s) em financeiro_mensal.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha ao importar financeiro_mensal:", error);
    process.exit(1);
  });
