import { describe, expect, it } from "vitest";
import { MAX_MESES, confirmarAlvo, identificarAlvo, mesesDoIntervalo } from "../sync/backfill-historico-orcamentos";

describe("mesesDoIntervalo", () => {
  it("lista cada mês, inclusive os extremos", () => {
    expect(mesesDoIntervalo("2023-03", "2023-05")).toEqual([
      { mes: 3, ano: 2023 }, { mes: 4, ano: 2023 }, { mes: 5, ano: 2023 },
    ]);
  });

  it("atravessa a virada de ano", () => {
    expect(mesesDoIntervalo("2023-11", "2024-02").map(m => `${m.mes}/${m.ano}`)).toEqual(["11/2023", "12/2023", "1/2024", "2/2024"]);
  });

  it("03/2023 a 12/2025 são 34 meses", () => {
    expect(mesesDoIntervalo("2023-03", "2025-12")).toHaveLength(34);
  });

  it("um mês só", () => {
    expect(mesesDoIntervalo("2025-12", "2025-12")).toEqual([{ mes: 12, ano: 2025 }]);
  });

  it("recusa formato inválido, mês 13 e intervalo invertido", () => {
    expect(() => mesesDoIntervalo("2023/03", "2025-12")).toThrow(/AAAA-MM/);
    expect(() => mesesDoIntervalo("2023-13", "2025-12")).toThrow(/AAAA-MM/);
    expect(() => mesesDoIntervalo("2025-12", "2023-03")).toThrow(/depois/);
  });

  it("recusa intervalos absurdos (erro de digitação não dispara anos de chamadas ao ERP)", () => {
    expect(() => mesesDoIntervalo("2000-01", "2025-12")).toThrow(new RegExp(String(MAX_MESES)));
  });
});

describe("confirmarAlvo (trava contra gravar no banco errado)", () => {
  const url = "postgresql://usuario:senha-secreta@ep-exemplo-123.neon.tech/producao?sslmode=require";

  it("identifica o alvo por host/banco, sem usuário nem senha", () => {
    const alvo = identificarAlvo(url);
    expect(alvo).toBe("ep-exemplo-123.neon.tech/producao");
    expect(alvo).not.toContain("senha-secreta");
    expect(alvo).not.toContain("usuario");
  });

  it("aceita quando a confirmação é exatamente o alvo (sem diferenciar caixa)", () => {
    expect(confirmarAlvo(url, "EP-exemplo-123.neon.tech/Producao")).toBe("ep-exemplo-123.neon.tech/producao");
  });

  it("recusa sem confirmação, com confirmação de outro banco e com confirmação parcial", () => {
    expect(() => confirmarAlvo(url, undefined)).toThrow(/recusada/);
    expect(() => confirmarAlvo(url, "")).toThrow(/recusada/);
    expect(() => confirmarAlvo(url, "ep-outro-999.neon.tech/producao")).toThrow(/recusada/);
    expect(() => confirmarAlvo(url, "ep-exemplo-123.neon.tech")).toThrow(/recusada/);
  });

  it("a mensagem de recusa não vaza a senha", () => {
    try { confirmarAlvo(url, "errado"); } catch (e: any) { expect(e.message).not.toContain("senha-secreta"); }
  });

  it("sem DATABASE_URL não há alvo: recusa", () => {
    expect(() => confirmarAlvo(undefined, "qualquer")).toThrow();
  });
});
