/**
 * Helpers de banco de dados para cotações de frete — Drizzle query builder.
 */

import { desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "./db-connection";
import { cotacoesFrete, InsertCotacaoFrete } from "../../drizzle/schema";
import { ENV } from "../_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (_db) return _db;
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL not set");
  _db = drizzle(getPool());
  return _db;
}

export interface CotacaoFreteData {
  solicitanteNome?: string;
  destinatarioNome: string;
  destinatarioCnpj?: string;
  cepDestino?: string;
  municipio: string;
  estado: string;
  dimensoesLargura?: number;
  dimensoesAltura?: number;
  dimensoesComprimento?: number;
  pesoKg?: number;
  observacoes?: string;
  osNumero?: string;
  quantidadeVolumes?: number;
  volumesJson?: string;
  empacotadores?: string;
  /** Dados próprios da OS consultada (cache/API MubiSys) */
  osAprovacao?: string;
  osEntrega?: string;
  osVendedor?: string;
}

export interface CotacaoFreteResult {
  success: boolean;
  id?: number;
  message?: string;
  error?: string;
}

/**
 * Criar nova cotação de frete.
 * Insere apenas os campos com valores, deixando o banco aplicar defaults
 * (ex: status = 'aberta').
 */
export async function criarCotacaoFrete(
  dados: CotacaoFreteData
): Promise<CotacaoFreteResult> {
  try {
    console.log('📝 [CRIAR-COTACAO] Iniciando criação de cotação...');
    console.log('📝 [CRIAR-COTACAO] Dados:', dados);

    const db = await getDb();
    const insertData: InsertCotacaoFrete = {
      destinatarioNome: dados.destinatarioNome,
      municipio: dados.municipio,
      estado: dados.estado,
      osNumero: dados.osNumero ?? null,
      solicitanteNome: dados.solicitanteNome ?? null,
      destinatarioCnpj: dados.destinatarioCnpj ?? null,
      cepDestino: dados.cepDestino ?? null,
      dimensoesLargura: dados.dimensoesLargura != null ? String(dados.dimensoesLargura) : null,
      dimensoesAltura: dados.dimensoesAltura != null ? String(dados.dimensoesAltura) : null,
      dimensoesComprimento: dados.dimensoesComprimento != null ? String(dados.dimensoesComprimento) : null,
      pesoKg: dados.pesoKg != null ? String(dados.pesoKg) : null,
      quantidadeVolumes: dados.quantidadeVolumes ?? 1,
      volumesJson: dados.volumesJson ?? null,
      observacoes: dados.observacoes ?? null,
      empacotadores: dados.empacotadores ?? null,
      osAprovacao: dados.osAprovacao ?? null,
      osEntrega: dados.osEntrega ?? null,
      osVendedor: dados.osVendedor ?? null,
    };

    console.log('📝 [CRIAR-COTACAO] Insert:', insertData);

    const [result] = await db.insert(cotacoesFrete).values(insertData).returning({ id: cotacoesFrete.id });
    const insertId = result.id;

    console.log('✅ [CRIAR-COTACAO] Sucesso! ID:', insertId);

    return {
      success: true,
      id: insertId,
      message: `Cotação criada com sucesso! ID: ${insertId}`
    };
  } catch (error: any) {
    console.error('❌ [CRIAR-COTACAO] Erro:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar cotação'
    };
  }
}

/**
 * Buscar cotação por ID
 */
export async function buscarCotacaoPorId(id: number) {
  try {
    const db = await getDb();
    const [result] = await db.select().from(cotacoesFrete).where(eq(cotacoesFrete.id, id));
    return result ?? null;
  } catch (error: any) {
    console.error('❌ [BUSCAR-COTACAO] Erro:', error);
    return null;
  }
}

/**
 * Listar cotações com paginação (últimos 30 dias)
 */
export async function listarCotacoes(page: number = 1, pageSize: number = 15) {
  try {
    const db = await getDb();
    const offset = (page - 1) * pageSize;
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        id: cotacoesFrete.id,
        solicitanteNome: cotacoesFrete.solicitanteNome,
        destinatarioNome: cotacoesFrete.destinatarioNome,
        municipio: cotacoesFrete.municipio,
        estado: cotacoesFrete.estado,
        pesoKg: cotacoesFrete.pesoKg,
        status: cotacoesFrete.status,
        createdAt: cotacoesFrete.createdAt,
      })
      .from(cotacoesFrete)
      .where(gte(cotacoesFrete.createdAt, trintaDiasAtras))
      .orderBy(desc(cotacoesFrete.createdAt))
      .limit(pageSize)
      .offset(offset);

    return result;
  } catch (error: any) {
    console.error('❌ [LISTAR-COTACOES] Erro:', error);
    return [];
  }
}

/**
 * Contar total de cotações (últimos 30 dias)
 */
export async function contarCotacoes() {
  try {
    const db = await getDb();
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(cotacoesFrete)
      .where(gte(cotacoesFrete.createdAt, trintaDiasAtras));
    return Number(result?.total ?? 0);
  } catch (error: any) {
    console.error('❌ [CONTAR-COTACOES] Erro:', error);
    return 0;
  }
}

/**
 * Atualizar status de cotação
 */
export async function atualizarStatusCotacao(id: number, status: InsertCotacaoFrete["status"]) {
  try {
    const db = await getDb();
    const result = await db
      .update(cotacoesFrete)
      .set({ status, updatedAt: new Date() })
      .where(eq(cotacoesFrete.id, id))
      .returning({ id: cotacoesFrete.id });
    return result.length > 0;
  } catch (error: any) {
    console.error('❌ [ATUALIZAR-STATUS] Erro:', error);
    return false;
  }
}

export default {
  criarCotacaoFrete,
  buscarCotacaoPorId,
  listarCotacoes,
  contarCotacoes,
  atualizarStatusCotacao
};
