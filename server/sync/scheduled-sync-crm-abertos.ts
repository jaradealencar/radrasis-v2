/**
 * Sincronização agendada do cache de "orçamentos abertos" do CRM (aba Propostas).
 * Executa via CRON job (QStash) e mantém quente o cache que
 * server/routers/crm.ts (getPropostas/getVendedores) lê a cada carregamento de
 * página — ver server/sync/crm-abertos-cache.ts e docs/cron-qstash.md.
 *
 * Cada execução atualiza UMA fatia da janela de 21 dias (não a janela inteira):
 * a busca única estourava o maxDuration de 60s (medido em 21/09/2026). Sem
 * `fatia` explícita, a fatia da vez é escolhida pelo relógio (ver fatiaDaVez),
 * então um único schedule a cada 10 min continua sendo suficiente.
 */

import {
  CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO,
  fatiaDaVez, refreshCrmAbertosFatia,
} from "./crm-abertos-cache";

export interface SincronizarCrmAbertosResultado {
  ok: boolean;
  /** Total de orçamentos no cache depois desta execução. */
  quantidade: number;
  tempoExecucaoMs: number;
  fatia?: number;
  di?: string;
  df?: string;
  /** Quantos vieram do MubiSys nesta fatia. */
  naFatia?: number;
  erro?: string;
}

export async function sincronizarCrmAbertos(fatiaPedida?: number): Promise<SincronizarCrmAbertosResultado> {
  const inicio = Date.now();
  const fatia = fatiaPedida ?? fatiaDaVez();
  try {
    const r = await refreshCrmAbertosFatia(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO, fatia);
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`✅ [SYNC-CRM-ABERTOS] fatia ${fatia} (${r.di} a ${r.df}): ${r.naFatia} orçamentos; ${r.totalEmCache} em cache, ${tempoExecucaoMs}ms`);
    return { ok: true, quantidade: r.totalEmCache, tempoExecucaoMs, fatia, di: r.di, df: r.df, naFatia: r.naFatia };
  } catch (erro: any) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`❌ [SYNC-CRM-ABERTOS] Erro na fatia ${fatia}:`, erro);
    return { ok: false, quantidade: 0, tempoExecucaoMs, fatia, erro: erro?.message || "Erro desconhecido" };
  }
}
