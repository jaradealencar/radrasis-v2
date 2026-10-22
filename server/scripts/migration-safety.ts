export type MigrationTarget = "local" | "ci" | "staging" | "production";

export type DatabaseIdentity = {
  host: string;
  port: number;
  database: string;
};

type Environment = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;

function fail(message: string): never {
  throw new Error(message);
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[|\]$/g, "");
}

export function databaseIdentity(connectionString: string | undefined): DatabaseIdentity {
  if (!connectionString) {
    return fail("DATABASE_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return fail("DATABASE_URL is not a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return fail("DATABASE_URL must use PostgreSQL.");
  }

  const host = normalizeHost(url.hostname);
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return fail("DATABASE_URL has an invalid database name.");
  }
  const port = url.port ? Number(url.port) : 5432;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return fail("DATABASE_URL must identify a host and valid port.");
  }
  if (!SAFE_IDENTIFIER.test(database)) {
    return fail("DATABASE_URL must identify a database using letters, digits, dot, underscore, or hyphen.");
  }

  return { host, port, database };
}

function isLocal(identity: DatabaseIdentity): boolean {
  return LOCAL_HOSTS.has(identity.host);
}

function sameDatabase(left: DatabaseIdentity, right: DatabaseIdentity): boolean {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

function expectedIdentity(environment: Environment): DatabaseIdentity {
  const host = environment.DB_MIGRATION_EXPECTED_HOST;
  const port = environment.DB_MIGRATION_EXPECTED_PORT;
  const database = environment.DB_MIGRATION_EXPECTED_DATABASE;
  if (!host || !port || !database) {
    return fail("Migration target identity is incomplete; set the expected host, port, and database name.");
  }

  const parsedPort = Number(port);
  const identity = {
    host: normalizeHost(host),
    port: parsedPort,
    database,
  };
  if (
    !identity.host ||
    !Number.isInteger(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65535 ||
    !SAFE_IDENTIFIER.test(database)
  ) {
    return fail("Migration target identity is invalid.");
  }

  return identity;
}

function validateEnvironment(target: MigrationTarget, identity: DatabaseIdentity, environment: Environment): void {
  const appEnvironment = environment.APP_ENV;
  const nodeEnvironment = environment.NODE_ENV;
  const vercelEnvironment = environment.VERCEL_ENV;

  switch (target) {
    case "local":
      if (!new Set(["local", "development"]).has(appEnvironment ?? "")) {
        return fail("APP_ENV must be local or development for a local migration.");
      }
      if (nodeEnvironment === "production" || vercelEnvironment) {
        return fail("A local migration cannot run in a production or Vercel environment.");
      }
      if (!isLocal(identity)) {
        return fail("A local migration is allowed only on a loopback database host.");
      }
      break;
    case "ci":
      if (appEnvironment !== "ci" || nodeEnvironment !== "test" || environment.CI !== "true") {
        return fail("A CI migration requires APP_ENV=ci, NODE_ENV=test, and CI=true.");
      }
      if (!isLocal(identity) || !/(?:^|[_-])(ci|test|tests)(?:$|[_-])/i.test(identity.database)) {
        return fail("CI migrations are allowed only on a local database named for CI or tests.");
      }
      break;
    case "staging":
      if (appEnvironment !== "staging" || nodeEnvironment !== "production") {
        return fail("A staging migration requires APP_ENV=staging and NODE_ENV=production.");
      }
      if (vercelEnvironment && vercelEnvironment !== "preview") {
        return fail("A staging migration conflicts with the Vercel environment.");
      }
      if (isLocal(identity)) {
        return fail("A staging target cannot use a loopback database host.");
      }
      break;
    case "production":
      if (appEnvironment !== "production" || nodeEnvironment !== "production") {
        return fail("A production migration requires APP_ENV=production and NODE_ENV=production.");
      }
      if (vercelEnvironment && vercelEnvironment !== "production") {
        return fail("A production migration conflicts with the Vercel environment.");
      }
      if (isLocal(identity)) {
        return fail("A production target cannot use a loopback database host.");
      }
      break;
  }
}

export function assertMigrationTarget(environment: Environment = process.env): {
  target: MigrationTarget;
  identity: DatabaseIdentity;
} {
  const rawTarget = environment.DB_MIGRATION_TARGET;
  if (!rawTarget || !["local", "ci", "staging", "production"].includes(rawTarget)) {
    return fail("DB_MIGRATION_TARGET must be local, ci, staging, or production.");
  }
  const target = rawTarget as MigrationTarget;
  const identity = databaseIdentity(environment.DATABASE_URL);
  const expected = expectedIdentity(environment);

  if (!sameDatabase(identity, expected)) {
    return fail("DATABASE_URL does not match the declared migration target.");
  }
  validateEnvironment(target, identity, environment);

  const confirmation = `MIGRATE:${target}:${identity.host}:${identity.port}/${identity.database}`;
  if (environment.DB_MIGRATION_CONFIRMATION !== confirmation) {
    return fail("DB_MIGRATION_CONFIRMATION does not match the selected target identity.");
  }

  if (target === "production") {
    const productionApproval = `AUTHORIZE_PRODUCTION_MIGRATION:${identity.host}:${identity.port}/${identity.database}`;
    if (environment.DB_MIGRATION_PRODUCTION_APPROVAL !== productionApproval) {
      return fail("Production migrations require the target-specific production approval phrase.");
    }
  }

  const testUrl = environment.TEST_DATABASE_URL;
  if (target === "production" && testUrl && sameDatabase(identity, databaseIdentity(testUrl))) {
    return fail("The production target is also configured as the test database.");
  }

  return { target, identity };
}

export function assertSafeTestDatabase(environment: Environment = process.env): DatabaseIdentity {
  if (environment.NODE_ENV === "production" || environment.APP_ENV === "production" || environment.VERCEL_ENV === "production") {
    return fail("Tests are blocked in a production application environment.");
  }

  const identity = databaseIdentity(environment.TEST_DATABASE_URL);
  if (!isLocal(identity)) {
    return fail("Tests require TEST_DATABASE_URL to point to a local loopback database.");
  }
  if (!/(?:^|[_-])(ci|test|tests)(?:$|[_-])/i.test(identity.database)) {
    return fail("The test database name must end in or contain a _ci, _test, or _tests segment.");
  }

  for (const variable of ["PRODUCTION_DATABASE_URL", "STAGING_DATABASE_URL"] as const) {
    const configuredUrl = environment[variable];
    if (configuredUrl && sameDatabase(identity, databaseIdentity(configuredUrl))) {
      return fail("TEST_DATABASE_URL matches a protected environment database.");
    }
  }

  return identity;
}
