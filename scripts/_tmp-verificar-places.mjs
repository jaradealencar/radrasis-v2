import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config({ path: "c:/Users/USUARIO/Documents/dev/radrasis-v2/.env" });

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) throw new Error("GOOGLE_MAPS_API_KEY ausente no .env");

// "transportation_service" e "warehouse" ficam de fora: o Google usa esses
// tipos genéricos também pra ponto de ônibus, estacionamento, terminal etc.
const TIPOS_TRANSPORTE = new Set([
  "moving_company", "shipping_service",
  "courier_service", "trucking_company", "logistics_service",
  "freight_forwarding_service", "delivery_service",
]);

// Exige "Campo Grande" seguido do estado (MS) — não basta a substring, porque
// "Campo Grande" também é bairro em Santos-SP, distrito no Rio de Janeiro etc.
const RE_CAMPO_GRANDE_MS = /Campo Grande\s*[-,]\s*MS\b/i;

function normaliza(s) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
  const wa = a.split(" ").filter(w => w.length > 2);
  if (wa.length >= 2) {
    // nomes com 2+ palavras significativas: contains vale
    if (b.includes(a) || a.includes(b)) return 0.9;
  }
  const wb = new Set(b.split(" ").filter(w => w.length > 2));
  const setA = new Set(wa);
  if (setA.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (wb.has(w)) inter++;
  return inter / setA.size;
}

async function buscar(nome, tentativa = 1) {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.businessStatus,places.types",
      },
      body: JSON.stringify({
        textQuery: nome,
        languageCode: "pt-BR",
        regionCode: "BR",
        locationBias: {
          circle: { center: { latitude: -20.4697, longitude: -54.6201 }, radius: 40000 },
        },
      }),
    });
    if (res.status === 429 && tentativa <= 3) {
      await new Promise(r => setTimeout(r, 800 * tentativa));
      return buscar(nome, tentativa + 1);
    }
    const data = await res.json();
    return data.places || [];
  } catch (e) {
    return { erro: String(e) };
  }
}

function avaliar(nomeDb, places) {
  if (!Array.isArray(places)) return { status: "erro", candidatos: [] };
  const candidatos = places
    .filter(p => RE_CAMPO_GRANDE_MS.test(p.formattedAddress || ""))
    .map(p => ({
      nome: p.displayName?.text,
      endereco: p.formattedAddress,
      types: p.types || [],
      sim: similaridade(nomeDb, p.displayName?.text),
      tipoOk: (p.types || []).some(t => TIPOS_TRANSPORTE.has(t)),
    }))
    .sort((a, b) => b.sim - a.sim);

  const confirmados = candidatos.filter(c => c.tipoOk && c.sim >= 0.6);
  const revisar = candidatos.filter(c => !(c.tipoOk && c.sim >= 0.6));

  if (confirmados.length > 0) {
    return { status: "confirmado", melhor: confirmados[0], candidatos };
  }
  if (revisar.length > 0) {
    return { status: "revisar", candidatos: revisar };
  }
  return { status: "nao_encontrado", candidatos: [] };
}

async function pool(items, worker, concorrencia = 8) {
  const resultados = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      resultados[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concorrencia }, next));
  return resultados;
}

async function main() {
  const lista = JSON.parse(readFileSync(
    "C:/Users/USUARIO/AppData/Local/Temp/claude/c--Users-USUARIO-Documents-dev-radrasis-v2/6d1f6b26-e733-49c9-ac3f-82eaebeb8cb4/scratchpad/lista-sem-endereco.json",
    "utf-8"
  ));

  console.log("Total a verificar:", lista.length);
  let feitos = 0;

  const resultados = await pool(lista, async (item) => {
    const places = await buscar(item.nome);
    const avaliacao = avaliar(item.nome, places);
    feitos++;
    if (feitos % 50 === 0) console.log("progresso:", feitos, "/", lista.length);
    return { id: item.id, nome: item.nome, ...avaliacao };
  }, 8);

  const outPath = "C:/Users/USUARIO/AppData/Local/Temp/claude/c--Users-USUARIO-Documents-dev-radrasis-v2/6d1f6b26-e733-49c9-ac3f-82eaebeb8cb4/scratchpad/resultado-places.json";
  writeFileSync(outPath, JSON.stringify(resultados, null, 2), "utf-8");

  const porStatus = {};
  for (const r of resultados) porStatus[r.status] = (porStatus[r.status] || 0) + 1;
  console.log("Resumo:", porStatus);
  console.log("Salvo em:", outPath);
}
main().catch(e => { console.error(e); process.exit(1); });
