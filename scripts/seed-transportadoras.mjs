/**
 * Script de importação das transportadoras da planilha Excel para o banco de dados.
 * Uso: node scripts/seed-transportadoras.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mysql from "mysql2/promise";
import xlsxPkg from "xlsx";
const { readFile: xlsxReadFile, utils: xlsxUtils } = xlsxPkg;
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const XLSX_PATH = "/home/ubuntu/upload/transportadoras_2026-04-29.xlsx";

// ─── Helpers ────────────────────────────────────────────────────────────────
function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}
function boolSim(v) {
  return str(v)?.toLowerCase() === "sim" ? "sim" : "nao";
}
function formaCotacao(v) {
  const s = str(v)?.toLowerCase();
  if (s === "whatsapp") return "whatsapp";
  if (s === "telefone") return "telefone";
  if (s === "email") return "email";
  return "site";
}

// ─── Main ────────────────────────────────────────────────────────────────────
const wb = xlsxReadFile(XLSX_PATH);

// ── Transportadoras ──
const wsT = wb.Sheets["Transportadoras"];
const rowsT = xlsxUtils.sheet_to_json(wsT, { defval: null });

// ── Cidades Atendidas ──
const wsC = wb.Sheets["Cidades Atendidas"];
const rowsC = xlsxUtils.sheet_to_json(wsC, { defval: null });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Limpar tabelas antes de importar
console.log("Limpando tabelas...");
await conn.execute("DELETE FROM transportadora_cidades");
await conn.execute("DELETE FROM transportadoras");

// Mapa: nome original → id gerado no banco
const nomeParaId = {};

console.log(`Importando ${rowsT.length} transportadoras...`);
for (const r of rowsT) {
  const nome = str(r["Nome"]);
  if (!nome) continue;

  // Montar modais como JSON
  const modais = [];
  if (str(r["Modal Avião"])?.toLowerCase() === "sim") modais.push("aereo");
  if (str(r["Modal Caminhão"])?.toLowerCase() === "sim") modais.push("rodoviario");
  if (str(r["Modal Ônibus"])?.toLowerCase() === "sim") modais.push("onibus");

  const [result] = await conn.execute(
    `INSERT INTO transportadoras
      (nome, site, endereco, referencia,
       nomeContato, telefoneContato, whatsappContato,
       nomeContatoNegocial, telefoneContatoNegocial, emailContatoNegocial,
       formaCotacao, modais,
       pesoMaxKg, alturaMaxCm, larguraMaxCm, comprimentoMaxCm, somaMaxCm,
       horarioLimiteColeta, horarioLimiteMercadoria,
       distanciaSedMin, observacoes, ativa)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      nome,
      str(r["Site"]),
      str(r["Endereço"]),
      str(r["Referência"]),
      str(r["Contato Cotação (Nome)"]),
      str(r["Contato Cotação (Telefone)"]),
      str(r["Contato Cotação (WhatsApp)"]),
      str(r["Contato Negocial (Nome)"]),
      str(r["Contato Negocial (Telefone)"]) ?? str(r["Contato Negocial (WhatsApp)"]),
      null, // email negocial não tem coluna separada na planilha
      formaCotacao(r["Forma de Cotação"]),
      modais.length > 0 ? JSON.stringify(modais) : null,
      num(r["Limite Peso (kg)"]),
      num(r["Limite Altura (cm)"]),
      num(r["Limite Largura (cm)"]),
      num(r["Limite Comprimento (cm)"]),
      num(r["Limite Soma Dimensões (cm)"]),
      str(r["Horário Limite Coleta"]),
      str(r["Horário Limite Entrega"]),
      r["Distância Sede (min)"] != null ? parseInt(r["Distância Sede (min)"]) : null,
      str(r["Observações"]),
      boolSim(r["Ativo"]),
    ]
  );

  const insertedId = result.insertId;
  nomeParaId[nome] = insertedId;
  // Também mapear variações com espaços extras
  nomeParaId[nome.trim()] = insertedId;
  console.log(`  ✓ ${nome} → id=${insertedId}`);
}

// ── Cidades Atendidas ──
console.log(`\nImportando ${rowsC.length - 1} cidades atendidas...`);

// Agrupar cidades por transportadora para batch insert
const cidadesPorTransp = {};
for (const r of rowsC) {
  const nomeTransp = str(r["Transportadora"]);
  const cidade = str(r["Cidade"]);
  const estado = str(r["Estado"]);
  if (!nomeTransp || !cidade || !estado) continue;

  // Buscar id pelo nome (tentativa exata e sem espaços extras)
  const id = nomeParaId[nomeTransp] ?? nomeParaId[nomeTransp.trim()];
  if (!id) {
    // Tentar match parcial
    const match = Object.keys(nomeParaId).find(k =>
      k.toLowerCase().includes(nomeTransp.toLowerCase()) ||
      nomeTransp.toLowerCase().includes(k.toLowerCase())
    );
    if (match) {
      if (!cidadesPorTransp[nomeParaId[match]]) cidadesPorTransp[nomeParaId[match]] = [];
      cidadesPorTransp[nomeParaId[match]].push([nomeParaId[match], cidade, estado]);
    } else {
      // silently skip unknown
    }
    continue;
  }
  if (!cidadesPorTransp[id]) cidadesPorTransp[id] = [];
  cidadesPorTransp[id].push([id, cidade, estado]);
}

// Inserir em lotes de 500
let totalCidades = 0;
for (const [transpId, lote] of Object.entries(cidadesPorTransp)) {
  const BATCH = 500;
  for (let i = 0; i < lote.length; i += BATCH) {
    const chunk = lote.slice(i, i + BATCH);
    const placeholders = chunk.map(() => "(?,?,?)").join(",");
    const values = chunk.flat();
    await conn.execute(
      `INSERT INTO transportadora_cidades (transportadoraId, cidade, estado) VALUES ${placeholders}`,
      values
    );
    totalCidades += chunk.length;
  }
}
console.log(`  ✓ ${totalCidades} cidades inseridas`);

await conn.end();
console.log("\n✅ Importação concluída com sucesso!");
