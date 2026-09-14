import { Request, Response } from "express";
import { relatorioCrmDiario } from "./scheduled-relatorio-crm-diario";

export async function handleRelatorioCrmDiario(req: Request, res: Response) {
  try {
    const resultado = await relatorioCrmDiario();
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error("❌ [CRON] Erro no relatório diário do CRM:", erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
