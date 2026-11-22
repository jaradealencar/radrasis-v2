import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const htmlPath = join(__dirname, "..", "artifacts", "analise-completa-2025-2026.html");
  const pdfPath = join(__dirname, "..", "artifacts", "analise-completa-2025-2026.pdf");

  if (!existsSync(htmlPath)) {
    console.error("HTML não encontrado:", htmlPath);
    process.exit(1);
  }

  console.log("Abrindo HTML:", htmlPath);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Carregar arquivo local
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });

  // Aguardar fontes e renderização
  await new Promise(r => setTimeout(r, 2000));

  // Gerar PDF
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log("✅ PDF gerado:", pdfPath);
}

main().catch(e => { console.error(e); process.exit(1); });