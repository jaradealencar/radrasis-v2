import { createServer } from "node:http";
import {
  assertSafeTestDatabase,
  databaseIdentity,
} from "../server/scripts/migration-safety";

function requireTestDatabase() {
  if (process.env.APP_ENV !== "test" || process.env.NODE_ENV !== "test") {
    throw new Error(
      "Escola E2E can only start with APP_ENV=test and NODE_ENV=test."
    );
  }

  const expected = assertSafeTestDatabase(process.env);
  const configured = databaseIdentity(process.env.DATABASE_URL);
  if (
    configured.host !== expected.host ||
    configured.port !== expected.port ||
    configured.database !== expected.database
  ) {
    throw new Error(
      "DATABASE_URL must match the validated local TEST_DATABASE_URL."
    );
  }

  if (process.env.RADRASYS_TEST_DB_DRIVER !== "pg") {
    throw new Error("Escola E2E requires the native PostgreSQL test driver.");
  }
}

requireTestDatabase();
process.env.RADRASYS_TEST_DB_DRIVER = "pg";

const appModulePath: string = "../server/_core/app";
const viteModulePath: string = "../server/_core/vite";
const { createApp } = await import(appModulePath);
const { setupVite } = await import(viteModulePath);
const port = Number(process.env.PORT ?? 4173);
const app = await createApp();
const server = createServer(app);

await setupVite(app, server);
server.listen(port, "127.0.0.1", () => {
  console.log(`Escola E2E server ready on http://127.0.0.1:${port}`);
});
