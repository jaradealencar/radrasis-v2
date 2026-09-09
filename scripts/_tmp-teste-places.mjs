import dotenv from "dotenv";
dotenv.config({ path: "c:/Users/USUARIO/Documents/dev/radrasis-v2/.env" });

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) throw new Error("GOOGLE_MAPS_API_KEY ausente no .env");

async function buscar(nome) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.businessStatus,places.types,places.location",
    },
    body: JSON.stringify({
      textQuery: nome,
      languageCode: "pt-BR",
      regionCode: "BR",
      locationBias: {
        circle: {
          center: { latitude: -20.4697, longitude: -54.6201 },
          radius: 40000,
        },
      },
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function normaliza(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similaridade(nomeDb, nomePlace) {
  const a = normaliza(nomeDb);
  const b = normaliza(nomePlace);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;
  const wa = new Set(a.split(" ").filter(w => w.length > 2));
  const wb = new Set(b.split(" ").filter(w => w.length > 2));
  if (wa.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / wa.size;
}

async function main() {
  const amostra = ["Patrus", "AWR", "Plimor", "TIB Transportes", "Multilog", "MTR", "Global"];
  for (const nome of amostra) {
    const r = await buscar(nome);
    const places = r.data.places || [];
    console.log("===", nome, `(${places.length} resultados)`, "===");
    for (const p of places.slice(0, 5)) {
      const sim = similaridade(nome, p.displayName?.text);
      const emCG = /Campo Grande/i.test(p.formattedAddress || "");
      console.log(`  sim=${sim.toFixed(2)} emCG=${emCG}  "${p.displayName?.text}" -> ${p.formattedAddress}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
