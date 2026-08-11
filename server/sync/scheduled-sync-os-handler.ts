/**
 * Handler HTTP para CRON job de sincronização de OS
 * Endpoint: POST /api/scheduled/sincronizarOS
 * Autenticação: via CRON token (user.isCron === true)
 */

import { Request, Response } from 'express';
import { sdk } from '../_core/sdk';
import { sincronizarOSDoMubiSys, obterStatusSincronizacao } from './scheduled-sync-os';

export async function handleSincronizarOS(req: Request, res: Response) {
  try {
    // Autenticar como CRON job
    const user = await (sdk as any).authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: 'cron-only', message: 'Este endpoint é apenas para CRON jobs' });
    }

    console.log(`🔄 [CRON] Sincronização de OS iniciada pelo CRON job: ${user.taskUid}`);

    // Executar sincronização
    const resultado = await sincronizarOSDoMubiSys();

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
