import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "../db/db-connection";
import {
  empacotamentoModelos,
  empacotamentoModelosCaixa,
  empacotamentoPedidos,
  empacotamentoTabelaPrecos,
  empacotamentoChecklistItens,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Context helper ──────────────────────────────────────────────────────────
function createCtx(): TrpcContext {
  return {
    user: {
      id: "test-user",
      email: "test@example.com",
      name: "Test User",
      role: "admin",
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── IDs criados nos testes ───────────────────────────────────────────────────
let db: ReturnType<typeof drizzle>;
let createdModeloId: number | null = null;
let createdCaixaId: number | null = null;
let createdPedidoId: number | null = null;
let createdPrecoId: number | null = null;
let createdChecklistItemId: number | null = null;

beforeAll(() => {
  db = drizzle(getPool());
});

afterAll(async () => {
  if (createdChecklistItemId) {
    await db.delete(empacotamentoChecklistItens).where(eq(empacotamentoChecklistItens.id, createdChecklistItemId));
  }
  if (createdPedidoId) {
    await db.delete(empacotamentoPedidos).where(eq(empacotamentoPedidos.id, createdPedidoId));
  }
  if (createdPrecoId) {
    await db.delete(empacotamentoTabelaPrecos).where(eq(empacotamentoTabelaPrecos.id, createdPrecoId));
  }
  if (createdCaixaId) {
    await db.delete(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.id, createdCaixaId));
  }
  if (createdModeloId) {
    await db.delete(empacotamentoModelos).where(eq(empacotamentoModelos.id, createdModeloId));
  }
});

// ─── Modelos de Letreiro ──────────────────────────────────────────────────────
describe("empacotamento.modelos", () => {
  it("cria um novo modelo de letreiro", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.empacotamento.modelos.create({ nome: "Letreiro Vitest v2" });
    expect(result.success).toBe(true);
    const rows = await db.select().from(empacotamentoModelos).where(eq(empacotamentoModelos.nome, "Letreiro Vitest v2"));
    expect(rows.length).toBeGreaterThan(0);
    createdModeloId = rows[0].id;
  });

  it("lista modelos ativos e inclui o criado", async () => {
    const caller = appRouter.createCaller(createCtx());
    const lista = await caller.empacotamento.modelos.listAtivos();
    expect(Array.isArray(lista)).toBe(true);
    const found = lista.find(m => m.nome === "Letreiro Vitest v2");
    expect(found).toBeDefined();
  });
});

// ─── Modelos de Caixa ─────────────────────────────────────────────────────────
describe("empacotamento.modelosCaixa", () => {
  it("cria modelo de caixa com dimensões e comissão", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.empacotamento.modelosCaixa.create({
      nome: "Caixa Vitest G",
      larguraCm: 40,
      alturaCm: 30,
      profundidadeCm: 20,
      tempoLimiteMin: 45,
      valorComissao: 8.50,
    });
    expect(result.success).toBe(true);
    const rows = await db.select().from(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.nome, "Caixa Vitest G"));
    expect(rows.length).toBeGreaterThan(0);
    createdCaixaId = rows[0].id;
  });

  it("lista modelos de caixa ativos", async () => {
    const caller = appRouter.createCaller(createCtx());
    const lista = await caller.empacotamento.modelosCaixa.listAtivos();
    expect(Array.isArray(lista)).toBe(true);
    const found = lista.find(m => m.id === createdCaixaId);
    expect(found?.nome).toBe("Caixa Vitest G");
  });
});

// ─── Checklist por Caixa ──────────────────────────────────────────────────────
describe("empacotamento.checklist", () => {
  it("adiciona item obrigatório ao checklist da caixa", async () => {
    if (!createdCaixaId) return;
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.empacotamento.checklist.addItem({
      modeloCaixaId: createdCaixaId,
      descricao: "Verificar lacre",
      obrigatorio: 1,
      ordem: 0,
    });
    expect(result.success).toBe(true);
    const rows = await db.select().from(empacotamentoChecklistItens)
      .where(eq(empacotamentoChecklistItens.modeloCaixaId, createdCaixaId));
    expect(rows.length).toBeGreaterThan(0);
    createdChecklistItemId = rows[0].id;
  });

  it("lista itens do checklist da caixa", async () => {
    if (!createdCaixaId) return;
    const caller = appRouter.createCaller(createCtx());
    const itens = await caller.empacotamento.checklist.listPorCaixa({ modeloCaixaId: createdCaixaId });
    expect(Array.isArray(itens)).toBe(true);
    expect(itens.some(i => i.id === createdChecklistItemId)).toBe(true);
  });
});

// ─── Tabela de Preços ─────────────────────────────────────────────────────────
describe("empacotamento.precos", () => {
  it("cria preço para modelo + tipo de caixa", async () => {
    if (!createdModeloId) return;
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.empacotamento.precos.upsert({
      modeloId: createdModeloId,
      tipoCaixa: "G",
      valorComissao: 5.50,
    });
    expect(result.success).toBe(true);
    const rows = await db.select().from(empacotamentoTabelaPrecos)
      .where(eq(empacotamentoTabelaPrecos.modeloId, createdModeloId));
    expect(rows.length).toBeGreaterThan(0);
    createdPrecoId = rows[0].id;
    expect(parseFloat(rows[0].valorComissao ?? "0")).toBeCloseTo(5.50, 1);
  });

  it("lista todos os preços", async () => {
    const caller = appRouter.createCaller(createCtx());
    const lista = await caller.empacotamento.precos.list();
    expect(Array.isArray(lista)).toBe(true);
  });
});

// ─── Pedidos e Kanban ─────────────────────────────────────────────────────────
describe("empacotamento.pedidos (kanban)", () => {
  it("cria pedido com prazo e modelo de caixa", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.empacotamento.pedidos.create({
      numeroPedido: "VITEST-V2-001",
      cliente: "Cliente Vitest v2",
      modeloId: createdModeloId ?? undefined,
      modeloCaixaId: createdCaixaId ?? undefined,
      modeloCaixaNome: "Caixa Vitest G",
      prazoEntrega: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      horarioMaximo: "18:00",
    });
    expect(result.success).toBe(true);
    const rows = await db.select().from(empacotamentoPedidos)
      .where(eq(empacotamentoPedidos.numeroPedido, "VITEST-V2-001"));
    expect(rows.length).toBeGreaterThan(0);
    createdPedidoId = rows[0].id;
    expect(rows[0].kanbanStatus).toBe("aguardando");
  });

  it("lista pedidos com kanbanStatus 'todos'", async () => {
    const caller = appRouter.createCaller(createCtx());
    const lista = await caller.empacotamento.pedidos.list({ kanbanStatus: "todos" });
    expect(Array.isArray(lista)).toBe(true);
    const found = lista.find(p => p.id === createdPedidoId);
    expect(found).toBeDefined();
  });

  it("move pedido para 'embalando'", async () => {
    if (!createdPedidoId) return;
    const caller = appRouter.createCaller(createCtx());
    await caller.empacotamento.pedidos.moverKanban({ id: createdPedidoId, kanbanStatus: "embalando" });
    const rows = await db.select().from(empacotamentoPedidos).where(eq(empacotamentoPedidos.id, createdPedidoId));
    expect(rows[0].kanbanStatus).toBe("embalando");
  });

  it("move pedido para 'patio'", async () => {
    if (!createdPedidoId) return;
    const caller = appRouter.createCaller(createCtx());
    await caller.empacotamento.pedidos.moverKanban({ id: createdPedidoId, kanbanStatus: "patio" });
    const rows = await db.select().from(empacotamentoPedidos).where(eq(empacotamentoPedidos.id, createdPedidoId));
    expect(rows[0].kanbanStatus).toBe("patio");
  });
});

// ─── Relatório ────────────────────────────────────────────────────────────────
describe("empacotamento.relatorio", () => {
  it("retorna resumo do dia com estrutura correta", async () => {
    const caller = appRouter.createCaller(createCtx());
    const resumo = await caller.empacotamento.relatorio.resumoDia();
    expect(typeof resumo.pendentes).toBe("number");
    expect(typeof resumo.finalizadosHoje).toBe("number");
    expect(typeof resumo.totalComissaoHoje).toBe("number");
  });

  it("retorna relatório de fechamento com estrutura correta", async () => {
    const caller = appRouter.createCaller(createCtx());
    const hoje = new Date().toISOString().split("T")[0];
    const rel = await caller.empacotamento.relatorio.fechamento({ dataInicio: hoje, dataFim: hoje });
    expect(typeof rel.totalGeral).toBe("number");
    expect(typeof rel.totalPedidos).toBe("number");
    expect(Array.isArray(rel.porOperador)).toBe(true);
    expect(Array.isArray(rel.pedidos)).toBe(true);
  });
});
