import { gerarRelatorioComercialCrm } from "../services/relatorioComercialCrm";
import { enviarRelatorioComercialCrm } from "../services/emailRelatorioCrm";
import { sincronizarFilaAcoesClientes } from "../routers/performanceComercial";
import { getDb } from "../db/db";

function fmtDateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Última semana completa (segunda a domingo) ANTES da semana corrente — não
 * depende do cron rodar necessariamente numa segunda-feira: qualquer que
 * seja o dia de hoje, calcula o domingo mais recente estritamente anterior a
 * hoje e volta 6 dias a partir dele.
 */
function calcularUltimaSemanaCompleta(referencia: Date): { inicio: Date; fim: Date } {
  const diaSemana = referencia.getDay(); // 0=domingo, 1=segunda, ...
  const diasDesdeUltimoDomingo = diaSemana === 0 ? 7 : diaSemana;
  const fim = new Date(referencia);
  fim.setDate(referencia.getDate() - diasDesdeUltimoDomingo);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - 6);
  return { inicio, fim };
}

export async function relatorioCrmSemanal() {
  const { inicio, fim } = calcularUltimaSemanaCompleta(new Date());
  const dataInicio = fmtDateISO(inicio);
  const dataFim = fmtDateISO(fim);

  // Ver nota equivalente em scheduled-relatorio-crm-diario.ts — sincroniza a
  // fila de Sugestões de Contato (~2min) antes de calcular o relatório.
  const db = await getDb();
  if (db) await sincronizarFilaAcoesClientes(db);

  const relatorio = await gerarRelatorioComercialCrm(dataInicio, dataFim, "semana");
  await enviarRelatorioComercialCrm(relatorio, "semanal");
  return { ok: true, periodo: { dataInicio, dataFim } };
}
