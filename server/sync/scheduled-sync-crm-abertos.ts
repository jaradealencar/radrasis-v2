/**
 * Sincronização agendada do cache de "orçamentos abertos" do CRM (aba Propostas).
 * Executa via CRON job (QStash) e mantém quente o cache que
 * server/routers/crm.ts (getPropostas/getVendedores) lê a cada carregamento de
 * página — ver server/sync/crm-abertos-cache.ts e docs/cron-qstash.md.
 *
 * Ao contrário de sincronizarOS/sincronizarHistorico, não precisa de
 * lotes/offset: a janela padrão (15 dias) já cabe com folga no maxDuration de
 * 60s (~25-32s medido em 12/09/2026). Um único schedule já é suficiente.
 */

import { CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO, refreshCrmAbertosCache } from "./crm-abertos-cache";

export interface SincronizarCrmAbertosResultado {
  ok: boolean;
  quantidade: number;
  tempoExecucaoMs: number;
  erro?: string;
}

export async function sincronizarCrmAbertos(): Promise<SincronizarCrmAbertosResultado> {
  const inicio = Date.now();
  try {
    const itens = await refreshCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO);
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`✅ [SYNC-CRM-ABERTOS] ${itens.length} orçamentos em cache em ${tempoExecucaoMs}ms`);
    return { ok: true, quantidade: itens.length, tempoExecucaoMs };
  } catch (erro: any) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`❌ [SYNC-CRM-ABERTOS] Erro:`, erro);
    return { ok: false, quantidade: 0, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
