#!/usr/bin/env node
/**
 * Compara o relatório de Vendas mais recente baixado do MubiSys (pasta Downloads)
 * com o que o endpoint público performanceComercial.getMes de produção está servindo.
 *
 * Existe porque o dashboard de Performance Comercial cai silenciosamente para um
 * fallback local (historico_os, desatualizado) sempre que a API MubiSys demora mais
 * que o timeout de 45s — o que acontece com alguma frequência perto do fim do mês
 * (mais dados para buscar = mais lento). Nesse estado o card mostra números presos
 * a um instante passado sem nenhum aviso óbvio além do badge "API INDISPONÍVEL —
 * dados locais" no topo da tela. Ver memória de projeto
 * performance_comercial_cache_bugs_2026_09 / conversa de 2026-09-25.
 *
 * Uso: node comparar.js [mes] [ano]
 *   mes/ano — padrão: mês/ano atuais (America/Sao_Paulo)
 *
 * O QUE FAZ:
 *  1. Acha o relatório "Resultado_*.xlsx" mais recente na pasta Downloads do usuário.
 *  2. Recalcula localmente Faturamento / Qtd OS válidas / Clientes únicos a partir das
 *     linhas de O.S. (mesma regra do sistema: exclui status "Cancelada" e, quando a
 *     coluna Tipo O.S. vem preenchida no relatório, também Retrabalho/Amostra/Cortesia).
 *  3. Confere esse cálculo contra a própria linha "Totalização" do rodapé do arquivo
 *     (é auto-conferência: se não bater, o parser está errado, não o sistema).
 *  4. Chama performanceComercial.getMes em produção com forceRefresh:true (pode levar
 *     até 45s — é o mesmo timeout que o próprio endpoint usa) e compara osGeradas /
 *     faturamento / clientesUnicos com o que veio do arquivo.
 *
 * LIMITAÇÃO CONHECIDA: performanceComercial.getClientesNovos é protectedProcedure
 * (exige sessão logada) — não dá pra chamar de fora do browser. Este script usa
 * clientesUnicos (de getMes, publicProcedure) como proxy de conferência; para
 * conferir "Clientes Novos"/"Reativados" de verdade, é preciso clicar em "Atualizar"
 * na própria tela logada (client/src/pages/comercial/PerformanceComercial.tsx).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECT_ROOT = "C:/Users/USUARIO/Documents/dev/radrasis-v2";
const PROD_BASE_URL = "https://radrasis-v2.vercel.app";
const DOWNLOADS_DIR = path.join(os.homedir(), "Downloads");

const XLSX = require(path.join(PROJECT_ROOT, "node_modules", "xlsx"));

function agoraBrasilia() {
  // Aproximação simples (UTC-3, sem DST no Brasil desde 2019) — suficiente para
  // escolher mês/ano padrão, não para cálculos de precisão de horário.
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function parseArgs() {
  const now = agoraBrasilia();
  const mes = process.argv[2] ? parseInt(process.argv[2], 10) : now.getUTCMonth() + 1;
  const ano = process.argv[3] ? parseInt(process.argv[3], 10) : now.getUTCFullYear();
  return { mes, ano };
}

/** Acha o Resultado_*.xlsx mais recente (por mtime) na pasta Downloads. Não filtra
 * por mês/ano no nome do arquivo — o padrão observado (Resultado_<id>_<mes>_<ano>.xlsx)
 * não é garantido, então confiamos em "o mais recente baixado" + no usuário ter
 * acabado de baixar o relatório certo antes de rodar isto. */
function acharRelatorioMaisRecente() {
  const candidatos = fs.readdirSync(DOWNLOADS_DIR)
    .filter(f => /^Resultado_.*\.xlsx$/i.test(f))
    .map(f => {
      const full = path.join(DOWNLOADS_DIR, f);
      return { full, name: f, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (candidatos.length === 0) {
    throw new Error(`Nenhum arquivo "Resultado_*.xlsx" encontrado em ${DOWNLOADS_DIR}. Baixe o relatório de Vendas do período desejado no MubiSys primeiro.`);
  }
  return candidatos[0];
}

// Formato do relatório MubiSys é en-US: vírgula = separador de milhar, ponto = decimal
// (ex: "R$ 3,500.00"), diferente do formato pt-BR usado no resto do sistema.
function parseMoneyUS(v) {
  if (v == null || v === "") return 0;
  const s = String(v).replace("R$", "").replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeEmpresaKey(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Mesma regra de isOsNormalDb/isOsNormalApi do sistema (server/routers/performanceComercial.ts):
 * exclui status Cancelada e tipo Retrabalho / Amostra / Cortesia. O relatório de Vendas do
 * MubiSys frequentemente vem com a coluna "Tipo O.S." vazia (não lista retrabalho/amostra/
 * cortesia nesse relatório específico) — nesse caso o filtro de tipo não teria efeito, o que
 * é esperado, não um bug do script. */
function isOsValida(tipo, status) {
  const t = (tipo ?? "").toLowerCase().trim();
  const s = (status ?? "").toLowerCase().trim();
  if (t.startsWith("retrabalho")) return false;
  if (t === "amostra") return false;
  if (t === "cortesia") return false;
  if (s === "cancelada") return false;
  return true;
}

function lerRelatorio(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  // Acha a linha de cabeçalho procurando "Empresa" numa das primeiras linhas, em vez de
  // assumir índice fixo — o relatório tem uma linha de título (data do período) antes.
  let headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "Empresa"));
  if (headerRowIdx === -1) throw new Error('Linha de cabeçalho ("Empresa") não encontrada no relatório — formato pode ter mudado.');
  const header = rows[headerRowIdx].map(h => String(h).trim());
  const idx = (nome) => header.indexOf(nome);
  const colTipo = idx("Tipo O.S.");
  const colEmpresa = idx("Empresa");
  const colStatus = idx("Status");
  const colValorOs = idx("Valor O.S.");
  if ([colEmpresa, colStatus, colValorOs].includes(-1)) {
    throw new Error(`Colunas esperadas não encontradas. Header lido: ${JSON.stringify(header)}`);
  }

  let osValidas = 0;
  let faturamento = 0;
  const clientes = new Set();
  let totalizacaoFaturamento = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const empresa = String(r[colEmpresa] ?? "").trim();
    // Linha de rodapé "Totalização" — parar de contar como O.S. e extrair o valor oficial
    // dela para autoconferência (fica numa coluna deslocada, sempre buscamos "Faturamento"
    // como rótulo em qualquer coluna da linha, valor na coluna seguinte).
    const rotuloIdx = r.findIndex(c => String(c).trim() === "Faturamento");
    if (rotuloIdx !== -1 && !empresa) {
      totalizacaoFaturamento = parseMoneyUS(r[rotuloIdx + 1]);
      continue;
    }
    if (!empresa) continue; // linha vazia ou de outro bloco do rodapé
    const tipo = colTipo !== -1 ? r[colTipo] : "";
    const status = r[colStatus];
    if (!isOsValida(tipo, status)) continue;
    osValidas++;
    faturamento += parseMoneyUS(r[colValorOs]);
    clientes.add(normalizeEmpresaKey(empresa));
  }

  return {
    osValidas,
    faturamento: Math.round(faturamento * 100) / 100,
    clientesUnicos: clientes.size,
    totalizacaoFaturamento,
  };
}

async function buscarGetMesProducao(mes, ano) {
  const input = encodeURIComponent(JSON.stringify({ json: { mes, ano, forceRefresh: true } }));
  const url = `${PROD_BASE_URL}/api/trpc/performanceComercial.getMes?input=${input}`;
  console.log(`\nConsultando ${url}\n(forceRefresh:true — a API MubiSys pode levar até ~45s; isso é esperado)...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
    return body.result.data.json;
  } finally {
    clearTimeout(timeout);
  }
}

function fmtBrl(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  const { mes, ano } = parseArgs();
  const arquivo = acharRelatorioMaisRecente();
  console.log(`Relatório usado: ${arquivo.name} (baixado em ${new Date(arquivo.mtime).toLocaleString("pt-BR")})`);
  console.log(`Conferindo contra mês ${mes}/${ano}\n`);

  const doArquivo = lerRelatorio(arquivo.full);
  console.log("── Do relatório MubiSys (recalculado localmente) ──");
  console.log(`OS válidas:       ${doArquivo.osValidas}`);
  console.log(`Faturamento:      ${fmtBrl(doArquivo.faturamento)}`);
  console.log(`Clientes únicos:  ${doArquivo.clientesUnicos}`);
  if (doArquivo.totalizacaoFaturamento != null) {
    const bate = Math.abs(doArquivo.totalizacaoFaturamento - doArquivo.faturamento) < 0.01;
    console.log(`Autoconferência (Totalização "Faturamento" do rodapé): ${fmtBrl(doArquivo.totalizacaoFaturamento)} ${bate ? "✅ bate com o recalculado" : "⚠️ NÃO bate — revisar regra do parser antes de confiar no resultado"}`);
  }

  let doSistema;
  try {
    doSistema = await buscarGetMesProducao(mes, ano);
  } catch (err) {
    console.error(`\n❌ Não foi possível consultar o endpoint de produção: ${err.message}`);
    console.error("A API MubiSys pode estar indisponível agora — tente de novo em alguns minutos.");
    process.exit(1);
  }

  console.log(`\n── Do sistema (performanceComercial.getMes, forceRefresh) ──`);
  console.log(`Fonte dos dados:  ${doSistema._origemDados === "api" ? "✅ api (ao vivo)" : `⚠️ ${doSistema._origemDados} (NÃO é ao vivo — API MubiSys deve ter falhado; resultado abaixo não é confiável)`}`);
  console.log(`OS geradas:       ${doSistema.osGeradas}`);
  console.log(`Faturamento:      ${fmtBrl(doSistema.faturamento)}`);
  console.log(`Clientes únicos:  ${doSistema.clientesUnicos}`);

  console.log(`\n── Diferença (sistema − relatório) ──`);
  console.log(`OS:               ${doSistema.osGeradas - doArquivo.osValidas}`);
  console.log(`Faturamento:      ${fmtBrl(doSistema.faturamento - doArquivo.faturamento)}`);
  console.log(`Clientes únicos:  ${doSistema.clientesUnicos - doArquivo.clientesUnicos}`);
  console.log(`\nDiferenças pequenas (poucas OS/poucos reais) são esperadas se o relatório foi baixado antes da última venda aprovada. Diferenças grandes com "_origemDados" != "api" confirmam fallback local desatualizado — não é bug de regra de negócio.`);
  console.log(`\nNOTA: "Clientes Novos"/"Reativados" (getClientesNovos) exige login e não pôde ser conferido por este script — clique em "Atualizar" na tela logada para esses números.`);
}

main().catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});
