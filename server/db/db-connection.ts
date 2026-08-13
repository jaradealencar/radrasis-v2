/**
 * Conexão com banco de dados PostgreSQL (Neon) usando o driver serverless.
 * Usa DATABASE_URL para conexão (mesma variável do Drizzle).
 *
 * Por que o driver serverless e não o `pg`: em ambiente serverless (Vercel)
 * cada instância fria abriria conexões TCP novas no caminho crítico da
 * primeira requisição, e instâncias mortas deixariam conexões penduradas até
 * o timeout do servidor. O driver do Neon fala com o banco pelo proxy dele,
 * sem TCP persistente.
 *
 * A API é drop-in compatível com a do `pg` (`.query(text, values)` →
 * `{ rows, rowCount }`), então nada abaixo desta função precisou mudar.
 */

import { Pool, neonConfig, type QueryResult } from '@neondatabase/serverless';

// Faz cada `pool.query()` avulso ir por HTTP (fetch) em vez de abrir uma
// sessão WebSocket. É o modo mais barato e o que serve para 100% do uso
// atual do projeto — não há transação multi-statement nem `pool.connect()`
// em lugar nenhum (validado no passo 2.0 da fase).
//
// ⚠️ Se algum dia o projeto precisar de `db.transaction(...)`, isto aqui
// deixa de bastar: transação exige a sessão WebSocket. Nesse caso, pare e
// trate como decisão de arquitetura.
neonConfig.poolQueryViaFetch = true;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    console.log('✅ [DB-CONNECTION] Pool (Neon serverless) criado com sucesso');
    return pool;
  } catch (error) {
    console.error('❌ [DB-CONNECTION] Erro ao criar pool:', error);
    throw error;
  }
}

/**
 * Converte placeholders posicionais estilo MySQL ("?") para o estilo
 * numerado do Postgres ("$1, $2, ..."), pra minimizar mudança nos call
 * sites que só fazem parâmetros simples (sem "?" literal dentro de strings).
 */
function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Executar query com prepared statement
 */
export async function executeQuery(
  sql: string,
  values: any[] = []
): Promise<QueryResult> {
  const pool = getPool();

  try {
    console.log('📝 [QUERY] SQL:', sql);
    console.log('📝 [QUERY] Values:', values);

    const result = await pool.query(toPgPlaceholders(sql), values);

    console.log('✅ [QUERY] Sucesso');
    return result;
  } catch (error) {
    console.error('❌ [QUERY] Erro:', error);
    throw error;
  }
}

/**
 * Executar query de SELECT
 */
export async function selectQuery(
  sql: string,
  values: any[] = []
): Promise<any[]> {
  const result = await executeQuery(sql, values);
  return result.rows;
}

/**
 * Executar query de INSERT/UPDATE/DELETE.
 *
 * O `pg` não tem equivalente nativo a `insertId`/`affectedRows` do mysql2:
 * `affectedRows` vira `rowCount`; `insertId` só existe se a query tiver
 * `RETURNING id` (senão fica undefined — INSERTs cru que ainda não foram
 * portados pra Postgres precisam ganhar essa cláusula).
 */
export async function mutationQuery(
  sql: string,
  values: any[] = []
): Promise<{ rows: any[]; rowCount: number; insertId: any; affectedRows: number }> {
  const result = await executeQuery(sql, values);
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
    insertId: result.rows[0]?.id,
    affectedRows: result.rowCount ?? 0,
  };
}

export default { getPool, executeQuery, selectQuery, mutationQuery };
