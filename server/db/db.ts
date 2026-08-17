import { and, asc, count, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "./db-connection";
import {
  errorLibrary, faturamento, InsertRetrabalho, retrabalhos,
  knowledgeBase, InsertKnowledgeItem,
  knowledgeComments, InsertKnowledgeComment,
  suppliers, InsertSupplier,
  routines, InsertRoutine,
  regulations, InsertRegulation,
  pops, InsertPop,
  rolePermissions,
  AppRole, PAGE_KEYS,
  priceTableSections, PriceTableSection, priceTableMeta, priceTableHistory,
  auditoriaRetrabalhos, InsertAuditoriaRetrabalho, AuditoriaRetrabalho,
  cargosFuncoes, InsertCargoFuncao, CargoFuncao,
  knowledgeSuggestions, InsertKnowledgeSuggestion,
  analiseCurriculos, InsertAnaliseCurriculo, AnaliseCurriculo,
  financeirosMensais,
} from "../../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(getPool());
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Error Library ─────────────────────────────────────────────────────────
export async function getErrorLibrary() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(errorLibrary).orderBy(asc(errorLibrary.category), asc(errorLibrary.code));
}

export async function getErrorByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(errorLibrary).where(eq(errorLibrary.code, code)).limit(1);
  return result[0] ?? null;
}

// ─── Retrabalhos CRUD ──────────────────────────────────────────────────────
export interface RetrabalhosFilter {
  mes?: string;
  setor?: string;
  tipo?: string;
  responsavel?: string;
  classe?: string;
  dataInicio?: Date;
  dataFim?: Date;
  search?: string;
  tipoRegistro?: "retrabalho" | "cnq";
}

function buildWhereConditions(filter: RetrabalhosFilter) {
  const conditions = [];
  if (filter.tipoRegistro) conditions.push(eq(retrabalhos.tipoRegistro, filter.tipoRegistro));
  if (filter.mes) conditions.push(eq(retrabalhos.mes, filter.mes));
  if (filter.setor) conditions.push(eq(retrabalhos.setor, filter.setor));
  if (filter.tipo) conditions.push(eq(retrabalhos.tipo, filter.tipo as "INTERNO" | "EXTERNO"));
  if (filter.responsavel) conditions.push(like(retrabalhos.responsavel, `%${filter.responsavel}%`));
  if (filter.classe) conditions.push(eq(retrabalhos.classe, filter.classe as "EVITÁVEL" | "INEVITÁVEL"));
  if (filter.dataInicio) conditions.push(gte(retrabalhos.data, filter.dataInicio));
  if (filter.dataFim) conditions.push(lte(retrabalhos.data, filter.dataFim));
  if (filter.search) {
    conditions.push(
      or(
        like(retrabalhos.osRetrabalhada, `%${filter.search}%`),
        like(retrabalhos.osOriginal, `%${filter.search}%`),
        like(retrabalhos.descricao, `%${filter.search}%`),
        like(retrabalhos.responsavel, `%${filter.search}%`)
      )
    );
  }
  return conditions;
}

export async function listRetrabalhos(filter: RetrabalhosFilter = {}, page = 1, pageSize = 50) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(retrabalhos).where(whereClause).orderBy(desc(retrabalhos.data)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: count() }).from(retrabalhos).where(whereClause),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getRetrabalhosAll(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(retrabalhos).where(whereClause).orderBy(desc(retrabalhos.data));
}

export async function createRetrabalho(data: InsertRetrabalho & { horasImpacto?: number | string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const normalized = { ...data, horasImpacto: data.horasImpacto != null ? String(data.horasImpacto) : null };
  const result = await db.insert(retrabalhos).values(normalized as InsertRetrabalho);
  return result;
}

export async function createBatchRetrabalhos(
  baseData: Omit<InsertRetrabalho & { horasImpacto?: number | string | null }, 'codigoErro'>,
  errorIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const results = [];
  
  for (const errorId of errorIds) {
    const error = await db.select().from(errorLibrary).where(eq(errorLibrary.id, errorId)).limit(1);
    if (!error.length) continue;
    
    const normalized = {
      ...baseData,
      codigoErro: error[0].code,
      horasImpacto: baseData.horasImpacto != null ? String(baseData.horasImpacto) : null,
    };
    
    const result = await db.insert(retrabalhos).values(normalized as InsertRetrabalho);
    results.push(result);
  }
  
  return results;
}

export async function updateRetrabalho(id: number, data: Partial<InsertRetrabalho & { horasImpacto?: number | string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const normalized = { ...data, horasImpacto: data.horasImpacto != null ? String(data.horasImpacto) : data.horasImpacto };
  return db.update(retrabalhos).set(normalized as Partial<InsertRetrabalho>).where(eq(retrabalhos.id, id));
}

export async function deleteRetrabalho(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(retrabalhos).where(eq(retrabalhos.id, id));
}

export async function getRetrabalhosById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(retrabalhos).where(eq(retrabalhos.id, id)).limit(1);
  return result[0] ?? null;
}

// ─── KPIs ──────────────────────────────────────────────────────────────────
export async function getKpis(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return null;
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals, evitavelCount, inevitavelCount, retrabalhoCount, cnqCount] = await Promise.all([
    db.select({
      total: count(),
      custoTotal: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
      custoMedio: sql<number>`COALESCE(AVG(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
      freteTotal: sql<number>`COALESCE(SUM(CAST(${retrabalhos.frete} AS DECIMAL(10,2))), 0)`,
      horasTotal: sql<number>`COALESCE(SUM(CAST(${retrabalhos.horasImpacto} AS DECIMAL(6,2))), 0)`,
    }).from(retrabalhos).where(whereClause),
    db.select({ count: count() }).from(retrabalhos).where(and(whereClause, eq(retrabalhos.classe, "EVITÁVEL"))),
    db.select({ count: count() }).from(retrabalhos).where(and(whereClause, eq(retrabalhos.classe, "INEVITÁVEL"))),
    db.select({ count: count() }).from(retrabalhos).where(and(whereClause, eq(retrabalhos.tipoRegistro, "retrabalho"))),
    db.select({ count: count() }).from(retrabalhos).where(and(whereClause, eq(retrabalhos.tipoRegistro, "cnq"))),
  ]);

  const totalCount = totals[0]?.total ?? 0;
  const evCount = evitavelCount[0]?.count ?? 0;
  const inevCount = inevitavelCount[0]?.count ?? 0;
  const totalRetrabalhos = retrabalhoCount[0]?.count ?? 0;
  const totalCnq = cnqCount[0]?.count ?? 0;

  return {
    total: totalCount,
    totalRetrabalhos,
    totalCnq,
    custoTotal: Number(totals[0]?.custoTotal ?? 0),
    custoMedio: Number(totals[0]?.custoMedio ?? 0),
    freteTotal: Number(totals[0]?.freteTotal ?? 0),
    horasTotal: Number(totals[0]?.horasTotal ?? 0),
    evitavel: evCount,
    inevitavel: inevCount,
    pctEvitavel: totalCount > 0 ? Math.round((evCount / totalCount) * 100) : 0,
    pctInevitavel: totalCount > 0 ? Math.round((inevCount / totalCount) * 100) : 0,
  };
}

// ─── Gráficos ──────────────────────────────────────────────────────────────
export async function getBySetor(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    setor: retrabalhos.setor,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.setor).orderBy(desc(count()));
}

export async function getByCategoria(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    categoria: errorLibrary.category,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
  })
    .from(retrabalhos)
    .leftJoin(errorLibrary, eq(retrabalhos.codigoErro, errorLibrary.code))
    .where(whereClause)
    .groupBy(errorLibrary.category)
    .orderBy(desc(count()));
}

export async function getByCodigoErro(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    codigoErro: retrabalhos.codigoErro,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.codigoErro).orderBy(desc(count())).limit(15);
}

export async function getByResponsavel(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    responsavel: retrabalhos.responsavel,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.responsavel).orderBy(desc(count())).limit(10);
}

export async function getEvolucaoMensal(tipoRegistro?: "retrabalho" | "cnq") {
  const db = await getDb();
  if (!db) return [];
  const whereClause = tipoRegistro ? eq(retrabalhos.tipoRegistro, tipoRegistro) : undefined;
  const rows = await db.select({
    mes: retrabalhos.mes,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
    evitavel: sql<number>`SUM(CASE WHEN ${retrabalhos.classe} = 'EVITÁVEL' THEN 1 ELSE 0 END)`,
    inevitavel: sql<number>`SUM(CASE WHEN ${retrabalhos.classe} = 'INEVITÁVEL' THEN 1 ELSE 0 END)`,
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.mes).orderBy(
    sql`CASE ${retrabalhos.mes}
      WHEN 'JANEIRO' THEN 1 WHEN 'FEVEREIRO' THEN 2 WHEN 'MARÇO' THEN 3 WHEN 'ABRIL' THEN 4
      WHEN 'MAIO' THEN 5 WHEN 'JUNHO' THEN 6 WHEN 'JULHO' THEN 7 WHEN 'AGOSTO' THEN 8
      WHEN 'SETEMBRO' THEN 9 WHEN 'OUTUBRO' THEN 10 WHEN 'NOVEMBRO' THEN 11 WHEN 'DEZEMBRO' THEN 12
      ELSE 13 END`
  );
  // Preencher todos os meses até o mês atual com 0 para evitar gaps no gráfico
  const MESES_ORDEM = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const rowMap = new Map(rows.map(r => [(r.mes ?? '').toUpperCase(), r]));
  const mesAtual = new Date().getMonth(); // 0-indexed
  return MESES_ORDEM.slice(0, mesAtual + 1).map((mesNome, i) => {
    const row = rowMap.get(mesNome);
    return {
      mes: MESES_ABREV[i],       // abreviado para gráficos
      mesCompleto: mesNome,       // nome completo em maiúsculas para cruzar com tabela faturamento
      count: row ? Number(row.count) : 0,
      custo: row ? Number(row.custo) : 0,
      evitavel: row ? Number(row.evitavel) : 0,
      inevitavel: row ? Number(row.inevitavel) : 0,
    };
  });
}

export async function getReincidencia(filter: RetrabalhosFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    codigoErro: retrabalhos.codigoErro,
    setor: retrabalhos.setor,
    count: count(),
    custo: sql<number>`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
    responsaveis: sql<string>`STRING_AGG(DISTINCT ${retrabalhos.responsavel}, ', ')`,
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.codigoErro, retrabalhos.setor).having(sql`COUNT(*) >= 2`).orderBy(desc(count()));
}

export async function getDistinctValues() {
  const db = await getDb();
  if (!db) return { setores: [], responsaveis: [], meses: [] };
  const [setores, responsaveis, meses] = await Promise.all([
    db.selectDistinct({ setor: retrabalhos.setor }).from(retrabalhos).orderBy(asc(retrabalhos.setor)),
    db.selectDistinct({ responsavel: retrabalhos.responsavel }).from(retrabalhos).where(sql`${retrabalhos.responsavel} IS NOT NULL`).orderBy(asc(retrabalhos.responsavel)),
    db.selectDistinct({ mes: retrabalhos.mes }).from(retrabalhos).where(sql`${retrabalhos.mes} IS NOT NULL`),
  ]);
  return {
    setores: setores.map(s => s.setor),
    responsaveis: responsaveis.map(r => r.responsavel).filter(Boolean),
    meses: meses.map(m => m.mes).filter(Boolean),
  };
}

export async function getFaturamento() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faturamento).orderBy(asc(faturamento.ano), asc(faturamento.id));
}

export async function upsertFaturamento(mes: string, ano: number, valorFaturado: number, totalPedidos: number) {
  const db = await getDb();
  if (!db) return;
  // Usa update/insert explícito com chave composta (mes, ano)
  const existing = await db.select({ id: faturamento.id })
    .from(faturamento)
    .where(and(eq(faturamento.mes, mes), eq(faturamento.ano, ano)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(faturamento)
      .set({ valorFaturado: String(valorFaturado), totalPedidos })
      .where(and(eq(faturamento.mes, mes), eq(faturamento.ano, ano)));
  } else {
    await db.insert(faturamento)
      .values({ mes, ano, valorFaturado: String(valorFaturado), totalPedidos });
  }
}

export async function updateErrorCorrection(code: string, correction: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(errorLibrary).set({ correction }).where(eq(errorLibrary.code, code));
}
export async function updateErrorItem(code: string, data: { description?: string; correction?: string; imageUrl?: string | null; imageKey?: string | null }) {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, unknown> = {};
  if (data.description !== undefined) updates.description = data.description;
  if (data.correction !== undefined) updates.correction = data.correction;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
  if (data.imageKey !== undefined) updates.imageKey = data.imageKey;
  if (Object.keys(updates).length > 0) {
    await db.update(errorLibrary).set(updates as any).where(eq(errorLibrary.code, code));
  }
}

export async function deleteErrorLibraryItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(errorLibrary).where(eq(errorLibrary.id, id));
}

export async function createErrorLibraryItem(data: InsertKnowledgeItem & { code: string; category: string; description: string; correction: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(errorLibrary).values(data as any);
}

// ─── OPERAÇÕES: Base de Conhecimento ──────────────────────────────────────────
export async function listKnowledge(search?: string, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (category) conditions.push(eq(knowledgeBase.category, category));
  if (search) conditions.push(or(like(knowledgeBase.title, `%${search}%`), like(knowledgeBase.content, `%${search}%`), like(knowledgeBase.keywords, `%${search}%`)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(knowledgeBase).where(where).orderBy(asc(knowledgeBase.category), asc(knowledgeBase.title));
}
export async function getKnowledgeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1);
  return r[0] ?? null;
}
export async function createKnowledge(data: InsertKnowledgeItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(knowledgeBase).values(data);
}
export async function updateKnowledge(id: number, data: Partial<InsertKnowledgeItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(knowledgeBase).set(data).where(eq(knowledgeBase.id, id));
}
export async function deleteKnowledge(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}

// ─── OPERAÇÕES: Fornecedores ───────────────────────────────────────────────────
export async function listSuppliers(search?: string, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (category) conditions.push(eq(suppliers.category, category));
  if (search) conditions.push(or(like(suppliers.name, `%${search}%`), like(suppliers.company, `%${search}%`), like(suppliers.supplies, `%${search}%`)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(suppliers).where(where).orderBy(asc(suppliers.category), asc(suppliers.name));
}
export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return r[0] ?? null;
}
export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(suppliers).values(data);
}
export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(suppliers).set(data).where(eq(suppliers.id, id));
}
export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(suppliers).where(eq(suppliers.id, id));
}

// ─── OPERAÇÕES: Rotinas ────────────────────────────────────────────────────────
export async function listRoutines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routines).orderBy(asc(routines.frequency), asc(routines.title));
}
export async function createRoutine(data: InsertRoutine) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(routines).values(data);
}
export async function updateRoutine(id: number, data: Partial<InsertRoutine>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(routines).set(data).where(eq(routines.id, id));
}
export async function deleteRoutine(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(routines).where(eq(routines.id, id));
}

/** Retorna rotinas pendentes ou atrasadas (para aviso ao logar) */
export async function listPendingRoutines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routines)
    .where(sql`${routines.status} IN ('pendente', 'atrasada')`)
    .orderBy(asc(routines.frequency), asc(routines.title));
}

/** Marca rotina como concluída e calcula próxima data */
export async function markRoutineDone(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [routine] = await db.select().from(routines).where(eq(routines.id, id));
  if (!routine) throw new Error("Rotina não encontrada");
  const now = new Date();
  let nextDue: Date | null = null;
  switch (routine.frequency) {
    case "diaria":    nextDue = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); break;
    case "semanal":   nextDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
    case "quinzenal": nextDue = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); break;
    case "mensal":    nextDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); break;
    case "esporadico": nextDue = null; break;
  }
  return db.update(routines).set({
    lastDone: now,
    nextDue: nextDue ?? undefined,
    status: "em_dia",
  }).where(eq(routines.id, id));
}

// ─── OPERAÇÕES: Regulamentos ───────────────────────────────────────────────────
export async function listRegulations(type?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = type ? eq(regulations.type, type as any) : undefined;
  return db.select().from(regulations).where(where).orderBy(desc(regulations.createdAt));
}
export async function getRegulationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(regulations).where(eq(regulations.id, id)).limit(1);
  return r[0] ?? null;
}
export async function createRegulation(data: InsertRegulation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(regulations).values(data);
}
export async function updateRegulation(id: number, data: Partial<InsertRegulation>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(regulations).set(data).where(eq(regulations.id, id));
}
export async function deleteRegulation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(regulations).where(eq(regulations.id, id));
}

// ─── OPERAÇÕES: POPs ───────────────────────────────────────────────────────────
export async function listPops(sector?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = sector ? eq(pops.sector, sector) : undefined;
  return db.select().from(pops).where(where).orderBy(asc(pops.sector), asc(pops.code));
}
export async function getPopById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(pops).where(eq(pops.id, id)).limit(1);
  return r[0] ?? null;
}
export async function createPop(data: InsertPop) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(pops).values(data).returning({ id: pops.id });
  return result;
}
export async function updatePop(id: number, data: Partial<InsertPop>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(pops).set(data).where(eq(pops.id, id));
}
export async function deletePop(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(pops).where(eq(pops.id, id));
}

// ─── ROLE PERMISSIONS ────────────────────────────────────────────────────────

export async function getRolePermissions(role: AppRole) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rolePermissions).where(eq(rolePermissions.role, role));
}

export async function getAllRolePermissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rolePermissions).orderBy(rolePermissions.role, rolePermissions.pageKey);
}

export async function setRolePermission(role: AppRole, pageKey: string, canAccess: "sim" | "nao") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Upsert: update if exists, insert if not
  const existing = await db.select().from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .limit(100);
  const found = existing.find(r => r.pageKey === pageKey);
  if (found) {
    return db.update(rolePermissions)
      .set({ canAccess })
      .where(eq(rolePermissions.id, found.id));
  }
  return db.insert(rolePermissions).values({ role, pageKey, canAccess });
}

export async function canRoleAccessPage(role: AppRole, pageKey: string): Promise<boolean> {
  // master e admin têm acesso total
  if (role === "master" || role === "admin") return true;
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .limit(100);
  const perm = rows.find(r => r.pageKey === pageKey);
  return perm?.canAccess === "sim";
}

export async function getPermissionsForRole(role: AppRole): Promise<string[]> {
  if (role === "master" || role === "admin") return [...PAGE_KEYS];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .limit(100);
  return rows.filter(r => r.canAccess === "sim").map(r => r.pageKey);
}

// ─── TABELA DE PREÇOS ────────────────────────────────────────────────────────

export async function listPriceTableSections(page?: number): Promise<PriceTableSection[]> {
  const db = await getDb();
  if (!db) return [];
  if (page !== undefined) {
    return db.select().from(priceTableSections)
      .where(eq(priceTableSections.page, page))
      .orderBy(priceTableSections.page, priceTableSections.sectionOrder)
      .limit(200);
  }
  return db.select().from(priceTableSections)
    .orderBy(priceTableSections.page, priceTableSections.sectionOrder)
    .limit(200);
}

export async function updatePriceTableSection(
  id: number,
  data: { sectionTitle?: string; contentJson?: string; notes?: string | null },
  autor?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Buscar valores anteriores para histórico
  const [before] = await db.select().from(priceTableSections).where(eq(priceTableSections.id, id)).limit(1);
  await db.update(priceTableSections)
    .set({ ...data })
    .where(eq(priceTableSections.id, id));
  // Registrar cada campo alterado no histórico
  const campos: Array<{ campo: string; antes: string; depois: string }> = [];
  if (data.contentJson !== undefined && before?.contentJson !== data.contentJson) {
    campos.push({ campo: "contentJson", antes: before?.contentJson ?? "", depois: data.contentJson ?? "" });
  }
  if (data.sectionTitle !== undefined && before?.sectionTitle !== data.sectionTitle) {
    campos.push({ campo: "sectionTitle", antes: before?.sectionTitle ?? "", depois: data.sectionTitle ?? "" });
  }
  if (data.notes !== undefined && before?.notes !== data.notes) {
    campos.push({ campo: "notes", antes: before?.notes ?? "", depois: data.notes ?? "" });
  }
  // Nada mudou de fato — não incrementa versão nem registra histórico
  if (campos.length === 0) return;

  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  for (const c of campos) {
    await db.insert(priceTableHistory).values({
      versao: nextVersao,
      sectionId: id,
      sectionTitle: before?.sectionTitle ?? "",
      autor: autor ?? "sistema",
      campoAlterado: c.campo,
      valorAnterior: c.antes,
      valorNovo: c.depois,
    });
  }
}

export async function listPriceTableHistory(limit = 50): Promise<typeof priceTableHistory.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priceTableHistory)
    .orderBy(desc(priceTableHistory.createdAt))
    .limit(limit);
}

export async function incrementPriceTableVersion(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [meta] = await db.select().from(priceTableMeta).limit(1);
  if (!meta) {
    await db.insert(priceTableMeta).values({ versao: "001" });
    return;
  }
  // Incrementar versão: "001" → "002", "099" → "100", etc.
  const current = parseInt(meta.versao, 10) || 0;
  const next = String(current + 1).padStart(3, "0");
  await db.update(priceTableMeta).set({ versao: next, dataModificacao: new Date() });
}

export async function addPriceTableSection(data: {
  page: number;
  sectionTitle: string;
  contentJson: string;
  notes?: string | null;
  sectionOrder?: number;
}, autor?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(priceTableSections)
    .where(eq(priceTableSections.page, data.page));
  const maxOrder = existing.reduce((max, r) => Math.max(max, r.sectionOrder), 0);
  const [result] = await db.insert(priceTableSections).values({
    page: data.page,
    sectionTitle: data.sectionTitle,
    contentJson: data.contentJson,
    notes: data.notes ?? null,
    sectionOrder: data.sectionOrder ?? maxOrder + 1,
  }).returning({ id: priceTableSections.id });

  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  await db.insert(priceTableHistory).values({
    versao: nextVersao,
    sectionId: result.id,
    sectionTitle: data.sectionTitle,
    autor: autor ?? "sistema",
    campoAlterado: "secao_criada",
    valorAnterior: "",
    valorNovo: data.sectionTitle,
  });
  return result.id;
}

export async function deletePriceTableSection(id: number, autor?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [before] = await db.select().from(priceTableSections).where(eq(priceTableSections.id, id)).limit(1);
  await db.delete(priceTableSections).where(eq(priceTableSections.id, id));
  if (!before) return;

  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  await db.insert(priceTableHistory).values({
    versao: nextVersao,
    sectionId: id,
    sectionTitle: before.sectionTitle,
    autor: autor ?? "sistema",
    campoAlterado: "secao_removida",
    valorAnterior: before.sectionTitle,
    valorNovo: "",
  });
}

export async function getPriceTableMeta(): Promise<{ versao: string; dataModificacao: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  const [meta] = await db.select().from(priceTableMeta).limit(1);
  return meta ?? null;
}

// ─── COMENTÁRIOS DA BASE DE CONHECIMENTO ──────────────────────────────────────────────────────

export async function listKnowledgeComments(knowledgeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeComments)
    .where(eq(knowledgeComments.knowledgeId, knowledgeId))
    .orderBy(knowledgeComments.createdAt);
}

export async function createKnowledgeComment(data: InsertKnowledgeComment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(knowledgeComments).values(data);
}

export async function deleteKnowledgeComment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(knowledgeComments).where(eq(knowledgeComments.id, id));
}

// ─── AUDITORIA DE RETRABALHOS ────────────────────────────────────────────────

export interface AuditLogInput {
  retrabalhoId?: number | null;
  osRetrabalhada?: string | null;
  osOriginal?: string | null;
  acao: "CRIACAO" | "EDICAO" | "EXCLUSAO";
  usuarioId?: string | null;
  usuarioNome?: string | null;
  usuarioRole?: string | null;
  detalhes?: Record<string, unknown> | null;
}

export async function insertAuditLog(data: AuditLogInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditoriaRetrabalhos).values({
    retrabalhoId: data.retrabalhoId ?? null,
    osRetrabalhada: data.osRetrabalhada ?? null,
    osOriginal: data.osOriginal ?? null,
    acao: data.acao,
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    usuarioRole: data.usuarioRole ?? null,
    detalhes: data.detalhes ? JSON.stringify(data.detalhes) : null,
  });
}

export interface ListAuditLogsFilter {
  acao?: "CRIACAO" | "EDICAO" | "EXCLUSAO";
  usuarioId?: string;
  retrabalhoId?: number;
  osRetrabalhada?: string;
  dataInicio?: Date;
  dataFim?: Date;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(filter: ListAuditLogsFilter = {}): Promise<{
  rows: AuditoriaRetrabalho[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const { page = 1, pageSize = 50 } = filter;
  const conditions = [];

  if (filter.acao) conditions.push(eq(auditoriaRetrabalhos.acao, filter.acao));
  if (filter.usuarioId) conditions.push(eq(auditoriaRetrabalhos.usuarioId, filter.usuarioId));
  if (filter.retrabalhoId) conditions.push(eq(auditoriaRetrabalhos.retrabalhoId, filter.retrabalhoId));
  if (filter.osRetrabalhada) conditions.push(like(auditoriaRetrabalhos.osRetrabalhada, `%${filter.osRetrabalhada}%`));
  if (filter.dataInicio) conditions.push(gte(auditoriaRetrabalhos.createdAt, filter.dataInicio));
  if (filter.dataFim) {
    const endOfDay = new Date(filter.dataFim);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(auditoriaRetrabalhos.createdAt, endOfDay));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ total: count() })
    .from(auditoriaRetrabalhos)
    .where(where);

  const rows = await db
    .select()
    .from(auditoriaRetrabalhos)
    .where(where)
    .orderBy(desc(auditoriaRetrabalhos.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows, total: countResult?.total ?? 0 };
}

// ─── Cargos e Funções ─────────────────────────────────────────────────────────

export async function listCargos(): Promise<CargoFuncao[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cargosFuncoes).orderBy(asc(cargosFuncoes.titulo));
}

export async function getCargoById(id: number): Promise<CargoFuncao | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(cargosFuncoes).where(eq(cargosFuncoes.id, id));
  return row ?? null;
}

export async function createCargo(data: InsertCargoFuncao): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(cargosFuncoes).values(data).returning({ id: cargosFuncoes.id });
  return result.id;
}

export async function updateCargo(id: number, data: Partial<InsertCargoFuncao>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(cargosFuncoes).set(data).where(eq(cargosFuncoes.id, id));
}

export async function deleteCargo(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cargosFuncoes).where(eq(cargosFuncoes.id, id));
}

// ─── SUGESTÕES DE INCORPORAÇÃO NA BASE DE CONHECIMENTO ──────────────────────

export async function listKnowledgeSuggestions(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(knowledgeSuggestions)
    .where(status ? eq(knowledgeSuggestions.status, status) : undefined)
    .orderBy(knowledgeSuggestions.createdAt);
  return rows;
}

export async function createKnowledgeSuggestion(data: InsertKnowledgeSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(knowledgeSuggestions).values(data);
  return result;
}

export async function updateKnowledgeSuggestion(id: number, data: Partial<InsertKnowledgeSuggestion>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(knowledgeSuggestions).set(data).where(eq(knowledgeSuggestions.id, id));
}

export async function deleteKnowledgeSuggestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(knowledgeSuggestions).where(eq(knowledgeSuggestions.id, id));
}

// ─── Biblioteca de Arquivos ──────────────────────────────────────────────────
export async function listArquivosBibliotecaComConteudo() {
  const db = await getDb();
  if (!db) return [];
  const { bibliotecaArquivos } = await import("../../drizzle/schema");
  const rows = await db
    .select({
      id: bibliotecaArquivos.id,
      nome: bibliotecaArquivos.nome,
      descricao: bibliotecaArquivos.descricao,
      categoria: bibliotecaArquivos.categoria,
      subcategoria: bibliotecaArquivos.subcategoria,
      tags: bibliotecaArquivos.tags,
      fileName: bibliotecaArquivos.fileName,
      mimeType: bibliotecaArquivos.mimeType,
      conteudoExtraido: bibliotecaArquivos.conteudoExtraido,
      fileUrl: bibliotecaArquivos.fileUrl,
    })
    .from(bibliotecaArquivos)
    .orderBy(desc(bibliotecaArquivos.createdAt));
  return rows;
}


// ─── Financeiros Mensais ────────────────────────────────────────────────
export async function getFinanceiros() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financeirosMensais).orderBy(desc(financeirosMensais.ano), desc(financeirosMensais.mes));
}

export async function getFinanceiroByMesAno(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(financeirosMensais).where(and(eq(financeirosMensais.mes, mes), eq(financeirosMensais.ano, ano)));
  return result[0] ?? null;
}

export async function upsertFinanceiro(input: {
  mes: number;
  ano: number;
  receitaBruta?: number;
  receitaOperacional?: number;
  receitaFinanceira?: number;
  despesasTotal?: number;
  despesasFixas?: number;
  despesasVariaveis?: number;
  despesasPessoal?: number;
  despesasFinanceiras?: number;
  despesasImpostos?: number;
  lucroGruto?: number;
  lucroOperacional?: number;
  lucroLiquido?: number;
  entradas?: number;
  saidas?: number;
  saldoMes?: number;
  observacoes?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getFinanceiroByMesAno(input.mes, input.ano);

  if (existing) {
    const toStr = (v: number | string | null | undefined) => v != null ? String(v) : undefined;
    await db.update(financeirosMensais).set({
      receitaBruta: toStr(input.receitaBruta ?? existing.receitaBruta),
      receitaOperacional: toStr(input.receitaOperacional ?? existing.receitaOperacional),
      receitaFinanceira: toStr(input.receitaFinanceira ?? existing.receitaFinanceira),
      despesasTotal: toStr(input.despesasTotal ?? existing.despesasTotal),
      despesasFixas: toStr(input.despesasFixas ?? existing.despesasFixas),
      despesasVariaveis: toStr(input.despesasVariaveis ?? existing.despesasVariaveis),
      despesasPessoal: toStr(input.despesasPessoal ?? existing.despesasPessoal),
      despesasFinanceiras: toStr(input.despesasFinanceiras ?? existing.despesasFinanceiras),
      despesasImpostos: toStr(input.despesasImpostos ?? existing.despesasImpostos),
      lucroGruto: toStr(input.lucroGruto ?? existing.lucroGruto),
      lucroOperacional: toStr(input.lucroOperacional ?? existing.lucroOperacional),
      lucroLiquido: toStr(input.lucroLiquido ?? existing.lucroLiquido),
      entradas: toStr(input.entradas ?? existing.entradas),
      saidas: toStr(input.saidas ?? existing.saidas),
      saldoMes: toStr(input.saldoMes ?? existing.saldoMes),
      observacoes: input.observacoes ?? existing.observacoes,
      fonte: "manual",
    }).where(and(eq(financeirosMensais.mes, input.mes), eq(financeirosMensais.ano, input.ano)));
    return getFinanceiroByMesAno(input.mes, input.ano);
  } else {
    const result = await db.insert(financeirosMensais).values({
      mes: input.mes,
      ano: input.ano,
      receitaBruta: String(input.receitaBruta ?? 0),
      receitaOperacional: String(input.receitaOperacional ?? 0),
      receitaFinanceira: String(input.receitaFinanceira ?? 0),
      despesasTotal: String(input.despesasTotal ?? 0),
      despesasFixas: String(input.despesasFixas ?? 0),
      despesasVariaveis: String(input.despesasVariaveis ?? 0),
      despesasPessoal: String(input.despesasPessoal ?? 0),
      despesasFinanceiras: String(input.despesasFinanceiras ?? 0),
      despesasImpostos: String(input.despesasImpostos ?? 0),
      lucroGruto: String(input.lucroGruto ?? 0),
      lucroOperacional: String(input.lucroOperacional ?? 0),
      lucroLiquido: String(input.lucroLiquido ?? 0),
      entradas: String(input.entradas ?? 0),
      saidas: String(input.saidas ?? 0),
      saldoMes: String(input.saldoMes ?? 0),
      fonte: "manual",
      observacoes: input.observacoes,
    });
    return getFinanceiroByMesAno(input.mes, input.ano);
  }
}




// ─── Análise de Currículos ────────────────────────────────────────────────────

export async function createAnaliseCurriculo(input: InsertAnaliseCurriculo): Promise<AnaliseCurriculo | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [result] = await db.insert(analiseCurriculos).values(input).returning({ id: analiseCurriculos.id });
    return getAnaliseCurriculoById(result.id);
  } catch (error) {
    console.error("[DB] Error creating analise_curriculo:", error);
    return null;
  }
}

export async function getAnaliseCurriculoById(id: number): Promise<AnaliseCurriculo | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(analiseCurriculos).where(eq(analiseCurriculos.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[DB] Error fetching analise_curriculo:", error);
    return null;
  }
}

export async function getAnaliseCurriculosByCargo(cargoId: number): Promise<AnaliseCurriculo[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(analiseCurriculos)
      .where(eq(analiseCurriculos.cargoId, cargoId))
      .orderBy(desc(analiseCurriculos.createdAt));
  } catch (error) {
    console.error("[DB] Error fetching analise_curriculos by cargo:", error);
    return [];
  }
}

export async function updateAnaliseCurriculo(id: number, updates: Partial<AnaliseCurriculo>): Promise<AnaliseCurriculo | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.update(analiseCurriculos).set(updates).where(eq(analiseCurriculos.id, id));
    return getAnaliseCurriculoById(id);
  } catch (error) {
    console.error("[DB] Error updating analise_curriculo:", error);
    return null;
  }
}
