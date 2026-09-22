/**
 * Expande o rótulo "(padrão)" da linha de PVC Expandido (page 2 e page 12,
 * variantes Brasil/MS) para deixar explícito o que conta como "padrão":
 * PVC cru 5/10/15mm, PVC preto 10/15mm e PVC colorido 16mm.
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

const OLD_LABEL = "PVC 20/30mm";
const NEW_LABEL = "PVC 20/30mm branco e preto";

const APPLY = process.argv.includes("--apply");

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
  const hasTarget = rows.some((r) => r.label === OLD_LABEL);
  if (!hasTarget) continue;

  const newRows = rows.map((r) => (r.label === OLD_LABEL ? { ...r, label: NEW_LABEL } : r));
  const newContent: Content = { ...content, rows: newRows };

  totalSections++;
  console.log(`\n=== id=${s.id} (page=${s.page}) "${s.sectionTitle}" ===`);
  console.log(`Rótulo antes: "${OLD_LABEL}"`);
  console.log(`Rótulo depois: "${NEW_LABEL}"`);

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
