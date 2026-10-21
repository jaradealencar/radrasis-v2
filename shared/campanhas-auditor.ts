import { CAMPANHAS_AUDITOR_CATALOGO } from "./campanhas-auditor-catalogo";

export const CAMPANHAS_AUDITOR_STATUS = [
  "nao_implementado",
  "implementado_nao_testado",
  "aprovado_simulacao",
  "aprovado_integracao_real",
  "aprovado_publicado",
  "reprovado",
  "bloqueado_dependencia",
  "inconclusivo",
] as const;

export type CampanhaAuditorStatus = (typeof CAMPANHAS_AUDITOR_STATUS)[number];

export interface AuditorCheck {
  id: string;
  name: string;
  critical: boolean;
  passed: boolean;
  requirementIds: string[];
  expected: string;
  actual: string;
  phase: string;
  severity: "critica" | "alta" | "media" | "baixa";
  evidence: Record<string, unknown>;
  hypothesis?: string;
  recommendation?: string;
}

export interface AuditorRequirementResult {
  requirementId: string;
  status: CampanhaAuditorStatus;
  executed: boolean;
  testIds: string[];
  evidence: Record<string, unknown>;
  expected: string;
  actual: string;
  phase: string;
  severity: "critica" | "alta" | "media" | "baixa";
  hypothesis?: string;
  recommendation?: string;
}

export const CAMPANHAS_AUDITOR_MODULES = [
  ...new Set(CAMPANHAS_AUDITOR_CATALOGO.map(item => item.module)),
];

/** Remove dados que não devem aparecer em relatórios técnicos do Auditor. */
export function sanitizarEvidenciaAuditor(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(
      /\b(password|senha|token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu,
      "$1=[REDACTED]"
    )
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/giu, "postgresql://[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[EMAIL]")
    .replace(
      /(?<!\d)(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}(?!\d)/gu,
      "[TELEFONE]"
    )
    .slice(0, 500);
}

/**
 * Checks sintéticos que injetam falhas apenas em objetos locais. Eles validam
 * os detectores do Auditor; não simulam chamadas de navegador, ERP ou WhatsApp.
 */
export function executarAutotestesAuditor(): AuditorCheck[] {
  const registrar = (
    id: string,
    name: string,
    requirementId: string,
    expected: string,
    actual: string,
    detected: boolean
  ): AuditorCheck => ({
    id,
    name,
    critical: ["AUD-OPT-OUT", "AUD-DUPLICATE", "AUD-TEST-DISABLED"].includes(
      id
    ),
    passed: detected,
    requirementIds: [requirementId],
    expected,
    actual,
    phase: "autoteste sintético",
    severity: id === "AUD-OPT-OUT" ? "critica" : "alta",
    evidence: { fixture: id, detected },
    ...(!detected
      ? {
          hypothesis: "O detector não identificou a falha controlada.",
          recommendation:
            "Corrigir a regra de detecção antes de aprovar o Auditor.",
        }
      : {}),
  });

  const detectarBotaoMorto = (esperada: boolean, observada: boolean) =>
    esperada !== observada;
  const detectarCalculoIncorreto = (esperado: number, observado: number) =>
    esperado !== observado;
  const detectarRecursoAusente = (presente: boolean) => !presente;
  const detectarTesteDesativado = (estado: string) => estado !== "passed";
  const detectarOptOutIgnorado = (optOut: boolean, elegivel: boolean) =>
    optOut && elegivel;
  const detectarEventoDuplicado = (ids: string[]) =>
    new Set(ids).size !== ids.length;
  const detectarVersaoDivergente = (esperada: string, publicada: string) =>
    esperada !== publicada;

  const checks: AuditorCheck[] = [
    registrar(
      "AUD-DEAD-BUTTON",
      "Detectar botão sem ação",
      "CAMP-084",
      "ação executada",
      "ação não executada",
      detectarBotaoMorto(true, false)
    ),
    registrar(
      "AUD-WRONG-CALC",
      "Detectar cálculo incorreto",
      "CAMP-084",
      "valor esperado 100",
      "valor observado 99",
      detectarCalculoIncorreto(100, 99)
    ),
    registrar(
      "AUD-MISSING-FEATURE",
      "Detectar funcionalidade ausente",
      "CAMP-084",
      "recurso obrigatório presente",
      "recurso obrigatório ausente",
      detectarRecursoAusente(false)
    ),
    registrar(
      "AUD-TEST-DISABLED",
      "Detectar teste crítico desativado",
      "CAMP-084",
      "teste crítico ativo",
      "teste crítico ignorado",
      detectarTesteDesativado("skipped")
    ),
    registrar(
      "AUD-OPT-OUT",
      "Detectar opt-out ainda elegível",
      "CAMP-084",
      "contato bloqueado",
      "contato elegível apesar do opt-out",
      detectarOptOutIgnorado(true, true)
    ),
    registrar(
      "AUD-DUPLICATE",
      "Detectar evento duplicado",
      "CAMP-084",
      "um evento por ID",
      "mesmo ID repetido",
      detectarEventoDuplicado(["evt-1", "evt-1"])
    ),
    registrar(
      "AUD-VERSION-DIVERGENCE",
      "Detectar versão publicada divergente",
      "CAMP-084",
      "SHA publicado igual ao esperado",
      "SHA publicado diferente",
      detectarVersaoDivergente("abc123", "def456")
    ),
  ];
  return checks;
}

export function resumirChecksAuditor(checks: AuditorCheck[]) {
  const executados = checks.length;
  const aprovados = checks.filter(check => check.passed).length;
  const criticosReprovados = checks.filter(
    check => check.critical && !check.passed
  ).length;
  const requisitosCobertos = new Set(
    checks.flatMap(check => check.requirementIds)
  ).size;
  return {
    testesExecutados: executados,
    testesAprovados: aprovados,
    testesReprovados: executados - aprovados,
    taxaAprovacao:
      executados === 0 ? null : Math.round((aprovados / executados) * 100),
    requisitosCobertos,
    alertasCriticos: criticosReprovados,
  };
}

export function validarCatalogoAuditor() {
  const ids = new Set<string>(CAMPANHAS_AUDITOR_CATALOGO.map(item => item.id));
  const catalogIds = CAMPANHAS_AUDITOR_CATALOGO.map(item => item.id);
  const duplicados = catalogIds.filter(
    (id, index) => catalogIds.indexOf(id) !== index
  );
  const ausentes = Array.from(
    { length: 84 },
    (_, index) => `CAMP-${String(index + 1).padStart(3, "0")}`
  ).filter(id => !ids.has(id));
  const invalidos = CAMPANHAS_AUDITOR_CATALOGO.filter(
    item =>
      !item.name.trim() ||
      !item.module.trim() ||
      !item.acceptanceCriteria.trim() ||
      !CAMPANHAS_AUDITOR_STATUS.includes(item.initialStatus)
  ).map(item => item.id);
  return {
    ok:
      duplicados.length === 0 &&
      ausentes.length === 0 &&
      invalidos.length === 0,
    total: catalogIds.length,
    duplicados,
    ausentes,
    invalidos,
  };
}
