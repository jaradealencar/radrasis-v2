import { gerarRelatorioComercialCrm } from "../services/relatorioComercialCrm";
import { enviarRelatorioComercialCrm } from "../services/emailRelatorioCrm";
import { sincronizarFilaAcoesClientes } from "../routers/performanceComercial";
import { getDb } from "../db/db";

function fmtDateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Roda de manhã (ver docs/cron-qstash.md) e cobre o dia ANTERIOR — o dia que
 * já terminou, não o dia em que o cron está rodando.
 *
 * Sem expediente sábado/domingo (confirmado com o usuário em 14/09/2026) — se
 * "ontem" cair num desses dias, não gera nem envia relatório: zero atividade
 * nesse caso é esperado, não um alerta real de vendedor ausente.
 */
export async function relatorioCrmDiario() {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const diaSemana = ontem.getDay(); // 0=domingo, 6=sábado
  if (diaSemana === 0 || diaSemana === 6) {
    return { ok: true, periodo: fmtDateISO(ontem), pulado: "fim de semana, sem expediente" };
  }
  const dataStr = fmtDateISO(ontem);

  // Atualiza a fila de Sugestões de Contato antes de calcular o relatório —
  // demora ~2 minutos contra o banco de produção, mas aqui roda em segundo
  // plano (cron), sem ninguém esperando (ver nota em relatorioComercialCrm.ts).
  const db = await getDb();
  if (db) await sincronizarFilaAcoesClientes(db);

  const relatorio = await gerarRelatorioComercialCrm(dataStr, dataStr, "dia");
  await enviarRelatorioComercialCrm(relatorio, "diario");
  return { ok: true, periodo: dataStr };
}
