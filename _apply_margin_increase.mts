import "dotenv/config";
import { listPriceTableSections, updatePriceTableSection, getPriceTableMeta } from "./server/db/db";

const GENERAL_DELTA = 3.2;
const EXTRA_DELTA = 5.0;
const SMALL_BRACKET_COLUMN = "Até R$330";
const SMALL_AREA_LABELS = ["Menor que 0,34m²", "Entre 0,35 e 0,60m²", "Entre 0,35 e 0,75m²"];

const TARGET_IDS = [
  // Página 1 / 11 — Frontlight / Galvanizado
  2, 3, 4, 5, 6, 7, 8,
  30002, 30003, 30004, 30005, 30006, 30007, 30008,
  // Página 2 / 12 — Inox / PVC / Acrílico
  10, 11, 12, 13, 14, 15, 16, 30023, 17,
  30010, 30011, 30012, 30013, 30014, 30015, 30016, 30024, 30017,
  // Página 3 / 13 — Pintura
  19, 20, 21,
  30019, 30020, 30021,
];

function bump(raw: string, delta: number): { newVal: string; changed: boolean } {
  const m = /^(-?\d+(?:[.,]\d+)?)%$/.exec(raw.trim());
  if (!m) return { newVal: raw, changed: false };
  const num = parseFloat(m[1].replace(",", "."));
  const bumped = Math.round((num + delta) * 10) / 10;
  const isInt = Math.abs(bumped - Math.round(bumped)) < 0.001;
  const formatted = isInt ? `${Math.round(bumped)}%` : `${bumped.toFixed(1).replace(".", ",")}%`;
  return { newVal: formatted, changed: true };
}

type Row = { label?: string; values?: string[]; value?: string };
type Content = { type?: string; columns?: string[]; rows?: Row[] };

function transform(content: Content): { newContent: Content; diffs: string[] } {
  const diffs: string[] = [];
  const columns = content.columns ?? [];
  const isAreaTable = columns[0] === "Área";
  const newRows: Row[] = (content.rows ?? []).map((row) => {
    const values = row.values ?? (row.value !== undefined ? [row.value] : []);
    const offset = content.type === "margin_table_multi" ? 1 : 0;
    const newValues = values.map((v, j) => {
      const colName = columns[j + offset];
      let extra = 0;
      if (isAreaTable && row.label && SMALL_AREA_LABELS.includes(row.label)) extra = EXTRA_DELTA;
      else if (colName === SMALL_BRACKET_COLUMN) extra = EXTRA_DELTA;
      const { newVal, changed } = bump(v, GENERAL_DELTA + extra);
      if (changed && newVal !== v) {
        diffs.push(`${row.label ?? ""}/${colName ?? ""}: ${v} → ${newVal}`);
      }
      return newVal;
    });
    return row.value !== undefined && row.values === undefined
      ? { ...row, value: newValues[0] }
      : { ...row, values: newValues };
  });
  return { newContent: { ...content, rows: newRows }, diffs };
}

const APPLY = process.argv.includes("--apply");

const meta = await getPriceTableMeta();
console.log("Versão atual:", meta?.versao);

const sections = await listPriceTableSections();
let totalCells = 0;
let totalSections = 0;

for (const id of TARGET_IDS) {
  const s = sections.find((x) => x.id === id);
  if (!s) { console.log(`id=${id} NÃO ENCONTRADO`); continue; }
  let content: Content;
  try { content = JSON.parse(s.contentJson); } catch { console.log(`id=${id} JSON inválido`); continue; }
  const { newContent, diffs } = transform(content);
  if (diffs.length === 0) { console.log(`id=${id} "${s.sectionTitle}" — nenhuma célula numérica alterada`); continue; }
  totalSections++;
  totalCells += diffs.length;
  console.log(`\n=== id=${id} "${s.sectionTitle}" (${diffs.length} células) ===`);
  console.log(diffs.join(" | "));
  if (APPLY) {
    await updatePriceTableSection(id, { contentJson: JSON.stringify(newContent) }, "Jarade Alencar (via Claude Code)");
    console.log("  -> GRAVADO");
  }
}

console.log(`\nTOTAL: ${totalSections} seções, ${totalCells} células alteradas. Modo: ${APPLY ? "APLICADO" : "SIMULAÇÃO (nada gravado)"}`);

if (APPLY) {
  const metaAfter = await getPriceTableMeta();
  console.log("Nova versão:", metaAfter?.versao);
}

process.exit(0);
