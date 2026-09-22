/**
 * Handler HTTP para CRON job de sincronização do cache de abertos do CRM.
 * Endpoint: POST /api/scheduled/sincronizarCrmAbertos[?fatia=N]
 *
 * Sem `fatia`, atualiza a fatia mais recente e segue pelas mais antigas (rodízio pelo
 * relógio) enquanto couber nos 60s. Com `fatia`, atualiza só aquela — útil para
 * repopular o cache na mão, uma chamada por fatia (0 = mais recente).
 *
 * Sem autenticação por segredo — mesma decisão de sincronizarOS/
 * sincronizarHistorico (ver docs/cron-qstash.md, "Sem autenticação por
 * segredo"). O job é idempotente (só troca o trecho da janela que busca), então
 * chamadas indevidas não corrompem dado.
 */

import { Request, Response } from "express";
import { sincronizarCrmAbertos } from "./scheduled-sync-crm-abertos";
import { JANELA_ABERTOS_DIAS_PADRAO, numFatias } from "./crm-abertos-cache";

export async function handleSincronizarCrmAbertos(req: Request, res: Response) {
  try {
    const bruto = req.query.fatia;
    let fatia: number | undefined;
    if (typeof bruto === "string" && bruto !== "") {
      const total = numFatias(JANELA_ABERTOS_DIAS_PADRAO);
      fatia = Number(bruto);
      if (!Number.isInteger(fatia) || fatia < 0 || fatia >= total) {
        return res.status(400).json({ error: `fatia inválida: use um inteiro de 0 a ${total - 1}` });
      }
    }
    const resultado = await sincronizarCrmAbertos(fatia);
    return res.json({ ok: resultado.ok, resultado, timestamp: new Date().toISOString() });
  } catch (erro: any) {
    console.error(`❌ [CRON] Erro na sincronização de abertos do CRM:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: new Date().toISOString() },
    });
  }
}
