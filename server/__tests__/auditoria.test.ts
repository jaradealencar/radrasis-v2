import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db/db";
import { auditoriaRetrabalhos } from "../../drizzle/schema";
import { insertAuditLog, listAuditLogs } from "../db/db";
import { eq } from "drizzle-orm";

// ─── Testes de integração para o módulo de Auditoria ────────────────────────

describe("Auditoria de Retrabalhos", () => {
  let insertedId: number | null = null;

  afterAll(async () => {
    // Limpar registros criados pelo teste
    if (insertedId !== null) {
      const db = await getDb();
      if (db) {
        await db.delete(auditoriaRetrabalhos).where(eq(auditoriaRetrabalhos.id, insertedId));
      }
    }
  });

  it("deve inserir um log de auditoria de CRIACAO", async () => {
    await insertAuditLog({
      retrabalhoId: 9999,
      osRetrabalhada: "OS-TEST-001",
      osOriginal: "OS-ORIG-001",
      acao: "CRIACAO",
      usuarioId: null,
      usuarioNome: "Usuário Teste",
      usuarioRole: "producao",
      detalhes: { input: { setor: "LASER", tipo: "INTERNO" } },
    });

    // Verificar que o log foi criado
    const { rows } = await listAuditLogs({ osRetrabalhada: "OS-TEST-001", pageSize: 5 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((r) => r.osRetrabalhada === "OS-TEST-001");
    expect(row).toBeDefined();
    expect(row?.acao).toBe("CRIACAO");
    expect(row?.usuarioNome).toBe("Usuário Teste");
    if (row) insertedId = row.id;
  });

  it("deve filtrar logs por ação CRIACAO", async () => {
    const { rows } = await listAuditLogs({ acao: "CRIACAO", pageSize: 100 });
    expect(rows.every((r) => r.acao === "CRIACAO")).toBe(true);
  });

  it("deve retornar total e totalPages corretamente", async () => {
    const pageSize = 5;
    const { rows, total } = await listAuditLogs({ pageSize });
    expect(rows.length).toBeLessThanOrEqual(pageSize);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it("deve filtrar por osRetrabalhada com LIKE", async () => {
    const { rows } = await listAuditLogs({ osRetrabalhada: "OS-TEST", pageSize: 10 });
    expect(rows.every((r) => r.osRetrabalhada?.includes("OS-TEST"))).toBe(true);
  });

  it("deve paginar corretamente", async () => {
    const page1 = await listAuditLogs({ page: 1, pageSize: 1 });
    const page2 = await listAuditLogs({ page: 2, pageSize: 1 });
    if (page1.total >= 2) {
      expect(page1.rows[0]?.id).not.toBe(page2.rows[0]?.id);
    }
    expect(page1.rows.length).toBeLessThanOrEqual(1);
  });
});
