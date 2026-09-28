/**
 * Backfill: atribui um ID estável a cada linha de margem (rows[].id, type
 * "margin_table"/"margin_table_multi") e a cada regra (items[].id, type
 * "config") da Tabela de Preços que ainda não tiver um. Usa a mesma
 * normalização aplicada em toda edição pela tela (updatePriceTableSection/
 * addPriceTableSection em server/db/db.ts), via
 * server/integrations/priceTableIds.ts — então o resultado é idêntico ao
 * que aconteceria salvando cada seção manualmente.
 *
 * Roda com UPDATE direto no banco (sem passar por updatePriceTableSection)
 * para não gerar dezenas de entradas triviais em price_table_history e na
 * tabela `metricas` ("Alteração na Tabela de Preços") por uma mudança
 * puramente estrutural, sem alteração de margem/valor de negócio.
 *
 * Uso:
 *   npx tsx scripts/backfill-price-table-ids.mts             # simula (local)
 *   npx tsx scripts/backfill-price-table-ids.mts --apply      # grava (local)
 *   npx tsx scripts/backfill-price-table-ids.mts --prod --apply  # grava em produção
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

const APPLY = process.argv.includes("--apply");

const { getDb } = await import("../server/db/db");
const { priceTableSections } = await import("../drizzle/schema");
const { normalizarIdsTabelaPrecos } =
  await import("../server/integrations/priceTableIds");
const { eq } = await import("drizzle-orm");

const db = await getDb();
if (!db) {
  console.error("Sem conexão com o banco (DATABASE_URL ausente ou inválida).");
  process.exit(1);
}

const todas = await db
  .select()
  .from(priceTableSections)
  .orderBy(priceTableSections.page, priceTableSections.sectionOrder);

function contarSemId(contentJson: string): number {
  try {
    const d = JSON.parse(contentJson);
    const chave =
      d.type === "margin_table" || d.type === "margin_table_multi"
        ? "rows"
        : d.type === "config"
          ? "items"
          : null;
    if (!chave || !Array.isArray(d[chave])) return 0;
    return d[chave].filter(
      (it: any) => !(typeof it?.id === "number" && it.id > 0)
    ).length;
  } catch {
    return 0;
  }
}

// Estado mutável em memória: ao normalizar a seção i, as seções já
// processadas (0..i-1) já têm seus IDs atribuídos, então entram como
// "reservadas" para a próxima — evita colisão de ID entre seções distintas
// nesta mesma rodada.
const estado = todas.map(s => ({
  id: s.id,
  page: s.page,
  sectionTitle: s.sectionTitle,
  contentJsonOriginal: s.contentJson,
  contentJson: s.contentJson,
}));

let totalSecoes = 0;
let totalItens = 0;
for (let i = 0; i < estado.length; i++) {
  const atual = estado[i];
  const semId = contarSemId(atual.contentJson);
  if (semId === 0) continue;
  const outras = estado
    .filter((_, j) => j !== i)
    .map(s => ({ contentJson: s.contentJson }));
  const novo = normalizarIdsTabelaPrecos(atual.contentJson, outras);
  if (novo !== atual.contentJson) {
    totalSecoes++;
    totalItens += semId;
    console.log(
      `id=${atual.id} (page=${atual.page}) "${atual.sectionTitle}" -> ${semId} item(ns) sem ID`
    );
    estado[i] = { ...atual, contentJson: novo };
  }
}

console.log(
  `\nTOTAL: ${totalItens} item(ns) sem ID em ${totalSecoes} de ${estado.length} seções.`
);

if (!APPLY) {
  console.log("Simulação — nada foi gravado. Rode com --apply para persistir.");
  process.exit(0);
}

for (const s of estado) {
  if (s.contentJson !== s.contentJsonOriginal) {
    await db
      .update(priceTableSections)
      .set({ contentJson: s.contentJson })
      .where(eq(priceTableSections.id, s.id));
  }
}
console.log("Gravado.");
process.exit(0);
