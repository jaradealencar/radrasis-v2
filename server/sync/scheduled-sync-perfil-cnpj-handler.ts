/**
 * Handler HTTP para CRON job de sincronização do Perfil de Clientes por CNPJ.
 * Endpoint: POST /api/scheduled/sincronizarPerfilCnpj
 *
 * Sem autenticação por segredo — mesma decisão dos demais jobs (ver
 * docs/cron-qstash.md, "Sem autenticação por segredo"). Idempotente: nunca
 * reprocessa quem já está em `clientes_perfil_cnpj`, então uma chamada
 * indevida ou repetida não corrompe nada, só reconsulta candidatos sem achar
 * nenhum novo.
 */

import { Request, Response } from "express";
import { sincronizarPerfilCnpj } from "./scheduled-sync-perfil-cnpj";

export async function handleSincronizarPerfilCnpj(req: Request, res: Response) {
  try {
    const resultado = await sincronizarPerfilCnpj();
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error("❌ [CRON] Erro na sincronização de perfil CNPJ:", erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
