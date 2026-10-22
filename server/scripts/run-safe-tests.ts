import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { assertSafeTestDatabase } from "./migration-safety";

const identity = assertSafeTestDatabase();
const cliPath = resolve("node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [cliPath, "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    APP_ENV: "test",
    NODE_ENV: "test",
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
});

console.info(`Test database: ${identity.host}:${identity.port}/${identity.database}`);

if (result.error) {
  console.error("Could not start the test runner.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
