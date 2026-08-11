import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function createCtx(role: "admin" | "vendas" = "admin"): TrpcContext {
  return {
    user: {
      id: "test-user",
      email: "test@example.com",
      name: "Test User",
      role,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("errorLibrary", () => {
  it("returns a list of errors", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.errorLibrary.list();
    expect(Array.isArray(result)).toBe(true);
    // Should have errors from seed
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("code");
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("description");
      expect(result[0]).toHaveProperty("correction");
    }
  });
});

describe("dashboard.kpis", () => {
  it("returns kpi object with expected fields", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.kpis({});
    if (result) {
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("custoTotal");
      expect(result).toHaveProperty("evitavel");
      expect(result).toHaveProperty("inevitavel");
      expect(result).toHaveProperty("pctEvitavel");
      expect(typeof result.total).toBe("number");
    }
  });
});

describe("dashboard.evolucaoMensal", () => {
  it("returns monthly evolution data", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.evolucaoMensal();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("faturamento.list", () => {
  it("returns list of faturamento records", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.faturamento.list();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("mes");
      expect(result[0]).toHaveProperty("valorFaturado");
      expect(result[0]).toHaveProperty("totalPedidos");
    }
  });
});

describe("errorLibrary.updateCorrection", () => {
  it("requires authentication", async () => {
    const unauthCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.errorLibrary.updateCorrection({ code: "XX-01", correction: "test" })).rejects.toThrow();
  });
});

describe("retrabalhos.list", () => {
  it("returns paginated list with total", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.retrabalhos.list({ page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("filters by setor", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.retrabalhos.list({ filter: { setor: "SOLDA" }, page: 1, pageSize: 50 });
    expect(Array.isArray(result.data)).toBe(true);
    result.data.forEach(r => expect(r.setor).toBe("SOLDA"));
  });
});
