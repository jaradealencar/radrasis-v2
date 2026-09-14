/**
 * Envio por e-mail (Resend) do relatório comercial + uso do CRM gerado por
 * server/services/relatorioComercialCrm.ts. Usado pelos crons diário/semanal
 * (server/sync/scheduled-relatorio-crm-*). Remetente usa o domínio de teste
 * do Resend (onboarding@resend.dev) até a Radra verificar um domínio próprio
 * — ver RESEND_API_KEY em .env.example.
 */
import { Resend } from "resend";
import type { RelatorioComercialCrm } from "./relatorioComercialCrm";

const REMETENTE = "Radra CRM <onboarding@resend.dev>";
const DESTINATARIO_PADRAO = "jaradealencar@gmail.com";

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(0)}%`;
}

function fmtVariacao(pct: number | null): string {
  if (pct == null) return "sem base de comparação";
  const seta = pct >= 0 ? "▲" : "▼";
  const cor = pct >= 0 ? "#16a34a" : "#dc2626";
  return `<span style="color:${cor};font-weight:600">${seta} ${Math.abs(pct).toFixed(0)}% vs. média do mês</span>`;
}

function fmtDataBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function montarHtml(relatorio: RelatorioComercialCrm, tipo: "diario" | "semanal"): string {
  const { periodo, comercial, usoCrm, sugestoesContato } = relatorio;
  const rotuloPeriodo = periodo.dataInicio === periodo.dataFim
    ? fmtDataBr(periodo.dataInicio)
    : `${fmtDataBr(periodo.dataInicio)} a ${fmtDataBr(periodo.dataFim)}`;
  const unidade = tipo === "diario" ? "dia" : "semana";

  const linhasVendedores = usoCrm.vendedores.map(v => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 8px;${v.semAtividade ? "color:#dc2626;font-weight:600" : ""}">${v.vendedor}${v.semAtividade ? " ⚠️" : ""}</td>
      <td style="padding:6px 8px;text-align:center">${v.contatosRegistrados}</td>
      <td style="padding:6px 8px;text-align:center">${v.ganhas}</td>
      <td style="padding:6px 8px;text-align:center">${v.perdidas}</td>
      <td style="padding:6px 8px;text-align:center">${v.diasComAtividade}/${v.totalDias}</td>
    </tr>`).join("");

  const alertaSemAtividade = usoCrm.vendedoresSemAtividade.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#991b1b;font-weight:600">
        ⚠️ Sem nenhuma atividade no CRM neste ${unidade}: ${usoCrm.vendedoresSemAtividade.join(", ")}
      </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#166534;font-weight:600">
        ✅ Todos os vendedores registraram alguma atividade no CRM neste ${unidade}.
      </div>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
    <h2 style="margin:0 0 4px">${tipo === "diario" ? "📊 Resumo comercial — " + rotuloPeriodo : "📈 Resumo comercial da semana — " + rotuloPeriodo}</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:13px">Radra CRM — relatório automático</p>

    <h3 style="margin:24px 0 8px;font-size:15px">Comercial (MubiSys)</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="padding:8px;background:#f9fafb;border-radius:6px 0 0 6px">📨 <b>${comercial.propostasEnviadas}</b> propostas enviadas</td>
        <td style="padding:8px;background:#f9fafb;border-radius:0 6px 6px 0">🆕 <b>${comercial.propostasNovosClientes}</b> de clientes novos</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="padding:8px;background:#f0fdf4;border-radius:6px 0 0 6px">✅ <b>${comercial.fechamentos}</b> fechamentos</td>
        <td style="padding:8px;background:#f0fdf4;border-radius:0 6px 6px 0">💰 <b>${fmtMoeda(comercial.valorFaturado)}</b> faturado</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr>
        <td style="padding:8px;background:#eff6ff;border-radius:6px">📈 Taxa de conversão do período: <b>${fmtPct(comercial.taxaConversaoPct)}</b></td>
      </tr>
    </table>

    <p style="font-size:13px;margin:8px 0">
      Valor faturado neste ${unidade}: ${fmtVariacao(comercial.comparativoValorFaturado.percentualVsMedia)}
      (posição ${comercial.comparativoValorFaturado.posicaoRanking}º de ${comercial.comparativoValorFaturado.totalComparados} ${unidade === "dia" ? "dias" : "semanas"} do mês — média: ${fmtMoeda(comercial.comparativoValorFaturado.mediaPeriodo)})
    </p>
    <p style="font-size:13px;margin:8px 0 20px">
      Propostas enviadas neste ${unidade}: ${fmtVariacao(comercial.comparativoPropostasEnviadas.percentualVsMedia)}
      (posição ${comercial.comparativoPropostasEnviadas.posicaoRanking}º de ${comercial.comparativoPropostasEnviadas.totalComparados})
    </p>

    <h3 style="margin:24px 0 8px;font-size:15px">Uso do CRM por vendedor</h3>
    ${alertaSemAtividade}
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="border-bottom:2px solid #d1d5db;text-align:center">
          <th style="text-align:left;padding:6px 8px">Vendedor</th>
          <th style="padding:6px 8px">Contatos<br/>registrados</th>
          <th style="padding:6px 8px">Ganhas</th>
          <th style="padding:6px 8px">Perdidas</th>
          <th style="padding:6px 8px">Dias ativos</th>
        </tr>
      </thead>
      <tbody>${linhasVendedores}</tbody>
    </table>

    <h3 style="margin:24px 0 8px;font-size:15px">Sugestões de Contato — reengajamento da carteira</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="padding:8px;background:#eef2ff;border-radius:6px 0 0 6px">🎯 <b>${sugestoesContato.pendentesTotal}</b> clientes parados pendentes de contato</td>
        <td style="padding:8px;background:#eef2ff;border-radius:0 6px 6px 0">☎️ <b>${sugestoesContato.contatadasPeriodo}</b> contatados neste ${unidade}</td>
      </tr>
    </table>
    ${sugestoesContato.porVendedor.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
      <thead>
        <tr style="border-bottom:2px solid #d1d5db;text-align:center">
          <th style="text-align:left;padding:6px 8px">Vendedor</th>
          <th style="padding:6px 8px">Pendentes</th>
          <th style="padding:6px 8px">Contatados<br/>no ${unidade}</th>
        </tr>
      </thead>
      <tbody>${sugestoesContato.porVendedor.map(v => `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:6px 8px">${escapeHtml(v.vendedor)}</td>
          <td style="padding:6px 8px;text-align:center">${v.pendentes}</td>
          <td style="padding:6px 8px;text-align:center">${v.contatadasPeriodo}</td>
        </tr>`).join("")}</tbody>
    </table>` : ""}
    ${sugestoesContato.topPendentes.length > 0 ? `
    <p style="font-size:13px;font-weight:600;margin:8px 0 4px">Maior potencial parado, priorize:</p>
    <ul style="font-size:13px;margin:0 0 16px;padding-left:20px">
      ${sugestoesContato.topPendentes.map(s => `<li style="margin-bottom:4px">
        <b>${escapeHtml(s.empresa)}</b> (score ${s.score}${s.vendedor ? `, ${escapeHtml(s.vendedor)}` : ""}) — ${escapeHtml(s.motivo)}
      </li>`).join("")}
    </ul>` : ""}

    <p style="color:#9ca3af;font-size:11px;margin-top:24px">
      "Contatos registrados" = cliques nos quadradinhos das faixas de follow-up. "Score" da sugestão de contato pondera atraso na recompra e relevância econômica do cliente. Gerado automaticamente pelo RadraSIS.
    </p>
  </div>`;
}

export async function enviarRelatorioComercialCrm(
  relatorio: RelatorioComercialCrm,
  tipo: "diario" | "semanal",
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY ausente — relatório não enviado.");

  const resend = new Resend(apiKey);
  const destinatario = process.env.RELATORIO_CRM_EMAIL_DESTINO || DESTINATARIO_PADRAO;
  const rotuloPeriodo = relatorio.periodo.dataInicio === relatorio.periodo.dataFim
    ? fmtDataBr(relatorio.periodo.dataInicio)
    : `${fmtDataBr(relatorio.periodo.dataInicio)} a ${fmtDataBr(relatorio.periodo.dataFim)}`;
  const assunto = tipo === "diario"
    ? `📊 CRM Radra — Resumo de ${rotuloPeriodo}`
    : `📈 CRM Radra — Resumo da semana, ${rotuloPeriodo}`;

  const { error } = await resend.emails.send({
    from: REMETENTE,
    to: destinatario,
    subject: assunto,
    html: montarHtml(relatorio, tipo),
  });
  if (error) throw new Error(`Falha ao enviar relatório por e-mail: ${error.message}`);
}
