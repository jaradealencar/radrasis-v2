import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { redesenharLetreiro, type EscopoRedesenho } from "../services/letraCaixaRedesign";

// Testa o redesenho de letreiro (Prompt 1) contra a API real da OpenAI.
// Uso: tsx server/scripts/testar-redesenho-letreiro.ts <caminho da foto> [logo|letreiro]
//   logo      -> escopo "somente_logo" (padrão)
//   letreiro  -> escopo "letreiro_completo"
const [, , fotoPath, escopoArg] = process.argv;

if (!fotoPath) {
  console.error(
    "Uso: tsx server/scripts/testar-redesenho-letreiro.ts <caminho da foto> [logo|letreiro]",
  );
  process.exit(1);
}

const ext = extname(fotoPath).toLowerCase();
const mime =
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
const escopo: EscopoRedesenho = escopoArg === "letreiro" ? "letreiro_completo" : "somente_logo";

console.log(`Redesenhando "${fotoPath}" (escopo: ${escopo})...`);

const resultado = await redesenharLetreiro({
  imageBuffer: readFileSync(fotoPath),
  imageFilename: basename(fotoPath),
  imageMimeType: mime,
  escopo,
});

const outPath = fotoPath.slice(0, -ext.length) + "-redesenho.png";
writeFileSync(outPath, resultado.imageBuffer);

console.log("Salvo localmente em:", outPath);
console.log("URL pública (UploadThing):", resultado.url);
