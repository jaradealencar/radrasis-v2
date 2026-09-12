/**
 * Cache de "orçamentos abertos" do CRM (aba Propostas), lido por
 * server/routers/crm.ts e alimentado proativamente por
 * server/sync/scheduled-sync-crm-abertos.ts (job agendado via QStash — ver
 * docs/cron-qstash.md).
 *
 * Por que existe: getPropostas/getVendedores buscavam 12 meses inteiros de
 * orçamentos no MubiSys a cada carregamento de página, o que estourava o
 * timeout de 45s da API (medido em 12/09/2026). Reaproveita a tabela
 * mubisys_api_cache (já usada em performanceComercial.ts), mas com TTL fixo
 * próprio — a janela do CRM é rolante (sempre inclui "hoje"), então a lógica
 * de "mês fechado" daquele outro módulo não se aplica aqui. mes/ano são
 * gravados apenas para satisfazer a coluna NOT NULL da tabela, sem carregar
 * significado.
 *
 * IMPORTANTE — nunca paralelizar chamadas ao MubiSys: testado em 12/09/2026
 * que 2 requisições simultâneas já triplicam o tempo por página (4s → 16-18s)
 * e 8 simultâneas fazem TODAS estourarem o timeout de 45s. A API parece
 * serializar por trás — sempre uma chamada de cada vez.
 *
 * IMPORTANTE — a leitura NUNCA expira o cache por idade: medido em 12/09/2026
 * que a mesma busca de 15 dias levou 25s numa execução e 117s em outra (a API
 * MubiSys é muito mais instável do que o volume de dados sugere) — nenhuma
 * janela fixa garante caber no maxDuration de 60s da Vercel sempre. Por isso
 * getPropostas/getVendedores nunca disparam uma busca ao vivo síncrona dentro
 * da resposta ao usuário a não ser no bootstrap (cache nunca populado ainda);
 * em todo outro caso servem o que houver em cache, por mais velho que esteja,
 * e mostram "atualizado há X" na tela — o job agendado tenta de novo a cada
 * ciclo (falha de um ciclo não é problema, só atrasa a próxima atualização).
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/db";
import { mubisysApiCache } from "../../drizzle/schema";
import { listarOrcamentosMubiSys } from "../integrations/mubisys-client";

// Cron sugerido a cada 10 min (ver docs/cron-qstash.md). Não é mais usado como
// gate de expiração na leitura (ver nota de topo) — só informativo/reservado
// para uma eventual UI que sinalize "desatualizado" quando muito velho.
export const CRM_CACHE_TTL_MS = 20 * 60 * 1000;

// 15 dias por padrão: cobre com folga o que realmente importa (o próprio
// sistema classifica >30 dias como "perdido") e mantém o volume por chamada
// menor — mas dado que o tempo de resposta do MubiSys varia muito (25s a
// 117s medidos para a mesma janela em 12/09/2026), isso reduz o risco médio,
// não o elimina. É por isso que a leitura nunca depende de terminar a tempo
// dentro do request do usuário — ver nota de topo do arquivo.
export const JANELA_ABERTOS_DIAS_PADRAO = 15;
export const JANELA_ABERTOS_DIAS_MAX = 30;

export const CACHE_KEY_ABERTOS_PADRAO = "crm_abertos_15d";
export const CACHE_KEY_ABERTOS_ESTENDIDO = "crm_abertos_30d";

export interface CrmAbertosCacheHit {
  itens: any[];
  fetchedAt: Date;
}

/**
 * Lê o cache SEM checar idade/expiração — serve o que houver, por mais velho
 * que esteja (ver nota de topo do arquivo). Só devolve `null` quando nunca
 * houve gravação para essa chave (bootstrap: primeiro deploy antes do cron
 * rodar pela primeira vez, ou o modo "buscar mais antigas" antes do primeiro
 * clique).
 */
export async function getCrmAbertosCache(cacheKey: string): Promise<CrmAbertosCacheHit | null> {
  try {
    const db = (await getDb())!;
    const rows = await db.select().from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    const row = rows[0];
    if (!row || !row.orcData) return null;
    return { itens: JSON.parse(row.orcData), fetchedAt: row.fetchedAt };
  } catch {
    return null;
  }
}

export async function setCrmAbertosCache(cacheKey: string, itens: any[]): Promise<void> {
  try {
    const db = (await getDb())!;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CRM_CACHE_TTL_MS);
    const orcData = JSON.stringify(itens);
    const existing = await db.select({ id: mubisysApiCache.id }).from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db.update(mubisysApiCache)
        .set({ orcData, fetchedAt: now, expiresAt, updatedAt: now })
        .where(eq(mubisysApiCache.cacheKey, cacheKey));
    } else {
      await db.insert(mubisysApiCache).values({
        cacheKey, mes: now.getMonth() + 1, ano: now.getFullYear(),
        osData: null, orcData, fetchedAt: now, expiresAt,
      });
    }
  } catch {
    // não deixar falha de cache quebrar quem chamou (leitura em getPropostas
    // continua com o resultado ao vivo; escrita do cron só perde o refresh)
  }
}

const fmtDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Busca ao vivo no MubiSys (status=ABERTO, perPage=50 — ver nota de topo sobre
 * degradação não-linear com páginas maiores) e grava no cache. Usado tanto
 * pelo fallback de cache-miss em crm.ts quanto pelo job agendado.
 */
export async function refreshCrmAbertosCache(cacheKey: string, janelaDias: number): Promise<any[]> {
  const now = new Date();
  const diAberto = fmtDate(new Date(now.getTime() - janelaDias * 24 * 60 * 60 * 1000));
  const dfAberto = fmtDate(now);
  const { itens } = await listarOrcamentosMubiSys({
    status: "ABERTO", datainicial: diAberto, datafinal: dfAberto, perPage: 50,
  });
  await setCrmAbertosCache(cacheKey, itens);
  return itens;
}
