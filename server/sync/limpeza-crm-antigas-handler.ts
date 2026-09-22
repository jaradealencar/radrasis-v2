/**
 * Handler HTTP da limpeza única do CRM de Propostas — ver limpeza-crm-antigas.ts.
 * Endpoint: POST /api/scheduled/limparCrmPropostasAntigas[?ate=YYYY-MM-DD][&apply=1]
 *
 * Ação administrativa pontual (não é um cron recorrente) — sem `apply=1` só mostra o que
 * faria, sem gravar nada. Mesma decisão de "sem autenticação por segredo" dos outros
 * endpoints em /api/scheduled (ver docs/cron-qstash.md), mas o dry-run por padrão evita que
 * uma chamada indevida grave algo — só um `apply=1` explícito grava.
 */

import { Request, Response } from "express";
import { limparPropostasAntigas } from "./limpeza-crm-antigas";

export async function handleLimparCrmAntigas(req: Request, res: Response) {
  try {
    const ate = typeof req.query.ate === "string" && req.query.ate ? req.query.ate : "2026-09-17";
    const apply = req.query.apply === "1" || req.query.apply === "true";
    const resultado = await limparPropostasAntigas(ate, apply);
    return res.json({ ok: true, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [LIMPEZA-CRM-ANTIGAS] Erro:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
