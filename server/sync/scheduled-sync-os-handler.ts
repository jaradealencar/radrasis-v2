/**
 * Handler HTTP para CRON job de sincronização de OS
 * Endpoint: POST /api/scheduled/sincronizarOS
 *
 * Sem autenticação por segredo — removida depois de dificultar o debug do
 * agendamento no QStash (403 mesmo com `CRON_SECRET`/`x-cron-secret`
 * batendo entre Vercel e o header `Upstash-Forward-x-cron-secret`, sem causa
 * raiz identificável a distância). O job em si é idempotente (upsert), então
 * chamadas indevidas não corrompem dado — o risco é só de custo/rate-limit
 * na API MubiSys se o endpoint for descoberto e martelado.
 */

import { Request, Response } from 'express';
import { sincronizarOSDoMubiSys, obterStatusSincronizacao } from './scheduled-sync-os';

/** Sem teto, um `?dias=3650` recria o estouro de maxDuration que a Fase 3 resolveu. */
function clampParam(valor: unknown, min: number, max: number, padrao: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}

export async function handleSincronizarOS(req: Request, res: Response) {
  try {
    const dias = clampParam(req.query.dias, 1, 31, 8);
    const offset = clampParam(req.query.offset, 0, 365, 0);

    console.log(`🔄 [CRON] Sincronização de OS iniciada (dias=${dias}, offset=${offset})`);

    // Executar sincronização
    const resultado = await sincronizarOSDoMubiSys({ dias, offset });

    console.log(`✅ [CRON] Sincronização concluída: ${resultado.quantidadeOsImportadas} OS processadas`);

    return res.json({
      ok: true,
      resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro na sincronização:`, erro);
    return res.status(500).json({
      error: erro?.message || 'Erro desconhecido',
      stack: erro?.stack,
      context: {
        url: req.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Endpoint para obter o status da última sincronização
 * GET /api/scheduled/sincronizarOS/status
 * O painel admin usa o procedure tRPC `admin.obterStatusSincronizacao`, não
 * esta rota — quem consulta isso é o operador do QStash.
 */
export async function handleStatusSincronizacao(req: Request, res: Response) {
  try {
    const status = await obterStatusSincronizacao();
    return res.json({
      ok: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (erro: any) {
    console.error(`❌ [STATUS] Erro ao obter status:`, erro);
    return res.status(500).json({
      error: erro?.message || 'Erro desconhecido',
    });
  }
}
