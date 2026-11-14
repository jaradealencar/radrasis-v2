import "dotenv/config";
import { and, eq } from "drizzle-orm";
import {
  assertSafeTestDatabase,
  databaseIdentity,
} from "../server/scripts/migration-safety";
import * as schema from "../drizzle/schema";

function requireTestDatabase() {
  if (process.env.APP_ENV !== "test" || process.env.NODE_ENV !== "test") {
    throw new Error(
      "Escola E2E fixtures require APP_ENV=test and NODE_ENV=test."
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
}

requireTestDatabase();
process.env.RADRASYS_TEST_DB_DRIVER = "pg";

const [{ auth }, { getDb }] = await Promise.all([
  import("../server/_core/auth"),
  import("../server/db/db"),
]);

function requireDatabase(database: Awaited<ReturnType<typeof getDb>>) {
  if (!database) {
    throw new Error("Could not connect to the validated E2E test database.");
  }
  return database;
}

const db = requireDatabase(await getDb());

const testPassword = "School-E2E-only-Password-2026!";

async function replaceUser(input: {
  name: string;
  email: string;
  username: string;
  role: "admin" | "vendas";
}) {
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, input.username))
    .limit(1);
  if (existing) {
    await db.delete(schema.user).where(eq(schema.user.id, existing.id));
  }

  const result = await auth.api.createUser({
    body: {
      email: input.email,
      password: testPassword,
      name: input.name,
      role: input.role,
      data: { username: input.username, displayUsername: input.name },
    },
  });
  return result.user.id;
}

async function main() {
  const adminId = await replaceUser({
    name: "E2E Instrutor",
    email: "e2e.instrutor@local.internal",
    username: "e2e.instrutor@local.internal",
    role: "admin",
  });
  const studentId = await replaceUser({
    name: "E2E Aluno",
    email: "e2e.aluno@local.internal",
    username: "e2e.aluno@local.internal",
    role: "vendas",
  });

  await db
    .delete(schema.rolePermissions)
    .where(
      and(
        eq(schema.rolePermissions.role, "vendas"),
        eq(schema.rolePermissions.pageKey, "treinamento")
      )
    );
  await db.insert(schema.rolePermissions).values({
    role: "vendas",
    pageKey: "treinamento",
    canAccess: "sim",
  });

  const [assessment] = await db
    .select({
      id: schema.trainingAssessments.id,
      subjectId: schema.trainingAssessments.subjectId,
      version: schema.trainingAssessments.version,
    })
    .from(schema.trainingAssessments)
    .where(
      eq(schema.trainingAssessments.title, "Closer · Atendimento consultivo")
    )
    .limit(1);
  if (!assessment) {
    throw new Error(
      "The published Closer assessment was not found after migrations."
    );
  }

  const now = Date.now();
  await db.insert(schema.trainingEnrollments).values({
    userId: adminId,
    subjectId: assessment.subjectId,
  });
  const [assignment] = await db
    .insert(schema.trainingExamAssignments)
    .values({
      assessmentId: assessment.id,
      dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      maxAttempts: 2,
      createdBy: adminId,
    })
    .returning({ id: schema.trainingExamAssignments.id });
  const [assignmentStudent] = await db
    .insert(schema.trainingExamAssignmentStudents)
    .values({ assignmentId: assignment.id, userId: adminId })
    .returning({ id: schema.trainingExamAssignmentStudents.id });

  await db.insert(schema.trainingAttempts).values([
    {
      userId: adminId,
      assessmentId: assessment.id,
      assignmentStudentId: assignmentStudent.id,
      mode: "formal",
      status: "completed",
      assessmentVersion: assessment.version,
      snapshot: { questions: [] },
      score: "7.50",
      pointsEarned: "3.00",
      pointsPossible: "4.00",
      startedAt: new Date(now - 120_000),
      completedAt: new Date(now - 60_000),
    },
    {
      userId: adminId,
      assessmentId: assessment.id,
      assignmentStudentId: assignmentStudent.id,
      mode: "formal",
      status: "completed",
      assessmentVersion: assessment.version,
      snapshot: { questions: [] },
      score: "8.50",
      pointsEarned: "3.40",
      pointsPossible: "4.00",
      startedAt: new Date(now - 30_000),
      completedAt: new Date(now - 10_000),
    },
  ]);

  console.info(
    "Escola E2E fixtures seeded in the validated disposable database."
  );
}

main().catch(error => {
  console.error(
    "Could not seed Escola E2E fixtures.",
    error instanceof Error ? error.name : "UnknownError"
  );
  process.exitCode = 1;
});
