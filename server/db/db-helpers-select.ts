import { and, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "./db-connection";
import { cotacoesFrete, cotacaoOpcoes, cotacaoComentarios, InsertCotacaoOpcao } from "../../drizzle/schema";
import { ENV } from "../_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (_db) return _db;
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL not set");
  _db = drizzle(getPool());
  return _db;
}

/**
 * SELECT do Kanban de fretes — pagina sobre cotacoes_frete e embute as
 * opções de frete de cada cotação.
 */
export async function listarCotacoesFrete(
  page: number = 1,
  pageSize: number = 15,
  status?: string,
) {
  const db = await getDb();
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 15, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safePageSize;

  const where = status ? eq(cotacoesFrete.status, status as any) : undefined;

  const rows = await db
    .select()
    .from(cotacoesFrete)
    .where(where)
    .orderBy(desc(cotacoesFrete.createdAt))
    .limit(safePageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(cotacoesFrete)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  console.log(
    `✅ [SELECT Kanban] ${rows.length} registros (página ${safePage}/${totalPages}, status=${status ?? 'todos'})`,
  );

  // As opções de frete precisam vir junto: o card exibe as transportadoras
  // selecionadas com valor e dias úteis em TODOS os estágios. Antes isso vinha
  // como [] e o card nunca mostrava nada, mesmo com registros no banco.
  const ids = rows.map((r) => r.id);
  const opcoes = await listarOpcoesPorCotacoes(ids);
  const porCotacao = new Map<number, any[]>();
  for (const op of opcoes) {
    const chave = op.cotacaoId;
    if (!porCotacao.has(chave)) porCotacao.set(chave, []);
    porCotacao.get(chave)!.push(normalizarOpcao(op));
  }
  console.log(`✅ [SELECT Kanban] ${opcoes.length} opção(ões) de frete carregada(s) para ${ids.length} cotação(ões)`);

  return {
    data: rows.map((row) => ({ ...row, opcoes: porCotacao.get(row.id) ?? [] })),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Converte a linha crua de cotacao_opcoes pro formato que o frontend espera.
 * `prazoEntrega` é derivado de prazoDias+tipoPrazo (compat com telas antigas).
 */
export function normalizarOpcao(op: any) {
  const prazoDias = op.prazoDias ?? null;
  const tipoPrazo = op.tipoPrazo ?? 'uteis';
  const selecionada = op.selecionada === 'sim' ? 'sim' : 'nao';
  return {
    id: Number(op.id),
    cotacaoId: Number(op.cotacaoId),
    transportadoraId: op.transportadoraId ?? null,
    transportadoraNome: op.transportadoraNome ?? null,
    valorFrete: op.valorFrete == null ? '0' : String(op.valorFrete),
    prazoDias,
    tipoPrazo,
    modal: op.modal ?? null,
    prazoEntrega: prazoDias != null ? `${prazoDias} dias ${tipoPrazo === 'corridos' ? 'corridos' : 'úteis'}` : null,
    observacoes: op.observacoes ?? null,
    selecionada,
    createdAt: op.createdAt ?? null,
  };
}

/**
 * Buscar uma cotação específica com todas as colunas.
 */
export async function obterCotacaoDetalhes(id: number) {
  const db = await getDb();
  const [cotacao] = await db.select().from(cotacoesFrete).where(eq(cotacoesFrete.id, id));
  if (!cotacao) {
    throw new Error(`Cotação #${id} não encontrada`);
  }
  return cotacao;
}

/**
 * Excluir uma cotação e seus registros dependentes (opções e comentários).
 */
export async function excluirCotacaoFrete(id: number) {
  const db = await getDb();
  await db.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, id));
  await db.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, id));
  const result = await db.delete(cotacoesFrete).where(eq(cotacoesFrete.id, id)).returning({ id: cotacoesFrete.id });
  const afetados = result.length;
  console.log(`🗑️ [DELETE] Cotação #${id} removida (${afetados} registro(s))`);
  return { id, afetados };
}

/**
 * Excluir TODAS as cotações de um determinado status (padrão: 'aberta').
 * Usado para limpar cards de teste do Kanban.
 */
export async function excluirCotacoesPorStatus(status: string = 'aberta') {
  const db = await getDb();
  const ids = await db.select({ id: cotacoesFrete.id }).from(cotacoesFrete).where(eq(cotacoesFrete.status, status as any));

  for (const row of ids) {
    await db.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, row.id));
    await db.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, row.id));
  }

  const result = await db.delete(cotacoesFrete).where(eq(cotacoesFrete.status, status as any)).returning({ id: cotacoesFrete.id });
  const afetados = result.length;
  console.log(`🗑️ [DELETE EM MASSA] ${afetados} cotação(ões) com status='${status}' removidas`);
  return { afetados };
}

// ─── OPÇÕES DE FRETE (cotacao_opcoes) ────────────────────────────────────────

export interface OpcaoFreteInput {
  cotacaoId: number;
  transportadoraId?: number | null;
  transportadoraNome: string;
  valorFrete?: string | number | null;
  prazoDias?: number | null;
  tipoPrazo?: string | null;
  modal?: string | null;
  observacoes?: string | null;
}

/** Insere uma opção de frete evitando duplicar a mesma transportadora na cotação. */
export async function adicionarOpcaoFrete(input: OpcaoFreteInput) {
  const db = await getDb();
  const valor =
    input.valorFrete == null || input.valorFrete === ''
      ? null
      : String(input.valorFrete).replace(',', '.');

  // Evita duplicidade da mesma transportadora na mesma cotação
  const [existente] = await db
    .select({ id: cotacaoOpcoes.id })
    .from(cotacaoOpcoes)
    .where(and(eq(cotacaoOpcoes.cotacaoId, input.cotacaoId), eq(cotacaoOpcoes.transportadoraNome, input.transportadoraNome)))
    .limit(1);
  if (existente) {
    console.log(`ℹ️ [OPCAO] ${input.transportadoraNome} já existe na cotação #${input.cotacaoId}`);
    return { id: existente.id, duplicada: true };
  }

  const insertData: InsertCotacaoOpcao = {
    cotacaoId: input.cotacaoId,
    transportadoraId: input.transportadoraId ?? null,
    transportadoraNome: input.transportadoraNome,
    valorFrete: valor ?? '0',
    prazoDias: input.prazoDias ?? null,
    tipoPrazo: (input.tipoPrazo as any) ?? 'uteis',
    modal: input.modal ?? null,
    observacoes: input.observacoes ?? null,
  };
  const [result] = await db.insert(cotacaoOpcoes).values(insertData).returning({ id: cotacaoOpcoes.id });

  console.log(`✅ [OPCAO] ${input.transportadoraNome} adicionada à cotação #${input.cotacaoId} (id ${result.id})`);
  return { id: result.id, duplicada: false };
}

/** Lista as opções de frete de uma cotação. */
export async function listarOpcoesFrete(cotacaoId: number) {
  const db = await getDb();
  return db.select().from(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, cotacaoId)).orderBy(cotacaoOpcoes.id);
}

/** Lista as opções de várias cotações de uma vez (para o Kanban). */
export async function listarOpcoesPorCotacoes(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select().from(cotacaoOpcoes).where(inArray(cotacaoOpcoes.cotacaoId, ids)).orderBy(cotacaoOpcoes.id);
}

/** Atualiza valor e/ou prazo de uma opção de frete. */
export async function atualizarOpcaoFrete(
  opcaoId: number,
  dados: { valorFrete?: string | number | null; prazoDias?: number | null; tipoPrazo?: string | null; modal?: string | null; observacoes?: string | null },
) {
  const db = await getDb();
  const sets: Partial<InsertCotacaoOpcao> = {};

  if (dados.valorFrete !== undefined) {
    sets.valorFrete =
      dados.valorFrete == null || dados.valorFrete === ''
        ? '0'
        : String(dados.valorFrete).replace(',', '.');
  }
  if (dados.prazoDias !== undefined) {
    sets.prazoDias = dados.prazoDias;
  }
  if (dados.tipoPrazo !== undefined) {
    sets.tipoPrazo = dados.tipoPrazo as any;
  }
  if (dados.modal !== undefined) {
    sets.modal = dados.modal;
  }
  if (dados.observacoes !== undefined) {
    sets.observacoes = dados.observacoes ?? null;
  }
  if (Object.keys(sets).length === 0) return { afetados: 0 };

  const result = await db.update(cotacaoOpcoes).set(sets).where(eq(cotacaoOpcoes.id, opcaoId)).returning({ id: cotacaoOpcoes.id });
  return { afetados: result.length };
}

/** Remove uma opção de frete. */
export async function removerOpcaoFrete(opcaoId: number) {
  const db = await getDb();
  const result = await db.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.id, opcaoId)).returning({ id: cotacaoOpcoes.id });
  return { afetados: result.length };
}

/** Marca uma opção como selecionada e move a cotação para 'enviada'. */
export async function selecionarOpcaoFrete(cotacaoId: number, opcaoId: number) {
  const db = await getDb();
  await db.update(cotacaoOpcoes).set({ selecionada: 'nao' }).where(eq(cotacaoOpcoes.cotacaoId, cotacaoId));
  await db.update(cotacaoOpcoes).set({ selecionada: 'sim' }).where(eq(cotacaoOpcoes.id, opcaoId));

  const [opcao] = await db.select({ transportadoraId: cotacaoOpcoes.transportadoraId }).from(cotacaoOpcoes).where(eq(cotacaoOpcoes.id, opcaoId));
  const transportadoraId = opcao?.transportadoraId ?? null;

  await db
    .update(cotacoesFrete)
    .set({ status: 'enviada', transportadoraSelecionadaId: transportadoraId, updatedAt: new Date() })
    .where(eq(cotacoesFrete.id, cotacaoId));

  console.log(`✅ [OPCAO] Opção #${opcaoId} selecionada para cotação #${cotacaoId}`);
  return { ok: true, transportadoraId };
}
