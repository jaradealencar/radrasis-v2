import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Usa o driver `pg` direto (não o @neondatabase/serverless da app) porque
// migrations rodam em transação e o pool da app usa poolQueryViaFetch, que
// não suporta sessão/transação — ver server/db/db-connection.ts.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL é obrigatória para aplicar migrations.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}

main()
  .then(() => {
    console.log("Migrations aplicadas com sucesso.");
    process.exit(0);
  })
  .catch(error => {
    console.error("Falha ao aplicar migrations:", error);
    process.exit(1);
  });
