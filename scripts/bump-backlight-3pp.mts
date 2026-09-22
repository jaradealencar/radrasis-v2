/**
 * Aumenta em 3 pontos percentuais (pp) cada coluna da linha "Backlight" nas
 * seções de PVC Expandido (page 2 e page 12, variantes Brasil/MS).
 */
import "dotenv/config";

const USE_PROD = process.argv.includes("--prod");
if (USE_PROD) {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    console.error("PRODUCTION_DATABASE_URL não definida no .env");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  console.log("Usando PRODUCTION_DATABASE_URL (banco do site publicado)");
}

const { listPriceTableSections, updatePriceTableSection, getPriceTableMeta } = await import("../server/db/db");

const TARGET_LABEL = "Backlight";
const DELTA = 3;

const APPLY = process.argv.includes("--apply");

function bumpPercent(raw: string, delta: number): string {
  const m = /^(-?\d+(?:[.,]\d+)?)%$/.exec(raw.trim());
  if (!m) return raw;
  const num = parseFloat(m[1].replace(",", ".")) + delta;
  const isInt = Math.abs(num - Math.round(num)) < 0.001;
  return isInt ? `${Math.round(num)}%` : `${num.toFixed(1).replace(".", ",")}%`;
}

const meta = await getPriceTableMeta();
console.log("Versão atual:", meta?.versao);

const sections = await listPriceTableSections();

type Row = { label?: string; values?: string[] };
type Content = { type?: string; columns?: string[]; rows?: Row[] };

let totalSections = 0;

for (const s of sections) {
  let content: Content;
  try {
    content = JSON.parse(s.contentJson);
  } catch {
    continue;
  }
  const rows = content.rows ?? [];
  const hasTarget = rows.some((r) => r.label === TARGET_LABEL);
  if (!hasTarget) continue;

  const newRows = rows.map((r) => {
    if (r.label !== TARGET_LABEL) return r;
    return { ...r, values: (r.values ?? []).map((v) => bumpPercent(v, DELTA)) };
  });
  const newContent: Content = { ...content, rows: newRows };

  totalSections++;
  const before = rows.find((r) => r.label === TARGET_LABEL)?.values ?? [];
  const after = newRows.find((r) => r.label === TARGET_LABEL)?.values ?? [];
  console.log(`\n=== id=${s.id} (page=${s.page}) "${s.sectionTitle}" ===`);
  console.log(`Antes:  ${before.join(", ")}`);
  console.log(`Depois: ${after.join(", ")}`);

  if (APPLY) {
    await updatePriceTableSection(s.id, { contentJson: JSON.stringify(newContent) }, "Jarade Alencar (via Claude Code)");
    console.log("  -> GRAVADO");
  }
}

console.log(`\nTOTAL: ${totalSections} seções ${APPLY ? "gravadas" : "identificadas (simulação, nada gravado)"}.`);

if (APPLY) {
  const metaAfter = await getPriceTableMeta();
  console.log("Nova versão:", metaAfter?.versao);
}

process.exit(0);
