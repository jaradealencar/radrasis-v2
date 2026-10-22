import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockedState, mockedReturning, mockedValues, mockedInsert } = vi.hoisted(() => {
  const mockedReturning = vi.fn();
  const mockedValues = vi.fn(() => ({ returning: mockedReturning }));
  const mockedInsert = vi.fn(() => ({ values: mockedValues }));

  return {
    mockedState: { databaseUrl: "" },
    mockedReturning,
    mockedValues,
    mockedInsert,
  };
});

vi.mock("../_core/env", () => ({
  ENV: mockedState,
}));

vi.mock("./db-connection", () => ({
  createAppDatabase: vi.fn(() => ({ insert: mockedInsert })),
  getPool: vi.fn(() => ({})),
  safeErrorType: vi.fn(() => "DatabaseError"),
}));

import { criarCotacaoFrete } from "./db-helpers";

describe("freight quote error responses", () => {
  beforeEach(() => {
    mockedState.databaseUrl = "";
    mockedReturning.mockReset();
    mockedValues.mockClear();
    mockedInsert.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the established business fallback without exposing internal database errors", async () => {
    const loggedErrors: unknown[][] = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      loggedErrors.push(args);
    });

    const result = await criarCotacaoFrete({
      destinatarioNome: "Cliente de teste",
      municipio: "Campo Grande",
      estado: "MS",
    });

    expect(result).toEqual({ success: false, error: "Erro ao criar cotação" });
    expect(JSON.stringify(loggedErrors)).not.toContain("DATABASE_URL not set");
  });

  it("preserves the established success message", async () => {
    mockedState.databaseUrl = "disposable-test-connection";
    mockedReturning.mockResolvedValueOnce([{ id: 73 }]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await criarCotacaoFrete({
      destinatarioNome: "Cliente de teste",
      municipio: "Campo Grande",
      estado: "MS",
    });

    expect(result).toEqual({
      success: true,
      id: 73,
      message: "Cotação criada com sucesso! ID: 73",
    });
    expect(mockedInsert).toHaveBeenCalledTimes(1);
  });
});
