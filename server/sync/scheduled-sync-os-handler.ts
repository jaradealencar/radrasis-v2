/**
 * Handler HTTP para CRON job de sincronização de OS
 * Endpoint: POST /api/scheduled/sincronizarOS
 * Autenticação: header `x-cron-secret` comparado contra CRON_SECRET.
 *
 * Antes da Fase 3 este endpoint checava `sdk.authenticateRequest(req).isCron`
 * (SDK OAuth do Manus) — mas `User`/`sdk` nunca tiveram esses campos de
 * verdade (o cast `as any` escondia isso); nunca funcionou como controle de
 * acesso real. Com o SDK do Manus removido, substituído por um segredo
 * compartilhado simples.
 */

import { Request, Response } from 'express';
import { sincronizarOSDoMubiSys, obterStatusSincronizacao } from './scheduled-sync-os';

export async function handleSincronizarOS(req: Request, res: Response) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(403).json({ error: 'cron-only', message: 'Este endpoint é apenas para CRON jobs' });
    }

    console.log(`🔄 [CRON] Sincronização de OS iniciada`);

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
