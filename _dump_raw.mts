import "dotenv/config";
import { listPriceTableSections } from "./server/db/db";

const sections = await listPriceTableSections();
const ids = [2, 16, 19, 21, 8];
for (const id of ids) {
  const s = sections.find(x => x.id === id);
  if (!s) { console.log(id, "NOT FOUND"); continue; }
  console.log(`=== id=${id} title="${s.sectionTitle}" ===`);
  console.log(s.contentJson);
  console.log("");
}
process.exit(0);
