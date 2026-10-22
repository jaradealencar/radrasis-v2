import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { mockedQuery } = vi.hoisted(() => ({ mockedQuery: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    query = mockedQuery;
  },
  neonConfig: {},
}));

import {
  executeQuery,
  safeErrorType,
  shouldUseNativePostgresTestDriver,
} from "./db-connection";

describe("database query logging", () => {
  beforeEach(() => {
    vi.stubEnv("RADRASYS_TEST_DB_DRIVER", "");
    mockedQuery.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not write SQL text or bound values to logs", async () => {
    const secretValue = "private-customer-email@example.test";
    const sql = "insert into customers (email) values (?)";
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await executeQuery(sql, [secretValue]);

    const loggedText = vi.mocked(console.log).mock.calls.flat().join(" ");
    const loggedErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(loggedText).not.toContain(sql);
    expect(loggedText).not.toContain(secretValue);
    expect(loggedErrors).not.toContain(sql);
    expect(loggedErrors).not.toContain(secretValue);
  });

  it("logs only a safe error category when a query fails", async () => {
    const secretValue = "sensitive-value-that-must-not-be-logged";
    const failure = new Error(`database error included ${secretValue}`);
    mockedQuery.mockRejectedValueOnce(failure);

    await expect(
      executeQuery("update customers set email = ?", [secretValue]),
    ).rejects.toBe(failure);

    const loggedErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(loggedErrors).toContain("Error");
    expect(loggedErrors).not.toContain(secretValue);
    expect(loggedErrors).not.toContain(failure.message);
  });

  it("reduces arbitrary database errors to a safe error category", () => {
    expect(safeErrorType(new Error("query parameters included a private value"))).toBe("Error");
    expect(safeErrorType({ name: "DatabaseError", message: "private details" })).toBe("UnknownError");

    const customError = new Error("sensitive detail");
    customError.name = "privateCustomerIdentifier42";
    expect(safeErrorType(customError)).toBe("UnknownError");

    const postgresError = new Error("sensitive detail");
    postgresError.name = "NeonDbError";
    expect(safeErrorType(postgresError)).toBe("NeonDbError");
  });

  it("enables the native PostgreSQL driver only for the guarded disposable test database", () => {
    const testUrl = "postgresql://tester:secret@127.0.0.1:5432/radrasys_ci_test";
    const testEnvironment = {
      RADRASYS_TEST_DB_DRIVER: "pg",
      APP_ENV: "test",
      NODE_ENV: "test",
      TEST_DATABASE_URL: testUrl,
      DATABASE_URL: testUrl,
    };

    expect(shouldUseNativePostgresTestDriver(testEnvironment)).toBe(true);
    expect(shouldUseNativePostgresTestDriver({ ...testEnvironment, RADRASYS_TEST_DB_DRIVER: "" })).toBe(false);
    expect(() =>
      shouldUseNativePostgresTestDriver({ ...testEnvironment, APP_ENV: "production" }),
    ).toThrow("requires APP_ENV=test");
    expect(() =>
      shouldUseNativePostgresTestDriver({
        ...testEnvironment,
        DATABASE_URL: "postgresql://tester:secret@db.example:5432/radrasys_ci_test",
      }),
    ).toThrow("must match the validated TEST_DATABASE_URL");
  });

  it("does not log customer input or raw ORM errors from other database wrappers", () => {
    const databaseSources = ["server/db/db.ts", "server/db/db-helpers.ts"].map(path =>
      readFileSync(resolve(path), "utf8"),
    );

    for (const source of databaseSources) {
      expect(source).not.toMatch(/console\.(?:log|error|warn)\([^;\n]*(?:dados|insertData)\b/i);
      expect(source).not.toMatch(/console\.(?:error|warn)\([^;\n]*,\s*error\s*\)/i);
    }
  });
});
