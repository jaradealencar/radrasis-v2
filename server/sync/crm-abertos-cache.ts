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

// 21 dias por padrão (setembro/2026: subiu de 15 para 21 junto da redefinição
// das faixas de follow-up do CRM — ver crm_faixa_etiquetas/getFaixaEtiquetas
// em server/routers/crm.ts). A Faixa 3 hoje termina em D+10 dias ÚTEIS, que no
// pior caso (início numa sexta ou segunda) corresponde a até 14 dias CORRIDOS
// — 21 dá folga confortável mesmo assim, e ainda mantém o volume por chamada
// bem menor que os 30 dias do modo "buscar mais antigas". IMPORTANTE: esta
// constante não é lida dinamicamente da config de faixas (que é editável via
// CRMConfig/Inteligência de Clientes sem deploy) — se o gestor alargar a
// Faixa 3 para muito além de D+10 dias úteis, revisar este valor também.
// Quanto ao tamanho em si: dado que o tempo de resposta do MubiSys varia
// muito (25s a 117s medidos para a mesma janela em 12/09/2026), aumentar a
// janela reduz o risco médio de não cobrir uma proposta ainda aberta, mas não
// elimina o risco de timeout — é por isso que a leitura nunca depende de
// terminar a tempo dentro do request do usuário (ver nota de topo do arquivo).
export const JANELA_ABERTOS_DIAS_PADRAO = 21;
export const JANELA_ABERTOS_DIAS_MAX = 30;

export const CACHE_KEY_ABERTOS_PADRAO = "crm_abertos_15d";
export const CACHE_KEY_ABERTOS_ESTENDIDO = "crm_abertos_30d";

// Cache rolante para as propostas "fechadas" (usado nas estatísticas do período
// selecionado na tela). Mesmo problema do "abertos": buscar ao vivo o período
// escolhido pelo usuário (ex.: "Este mês" = até 31 dias) tem o mesmo risco de
// demora/instabilidade — ver server/sync/scheduled-sync-crm-fechados.ts.
// 45 dias cobre com folga os presets do front (hoje/7dias/15dias/mês) porque
// "mês" nunca recua mais que ~31 dias a partir de hoje.
export const JANELA_FECHADOS_DIAS = 45;
export const CACHE_KEY_FECHADOS = "crm_fechados_45d";

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

// ─── Atualização por fatias ───────────────────────────────────────────────────
// Medido em 21/09/2026: a busca única da janela de 21 dias (todos os vendedores,
// ~4s por página de 50) estoura o maxDuration de 60s da Vercel ("Task timed out
// after 60 seconds"). Como a leitura nunca expira o cache por idade, o CRM ficou
// servindo dados parados — e, ao filtrar por data de criação, propostas recentes
// simplesmente não existiam ("0 propostas"). Por isso o job agendado atualiza UMA
// fatia da janela por execução (cada uma cabe com folga em 60s) e mescla no cache.
export const NUM_FATIAS_ABERTOS = 3;
const CRON_INTERVALO_MS = 10 * 60 * 1000;
// A fatia 0 (dias mais recentes) é onde entram propostas novas o tempo todo, então roda
// a cada 2ª execução (~20 min); as mais antigas só mudam de status e esperam ~40 min.
const CICLO_FATIAS = [0, 1, 0, 2];
const DIA_MS = 24 * 60 * 60 * 1000;

/** Qual fatia atualizar agora, sem estado: gira pelo relógio, então uma execução perdida só adia aquela fatia. */
export function fatiaDaVez(agora: Date = new Date()): number {
  return CICLO_FATIAS[Math.floor(agora.getTime() / CRON_INTERVALO_MS) % CICLO_FATIAS.length];
}

/**
 * Intervalo [di, df] (YYYY-MM-DD) de uma fatia. Cobre hoje + `janelaDias` dias para trás
 * (a mesma cobertura da busca única), dividido em NUM_FATIAS_ABERTOS blocos contíguos:
 * fatia 0 = mais recente, última fatia = mais antiga.
 */
export function intervaloDaFatia(janelaDias: number, fatia: number, agora: Date = new Date()): { di: string; df: string } {
  if (!Number.isInteger(fatia) || fatia < 0 || fatia >= NUM_FATIAS_ABERTOS) {
    throw new Error(`Fatia inválida: ${fatia} (use 0 a ${NUM_FATIAS_ABERTOS - 1})`);
  }
  const dias = janelaDias + 1;
  const tamanho = Math.ceil(dias / NUM_FATIAS_ABERTOS);
  const recuoRecente = fatia * tamanho;
  const recuoAntigo = Math.min(dias, (fatia + 1) * tamanho) - 1;
  return {
    di: fmtDate(new Date(agora.getTime() - recuoAntigo * DIA_MS)),
    df: fmtDate(new Date(agora.getTime() - recuoRecente * DIA_MS)),
  };
}

/**
 * Troca no cache só o trecho [di, df] pelos itens novos, mantendo o resto da janela e
 * descartando o que já saiu dela (`inicioJanela`) ou não tem data de cadastro.
 */
export function mesclarFatia<T extends { data_cadastro?: string | null }>(
  existentes: T[], novos: T[], di: string, df: string, inicioJanela: string,
): T[] {
  const preservados = existentes.filter((o) => {
    const dia = (o.data_cadastro || "").slice(0, 10);
    return !!dia && dia >= inicioJanela && (dia < di || dia > df);
  });
  return [...preservados, ...novos];
}

/**
 * Busca ao vivo só a fatia pedida (status=ABERTO, perPage=50) e mescla no cache existente.
 * Se a busca falhar ou vier incompleta, o cache anterior fica intocado.
 */
export async function refreshCrmAbertosFatia(
  cacheKey: string, janelaDias: number, fatia: number,
): Promise<{ di: string; df: string; naFatia: number; totalEmCache: number }> {
  const { di, df } = intervaloDaFatia(janelaDias, fatia);
  const { itens, completo } = await listarOrcamentosMubiSys({
    status: "ABERTO", datainicial: di, datafinal: df, perPage: 50,
  });
  if (!completo) throw new Error(`Fatia ${fatia} (${di} a ${df}) veio incompleta do MubiSys — cache mantido`);
  // Lê o cache só depois da busca (que é a parte lenta) para encolher a janela de corrida
  // com outra execução do job.
  const existente = await getCrmAbertosCache(cacheKey);
  const inicioJanela = intervaloDaFatia(janelaDias, NUM_FATIAS_ABERTOS - 1).di;
  const mesclado = mesclarFatia(existente?.itens ?? [], itens, di, df, inicioJanela);
  await setCrmAbertosCache(cacheKey, mesclado);
  return { di, df, naFatia: itens.length, totalEmCache: mesclado.length };
}

/**
 * Mantém só os orçamentos cadastrados dentro de [di, df] (inclusive, YYYY-MM-DD).
 * `data_cadastro` vem do MubiSys sem timezone ("2026-09-17 08:38:30") — compara só o
 * dia, igual ao filtro "Data inicial/final" da tela de Orçamentos do próprio ERP.
 */
export function filtrarPorDiaDeCadastro<T extends { data_cadastro?: string | null }>(
  itens: T[], di: string, df: string,
): T[] {
  return itens.filter((o) => {
    const dia = (o.data_cadastro || "").slice(0, 10);
    return !!dia && dia >= di && dia <= df;
  });
}

/** Data (YYYY-MM-DD) a partir da qual o cache de "fechados" tem cobertura garantida. */
export function inicioJanelaFechadosCache(): string {
  return fmtDate(new Date(Date.now() - JANELA_FECHADOS_DIAS * 24 * 60 * 60 * 1000));
}

/**
 * Busca ao vivo no MubiSys e grava no cache de "fechados". Sem filtro de
 * `status` na chamada (igual ao comportamento original) — o filtro de quais
 * status contam como "fechado" (aprovado/faturado/concluído) é sempre feito
 * client-side em crm.ts, e testado que o parâmetro `status` da API não reduz
 * o volume retornado de forma confiável (ver nota em listarOrcamentosMubiSys).
 */
export async function refreshCrmFechadosCache(): Promise<any[]> {
  const now = new Date();
  const diFechados = fmtDate(new Date(now.getTime() - JANELA_FECHADOS_DIAS * 24 * 60 * 60 * 1000));
  const dfFechados = fmtDate(now);
  const { itens } = await listarOrcamentosMubiSys({
    datainicial: diFechados, datafinal: dfFechados, perPage: 50,
  });
  await setCrmAbertosCache(CACHE_KEY_FECHADOS, itens);
  return itens;
}
