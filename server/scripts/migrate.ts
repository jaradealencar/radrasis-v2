import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertMigrationTarget } from "./migration-safety";

// Usa o driver `pg` direto (não o @neondatabase/serverless da app) porque
// migrations rodam em transação e o pool da app usa poolQueryViaFetch, que
// não suporta sessão/transação — ver server/db/db-connection.ts.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  const { target, identity } = assertMigrationTarget();

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const sourceCommit =
      process.env.GITHUB_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA;
    console.info(
      `Migration target: ${target} ${identity.host}:${identity.port}/${identity.database}`,
    );
    console.info(
      `Source commit: ${sourceCommit && /^[a-f0-9]{7,40}$/i.test(sourceCommit) ? sourceCommit : "not supplied"}`,
    );
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}

main()
  .then(() => console.info("Migrations applied successfully."))
  .catch(error => {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`Migration failed (${errorType}); database details were suppressed.`);
    process.exitCode = 1;
  });
