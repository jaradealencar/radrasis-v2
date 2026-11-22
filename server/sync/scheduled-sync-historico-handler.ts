/**
 * Handler HTTP para CRON job de sincronização de `historico_os`/`historico_orcamentos`
 * Endpoint: POST /api/scheduled/sincronizarHistorico
 *
 * Sem autenticação por segredo — ver justificativa em scheduled-sync-os-handler.ts.
 *
 * Query params opcionais `mes`/`ano`: sincroniza só aquele mês (uso manual/
 * backfill pontual). Sem eles, sincroniza o mês corrente + `mesesAtras`
 * meses anteriores (padrão 1) — ver sincronizarHistoricoRecente.
 */

import { Request, Response } from 'express';
import { sincronizarHistoricoDoMubiSys, sincronizarHistoricoRecente } from './scheduled-sync-historico';
import { recalcularFatosContatoErp, registrarTentativaSyncErp } from '../services/campanhaCadenciaErp';
import { invalidarCacheContextoErp } from '../services/fontesErpCampanhas';

function clampParam(valor: unknown, min: number, max: number, padrao: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}

export async function handleSincronizarHistorico(req: Request, res: Response) {
  try {
    const mesParam = req.query.mes;
    const anoParam = req.query.ano;

    if (mesParam !== undefined && anoParam !== undefined) {
      const mes = clampParam(mesParam, 1, 12, new Date().getMonth() + 1);
      const ano = clampParam(anoParam, 2020, 2100, new Date().getFullYear());
      const resultado = await sincronizarHistoricoDoMubiSys(mes, ano);
      return res.json({ ok: resultado.status === 'SUCESSO', resultado, timestamp: new Date().toISOString() });
    }

    const mesesAtras = clampParam(req.query.mesesAtras, 0, 6, 1);
    if (mesesAtras >= 1) {
      await registrarTentativaSyncErp('historico', 'Sincronização do histórico MubiSys em andamento.', false);
      await registrarTentativaSyncErp('fatos', 'Aguardando conclusão da sincronização do histórico MubiSys.', false);
    }
    const resultados = await sincronizarHistoricoRecente(mesesAtras);
    const ok = resultados.every(r => r.status === 'SUCESSO');
    if (mesesAtras >= 1) {
      const detalhe = ok ? null : resultados.filter(r => r.status !== 'SUCESSO').map(r => `${r.mes}/${r.ano}: ${r.mensagemErro ?? 'falha'}`).join('; ');
      if (ok) {
        invalidarCacheContextoErp();
        await recalcularFatosContatoErp();
        await registrarTentativaSyncErp('fatos');
        await registrarTentativaSyncErp('historico');
      } else {
        await registrarTentativaSyncErp('historico', detalhe, false);
        await registrarTentativaSyncErp('fatos', `Histórico incompleto: ${detalhe ?? 'falha sem detalhe'}`, false);
      }
    }
    return res.status(ok ? 200 : 207).json({ ok, resultados, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    await registrarTentativaSyncErp('historico', erro?.message ?? 'Falha inesperada na sincronização do histórico.', false).catch(() => undefined);
    await registrarTentativaSyncErp('fatos', erro?.message ?? 'Falha ao atualizar fatos após sincronização do histórico.', false).catch(() => undefined);
    console.error(`❌ [CRON] Erro na sincronização de histórico:`, erro);
    return res.status(500).json({
      error: erro?.message || 'Erro desconhecido',
      stack: erro?.stack,
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
