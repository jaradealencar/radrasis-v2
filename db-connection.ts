/**
 * Conexão com banco de dados MySQL usando mysql2/promise
 * Usa DATABASE_URL para conexão (mesma variável do Drizzle)
 */

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (pool) {
    return pool;
  }

  try {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('✅ [DB-CONNECTION] Pool de conexões criado com sucesso');
    return pool;
  } catch (error) {
    console.error('❌ [DB-CONNECTION] Erro ao criar pool:', error);
    throw error;
  }
}

/**
 * Executar query com prepared statement
 */
export async function executeQuery(
  sql: string,
  values: any[] = []
): Promise<[mysql.QueryResult, mysql.FieldPacket[]]> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  
  try {
    console.log('📝 [QUERY] SQL:', sql);
    console.log('📝 [QUERY] Values:', values);
    
    const result = await connection.execute(sql, values);
    
    console.log('✅ [QUERY] Sucesso');
    return result;
  } catch (error) {
    console.error('❌ [QUERY] Erro:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Executar query de SELECT
 */
export async function selectQuery(
  sql: string,
  values: any[] = []
): Promise<any[]> {
  const [rows] = await executeQuery(sql, values);
  return rows as any[];
}

/**
 * Executar query de INSERT/UPDATE/DELETE
 */
export async function mutationQuery(
  sql: string,
  values: any[] = []
): Promise<mysql.QueryResult> {
  const [result] = await executeQuery(sql, values);
  return result;
}

export default { getPool, executeQuery, selectQuery, mutationQuery };
