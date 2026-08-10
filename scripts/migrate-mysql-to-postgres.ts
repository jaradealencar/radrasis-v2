/**
 * ETL único: copia todos os dados do MySQL de origem (TiDB Cloud) para o
 * Postgres de destino, usando o schema.ts (já convertido para pg-core) como
 * fonte de verdade sobre nomes/tipos de coluna de cada tabela.
 *
 * Uso:
 *   MYSQL_SOURCE_URL="mysql://..." npx tsx scripts/migrate-mysql-to-postgres.ts
 *
 * Requer DATABASE_URL (Postgres, destino) já configurado no .env.
 *
 * - Preserva os ids originais (INSERT explícito, sem deixar o serial gerar
 *   novos) e realinha as sequences do Postgres no final.
 * - Insere primeiro as tabelas "pai" (cargos, cargos_funcoes, motivos_atraso,
 *   producao_ordens) antes das que têm FK declarada no schema, pra não violar
 *   constraint.
 * - Não migra `__drizzle_migrations` (bookkeeping do MySQL, não é dado da app).
 * - Idempotente por tabela: se a tabela de destino já tem linhas, pula (não
 *   duplica em caso de reexecução parcial).
 */
import "dotenv/config";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import pg from "pg";
import bcrypt from "bcryptjs";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../drizzle/schema";

const MYSQL_URL = process.env.MYSQL_SOURCE_URL;
const PG_URL = process.env.DATABASE_URL;

if (!MYSQL_URL) {
  console.error("Defina MYSQL_SOURCE_URL com a connection string do MySQL de origem.");
  process.exit(1);
}
if (!PG_URL) {
  console.error("DATABASE_URL (Postgres de destino) não está configurada.");
  process.exit(1);
}

// Ordem: tabelas referenciadas por FK primeiro
const PARENT_TABLES = ["cargos", "cargos_funcoes", "motivos_atraso", "producao_ordens"];

function orderTables(tableExports: Array<{ name: string; table: any }>) {
  const parents = tableExports.filter((t) => PARENT_TABLES.includes(t.name));
  const children = tableExports.filter((t) => !PARENT_TABLES.includes(t.name));
  return [...parents, ...children];
}

function collectPgTables(): Array<{ name: string; table: any }> {
  const out: Array<{ name: string; table: any }> = [];
  // getTableConfig throws for non-table exports (enums, const arrays, types), so probe defensively
  for (const value of Object.values(schema)) {
    try {
      const config = getTableConfig(value as any);
      if (config && config.name) {
        out.push({ name: config.name, table: value });
      }
    } catch {
      // not a pgTable export (enum, const array, type, etc) — skip
    }
  }
  return out;
}

// Tabelas cujo status no MySQL de origem usa um vocabulário antigo que não bate
// mais com o pgEnum atual (código novo em drizzle já escreve no vocabulário novo,
// código legado em SQL cru ainda escreve no antigo — ver server/db-helpers.ts).
const STATUS_REMAP: Record<string, Record<string, Record<string, string>>> = {
  cotacoes_frete: {
    status: {
      aberta: "fila",
      cotando: "em_cotacao",
      selecao: "em_cotacao",
      cotada: "pronto",
      enviada: "concluido",
      cancelada: "cancelado",
    },
  },
};

const APP_ROLES = ["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"];

// local_users no MySQL real é uma tabela de contatos antiga (nome/setor/cargo/ativo)
// que nunca teve passwordHash nem role de verdade — server/db.ts já documenta isso
// ("A tabela real tem colunas diferentes do schema Drizzle"). O login por bcrypt
// nunca funcionou pra essas linhas legadas. Migramos o registro preservando nome/
// e-mail/status, mas com uma senha placeholder impossível de adivinhar — o usuário
// precisa redefinir a senha (ou a conta é recriada do zero na Fase 3, com Better Auth).
const UNUSABLE_PASSWORD_HASH = bcrypt.hashSync(`migrated-${crypto.randomUUID()}-needs-reset`, 10);

function transformLocalUsersRow(row: any): any {
  const role = APP_ROLES.includes(row.setor) ? row.setor : "vendas";
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    passwordHash: UNUSABLE_PASSWORD_HASH,
    role,
    active: Number(row.ativo) === 1 ? "sim" : "nao",
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  };
}

const ROW_TRANSFORM: Record<string, (row: any) => any> = {
  local_users: transformLocalUsersRow,
};

// Mapeia o columnType (+ enumValues, quando aplicável) do Drizzle pra uma função
// de coerção do valor vindo do mysql2.
function coerceValue(value: unknown, column: { columnType: string; enumValues?: readonly string[] }, tableName: string, columnName: string): unknown {
  if (value === null || value === undefined) return null;
  const { columnType, enumValues } = column;
  if (columnType === "PgBoolean") {
    if (typeof value === "boolean") return value;
    return Number(value) === 1;
  }
  if (columnType === "PgDate") {
    // mysql2 retorna Date; drizzle-orm/pg-core espera string "YYYY-MM-DD" para date mode padrão
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value;
  }
  if (columnType === "PgEnumColumn" && enumValues) {
    const remap = STATUS_REMAP[tableName]?.[columnName];
    if (remap && typeof value === "string" && remap[value]) return remap[value];
    // Colunas sim/nao que no MySQL real ficaram como tinyint(0/1) em vez do
    // enum('sim','nao') que o schema (e o resto do app) espera.
    if (enumValues.includes("sim") && enumValues.includes("nao") && !enumValues.includes(String(value))) {
      if (typeof value === "boolean") return value ? "sim" : "nao";
      if (typeof value === "number") return value === 1 ? "sim" : "nao";
    }
    return value;
  }
  return value;
}

async function main() {
  const mysqlConn = await mysql.createConnection({
    uri: MYSQL_URL!.split("?")[0],
    ssl: { rejectUnauthorized: true },
  });
  const pgPool = new pg.Pool({ connectionString: PG_URL });

  const tables = orderTables(collectPgTables());
  console.log(`${tables.length} tabelas a migrar.\n`);

  const report: Array<{ table: string; source: number; inserted: number; skipped: boolean }> = [];

  for (const { name: dbTableName, table } of tables) {
    const config = getTableConfig(table);
    const columns = config.columns; // [{ name, columnType, ... }]

    const existing = await pgPool.query(`SELECT count(*)::int AS c FROM "${dbTableName}"`);
    if ((existing.rows[0] as any).c > 0) {
      const [[{ cnt: sourceCount }]] = (await mysqlConn.query(
        `SELECT COUNT(*) AS cnt FROM \`${dbTableName}\``
      )) as any;
      console.log(`⏭  ${dbTableName}: já tem dados no destino, pulando (origem tinha ${sourceCount}).`);
      report.push({ table: dbTableName, source: Number(sourceCount), inserted: 0, skipped: true });
      continue;
    }

    const [rows] = (await mysqlConn.query(`SELECT * FROM \`${dbTableName}\``)) as any;
    if (rows.length === 0) {
      report.push({ table: dbTableName, source: 0, inserted: 0, skipped: false });
      continue;
    }

    const colNames = columns.map((c) => c.name);
    const colByName = new Map(columns.map((c) => [c.name, c as any]));
    const transform = ROW_TRANSFORM[dbTableName];

    let inserted = 0;
    for (const rawRow of rows) {
      const row = transform ? transform(rawRow) : rawRow;
      const values = colNames.map((cn) =>
        coerceValue(row[cn], colByName.get(cn)!, dbTableName, cn)
      );
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ");
      const quotedCols = colNames.map((c) => `"${c}"`).join(", ");
      try {
        await pgPool.query(
          `INSERT INTO "${dbTableName}" (${quotedCols}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (err: any) {
        console.error(`  ✗ erro inserindo em ${dbTableName} (id=${row.id}): ${err.message}`);
      }
    }

    // Realinha a sequence do serial pra não colidir com os ids importados
    const hasIdColumn = colNames.includes("id");
    if (hasIdColumn) {
      await pgPool.query(
        `SELECT setval(pg_get_serial_sequence('"${dbTableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${dbTableName}"), 1))`
      );
    }

    console.log(`✓ ${dbTableName}: ${inserted}/${rows.length} linhas`);
    report.push({ table: dbTableName, source: rows.length, inserted, skipped: false });
  }

  console.log("\n=== Verificação final (origem vs. destino) ===");
  let totalSource = 0;
  let totalInserted = 0;
  let mismatches = 0;
  for (const r of report) {
    totalSource += r.source;
    totalInserted += r.inserted;
    const ok = r.skipped || r.inserted === r.source;
    if (!ok) mismatches++;
    if (r.source > 0) {
      console.log(`${ok ? "✓" : "✗"} ${r.table.padEnd(35)} origem=${r.source}  destino=${r.skipped ? "(já existia)" : r.inserted}`);
    }
  }
  console.log(`\nTotal: ${totalInserted} linhas inseridas de ${totalSource} na origem. ${mismatches} tabela(s) com divergência.`);

  await mysqlConn.end();
  await pgPool.end();

  if (mismatches > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Falha na migração:", err);
  process.exit(1);
});
