/**
 * Handler HTTP para CRON job de sincronização de `historico_os`/`historico_orcamentos`
 * Endpoint: POST /api/scheduled/sincronizarHistorico
 * Autenticação: header `x-cron-secret` comparado contra CRON_SECRET (mesmo
 * segredo do endpoint irmão em scheduled-sync-os-handler.ts).
 *
 * Query params opcionais `mes`/`ano`: sincroniza só aquele mês (uso manual/
 * backfill pontual). Sem eles, sincroniza o mês corrente + `mesesAtras`
 * meses anteriores (padrão 1) — ver sincronizarHistoricoRecente.
 */

import { Request, Response } from 'express';
import { sincronizarHistoricoDoMubiSys, sincronizarHistoricoRecente } from './scheduled-sync-historico';

function clampParam(valor: unknown, min: number, max: number, padrao: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}

export async function handleSincronizarHistorico(req: Request, res: Response) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(403).json({ error: 'cron-only', message: 'Este endpoint é apenas para CRON jobs' });
    }

    const mesParam = req.query.mes;
    const anoParam = req.query.ano;

    if (mesParam !== undefined && anoParam !== undefined) {
      const mes = clampParam(mesParam, 1, 12, new Date().getMonth() + 1);
      const ano = clampParam(anoParam, 2020, 2100, new Date().getFullYear());
      const resultado = await sincronizarHistoricoDoMubiSys(mes, ano);
      return res.json({ ok: resultado.status === 'SUCESSO', resultado, timestamp: new Date().toISOString() });
    }

    const mesesAtras = clampParam(req.query.mesesAtras, 0, 6, 1);
    const resultados = await sincronizarHistoricoRecente(mesesAtras);
    const ok = resultados.every(r => r.status === 'SUCESSO');
    return res.status(ok ? 200 : 207).json({ ok, resultados, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro na sincronização de histórico:`, erro);
    return res.status(500).json({
      error: erro?.message || 'Erro desconhecido',
      stack: erro?.stack,
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
