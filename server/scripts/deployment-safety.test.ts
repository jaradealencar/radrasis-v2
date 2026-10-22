import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const vercelJson = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
  buildCommand: string;
};

describe("deployment and migration separation", () => {
  it("keeps database migrations out of the Vercel build command", () => {
    expect(vercelJson.buildCommand).toBe("yarn build:vercel");
    expect(vercelJson.buildCommand).not.toMatch(/migrat|db:push/i);
    expect(packageJson.scripts["build:vercel"]).not.toMatch(/migrat|db:push/i);
  });

  it("keeps every build and startup script free of migration commands", () => {
    for (const scriptName of ["dev", "build", "build:client", "build:api", "build:vercel", "start"]) {
      expect(packageJson.scripts[scriptName], scriptName).not.toMatch(
        /\b(?:drizzle-kit\s+(?:migrate|push)|db:migrate|db:push)\b/i,
      );
    }
  });

  it("keeps the deploy build independent of database credentials", () => {
    expect(packageJson.scripts["build:vercel"]).not.toContain("DATABASE_URL");
  });

  it("routes database migration commands through guarded entry points", () => {
    expect(packageJson.scripts["db:migrate"]).toBe("tsx server/scripts/migrate.ts");
    expect(packageJson.scripts["db:push"]).toMatch(/drizzle-kit generate && drizzle-kit migrate/);
  });
});
