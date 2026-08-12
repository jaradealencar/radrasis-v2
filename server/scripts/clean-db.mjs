import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`);

if (rows.length === 0) {
  console.log("Nenhuma tabela encontrada no schema public.");
  await client.end();
  process.exit(0);
}

const tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
console.log(`Truncando ${rows.length} tabelas...`);

await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

console.log("OK. Tabelas truncadas:");
for (const r of rows) console.log(" -", r.tablename);

await client.end();
