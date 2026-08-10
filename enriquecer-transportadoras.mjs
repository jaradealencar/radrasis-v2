/**
 * Enriquece o cadastro de transportadoras com os dados do JSON fornecido
 * (transportadoras_radrasys.json — 58 registros).
 *
 * Regras:
 * - Casa por nome normalizado com o registro existente; se não existir, cria.
 * - NUNCA sobrescreve um valor já preenchido no banco (só completa vazios).
 * - Grava origem (Frenet/Manual), telefone, email, site, endereço, bairro, cep, cidade, uf.
 * - Importa cidadesAtendidas para transportadora_cidades sem duplicar.
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const JSON_PATH = process.argv[2] || '/home/ubuntu/upload/transportadoras_radrasys.json';

function normalizar(nome) {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\bvia\s+frenet\b/g, ' ')
    .replace(/\bvia\s+melhor\s*envio\b/g, ' ')
    .replace(/\b(transportes?|transportadora|logistica|log|express|expresso|cargas?|encomendas?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const MODAL_MAP = { Rodoviario: 'rodoviario', Aereo: 'aereo', Onibus: 'onibus' };

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('✅ Conectado ao banco');

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const lista = Array.isArray(raw) ? raw : raw.transportadoras ?? [];
console.log(`📦 ${lista.length} transportadoras no JSON`);

const [existentes] = await conn.query('SELECT id, nome FROM transportadoras');
const indice = new Map();
for (const t of existentes) {
  const chave = normalizar(t.nome);
  if (chave && !indice.has(chave)) indice.set(chave, t.id);
}
console.log(`🗂️  ${existentes.length} registros já no banco`);

let atualizados = 0;
let criados = 0;
let cidadesInseridas = 0;

for (const t of lista) {
  const nome = String(t.nome ?? '').trim();
  if (!nome) continue;
  if (normalizar(nome) === 'loggi') { console.log('⏭️  Loggi ignorada'); continue; }

  const chave = normalizar(nome);
  let id = indice.get(chave);

  const modal = MODAL_MAP[t.modal] ?? 'rodoviario';
  const modaisJson = JSON.stringify([modal]);
  const ativa = t.ativa ? 'sim' : 'nao';
  const origem = t.origem ?? 'Manual';

  if (!id) {
    const [res] = await conn.execute(
      `INSERT INTO transportadoras
         (nome, site, endereco, bairro, cep, cidade, uf, cnpj, telefoneContato,
          emailContatoNegocial, modais, ativa, origem, observacoes, formaCotacao, coberturaTotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'site', 0)`,
      [
        nome, t.site ?? null, t.endereco ?? null, t.bairro ?? null, t.cep ?? null,
        t.cidade ?? null, t.uf ?? null, t.cnpj ?? null, t.telefone ?? null,
        t.email ?? null, modaisJson, ativa, origem, t.observacoes ?? null,
      ],
    );
    id = res.insertId;
    indice.set(chave, id);
    criados++;
  } else {
    // COALESCE + NULLIF: só preenche o que estiver vazio no banco
    await conn.execute(
      `UPDATE transportadoras SET
         site                 = COALESCE(NULLIF(TRIM(site), ''), ?),
         endereco             = COALESCE(NULLIF(TRIM(endereco), ''), ?),
         bairro               = COALESCE(NULLIF(TRIM(bairro), ''), ?),
         cep                  = COALESCE(NULLIF(TRIM(cep), ''), ?),
         cidade               = COALESCE(NULLIF(TRIM(cidade), ''), ?),
         uf                   = COALESCE(NULLIF(TRIM(uf), ''), ?),
         cnpj                 = COALESCE(NULLIF(TRIM(cnpj), ''), ?),
         telefoneContato      = COALESCE(NULLIF(TRIM(telefoneContato), ''), ?),
         emailContatoNegocial = COALESCE(NULLIF(TRIM(emailContatoNegocial), ''), ?),
         observacoes          = COALESCE(NULLIF(TRIM(observacoes), ''), ?),
         origem               = ?,
         ativa                = ?
       WHERE id = ?`,
      [
        t.site ?? null, t.endereco ?? null, t.bairro ?? null, t.cep ?? null,
        t.cidade ?? null, t.uf ?? null, t.cnpj ?? null, t.telefone ?? null,
        t.email ?? null, t.observacoes ?? null, origem, ativa, id,
      ],
    );
    atualizados++;
  }

  // Cidades atendidas (sem duplicar)
  const cidades = Array.isArray(t.cidadesAtendidas) ? t.cidadesAtendidas : [];
  for (const c of cidades) {
    const cidade = String(c.cidade ?? '').trim();
    const uf = String(c.uf ?? '').trim().toUpperCase();
    if (!cidade || !uf) continue;
    const [dup] = await conn.execute(
      'SELECT id FROM transportadora_cidades WHERE transportadoraId = ? AND cidade = ? AND estado = ? LIMIT 1',
      [id, cidade, uf],
    );
    if (dup.length > 0) continue;
    await conn.execute(
      'INSERT INTO transportadora_cidades (transportadoraId, cidade, estado) VALUES (?, ?, ?)',
      [id, cidade, uf],
    );
    cidadesInseridas++;
  }
}

const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM transportadoras');
const [[{ comContato }]] = await conn.query(
  "SELECT COUNT(*) AS comContato FROM transportadoras WHERE TRIM(COALESCE(telefoneContato,'')) <> ''",
);

console.log('─'.repeat(50));
console.log(`✅ Criadas:            ${criados}`);
console.log(`✅ Enriquecidas:       ${atualizados}`);
console.log(`✅ Cidades inseridas:  ${cidadesInseridas}`);
console.log(`📊 Total no cadastro:  ${total}`);
console.log(`📞 Com telefone:       ${comContato}`);

await conn.end();
