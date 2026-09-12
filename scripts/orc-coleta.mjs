/**
 * Coleta todos os orçamentos do MubiSys (2025 + 2026) e salva um JSON por mês.
 * Resumível: pula meses cuja saída já existe. Roda em segundo plano (~2h).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";

const KEY = process.env.MUBISYS_PUBLIC_KEY;
const TOKEN = process.env.MUBISYS_ACCESS_TOKEN;
const BASE = `https://api.mubisys.com/api/${KEY}`;
const OUT_DIR = path.join(process.cwd(), "scripts", "_orcamentos-raw");
const PER_PAGE = 100;
const TIMEOUT_MS = 150_000;
// A conexão com a API cai com frequência (ENOTFOUND/AbortError) em execuções
// longas. Tentativas com espera crescente absorvem quedas de alguns minutos.
const MAX_TENTATIVAS = 6;
const ESPERA_BASE_MS = 5_000;

fs.mkdirSync(OUT_DIR, { recursive: true });

function ajustarDias(dataISO, dias) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

async function getPagina(datainicial, datafinal, page) {
  const url = `${BASE}/orcamento?status=TODOS&filtrodata=CADASTRO`
    + `&datainicial=${datainicial}&datafinal=${datafinal}`
    + `&per_page=${PER_PAGE}&page=${page}`;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        headers: { "Access-Token": TOKEN, Accept: "application/json" },
        signal: ac.signal,
      });
      if (r.status === 404) return { data: [], pagination: { last_page: 0, total: 0 } };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (tentativa === MAX_TENTATIVAS) throw e;
      const espera = ESPERA_BASE_MS * 2 ** (tentativa - 1);
      console.log(`      tentativa ${tentativa} falhou (${e.name}), repetindo em ${espera / 1000}s...`);
      await new Promise(res => setTimeout(res, espera));
    } finally { clearTimeout(timer); }
  }
}

const meses = [];
for (const ano of [2025, 2026]) {
  for (let m = 1; m <= 12; m++) {
    if (ano === 2026 && m > 9) break;
    meses.push({ ano, mes: m });
  }
}

console.log(`Coletando ${meses.length} meses de orçamentos...\n`);
const t0 = Date.now();
let totalGeral = 0;
const falhados = [];

for (const { ano, mes } of meses) {
  const tag = `${ano}-${String(mes).padStart(2, "0")}`;
  const arquivo = path.join(OUT_DIR, `${tag}.json`);
  if (fs.existsSync(arquivo)) {
    const existente = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    totalGeral += existente.length;
    console.log(`[${tag}] já coletado (${existente.length} registros), pulando.`);
    continue;
  }

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const inicio = `${tag}-01`;
  const fim = `${tag}-${ultimoDia}`;
  // ±1 dia de folga: a API corta registros na borda (ver docs/integracao-mubisys.md)
  const di = ajustarDias(inicio, -1);
  const df = ajustarDias(fim, 1);

  const tMes = Date.now();
  const acumulado = [];
  let page = 1;
  let ultimaPagina = 1;

  // Um mês que falhe não derruba a execução: registra e segue para o próximo.
  // O mês incompleto fica sem arquivo, então a próxima rodada o refaz.
  try {
    do {
      const resp = await getPagina(di, df, page);
      const linhas = resp.data ?? [];
      acumulado.push(...linhas);
      ultimaPagina = resp.pagination?.last_page ?? 1;
      if (linhas.length === 0) break;
      process.stdout.write(`\r[${tag}] página ${page}/${ultimaPagina} — ${acumulado.length} registros`);
      page++;
    } while (page <= ultimaPagina && page <= 60);
  } catch (e) {
    falhados.push(tag);
    console.log(`\r[${tag}] FALHOU na página ${page} (${e.name}) — sem arquivo, será refeito na próxima rodada.`);
    continue;
  }

  // Refiltra pela janela real do mês (descarta a folga de ±1 dia)
  const doMes = acumulado.filter(o => {
    const dia = String(o.data_cadastro ?? "").slice(0, 10);
    return dia >= inicio && dia <= fim;
  });

  fs.writeFileSync(arquivo, JSON.stringify(doMes));
  totalGeral += doMes.length;
  const secs = ((Date.now() - tMes) / 1000).toFixed(0);
  console.log(`\r[${tag}] ${doMes.length} registros salvos (${secs}s) — acumulado: ${totalGeral}          `);
}

console.log(`\nConcluído: ${totalGeral} orçamentos em ${((Date.now()-t0)/60000).toFixed(1)} min.`);
if (falhados.length) console.log(`Meses que falharam (rode de novo): ${falhados.join(", ")}`);
console.log(`Arquivos em: ${OUT_DIR}`);
