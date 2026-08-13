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
 * - Insere primeiro as tabelas "pai" (cargos, cargos_funcoes) antes das que
 *   têm FK declarada no schema, pra não violar constraint.
 * - Não migra `__drizzle_migrations` (bookkeeping do MySQL, não é dado da app).
 * - Pula automaticamente qualquer pgTable do schema.ts que não exista na
 *   origem MySQL — cobre as tabelas do Better Auth (`user`, `session`,
 *   `account`, `verification`), que substituíram a antiga autenticação por
 *   OAuth/local_users e nunca existiram no banco de origem (ver comentário
 *   em drizzle/schema.ts sobre a Fase 3, Tarefa 3.2).
 * - Idempotente por tabela: se a tabela de destino já tem linhas, pula (não
 *   duplica em caso de reexecução parcial).
 * - Ao final, garante o usuário admin inicial ("Daniel Jara", login
 *   daniel_jara / SEED_ADMIN_PASSWORD) via Better Auth e cria conta pros
 *   demais funcionários ativos de `local_users` (senha temporária
 *   aleatória, impressa no console) — o banco de origem usava OAuth do
 *   Google e não guardava nenhuma senha (tabela `users`), e `local_users`
 *   era só um cadastro de contato sem credencial de verdade, então não há
 *   senha nenhuma pra migrar em nenhum dos dois casos; as contas são
 *   criadas do zero.
 */
import "dotenv/config";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { auth } from "../server/_core/auth";
import { getDb } from "../server/db/db";
import { user as userTable, APP_ROLES } from "../drizzle/schema";

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
const PARENT_TABLES = ["cargos", "cargos_funcoes"];

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

// `local_users` (contatos antigos, sem senha real) e `users` (OAuth do
// Google, também sem senha) não têm mais tabela correspondente no schema.ts
// — foram substituídas pelo Better Auth (`user`/`account`/`session`) na Fase
// 3. Não há nenhuma senha pra preservar dessas tabelas: o admin inicial é
// criado do zero em `ensureAdminUser()`, no final deste script.
const ROW_TRANSFORM: Record<string, (row: any) => any> = {};

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

// Nome/senha do usuário admin inicial, criado via Better Auth ao final da
// migração — mesmo caminho de server/scripts/seed-admin-user.ts (auth.api.
// createUser), pra gerar hash bcrypt e linhas em `user`/`account` consistentes
// com o resto do app. O login exibido pro usuário ("daniel_jara") é
// normalizado pela mesma slugifyName() da tela de login (client/src/pages/
// LocalLogin.tsx) e vira "daniel.jara" — é o valor que fica salvo em
// user.username.
function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug || "usuario";
}

const ADMIN_NAME = "Daniel Jara";
const ADMIN_USERNAME = slugifyName(ADMIN_NAME);
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "12345678";
const ADMIN_EMAIL = `${ADMIN_USERNAME}@local.internal`;

async function ensureAdminUser(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("⚠ Não foi possível conectar ao Postgres para criar o usuário admin (DATABASE_URL ausente/inválida).");
    return;
  }
  const [existing] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, ADMIN_USERNAME));
  if (existing) {
    console.log(`\n⏭  Usuário admin "${ADMIN_USERNAME}" já existe (id=${existing.id}) — nada a fazer.`);
    return;
  }
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(`⚠ SEED_ADMIN_PASSWORD não definida — usando senha padrão "12345678". Troque-a após o primeiro login.`);
  }
  const { user } = await auth.api.createUser({
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: "admin",
      data: { username: ADMIN_USERNAME, displayUsername: ADMIN_NAME },
    },
  });
  console.log(`\n✓ Usuário admin criado: login="${ADMIN_USERNAME}" senha="${ADMIN_PASSWORD}" id=${user.id}`);
}

// `local_users` era a tabela de contatos/funcionários do sistema antigo —
// nunca teve senha real (nem lá o login por ela funcionava, ver comentário
// no topo do arquivo), então não há credencial pra migrar. Pra cada
// funcionário ativo, cria a conta do zero no Better Auth com uma senha
// temporária aleatória — o admin repassa ao funcionário, que troca no
// primeiro acesso.
async function ensureEmployeeUsers(localUsersRows: any[]): Promise<void> {
  const activeRows = localUsersRows.filter((r) => Number(r.ativo) === 1 && r.nome);
  if (activeRows.length === 0) return;

  const db = await getDb();
  if (!db) {
    console.warn("⚠ Não foi possível conectar ao Postgres para criar contas de funcionários (local_users).");
    return;
  }

  console.log(`\n=== Contas de funcionários (local_users → Better Auth) ===`);
  for (const row of activeRows) {
    const username = slugifyName(row.nome);
    if (username === ADMIN_USERNAME) continue; // já é o admin, não duplica

    const [existing] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, username));
    if (existing) {
      console.log(`⏭  "${username}" já existe (id=${existing.id}) — pulando.`);
      continue;
    }

    const role = APP_ROLES.includes(row.setor) ? row.setor : "vendas";
    const email = row.email?.trim() ? row.email.trim().toLowerCase() : `${username}@local.internal`;
    // Sem senha de origem pra reaproveitar — gera uma temporária aleatória.
    const tempPassword = crypto.randomBytes(9).toString("base64url");

    try {
      const { user } = await auth.api.createUser({
        body: {
          email,
          password: tempPassword,
          name: row.nome,
          role,
          data: { username, displayUsername: row.nome },
        },
      });
      console.log(
        `✓ "${username}" criado (role=${role}) — senha temporária: ${tempPassword} (id=${user.id}). Repasse ao funcionário e peça troca no primeiro acesso.`
      );
    } catch (err: any) {
      console.error(`✗ Falha ao criar "${username}": ${err.message}`);
    }
  }
}

async function main() {
  const mysqlConn = await mysql.createConnection({
    uri: MYSQL_URL!.split("?")[0],
    ssl: { rejectUnauthorized: true },
  });
  const pgPool = new pg.Pool({ connectionString: PG_URL });

  // Só migra tabelas que existem de fato na origem — o schema.ts atual já
  // inclui as tabelas do Better Auth (user/session/account/verification),
  // que nunca existiram no MySQL de origem (ver cabeçalho do arquivo).
  const [sourceTableRows] = (await mysqlConn.query("SHOW TABLES")) as any;
  const sourceTableKey = sourceTableRows.length ? Object.keys(sourceTableRows[0])[0] : null;
  const sourceTableNames = new Set<string>(sourceTableRows.map((r: any) => r[sourceTableKey!]));

  const allTables = orderTables(collectPgTables());
  const tables = allTables.filter((t) => sourceTableNames.has(t.name));
  const skippedNoSource = allTables.filter((t) => !sourceTableNames.has(t.name));
  if (skippedNoSource.length > 0) {
    console.log(`⏭  Tabelas do schema novo sem correspondente na origem (não migradas): ${skippedNoSource.map((t) => t.name).join(", ")}`);
  }
  console.log(`${tables.length} tabelas a migrar.\n`);

  // `local_users` não é mais um pgTable do schema novo (virou Better Auth),
  // então não entra no loop de cópia genérica abaixo — capturamos os
  // registros aqui, antes de fechar a conexão, pra criar as contas de
  // funcionário no final (ver ensureEmployeeUsers).
  const localUsersRows: any[] = sourceTableNames.has("local_users")
    ? ((await mysqlConn.query("SELECT * FROM `local_users`")) as any)[0]
    : [];

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

  // Independente de divergências na cópia de dados: garante que o admin
  // inicial existe (a origem não tinha nenhuma senha migrável — ver
  // cabeçalho do arquivo) e cria conta pros demais funcionários ativos
  // achados em local_users.
  try {
    await ensureAdminUser();
  } catch (err: any) {
    console.error(`✗ Falha ao criar usuário admin: ${err.message}`);
  }
  try {
    await ensureEmployeeUsers(localUsersRows);
  } catch (err: any) {
    console.error(`✗ Falha ao criar contas de funcionários: ${err.message}`);
  }

  if (mismatches > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Falha na migração:", err);
  process.exit(1);
});
