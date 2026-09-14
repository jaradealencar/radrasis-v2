import { gerarRelatorioComercialCrm } from "../services/relatorioComercialCrm";
import { enviarRelatorioComercialCrm } from "../services/emailRelatorioCrm";

function fmtDateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Roda de manhã (ver docs/cron-qstash.md) e cobre o dia ANTERIOR — o dia que
 * já terminou, não o dia em que o cron está rodando.
 */
export async function relatorioCrmDiario() {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const dataStr = fmtDateISO(ontem);

  const relatorio = await gerarRelatorioComercialCrm(dataStr, dataStr, "dia");
  await enviarRelatorioComercialCrm(relatorio, "diario");
  return { ok: true, periodo: dataStr };
}
