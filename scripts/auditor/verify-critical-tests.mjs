import fs from "node:fs";

const reportPath = process.argv[2];
if (!reportPath || !fs.existsSync(reportPath)) {
  console.error("Relatório JSON do Vitest ausente; gate crítico reprovado.");
  process.exit(1);
}

const manifest = JSON.parse(
  fs.readFileSync("scripts/auditor/critical-tests.json", "utf8")
);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const assertions = (report.testResults ?? []).flatMap(
  file => file.assertionResults ?? []
);
const missing = [];
const notPassed = [];

for (const required of manifest.tests) {
  const matching = assertions.filter(assertion =>
    String(assertion.fullName ?? assertion.title ?? "").includes(required)
  );
  if (matching.length === 0) missing.push(required);
  else if (matching.some(assertion => assertion.status !== "passed"))
    notPassed.push(required);
}

if (missing.length || notPassed.length) {
  if (missing.length)
    console.error(
      `Testes críticos ausentes/desativados: ${missing.join(" | ")}`
    );
  if (notPassed.length)
    console.error(`Testes críticos sem aprovação: ${notPassed.join(" | ")}`);
  process.exit(1);
}

console.log(
  `Gate crítico aprovado: ${manifest.tests.length} testes presentes e aprovados.`
);
