/**
 * Sincronização agendada do cache de "orçamentos fechados" do CRM (usado nas
 * estatísticas do período selecionado na aba Propostas). Ver
 * server/sync/crm-abertos-cache.ts e docs/cron-qstash.md.
 *
 * Job separado de sincronizarCrmAbertos (não a mesma invocação) porque cada
 * busca já pode sozinha se aproximar do maxDuration de 60s da Vercel quando a
 * API MubiSys está lenta — somar as duas no mesmo request arriscaria estourar
 * sempre.
 */

import { CACHE_KEY_FECHADOS, refreshCrmFechadosCache } from "./crm-abertos-cache";

export interface SincronizarCrmFechadosResultado {
  ok: boolean;
  quantidade: number;
  tempoExecucaoMs: number;
  erro?: string;
}

export async function sincronizarCrmFechados(): Promise<SincronizarCrmFechadosResultado> {
  const inicio = Date.now();
  try {
    const itens = await refreshCrmFechadosCache();
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`✅ [SYNC-CRM-FECHADOS] ${itens.length} orçamentos em cache (${CACHE_KEY_FECHADOS}) em ${tempoExecucaoMs}ms`);
    return { ok: true, quantidade: itens.length, tempoExecucaoMs };
  } catch (erro: any) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`❌ [SYNC-CRM-FECHADOS] Erro:`, erro);
    return { ok: false, quantidade: 0, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
