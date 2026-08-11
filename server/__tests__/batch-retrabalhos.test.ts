import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db/db";
import { createBatchRetrabalhos } from "../db/db";
import { errorLibrary, retrabalhos } from "../../drizzle/schema";
import { eq, inArray, like } from "drizzle-orm";

describe("createBatchRetrabalhos", () => {
  let db: ReturnType<typeof getDb> | null = null;
  let testErrorIds: number[] = [];
  let testCodes: string[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar 3 erros de teste
    const errors = await db
      .insert(errorLibrary)
      .values([
        {
          code: "TEST-BATCH-001",
          category: "Teste",
          description: "Erro de teste 1",
          correction: "Correção 1",
          tipoRegistro: "retrabalho",
        },
        {
          code: "TEST-BATCH-002",
          category: "Teste",
          description: "Erro de teste 2",
          correction: "Correção 2",
          tipoRegistro: "retrabalho",
        },
        {
          code: "TEST-BATCH-003",
          category: "Teste",
          description: "Erro de teste 3",
          correction: "Correção 3",
          tipoRegistro: "retrabalho",
        },
      ]);

    // Buscar os IDs dos erros criados
    const createdErrors = await db
      .select({ id: errorLibrary.id, code: errorLibrary.code })
      .from(errorLibrary)
      .where(like(errorLibrary.code, "TEST-BATCH-%"));

    testErrorIds = createdErrors.map((e) => e.id);
    testCodes = createdErrors.map((e) => e.code);
  });

  afterAll(async () => {
    if (!db || testErrorIds.length === 0) return;

    // Limpar dados de teste
    await db
      .delete(retrabalhos)
      .where(inArray(retrabalhos.codigoErro, testCodes));

    await db
      .delete(errorLibrary)
      .where(like(errorLibrary.code, "TEST-BATCH-%"));
  });

  it("deve criar múltiplos retrabalhos com os mesmos dados base", async () => {
    if (!db || testErrorIds.length < 3) throw new Error("Setup failed");

    const baseData = {
      titulo: "Lote de teste",
      osRetrabalhada: "OS-BATCH-001",
      osOriginal: "OS-ORIG-001",
      data: new Date("2026-06-22"),
      setor: "Pintura",
      tipo: "INTERNO" as const,
      custo: "100.00",
      frete: "50.00",
      total: "150.00",
      responsavel: "Teste User",
      tipoResponsavel: "operador" as const,
      descricao: "Lançamento em lote de teste",
      classe: "EVITÁVEL" as const,
      horasImpacto: "2",
      mes: "junho",
      tipoRegistro: "retrabalho" as const,
    };

    const results = await createBatchRetrabalhos(baseData, testErrorIds.slice(0, 3));

    expect(results).toHaveLength(3);

    // Verificar que os retrabalhos foram criados com os códigos de erro corretos
    const createdRetrabalhos = await db
      .select()
      .from(retrabalhos)
      .where(inArray(retrabalhos.codigoErro, testCodes.slice(0, 3)));

    expect(createdRetrabalhos.length).toBeGreaterThanOrEqual(3);

    // Verificar que todos têm os mesmos dados base
    createdRetrabalhos.forEach((r) => {
      expect(r.osRetrabalhada).toBe("OS-BATCH-001");
      expect(r.osOriginal).toBe("OS-ORIG-001");
      expect(r.setor).toBe("Pintura");
      expect(r.tipo).toBe("INTERNO");
      expect(r.custo).toBe("100.00");
      expect(r.frete).toBe("50.00");
      expect(r.total).toBe("150.00");
      expect(r.responsavel).toBe("Teste User");
      expect(r.classe).toBe("EVITÁVEL");
      expect(r.tipoRegistro).toBe("retrabalho");
    });
  });

  it("deve ignorar erros que não existem", async () => {
    if (!db || testErrorIds.length < 2) throw new Error("Setup failed");

    const baseData = {
      titulo: "Lote com erro inexistente",
      osRetrabalhada: "OS-BATCH-002",
      osOriginal: "OS-ORIG-002",
      data: new Date("2026-06-22"),
      setor: "Corte",
      tipo: "EXTERNO" as const,
      custo: "200.00",
      frete: "0.00",
      total: "200.00",
      responsavel: "Outro User",
      tipoResponsavel: "gestor" as const,
      descricao: "Teste com erro inexistente",
      classe: "INEVITÁVEL" as const,
      horasImpacto: "1",
      mes: "junho",
      tipoRegistro: "retrabalho" as const,
    };

    const invalidIds = [testErrorIds[0], 99999, testErrorIds[1]];
    const results = await createBatchRetrabalhos(baseData, invalidIds);

    // Deve criar apenas 2 retrabalhos (ignorando o ID 99999)
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("deve preservar tipoRegistro CNQ quando especificado", async () => {
    if (!db || testErrorIds.length < 1) throw new Error("Setup failed");

    const baseData = {
      titulo: "Lote CNQ",
      osRetrabalhada: "OS-CNQ-001",
      osOriginal: "OS-ORIG-CNQ",
      data: new Date("2026-06-22"),
      setor: "Administrativo",
      tipo: "INTERNO" as const,
      custo: "50.00",
      frete: "0.00",
      total: "50.00",
      responsavel: "Admin",
      tipoResponsavel: "operador" as const,
      descricao: "Teste CNQ",
      classe: "EVITÁVEL" as const,
      horasImpacto: null,
      mes: "junho",
      tipoRegistro: "cnq" as const,
    };

    const results = await createBatchRetrabalhos(baseData, [testErrorIds[0]]);

    expect(results.length).toBeGreaterThanOrEqual(1);

    const created = await db
      .select()
      .from(retrabalhos)
      .where(eq(retrabalhos.osRetrabalhada, "OS-CNQ-001"))
      .limit(1);

    expect(created[0]).toBeDefined();
    expect(created[0].tipoRegistro).toBe("cnq");
  });
});
