/**
 * Handler HTTP para CRON job de sincronização do cache de abertos do CRM.
 * Endpoint: POST /api/scheduled/sincronizarCrmAbertos
 *
 * Sem autenticação por segredo — mesma decisão de sincronizarOS/
 * sincronizarHistorico (ver docs/cron-qstash.md, "Sem autenticação por
 * segredo"). O job é idempotente (sobrescreve a mesma linha de cache), então
 * chamadas indevidas não corrompem dado.
 */

import { Request, Response } from "express";
import { sincronizarCrmAbertos } from "./scheduled-sync-crm-abertos";

export async function handleSincronizarCrmAbertos(req: Request, res: Response) {
  try {
    const resultado = await sincronizarCrmAbertos();
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro na sincronização de abertos do CRM:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
