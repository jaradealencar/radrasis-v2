/**
 * Conexão com banco de dados PostgreSQL usando pg (node-postgres)
 * Usa DATABASE_URL para conexão (mesma variável do Drizzle)
 */

import pg from 'pg';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });

    console.log('✅ [DB-CONNECTION] Pool de conexões criado com sucesso');
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
): Promise<pg.QueryResult> {
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
