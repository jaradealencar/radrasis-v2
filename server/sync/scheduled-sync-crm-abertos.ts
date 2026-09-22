/**
 * Sincronização agendada do cache de "orçamentos abertos" do CRM (aba Propostas).
 * Executa via CRON job (QStash) e mantém quente o cache que
 * server/routers/crm.ts (getPropostas/getVendedores) lê a cada carregamento de
 * página — ver server/sync/crm-abertos-cache.ts e docs/cron-qstash.md.
 *
 * A janela de 21 dias não cabe numa chamada só (estourava o maxDuration de 60s,
 * medido em 21/09/2026). Cada execução busca fatias de 2 dias, começando pela mais
 * recente, e grava o cache a cada fatia — então um 504 ou uma falha no meio não
 * perde o que já foi feito. Só parte para a próxima fatia se, pelo tempo da anterior,
 * ela couber nos 60s. Um único schedule a cada 10 min continua sendo suficiente.
 */

import {
  CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO,
  ordemDasFatias, refreshCrmAbertosFatia,
} from "./crm-abertos-cache";

// maxDuration da função é 60s; só começa outra fatia se a previsão (1,5x a duração da
// anterior) terminar antes disso.
const LIMITE_MS = 55_000;

export interface FatiaSincronizada {
  fatia: number;
  di: string;
  df: string;
  /** Quantos vieram do MubiSys nesta fatia. */
  naFatia: number;
}

export interface SincronizarCrmAbertosResultado {
  /** true só se todas as fatias tentadas deram certo (e ao menos uma foi tentada). */
  ok: boolean;
  /** Total de orçamentos no cache depois da última fatia gravada. */
  quantidade: number;
  tempoExecucaoMs: number;
  fatias: FatiaSincronizada[];
  erro?: string;
}

export async function sincronizarCrmAbertos(fatiaPedida?: number): Promise<SincronizarCrmAbertosResultado> {
  const inicio = Date.now();
  const ordem = fatiaPedida !== undefined ? [fatiaPedida] : ordemDasFatias(JANELA_ABERTOS_DIAS_PADRAO);
  const fatias: FatiaSincronizada[] = [];
  const erros: string[] = [];
  let quantidade = 0;
  let duracaoAnterior = 0;

  for (const fatia of ordem) {
    const t0 = Date.now();
    const jaTentou = fatias.length + erros.length > 0;
    if (jaTentou && (t0 - inicio) + duracaoAnterior * 1.5 > LIMITE_MS) break;
    try {
      const r = await refreshCrmAbertosFatia(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO, fatia);
      fatias.push({ fatia, di: r.di, df: r.df, naFatia: r.naFatia });
      quantidade = r.totalEmCache;
      console.log(`✅ [SYNC-CRM-ABERTOS] fatia ${fatia} (${r.di} a ${r.df}): ${r.naFatia} orçamentos; ${r.totalEmCache} em cache; ${Date.now() - t0}ms`);
    } catch (erro: any) {
      erros.push(`fatia ${fatia}: ${erro?.message || "erro desconhecido"}`);
      console.error(`❌ [SYNC-CRM-ABERTOS] Erro na fatia ${fatia}:`, erro);
    }
    duracaoAnterior = Date.now() - t0;
  }

  return {
    ok: erros.length === 0 && fatias.length > 0,
    quantidade,
    tempoExecucaoMs: Date.now() - inicio,
    fatias,
    erro: erros.length > 0 ? erros.join("; ") : undefined,
  };
}
