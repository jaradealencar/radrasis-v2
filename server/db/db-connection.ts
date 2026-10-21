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

import { Pool as NeonPool, neonConfig, type QueryResult } from '@neondatabase/serverless';
import { Pool as PostgresPool } from "pg";

// Consultas avulsas via `pool.query()` usam HTTP (fetch). O Drizzle executa
// `db.transaction(...)` fazendo `pool.connect()` e usa o PoolClient por
// WebSocket durante BEGIN/COMMIT/ROLLBACK. Endpoints transacionais exigem
// runtime Node com suporte a WebSocket; use exclusivamente o `tx` recebido
// dentro do callback para que todas as queries participem da mesma transação.

// O Neon usa HTTP nas consultas avulsas de produção. O banco efêmero do CI é
// PostgreSQL comum (não fala o protocolo WebSocket do proxy Neon), por isso o
// modo de auditoria usa o driver pg, já presente nas dependências do servidor.
const auditorTestDatabase = process.env.AUDITOR_TEST_DATABASE === "1";
neonConfig.poolQueryViaFetch = true;

let pool: NeonPool | null = null;

function validarBancoEfemero(connectionString: string): void {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("AUDITOR_TEST_DATABASE exige uma DATABASE_URL de PostgreSQL local isolado.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const hostLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const nomeBanco = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const nomeDeTeste = /_(?:test|tests|ci)$/i.test(nomeBanco);
  if (!hostLocal || !nomeDeTeste) {
    throw new Error("AUDITOR_TEST_DATABASE só pode usar host local e banco com sufixo _test, _tests ou _ci.");
  }
}

export function getPool(): NeonPool {
  if (pool) {
    return pool;
  }

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL é obrigatória.");
    if (auditorTestDatabase) {
      validarBancoEfemero(connectionString);
      pool = new PostgresPool({ connectionString, max: 5, idleTimeoutMillis: 1_000 }) as unknown as NeonPool;
      console.log("✅ [DB-CONNECTION] Pool pg criado para PostgreSQL efêmero de teste");
      return pool;
    }
    pool = new NeonPool({ connectionString });

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
