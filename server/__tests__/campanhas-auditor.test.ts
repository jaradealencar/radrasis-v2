import { describe, expect, it } from "vitest";
import { CAMPANHAS_AUDITOR_CATALOGO } from "@shared/campanhas-auditor-catalogo";
import {
  executarAutotestesAuditor,
  sanitizarEvidenciaAuditor,
  resumirChecksAuditor,
  validarCatalogoAuditor,
} from "@shared/campanhas-auditor";

describe("Robô Auditor — checks críticos", () => {
  it("AUDITOR-CRITICAL: importa os 74 requisitos e não reutiliza IDs", () => {
    const validacao = validarCatalogoAuditor();
    expect(validacao).toEqual({
      ok: true,
      total: 84,
      duplicados: [],
      ausentes: [],
      invalidos: [],
    });
    expect(new Set(CAMPANHAS_AUDITOR_CATALOGO.map(item => item.id)).size).toBe(
      84
    );
    expect(
      CAMPANHAS_AUDITOR_CATALOGO.slice(0, 74).map(item => item.id)
    ).toEqual(
      Array.from(
        { length: 74 },
        (_, index) => `CAMP-${String(index + 1).padStart(3, "0")}`
      )
    );
  });

  it("AUDITOR-CRITICAL: detecta cada falha sintética sem dados reais", () => {
    const checks = executarAutotestesAuditor();
    expect(checks.map(check => check.id)).toEqual([
      "AUD-DEAD-BUTTON",
      "AUD-WRONG-CALC",
      "AUD-MISSING-FEATURE",
      "AUD-TEST-DISABLED",
      "AUD-OPT-OUT",
      "AUD-DUPLICATE",
      "AUD-VERSION-DIVERGENCE",
    ]);
    expect(checks.every(check => check.passed)).toBe(true);
    expect(
      checks.every(
        check => check.evidence.fixture && check.phase === "autoteste sintético"
      )
    ).toBe(true);
    expect(
      checks.every(check => check.requirementIds.includes("CAMP-084"))
    ).toBe(true);
  });

  it("AUDITOR-CRITICAL: sanitiza credenciais, e-mail e telefone fictícios", () => {
    const output = sanitizarEvidenciaAuditor(
      "Bearer abc123 token=secreto teste@example.com 67999001234"
    );
    expect(output).not.toMatch(
      /abc123|secreto|teste@example\.com|67999001234/u
    );
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("[EMAIL]");
    expect(output).toContain("[TELEFONE]");
  });

  it("não confunde cobertura de requisitos com aprovação dos testes", () => {
    const result = resumirChecksAuditor([
      {
        id: "T1",
        name: "a",
        critical: false,
        passed: true,
        requirementIds: ["CAMP-057"],
        expected: "",
        actual: "",
        phase: "simulação",
        severity: "baixa",
        evidence: {},
      },
      {
        id: "T2",
        name: "b",
        critical: false,
        passed: false,
        requirementIds: ["CAMP-071"],
        expected: "",
        actual: "",
        phase: "simulação",
        severity: "alta",
        evidence: {},
      },
    ]);
    expect(result.testesExecutados).toBe(2);
    expect(result.testesAprovados).toBe(1);
    expect(result.taxaAprovacao).toBe(50);
    expect(result.requisitosCobertos).toBe(2);
  });
});
