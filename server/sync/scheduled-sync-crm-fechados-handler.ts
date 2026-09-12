/**
 * Handler HTTP para CRON job de sincronização do cache de fechados do CRM.
 * Endpoint: POST /api/scheduled/sincronizarCrmFechados
 *
 * Sem autenticação por segredo — mesma decisão dos demais jobs (ver
 * docs/cron-qstash.md, "Sem autenticação por segredo").
 */

import { Request, Response } from "express";
import { sincronizarCrmFechados } from "./scheduled-sync-crm-fechados";

export async function handleSincronizarCrmFechados(req: Request, res: Response) {
  try {
    const resultado = await sincronizarCrmFechados();
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro na sincronização de fechados do CRM:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
