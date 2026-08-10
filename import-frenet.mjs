/**
 * Importa transportadoras do CSV da Frenet para a tabela `transportadoras`,
 * evitando duplicidades por nome normalizado, e remove a transportadora "Loggi".
 *
 * Uso: node scripts/import-frenet.mjs
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "data/transportadoras_frenet.csv");

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

/**
 * Normaliza o nome para comparação: remove acentos, caixa, pontuação e
 * sufixos de marketplace como "via Frenet", "[Melhor Envio]", "[Frenet]".
 */
function normalizar(nome) {
  return String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\bvia\s+frenet\b/g, " ")
    .replace(/\bvia\s+melhor\s*envio\b/g, " ")
    .replace(/\b(transportes?|transportadora|logistica|log|express|expresso|cargas?|encomendas?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Divide uma linha CSV simples (sem campos com vírgula entre aspas). */
function parseLinha(linha) {
  const partes = linha.split(",");
  if (partes.length <= 3) return partes.map(p => p.trim());
  // Nome pode conter vírgula; junta tudo menos as duas últimas colunas
  const tipo = partes.pop().trim();
  const status = partes.pop().trim();
  return [partes.join(",").trim(), status, tipo];
}

const conteudo = readFileSync(CSV_PATH, "utf8");
const linhas = conteudo.split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim() !== "");
const cabecalho = linhas.shift();
console.log(`CSV lido: ${linhas.length} linhas (cabeçalho: ${cabecalho})`);

const conn = await mysql.createConnection(DATABASE_URL);
console.log("Conectado ao banco.");

// ── 1. Remover Loggi ────────────────────────────────────────────────────────
const [loggiRows] = await conn.query(
  "SELECT id, nome FROM transportadoras WHERE nome = 'Loggi' OR nome LIKE 'Loggi %' OR nome LIKE '%[Loggi]%'",
);
for (const t of loggiRows) {
  await conn.execute("DELETE FROM transportadora_cidades WHERE transportadoraId = ?", [t.id]);
  await conn.execute("DELETE FROM transportadora_filiais WHERE transportadoraId = ?", [t.id]);
  await conn.execute("DELETE FROM transportadora_avaliacoes WHERE transportadoraId = ?", [t.id]);
  await conn.execute("DELETE FROM transportadoras WHERE id = ?", [t.id]);
  console.log(`🗑️  Removida: ${t.nome} (id ${t.id})`);
}
if (loggiRows.length === 0) console.log("ℹ️  Loggi não estava cadastrada.");

// ── 2. Índice de nomes já existentes ────────────────────────────────────────
const [existentes] = await conn.query("SELECT id, nome FROM transportadoras");
const indice = new Map();
for (const t of existentes) {
  const chave = normalizar(t.nome);
  if (chave && !indice.has(chave)) indice.set(chave, t);
}
console.log(`${existentes.length} transportadoras já cadastradas (${indice.size} chaves normalizadas).`);

// ── 3. Importar do CSV ──────────────────────────────────────────────────────
let inseridas = 0;
let ignoradas = 0;
const vistosNoCsv = new Set();

for (const linha of linhas) {
  const [nomeBruto, status, tipo] = parseLinha(linha);
  if (!nomeBruto) continue;

  // Pular Loggi vinda do CSV (usuário pediu para excluir)
  if (normalizar(nomeBruto) === normalizar("Loggi")) {
    console.log("⏭️  Loggi ignorada na importação (exclusão solicitada).");
    continue;
  }

  const chave = normalizar(nomeBruto);
  if (!chave) continue;

  // Duplicidade dentro do próprio CSV
  if (vistosNoCsv.has(chave)) { ignoradas++; continue; }
  vistosNoCsv.add(chave);

  // Já existe no banco
  if (indice.has(chave)) { ignoradas++; continue; }

  const ativa = /ativo/i.test(status) ? "sim" : "sim"; // todas disponíveis são utilizáveis
  const observacoes = `Importada da Frenet — status: ${status || "-"}, tipo de tabela: ${tipo || "-"}`;

  const [res] = await conn.execute(
    `INSERT INTO transportadoras (nome, ativa, coberturaTotal, modais, observacoes)
     VALUES (?, ?, 0, ?, ?)`,
    [nomeBruto, ativa, JSON.stringify(["rodoviario"]), observacoes],
  );
  indice.set(chave, { id: res.insertId, nome: nomeBruto });
  inseridas++;
}

const [[c1]] = await conn.query("SELECT COUNT(*) AS t FROM transportadoras");
console.log("─".repeat(60));
console.log(`✅ Inseridas: ${inseridas}`);
console.log(`⏭️  Ignoradas por duplicidade: ${ignoradas}`);
console.log(`📊 Total no cadastro agora: ${c1.t}`);

await conn.end();
console.log("Concluído.");
