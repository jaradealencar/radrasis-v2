import type { Request, Response } from "express";
import { sincronizarCatalogoMubiSys } from "../services/mubisysEspelho";

/** Atualiza o catálogo e o inventário de perfis via agenda QStash. */
export async function handleSincronizarPerfisMubiSys(
  req: Request,
  res: Response
) {
  try {
    const resultado = await sincronizarCatalogoMubiSys();
    return res.json({
      ok: true,
      resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Falha ao consultar o catálogo MubiSys.";
    console.error(
      "[CRON] Falha na sincronização do catálogo de perfis:",
      mensagem
    );
    return res
      .status(500)
      .json({ error: mensagem, timestamp: new Date().toISOString() });
  }
}
