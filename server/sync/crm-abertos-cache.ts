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

// 45 dias cobrem o mês vigente inteiro, mesmo no fim do mês, e preservam uma
// margem para propostas abertas recentes do mês anterior. A janela é dividida
// em chamadas sequenciais de dois dias para respeitar o limite da Vercel.
export const JANELA_ABERTOS_DIAS_PADRAO = 45;

// Mantemos a chave antiga para reaproveitar o cache existente sem migration ou limpeza.
export const CACHE_KEY_ABERTOS_PADRAO = "crm_abertos_15d";

// Cache rolante para as propostas "fechadas" (usado nas estatísticas do período
// selecionado na tela). Mesmo problema do "abertos": buscar ao vivo o período
// escolhido pelo usuário (ex.: "Este mês" = até 31 dias) tem o mesmo risco de
// demora/instabilidade — ver server/sync/scheduled-sync-crm-fechados.ts.
// 45 dias cobre com folga os presets do front (hoje/7dias/15dias/mês) porque
// "mês" nunca recua mais que ~31 dias a partir de hoje.
export const JANELA_FECHADOS_DIAS = 45;
export const CACHE_KEY_FECHADOS = "crm_fechados_45d";

const CRM_SYNC_STATUS_SUFFIX = "_sync_status";
const CRM_SYNC_STATUS_MAX_AGE_MS = 5 * 60 * 60 * 1000;

export interface CrmAbertosSyncStatus {
  totalDias: number;
  totalFatias: number;
  diasAtualizados: number;
  diasDesatualizados: number;
  fatiasDesatualizadas: number[];
  ultimaSincronizacaoEm: string | null;
  completo: boolean;
}

function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T00:00:00.000Z`);
  const limite = new Date(`${fim}T00:00:00.000Z`);
  while (cursor <= limite) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

async function lerStatusFatias(cacheKey: string): Promise<Record<string, string>> {
  try {
    const db = (await getDb())!;
    const rows = await db.select({ orcData: mubisysApiCache.orcData })
      .from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, `${cacheKey}${CRM_SYNC_STATUS_SUFFIX}`))
      .limit(1);
    const json = rows[0]?.orcData;
    if (!json) return {};
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function gravarStatusFatias(cacheKey: string, diasSincronizados: string[]): Promise<void> {
  try {
    const db = (await getDb())!;
    const statusKey = `${cacheKey}${CRM_SYNC_STATUS_SUFFIX}`;
    const anterior = await lerStatusFatias(cacheKey);
    const agora = new Date();
    const mapa = { ...anterior };
    for (const dia of diasSincronizados) mapa[dia] = agora.toISOString();
    const corte = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const dia of Object.keys(mapa)) if (dia < corte) delete mapa[dia];
    const existente = await db.select({ id: mubisysApiCache.id }).from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, statusKey)).limit(1);
    const dados = {
      orcData: JSON.stringify(mapa),
      fetchedAt: agora,
      expiresAt: new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000),
      updatedAt: agora,
    };
    if (existente.length > 0) {
      await db.update(mubisysApiCache).set(dados).where(eq(mubisysApiCache.cacheKey, statusKey));
    } else {
      await db.insert(mubisysApiCache).values({
        cacheKey: statusKey,
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear(),
        osData: null,
        ...dados,
      });
    }
  } catch {
    // O status de cobertura é diagnóstico: uma falha não deve interromper a lista do CRM.
  }
}

export async function getCrmAbertosSyncStatus(
  cacheKey: string,
  janelaDias: number,
  agora = new Date(),
): Promise<CrmAbertosSyncStatus> {
  const total = janelaDias + 1;
  const inicio = fmtDate(new Date(agora.getTime() - janelaDias * DIA_MS));
  const fim = fmtDate(agora);
  const diasEsperados = diasEntre(inicio, fim);
  const mapa = await lerStatusFatias(cacheKey);
  const atualizadoRecentemente = (dia: string) => {
    const registro = mapa[dia];
    if (!registro) return false;
    const sincronizadoEm = Date.parse(registro);
    return Number.isFinite(sincronizadoEm) && agora.getTime() - sincronizadoEm <= CRM_SYNC_STATUS_MAX_AGE_MS;
  };
  let diasAtualizados = 0;
  let ultima: string | null = null;
  for (const dia of diasEsperados) {
    const registro = mapa[dia];
    if (!registro) continue;
    if (!ultima || registro > ultima) ultima = registro;
    if (atualizadoRecentemente(dia)) diasAtualizados++;
  }
  const diasDesatualizados = Math.max(0, total - diasAtualizados);
  const totalFatias = numFatias(janelaDias);
  const fatiasDesatualizadas = Array.from({ length: totalFatias }, (_, fatia) => fatia)
    .filter(fatia => {
      const intervalo = intervaloDaFatia(janelaDias, fatia, agora);
      return diasEntre(intervalo.di, intervalo.df).some(dia => !atualizadoRecentemente(dia));
    });
  return {
    totalDias: total,
    totalFatias,
    diasAtualizados,
    diasDesatualizados,
    fatiasDesatualizadas,
    ultimaSincronizacaoEm: ultima,
    completo: diasDesatualizados === 0,
  };
}

export interface CrmAbertosCacheHit {
  itens: any[];
  fetchedAt: Date;
}

/**
 * Lê o cache SEM checar idade/expiração — serve o que houver, por mais velho
 * que esteja (ver nota de topo do arquivo). Só devolve `null` quando nunca
 * houve gravação para essa chave (bootstrap: primeiro deploy antes do cron
 * rodar pela primeira vez).
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
// simplesmente não existiam ("0 propostas"). Por isso o job agendado busca a janela
// em fatias pequenas, grava o cache a cada fatia e só segue para a próxima se couber
// no tempo. Fatias de 8 dias ainda estouraram os 60s no mesmo dia (a API chegou a
// ~13s por página de 50), daí 2 dias por fatia.
export const DIAS_POR_FATIA = 2;
const CRON_INTERVALO_MS = 10 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Quantas fatias de DIAS_POR_FATIA dias cobrem hoje + `janelaDias` dias para trás. */
export function numFatias(janelaDias: number): number {
  return Math.ceil((janelaDias + 1) / DIAS_POR_FATIA);
}

/**
 * Ordem em que o job tenta as fatias nesta execução, sem estado: a mais recente (0) vai
 * sempre primeiro — é onde entram propostas novas o tempo todo — e as mais antigas seguem
 * em rodízio pelo relógio. Uma execução perdida só adia as fatias que ela pegaria.
 */
export function ordemDasFatias(janelaDias: number, agora: Date = new Date()): number[] {
  const antigas = numFatias(janelaDias) - 1;
  if (antigas <= 0) return [0];
  const cursor = Math.floor(agora.getTime() / CRON_INTERVALO_MS) % antigas;
  return [0, ...Array.from({ length: antigas }, (_, k) => 1 + ((cursor + k) % antigas))];
}

/**
 * Intervalo [di, df] (YYYY-MM-DD) de uma fatia. Cobre hoje + `janelaDias` dias para trás
 * (a mesma cobertura da busca única), em blocos contíguos de DIAS_POR_FATIA dias:
 * fatia 0 = mais recente, última fatia = mais antiga.
 */
export function intervaloDaFatia(janelaDias: number, fatia: number, agora: Date = new Date()): { di: string; df: string } {
  const total = numFatias(janelaDias);
  if (!Number.isInteger(fatia) || fatia < 0 || fatia >= total) {
    throw new Error(`Fatia inválida: ${fatia} (use 0 a ${total - 1})`);
  }
  const dias = janelaDias + 1;
  const recuoRecente = fatia * DIAS_POR_FATIA;
  const recuoAntigo = Math.min(dias, (fatia + 1) * DIAS_POR_FATIA) - 1;
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
  const inicioJanela = intervaloDaFatia(janelaDias, numFatias(janelaDias) - 1).di;
  const mesclado = mesclarFatia(existente?.itens ?? [], itens, di, df, inicioJanela);
  await setCrmAbertosCache(cacheKey, mesclado);
  await gravarStatusFatias(cacheKey, diasEntre(di, df));
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
