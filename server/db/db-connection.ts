/**
 * Conexão PostgreSQL da aplicação. O runtime normal usa o driver serverless
 * do Neon; a suíte protegida de testes pode selecionar `pg` para PostgreSQL
 * local descartável.
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

import { Pool as NeonPool, neonConfig, type QueryResult } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { Pool as PostgresPool, type Pool as NodePostgresPool } from 'pg';
import { assertSafeTestDatabase, databaseIdentity } from '../scripts/migration-safety';

// No runtime normal, consultas avulsas via `pool.query()` usam HTTP (fetch).
// O wrapper `yarn test` seleciona `pg` somente depois de validar a URL
// descartável local. No runtime Neon, transações Drizzle usam WebSocket;
// dentro do callback, use exclusivamente o `tx` recebido.

neonConfig.poolQueryViaFetch = true;

type DatabasePool = NeonPool | PostgresPool;

let pool: DatabasePool | null = null;

const SAFE_ERROR_CATEGORIES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'AggregateError',
  'AbortError',
  'TimeoutError',
  'DatabaseError',
  'NeonDbError',
  'PostgresError',
  'DrizzleError',
]);

export function shouldUseNativePostgresTestDriver(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.RADRASYS_TEST_DB_DRIVER !== 'pg') {
    return false;
  }

  if (environment.APP_ENV !== 'test' || environment.NODE_ENV !== 'test') {
    throw new Error('The native PostgreSQL test driver requires APP_ENV=test and NODE_ENV=test.');
  }

  const testIdentity = assertSafeTestDatabase(environment);
  const databaseUrlIdentity = databaseIdentity(environment.DATABASE_URL);
  if (
    databaseUrlIdentity.host !== testIdentity.host ||
    databaseUrlIdentity.port !== testIdentity.port ||
    databaseUrlIdentity.database !== testIdentity.database
  ) {
    throw new Error('DATABASE_URL must match the validated TEST_DATABASE_URL for database tests.');
  }

  return true;
}

export function getPool(): DatabasePool {
  if (pool) {
    return pool;
  }

  try {
    const poolConfig = { connectionString: process.env.DATABASE_URL };
    pool = shouldUseNativePostgresTestDriver()
      ? new PostgresPool(poolConfig)
      : new NeonPool(poolConfig);

    console.log(
      `[DB-CONNECTION] Pool (${pool instanceof PostgresPool ? 'PostgreSQL de teste' : 'Neon serverless'}) criado`,
    );
    return pool;
  } catch (error) {
    console.error('[DB-CONNECTION] Falha ao criar pool:', safeErrorType(error));
    throw error;
  }
}

export function safeErrorType(error: unknown): string {
  return error instanceof Error && SAFE_ERROR_CATEGORIES.has(error.name) ? error.name : 'UnknownError';
}

export function createAppDatabase(
  databasePool: DatabasePool = getPool(),
): ReturnType<typeof drizzleNeon> {
  if (databasePool instanceof PostgresPool) {
    return drizzlePostgres(databasePool as NodePostgresPool) as unknown as ReturnType<typeof drizzleNeon>;
  }

  return drizzleNeon(databasePool);
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
    const postgresSql = toPgPlaceholders(sql);
    if (pool instanceof PostgresPool) {
      return (await pool.query(postgresSql, values)) as QueryResult;
    }

    return await pool.query(postgresSql, values);
  } catch (error) {
    console.error('[QUERY] Falha na consulta:', safeErrorType(error));
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
