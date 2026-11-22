import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

function compararSegredo(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function segredoRecebido(req: Request): string {
  const dedicado = req.header("x-wts-webhook-secret")?.trim();
  if (dedicado) return dedicado;
  const apiKey = req.header("x-api-key")?.trim();
  if (apiKey) return apiKey;
  const auth = req.header("authorization")?.trim() ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export function exigirChaveWebhookWts(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.CAMPANHAS_API_KEY?.trim();
  const wtsSecret = process.env.CAMPANHAS_WTS_WEBHOOK_SECRET?.trim();
  if (!apiKey && !wtsSecret) {
    res.status(503).json({ erro: "Webhook desativado: configure CAMPANHAS_WTS_WEBHOOK_SECRET no servidor." });
    return;
  }
  const recebida = segredoRecebido(req);
  if ([apiKey, wtsSecret].some(esperada => esperada && compararSegredo(recebida, esperada))) {
    next();
    return;
  }
  res.status(401).json({ erro: "Chave do webhook inválida." });
}

export function exigirChaveWebhookWtsDedicada(req: Request, res: Response, next: NextFunction) {
  const segredo = process.env.CAMPANHAS_WTS_WEBHOOK_SECRET?.trim();
  if (!segredo) {
    res.status(503).json({ erro: "Webhook desativado: configure CAMPANHAS_WTS_WEBHOOK_SECRET no servidor." });
    return;
  }
  if (!compararSegredo(segredoRecebido(req), segredo)) {
    res.status(401).json({ erro: "Chave do webhook WTS inválida." });
    return;
  }
  next();
}
