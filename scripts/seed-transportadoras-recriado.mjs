/**
 * Popula as tabelas `transportadoras` e `transportadora_cidades` com as 41
 * transportadoras do sistema original (https://retrabctrl-7bbgkjkd.manus.space).
 *
 * Uso: node scripts/seed-transportadoras-recriado.mjs
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const txt = readFileSync(join(__dirname, "../.env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  } catch {}
  return null;
}

const DATABASE_URL = loadDatabaseUrl();
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido");
  process.exit(1);
}

// nome, modal, ativa, coberturaTotal
const TRANSPORTADORAS = [
  ["Alfa Transportes", "rodoviario", "sim", 0],
  ["Andorinha", "rodoviario", "sim", 0],
  ["APT Logística", "rodoviario", "sim", 0],
  ["Atual Cargas", "rodoviario", "sim", 0],
  ["Azul Cargo", "aereo", "sim", 1],
  ["Braspress", "rodoviario", "sim", 1],
  ["Carvalima", "rodoviario", "sim", 1],
  ["Condex", "rodoviario", "sim", 0],
  ["Correios (PAC/SEDEX)", "rodoviario", "sim", 1],
  ["Eucatur", "rodoviario", "sim", 0],
  ["Favorita Transportes", "rodoviario", "sim", 0],
  ["Gollog", "aereo", "sim", 1],
  ["Gontijo", "rodoviario", "sim", 0],
  ["Guerino", "rodoviario", "sim", 0],
  ["J&T Express", "rodoviario", "sim", 1],
  ["Jadlog", "rodoviario", "sim", 1],
  ["KM Transportes", "rodoviario", "sim", 0],
  ["LATAM Cargo", "aereo", "sim", 1],
  ["Lontano", "rodoviario", "nao", 0],
  ["Martins Transportes", "rodoviario", "sim", 0],
  ["Mira Transportes", "rodoviario", "sim", 0],
  ["ML. R. Teófilo Otoni", "rodoviario", "sim", 0],
  ["Motta", "rodoviario", "sim", 0],
  ["MVS", "rodoviario", "nao", 0],
  ["Penha", "onibus", "sim", 0],
  ["Potenza Transportes", "rodoviario", "sim", 0],
  ["Rodomaior", "rodoviario", "sim", 0],
  ["Rodonaves [Carvalima]", "rodoviario", "sim", 0],
  ["Solidez", "rodoviario", "sim", 0],
  ["TodoBrasil", "rodoviario", "sim", 0],
  ["TodoBrasil - Transporte e Logística", "rodoviario", "sim", 0],
  ["Translog Transportes", "rodoviario", "sim", 0],
  ["Unesul", "rodoviario", "sim", 0],
  ["União Express", "rodoviario", "sim", 0],
  ["Valtur", "rodoviario", "sim", 0],
  ["Viopex", "rodoviario", "sim", 0],
  ["Vitlog", "rodoviario", "sim", 0],
];

// Cobertura por cidade (transportadoras regionais).
// Cidade → lista de transportadoras que atendem.
const COBERTURA = {
  "ANDRADINA/SP": ["Andorinha", "Motta", "KM Transportes", "Guerino", "Atual Cargas", "Viopex"],
  "CAMPINAS/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "KM Transportes", "Viopex", "Solidez", "Alfa Transportes", "Motta"],
  "SAO PAULO/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "Alfa Transportes", "Viopex", "Solidez", "KM Transportes", "Condex", "Vitlog"],
  "SÃO PAULO/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "Alfa Transportes", "Viopex", "Solidez", "KM Transportes", "Condex", "Vitlog"],
  "SANTOS/SP": ["Atual Cargas", "Viopex", "Alfa Transportes", "KM Transportes"],
  "RIBEIRAO PRETO/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "Viopex", "Motta"],
  "RIBEIRÃO PRETO/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "Viopex", "Motta"],
  "SOROCABA/SP": ["Atual Cargas", "Rodonaves [Carvalima]", "Viopex", "Alfa Transportes"],
  "BAURU/SP": ["Atual Cargas", "Viopex", "Motta", "KM Transportes"],
  "PRESIDENTE PRUDENTE/SP": ["Andorinha", "Motta", "Atual Cargas", "Viopex"],
  "ARACATUBA/SP": ["Andorinha", "Motta", "Atual Cargas", "Guerino"],
  "ARAÇATUBA/SP": ["Andorinha", "Motta", "Atual Cargas", "Guerino"],
  "RIO DE JANEIRO/RJ": ["Atual Cargas", "Viopex", "Penha", "Condex", "Vitlog"],
  "BELO HORIZONTE/MG": ["Atual Cargas", "Viopex", "Gontijo", "ML. R. Teófilo Otoni", "Vitlog"],
  "CURITIBA/PR": ["Atual Cargas", "Viopex", "Unesul", "Eucatur", "Alfa Transportes"],
  "PORTO ALEGRE/RS": ["Atual Cargas", "Unesul", "Viopex", "União Express"],
  "SALVADOR/BA": ["Atual Cargas", "Viopex", "Mira Transportes", "União Express"],
  "RECIFE/PE": ["Atual Cargas", "Viopex", "União Express"],
  "FORTALEZA/CE": ["Atual Cargas", "Viopex", "União Express"],
  "BRASILIA/DF": ["Atual Cargas", "Viopex", "Mira Transportes", "Gontijo"],
  "BRASÍLIA/DF": ["Atual Cargas", "Viopex", "Mira Transportes", "Gontijo"],
  "GOIANIA/GO": ["Atual Cargas", "Viopex", "Mira Transportes"],
  "GOIÂNIA/GO": ["Atual Cargas", "Viopex", "Mira Transportes"],
  "CUIABA/MT": ["Eucatur", "Atual Cargas", "Viopex", "Andorinha"],
  "CUIABÁ/MT": ["Eucatur", "Atual Cargas", "Viopex", "Andorinha"],
  "CAMPO GRANDE/MS": ["Andorinha", "Motta", "Eucatur", "Atual Cargas", "Viopex"],
  "FLORIANOPOLIS/SC": ["Atual Cargas", "Unesul", "Viopex"],
  "FLORIANÓPOLIS/SC": ["Atual Cargas", "Unesul", "Viopex"],
  "VITORIA/ES": ["Atual Cargas", "Viopex", "ML. R. Teófilo Otoni"],
  "VITÓRIA/ES": ["Atual Cargas", "Viopex", "ML. R. Teófilo Otoni"],
  "MANAUS/AM": ["Eucatur", "Atual Cargas"],
  "BELEM/PA": ["Atual Cargas", "Viopex"],
  "BELÉM/PA": ["Atual Cargas", "Viopex"],
};

const conn = await mysql.createConnection(DATABASE_URL);
console.log("Conectado ao banco.");

// Limpar tabelas
await conn.execute("DELETE FROM transportadora_cidades");
await conn.execute("DELETE FROM transportadoras");
console.log("Tabelas limpas.");

// Inserir transportadoras
const idPorNome = {};
for (const [nome, modal, ativa, coberturaTotal] of TRANSPORTADORAS) {
  const [res] = await conn.execute(
    "INSERT INTO transportadoras (nome, modais, ativa, coberturaTotal) VALUES (?, ?, ?, ?)",
    [nome, JSON.stringify([modal]), ativa, coberturaTotal],
  );
  idPorNome[nome] = res.insertId;
}
console.log(`${TRANSPORTADORAS.length} transportadoras inseridas.`);

// Inserir cobertura de cidades
let totalCidades = 0;
for (const [chave, nomes] of Object.entries(COBERTURA)) {
  const [cidade, estado] = chave.split("/");
  for (const nome of nomes) {
    const tid = idPorNome[nome];
    if (!tid) { console.warn(`Transportadora não encontrada: ${nome}`); continue; }
    await conn.execute(
      "INSERT INTO transportadora_cidades (transportadoraId, cidade, estado) VALUES (?, ?, ?)",
      [tid, cidade, estado],
    );
    totalCidades++;
  }
}
console.log(`${totalCidades} registros de cobertura inseridos.`);

const [[c1]] = await conn.query("SELECT COUNT(*) AS t FROM transportadoras");
const [[c2]] = await conn.query("SELECT COUNT(*) AS t FROM transportadora_cidades");
console.log(`Total final: ${c1.t} transportadoras, ${c2.t} cidades.`);

await conn.end();
console.log("Concluído.");
