import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/db";
import { historicoOs, dreMensal } from "../../drizzle/schema";
import { isOsNormalDb } from "../routers/performanceComercial";

/**
 * Backfill de dre_mensal a partir de historico_os (parte que vem do ERP MubiSys).
 * dre_mensal está vazia em produção — nunca foi importada corretamente, mesmo
 * problema já documentado para historico_os em docs/cron-qstash.md. Preenche só
 * os campos com correspondência direta no ERP; despesas de pessoal, financeiras,
 * não-operacionais e receitas financeira/não-operacional ficam NULL — essas não
 * existem em nenhuma OS do MubiSys (vêm de folha de pagamento e do banco), então
 * os subtotais que dependem delas (Lucro Operacional, Lucro Líquido) também ficam
 * NULL em vez de mostrar um número incompleto como se fosse o fechamento real.
 *
 * Mapeamento (confirmado com o usuário em 01/09/2026):
 * - Despesa Variável = comissões (interna+externa) + descontos + terceirizados
 * - Despesa Operacional = mão de obra + tarifas financeiras
 * - Matéria Prima, Despesas Fixas (custo fixo rateado) e Impostos s/ Vendas
 *   (tributos) têm campo próprio em historico_os, sem precisar agrupar.
 *
 * Idempotente: apaga e reinsere as linhas de cada mes/ano presente em
 * historico_os, então pode ser rodado de novo com segurança (ex.: depois que
 * historico_os ganhar mais meses, ou se o mapeamento acima for revisado).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const num = (v: string | null | undefined) => parseFloat(String(v ?? "0")) || 0;

type Acc = {
  receitaOperacionalBruta: number;
  materiaPrima: number;
  despesasFixas: number;
  impostosVendas: number;
  comissoesInternas: number;
  descontos: number;
  despesaVariavel: number;
  despesaOperacional: number;
};

function novoAcc(): Acc {
  return {
    receitaOperacionalBruta: 0, materiaPrima: 0, despesasFixas: 0, impostosVendas: 0,
    comissoesInternas: 0, descontos: 0, despesaVariavel: 0, despesaOperacional: 0,
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

  const rows = await db.select({
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
    valorOs: historicoOs.valorOs,
    valorTotal: historicoOs.valorTotal,
    materiaPrima: historicoOs.materiaPrima,
    custoFixo: historicoOs.custoFixo,
    maoDeObra: historicoOs.maoDeObra,
    tarifasFinanceiras: historicoOs.tarifasFinanceiras,
    comissoesInternas: historicoOs.comissoesInternas,
    comissoesExternas: historicoOs.comissoesExternas,
    terceirizados: historicoOs.terceirizados,
    tributos: historicoOs.tributos,
    descontos: historicoOs.descontos,
  }).from(historicoOs);

  const porMes = new Map<string, Acc>();
  for (const os of rows) {
    if (!isOsNormalDb(os)) continue;
    const chave = `${os.mes}_${os.ano}`;
    const acc = porMes.get(chave) ?? novoAcc();

    acc.receitaOperacionalBruta += num(os.valorOs ?? os.valorTotal);
    acc.materiaPrima += num(os.materiaPrima);
    acc.despesasFixas += num(os.custoFixo);
    acc.impostosVendas += num(os.tributos);
    acc.comissoesInternas += num(os.comissoesInternas);
    acc.descontos += num(os.descontos);
    acc.despesaVariavel += num(os.comissoesInternas) + num(os.comissoesExternas) + num(os.descontos) + num(os.terceirizados);
    acc.despesaOperacional += num(os.maoDeObra) + num(os.tarifasFinanceiras);

    porMes.set(chave, acc);
  }

  if (porMes.size === 0) {
    console.log("Nenhuma OS normal encontrada em historico_os — nada a inserir.");
    return;
  }

  const pct = (parte: number, base: number) => (base > 0 ? (parte / base).toFixed(4) : null);

  let inseridos = 0;
  for (const [chave, acc] of [...porMes.entries()].sort()) {
    const [mesStr, anoStr] = chave.split("_");
    const mes = Number(mesStr), ano = Number(anoStr);

    const receitaBrutaOperacional = acc.receitaOperacionalBruta - acc.impostosVendas;
    const lucroBruto = receitaBrutaOperacional - acc.despesaVariavel - acc.despesaOperacional;

    await db.delete(dreMensal).where(and(eq(dreMensal.mes, mes), eq(dreMensal.ano, ano)));
    await db.insert(dreMensal).values({
      mes, ano,
      receitaOperacionalBruta: acc.receitaOperacionalBruta.toFixed(2),
      valorPedidos: acc.receitaOperacionalBruta.toFixed(2),
      impostosVendas: acc.impostosVendas.toFixed(2),
      receitaBrutaOperacional: receitaBrutaOperacional.toFixed(2),
      despesaVariavel: acc.despesaVariavel.toFixed(2),
      despesaOperacional: acc.despesaOperacional.toFixed(2),
      lucroBruto: lucroBruto.toFixed(2),
      materiaPrima: acc.materiaPrima.toFixed(2),
      despesasFixas: acc.despesasFixas.toFixed(2),
      percMateriaPrima: pct(acc.materiaPrima, acc.receitaOperacionalBruta),
      percFixoRateado: pct(acc.despesasFixas, acc.receitaOperacionalBruta),
      percTributos: pct(acc.impostosVendas, acc.receitaOperacionalBruta),
      percComissaoInterna: pct(acc.comissoesInternas, acc.receitaOperacionalBruta),
      percDescontos: pct(acc.descontos, acc.receitaOperacionalBruta),
      // Fora do escopo do ERP — ficam NULL até alguém preencher manualmente:
      // gastosGeraisFabricacao, despesasPessoal, despesasFinanceiras,
      // despesasNaoOperacionais, receitaFinanceira, receitaNaoOperacional,
      // totalEntradas, totalSaidas, lucroOperacional, lucroLiquido,
      // resultadoEfetivo, margemResultadoEfetivo.
    });
    inseridos++;
    console.log(`✅ dre_mensal ${pad(mes)}/${ano}: receita=${acc.receitaOperacionalBruta.toFixed(2)} lucroBruto=${lucroBruto.toFixed(2)}`);
  }

  console.log(`\n${inseridos} mes(es) inserido(s) em dre_mensal a partir do ERP.`);
  console.log("Faltam (ficaram NULL, precisam de preenchimento manual): despesas com pessoal, despesas financeiras, despesas/receitas não-operacionais, receita financeira — e por consequência Lucro Operacional e Lucro Líquido.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha ao popular dre_mensal:", error);
    process.exit(1);
  });
