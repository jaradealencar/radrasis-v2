import { defineConfig } from "drizzle-kit";
import { assertMigrationTarget } from "./server/scripts/migration-safety";

// drizzle-kit migrate/push bypasses server/scripts/migrate.ts, so guard those
// CLI entry points here as well. `generate` reads the schema and makes files
// only; it does not connect to or change a database.
const drizzleAction = process.argv.slice(2).find(argument =>
  ["migrate", "push"].includes(argument),
);
if (drizzleAction) {
  assertMigrationTarget();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
