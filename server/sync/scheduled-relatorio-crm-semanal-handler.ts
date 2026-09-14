import { Request, Response } from "express";
import { relatorioCrmSemanal } from "./scheduled-relatorio-crm-semanal";

export async function handleRelatorioCrmSemanal(req: Request, res: Response) {
  try {
    const resultado = await relatorioCrmSemanal();
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error("❌ [CRON] Erro no relatório semanal do CRM:", erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
