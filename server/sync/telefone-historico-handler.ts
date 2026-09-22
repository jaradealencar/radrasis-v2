/**
 * Handler HTTP para preencher `historico_os.telefone` de uma janela de datas.
 * Endpoint: POST /api/scheduled/completarTelefones?di=AAAA-MM-DD&df=AAAA-MM-DD
 *
 * Mesmo padrão dos demais /api/scheduled/* (sem segredo, ver docs/cron-qstash.md): só grava
 * telefone onde ainda é NULL (idempotente) e recusa janela maior que 7 dias ou fora dos
 * últimos 13 meses, então uma chamada indevida custa no máximo uma consulta à API MubiSys.
 * Serve para completar o histórico sem depender do botão da aba Guia de Fornecedores.
 */
import { Request, Response } from 'express';
import { completarTelefonesJanela, janelaValida } from './telefone-historico';

export async function handleCompletarTelefones(req: Request, res: Response) {
  const di = String(req.query.di ?? '');
  const df = String(req.query.df ?? '');
  if (!janelaValida({ di, df })) {
    return res.status(400).json({ ok: false, error: 'Informe di e df (AAAA-MM-DD): janela de até 7 dias dentro dos últimos 13 meses.' });
  }
  try {
    const resultado = await completarTelefonesJanela({ di, df });
    return res.json({ ok: true, di, df, ...resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro ao completar telefones (${di}..${df}):`, erro);
    return res.status(502).json({ ok: false, di, df, error: erro?.message || 'Erro desconhecido' });
  }
}
