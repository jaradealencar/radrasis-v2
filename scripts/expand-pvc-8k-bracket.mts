/**
 * Estende a última faixa "R$4.8k+" das seções "PVC Expandido" (page 2 e page 12,
 * variantes Brasil/MS) para "R$4.8k~8.000" mantendo os percentuais atuais, e cria
 * uma nova faixa "R$8k+" com margem 0% em todas as linhas.
 */
import "dotenv/config";
import { listPriceTableSections, updatePriceTableSection, getPriceTableMeta } from "../server/db/db";

const TITLE_MATCH = "PVC (5/10/15/16mm) de todas as cores e acrílico e ACM";
const OLD_LAST_COLUMN = "R$4.8k+";
const NEW_LAST_COLUMN = "R$4.8k~8.000";
const NEW_FINAL_COLUMN = "R$8k+";

// id=16 (page 2, Clientes Brasil) está 1pp abaixo do valor confirmado pelo usuário
// (print de tela) na última coluna — corrige antes de estender a faixa.
const LAST_COLUMN_OVERRIDE_DELTA: Record<number, number> = { 16: 1 };

type Row = { label?: string; values?: string[] };
type Content = { type?: string; columns?: string[]; rows?: Row[] };

function bumpPercent(raw: string, delta: number): string {
  const m = /^(-?\d+(?:[.,]\d+)?)%$/.exec(raw.trim());
  if (!m) return raw;
  const num = parseFloat(m[1].replace(",", ".")) + delta;
  const isInt = Math.abs(num - Math.round(num)) < 0.001;
  return isInt ? `${Math.round(num)}%` : `${num.toFixed(1).replace(".", ",")}%`;
}

const APPLY = process.argv.includes("--apply");

const meta = await getPriceTableMeta();
console.log("Versão atual:", meta?.versao);

const sections = await listPriceTableSections();
const targets = sections.filter((s) => s.sectionTitle.includes(TITLE_MATCH));

console.log(`\nEncontradas ${targets.length} seções com título contendo "${TITLE_MATCH}"`);

let totalSections = 0;

for (const s of targets) {
  let content: Content;
  try {
    content = JSON.parse(s.contentJson);
  } catch {
    console.log(`id=${s.id} "${s.sectionTitle}" — JSON inválido, pulando`);
    continue;
  }

  const columns = content.columns ?? [];
  if (columns[columns.length - 1] !== OLD_LAST_COLUMN) {
    console.log(`id=${s.id} "${s.sectionTitle}" — última coluna não é "${OLD_LAST_COLUMN}" (é "${columns[columns.length - 1]}"), pulando`);
    continue;
  }

  const delta = LAST_COLUMN_OVERRIDE_DELTA[s.id] ?? 0;
  const newColumns = [...columns.slice(0, -1), NEW_LAST_COLUMN, NEW_FINAL_COLUMN];
  const newRows: Row[] = (content.rows ?? []).map((row) => {
    const values = row.values ?? [];
    const keptLast = delta !== 0 && values.length > 0
      ? bumpPercent(values[values.length - 1], delta)
      : values[values.length - 1];
    return {
      ...row,
      values: [...values.slice(0, -1), keptLast, "0%"],
    };
  });
  const newContent: Content = { ...content, columns: newColumns, rows: newRows };

  totalSections++;
  console.log(`\n=== id=${s.id} (page=${s.page}) "${s.sectionTitle}" ===`);
  console.log(`Colunas antes: ${JSON.stringify(columns)}`);
  console.log(`Colunas depois: ${JSON.stringify(newColumns)}`);
  for (const row of newRows) {
    console.log(`  ${row.label}: ${row.values?.join(", ")}`);
  }

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
