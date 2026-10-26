import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const drizzleConfig = readFileSync(resolve("drizzle.config.ts"), "utf8");
const vercelJson = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
  buildCommand: string;
};
const workflowDirectory = resolve(".github/workflows");
const workflowNames = readdirSync(workflowDirectory)
  .filter(name => /\.ya?ml$/i.test(name))
  .sort();
const workflows = new Map(
  workflowNames.map(name => [name, readFileSync(resolve(workflowDirectory, name), "utf8")]),
);
const qualityWorkflow = workflows.get("quality.yml") ?? "";
const migrationWorkflow = workflows.get("migrate.yml") ?? "";
const workflowMigrationPattern = /\b(?:yarn\s+db:migrate|yarn\s+db:push|drizzle-kit\s+(?:migrate|push))\b/i;

describe("deployment and migration separation", () => {
  it("keeps database migrations out of Vercel builds and all startup scripts", () => {
    expect(vercelJson.buildCommand).toBe("yarn build:vercel");

    for (const scriptName of ["dev", "build", "build:client", "build:api", "build:vercel", "start", "postinstall"]) {
      expect(packageJson.scripts[scriptName], scriptName).toBeDefined();
      expect(packageJson.scripts[scriptName], scriptName).not.toMatch(
        /\b(?:drizzle-kit\s+(?:migrate|push)|db:migrate|db:push)\b/i,
      );
    }

    for (const startupFile of ["server/_core/index.ts", "server/_core/app.ts", "server/_core/serverless-handler.ts"]) {
      expect(readFileSync(resolve(startupFile), "utf8"), startupFile).not.toMatch(
        /\b(?:drizzle-kit\s+(?:migrate|push)|db:migrate|db:push)\b/i,
      );
    }
  });

  it("keeps the deploy build independent of database credentials and records its source SHA", () => {
    expect(packageJson.scripts["build:vercel"]).not.toContain("DATABASE_URL");
    expect(packageJson.scripts["build:vercel"]).toContain("write-build-metadata.ts");
    expect(packageJson.scripts.build).toContain("write-build-metadata.ts");
    expect(migrationWorkflow).toContain("GIT_COMMIT_SHA: ${{ github.sha }}");
  });

  it("routes database migration commands through guarded entry points", () => {
    expect(packageJson.scripts["db:migrate"]).toBe("tsx server/scripts/migrate.ts");
    expect(packageJson.scripts["db:push"]).toMatch(/drizzle-kit generate && drizzle-kit migrate/);
    expect(drizzleConfig).toContain('process.argv.slice(2).find');
    expect(drizzleConfig).toContain('["migrate", "push"]');
    expect(drizzleConfig).toContain("assertMigrationTarget();");
  });

  it("allows migration commands only in the controlled workflow and disposable CI workflow", () => {
    const callers = [...workflows.entries()]
      .filter(([, contents]) => workflowMigrationPattern.test(contents))
      .map(([name]) => name)
      .sort();
    expect(callers).toEqual(["migrate.yml", "quality.yml"]);
    expect(workflowNames).toEqual(["migrate.yml", "quality.yml"]);
    expect(migrationWorkflow).toContain("workflow_dispatch:");
    expect(migrationWorkflow).not.toMatch(/^\s{2}(?:push|pull_request):/m);
    expect(migrationWorkflow).toContain('test "$GITHUB_REF" = "refs/heads/main"');
    expect(migrationWorkflow).toContain('workflow_id: "quality.yml"');
  });

  it("fails closed unless the migration environment and exact database resource are provisioned", () => {
    expect(migrationWorkflow).toContain("name: ${{ inputs.target }}-${{ inputs.project }}");
    expect(migrationWorkflow).toContain("database_resource_id:");
    expect(migrationWorkflow).toContain("group: migration-database-${{ inputs.database_resource_id }}");
    expect(migrationWorkflow).toContain("queue: max");
    expect(migrationWorkflow).toContain("DB_MIGRATION_RESOURCE_ID: ${{ vars.DB_MIGRATION_RESOURCE_ID }}");
    expect(migrationWorkflow).toContain("DB_MIGRATION_ENVIRONMENT_READY");
    expect(migrationWorkflow).toContain("MIGRATION_ENVIRONMENT_READY:${MIGRATION_TARGET}:${VERCEL_PROJECT}:${REQUESTED_RESOURCE_ID}");
    expect(migrationWorkflow).toContain("DB_MIGRATION_PRODUCTION_APPROVAL");
    expect(migrationWorkflow).not.toMatch(/continue-on-error:\s*true/i);
  });

  it("requires the exact Quality jobs before database integration tests and migrations", () => {
    const buildJob = qualityWorkflow.split("  isolated-database-tests:")[0] ?? "";
    expect(buildJob).toContain("name: build-and-typecheck");
    expect(buildJob).toContain("run: yarn test:safety");
    expect(buildJob).toContain("run: yarn run check");
    expect(buildJob).toContain("run: yarn build:vercel");
    expect(buildJob).not.toMatch(/DATABASE_URL\s*:/);
    expect(qualityWorkflow).toContain("name: isolated-database-tests");
    expect(qualityWorkflow).toContain("needs: [build-and-typecheck]");
    expect(qualityWorkflow).toContain("image: postgres:16");
    expect(qualityWorkflow).toContain("radrasys_ci_test");
    expect(qualityWorkflow).toContain("127.0.0.1");
    expect(qualityWorkflow).toContain("run: yarn db:migrate");
    expect(qualityWorkflow).toContain("run: yarn test");
    expect(qualityWorkflow).not.toMatch(/continue-on-error:\s*true/i);
  });

  it("checks that the Drizzle journal is ordered and every entry has a migration file", () => {
    const journal = JSON.parse(readFileSync(resolve("drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ when: number; tag: string }>;
    };
    const migrationFiles = new Set(readdirSync(resolve("drizzle")));
    const tags = journal.entries.map(entry => entry.tag);

    expect(journal.entries.length).toBeGreaterThan(0);
    expect(new Set(tags).size).toBe(tags.length);
    for (let index = 0; index < journal.entries.length; index += 1) {
      const entry = journal.entries[index];
      expect(migrationFiles.has(`${entry.tag}.sql`), entry.tag).toBe(true);
      if (index > 0) {
        expect(entry.when, entry.tag).toBeGreaterThan(journal.entries[index - 1].when);
      }
    }
  });
});
