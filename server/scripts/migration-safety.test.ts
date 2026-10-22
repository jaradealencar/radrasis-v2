import { describe, expect, it } from "vitest";
import {
  assertMigrationTarget,
  assertSafeTestDatabase,
  type MigrationTarget,
} from "./migration-safety";

const localIdentity = {
  host: "127.0.0.1",
  port: "5432",
  database: "radrasys_ci_test",
};

function migrationEnvironment(target: MigrationTarget, overrides: Record<string, string> = {}) {
  const environment = {
    DATABASE_URL: "postgresql://db_user:db_password@127.0.0.1:5432/radrasys_ci_test",
    DB_MIGRATION_TARGET: target,
    DB_MIGRATION_EXPECTED_HOST: localIdentity.host,
    DB_MIGRATION_EXPECTED_PORT: localIdentity.port,
    DB_MIGRATION_EXPECTED_DATABASE: localIdentity.database,
    DB_MIGRATION_CONFIRMATION: `MIGRATE:${target}:${localIdentity.host}:${localIdentity.port}/${localIdentity.database}`,
    APP_ENV: "ci",
    NODE_ENV: "test",
    CI: "true",
    ...overrides,
  };

  if (target === "production") {
    Object.assign(environment, {
      DATABASE_URL: "postgresql://db_user:db_password@prod-db.example:5432/radrasys",
      DB_MIGRATION_EXPECTED_HOST: "prod-db.example",
      DB_MIGRATION_EXPECTED_DATABASE: "radrasys",
      DB_MIGRATION_CONFIRMATION: "MIGRATE:production:prod-db.example:5432/radrasys",
      DB_MIGRATION_PRODUCTION_APPROVAL:
        "AUTHORIZE_PRODUCTION_MIGRATION:prod-db.example:5432/radrasys",
      APP_ENV: "production",
      NODE_ENV: "production",
      CI: "true",
    });
    Object.assign(environment, overrides);
  }

  return environment;
}

describe("migration target safety", () => {
  it("requires an explicit target and target identity", () => {
    expect(() => assertMigrationTarget({})).toThrow("DB_MIGRATION_TARGET");
  });

  it("rejects a migration when the expected database identity is incomplete", () => {
    expect(() =>
      assertMigrationTarget(
        migrationEnvironment("ci", { DB_MIGRATION_EXPECTED_HOST: "" }),
      ),
    ).toThrow("identity is incomplete");
  });

  it("rejects unknown migration targets", () => {
    expect(() =>
      assertMigrationTarget({ DB_MIGRATION_TARGET: "unknown" }),
    ).toThrow("DB_MIGRATION_TARGET must be local, ci, staging, or production");
  });

  it("allows a CI migration only on a named local CI database", () => {
    const result = assertMigrationTarget(migrationEnvironment("ci"));
    expect(result).toEqual({
      target: "ci",
      identity: { host: "127.0.0.1", port: 5432, database: "radrasys_ci_test" },
    });
  });

  it("rejects a URL that does not match the declared host, port, and database", () => {
    expect(() =>
      assertMigrationTarget(
        migrationEnvironment("ci", {
          DATABASE_URL: "postgresql://db_user:db_password@127.0.0.1:5433/radrasys_ci_test",
        }),
      ),
    ).toThrow("does not match");
  });

  it("requires target-specific confirmation", () => {
    expect(() =>
      assertMigrationTarget(
        migrationEnvironment("ci", { DB_MIGRATION_CONFIRMATION: "yes" }),
      ),
    ).toThrow("DB_MIGRATION_CONFIRMATION");
  });

  it("rejects CI migrations to remote databases", () => {
    expect(() =>
      assertMigrationTarget(
        migrationEnvironment("ci", {
          DATABASE_URL: "postgresql://db_user:db_password@prod-db.example:5432/radrasys_ci_test",
          DB_MIGRATION_EXPECTED_HOST: "prod-db.example",
        }),
      ),
    ).toThrow("local database");
  });

  it("requires production environment consistency and a second approval phrase", () => {
    const production = migrationEnvironment("production");
    expect(assertMigrationTarget(production).target).toBe("production");
    expect(() =>
      assertMigrationTarget({ ...production, DB_MIGRATION_PRODUCTION_APPROVAL: "" }),
    ).toThrow("production approval phrase");
    expect(() => assertMigrationTarget({ ...production, APP_ENV: "staging" })).toThrow("APP_ENV");
  });

  it("rejects an incorrect production approval phrase", () => {
    const production = migrationEnvironment("production");
    expect(() =>
      assertMigrationTarget({
        ...production,
        DB_MIGRATION_PRODUCTION_APPROVAL:
          "AUTHORIZE_PRODUCTION_MIGRATION:other-db.example:5432/radrasys",
      }),
    ).toThrow("production approval phrase");
  });

  it("does not include database credentials in validation errors", () => {
    let message = "";
    try {
      assertMigrationTarget(
        migrationEnvironment("ci", {
          DATABASE_URL: "postgresql://sensitive_user:sensitive_password@remote.example:5432/radrasys_ci_test",
        }),
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("sensitive_user");
    expect(message).not.toContain("sensitive_password");
  });
});

describe("test database safety", () => {
  it("accepts only a local database with an explicit test or CI name", () => {
    expect(
      assertSafeTestDatabase({
        TEST_DATABASE_URL: "postgresql://tester:secret@localhost:5432/radrasys_test",
        NODE_ENV: "test",
      }),
    ).toEqual({ host: "localhost", port: 5432, database: "radrasys_test" });
  });

  it("rejects remote test databases and production application environments", () => {
    expect(() =>
      assertSafeTestDatabase({
        TEST_DATABASE_URL: "postgresql://tester:secret@db.example:5432/radrasys_test",
      }),
    ).toThrow("local loopback");
    expect(() =>
      assertSafeTestDatabase({
        TEST_DATABASE_URL: "postgresql://tester:secret@localhost:5432/radrasys_test",
        APP_ENV: "production",
      }),
    ).toThrow("production application");
  });

  it("rejects a test URL that is also configured as the production database", () => {
    const url = "postgresql://tester:secret@localhost:5432/radrasys_test";
    expect(() =>
      assertSafeTestDatabase({ TEST_DATABASE_URL: url, PRODUCTION_DATABASE_URL: url }),
    ).toThrow("protected environment database");
  });
});
