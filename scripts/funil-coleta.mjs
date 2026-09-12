/**
 * Coleta todos os cards do Funil de Vendas do MubiSys e salva um JSON por
 * fase/status. Resumível: pula arquivos que já existem.
 *
 * Por que esta fonte e não `orcamento`: o card do funil traz `status` com
 * "Ganhou"/"Perdeu" explícito — a tabela de orçamentos só tem "Em aberto"
 * e "Aprovado", sem marcar perda. Traz também `classificacao` (Agência,
 * Revenda), `origem` e o histórico de `interacoes`, que permitem medir
 * conversão por segmento e por intensidade de follow-up.
 *
 * O motivo da perda NÃO vem: o registro de perda tem título fixo
 * "Perdeu negócio:" e o campo de observação nunca é preenchido.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";

const KEY = process.env.MUBISYS_PUBLIC_KEY;
const TOKEN = process.env.MUBISYS_ACCESS_TOKEN;
const BASE = `https://api.mubisys.com/api/${KEY}`;
const OUT_DIR = path.join(process.cwd(), "scripts", "_funil-raw");
const PER_PAGE = 200;
const TIMEOUT_MS = 150_000;
// A conexão com a API cai com frequência (ENOTFOUND/AbortError) em execuções
// longas. Tentativas com espera crescente absorvem quedas de alguns minutos.
const MAX_TENTATIVAS = 6;
const ESPERA_BASE_MS = 5_000;
const MAX_PAGINAS = 400;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function get(caminho) {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${BASE}/${caminho}`, {
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

// ── Descobre grupos e fases ────────────────────────────────────────────
console.log("Descobrindo estrutura do funil...\n");
const grupos = (await get("funil-vendas-grupo")).data ?? [];

const alvos = [];
for (const g of grupos) {
  const fases = (await get(`funil-vendas-fase/grupo/${g.id}`)).data ?? [];
  console.log(`Grupo ${g.id} "${g.nome}" (${g.status}): ${fases.length} fases — ${fases.map(f => f.nome).join(", ")}`);
  for (const f of fases) {
    for (const status of ["ATIVO", "INATIVO"]) {
      alvos.push({ grupo: g.id, grupoNome: g.nome, fase: f.id, faseNome: f.nome, status });
    }
  }
}

console.log(`\n${alvos.length} combinações de fase/status para coletar.\n`);
const t0 = Date.now();
let totalGeral = 0;
const falhados = [];

for (const a of alvos) {
  const tag = `g${a.grupo}-f${a.fase}-${a.status}`;
  const arquivo = path.join(OUT_DIR, `${tag}.json`);
  const rotulo = `${a.grupoNome}/${a.faseNome}/${a.status}`;

  if (fs.existsSync(arquivo)) {
    const existente = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    totalGeral += existente.length;
    console.log(`[${tag}] já coletado (${existente.length} cards), pulando.`);
    continue;
  }

  const tFase = Date.now();
  const acumulado = [];
  let page = 1;
  let ultimaPagina = 1;

  // Uma fase que falhe não derruba a execução: fica sem arquivo e a próxima
  // rodada a refaz.
  try {
  do {
    const resp = await get(
      `funil-vendas-card?grupo_id=${a.grupo}&fase_id=${a.fase}&status=${a.status}`
      + `&per_page=${PER_PAGE}&page=${page}`
    );
    const linhas = resp.data ?? [];
    if (linhas.length === 0) break;
    // Guarda só o que interessa para a análise — o payload bruto é enorme
    for (const c of linhas) {
      acumulado.push({
        id: c.id,
        grupo: a.grupoNome,
        fase: a.faseNome,
        statusLista: a.status,
        status: c.status,
        cliente: c.nome_cliente ?? c.cliente?.nome ?? "",
        clienteId: c.cliente?.id ?? null,
        classificacao: c.classificacao?.nome ?? "",
        origem: c.origem?.nome ?? "",
        titulo: c.titulo ?? "",
        valor: Number(c.valor) || 0,
        responsavel: c.responsavel ?? null,
        dataCadastro: c.data_cadastro ?? "",
        movido: c.movido ?? "",
        ultimaInteracao: c.ultima_interacao ?? "",
        qtdInteracoes: c.interacoes?.length ?? 0,
        qtdAnotacoes: c.anotacoes?.length ?? 0,
        qtdTarefas: c.tarefas?.length ?? 0,
        interacoes: (c.interacoes ?? []).map(i => ({
          tipo: i.tipo_descricao ?? String(i.tipo),
          titulo: i.titulo ?? "",
          data: i.data_cadastro ?? "",
          usuario: i.usuario?.nome ?? "",
        })),
      });
    }
    ultimaPagina = resp.pagination?.last_page ?? 1;
    process.stdout.write(`\r[${tag}] ${rotulo} — página ${page}/${ultimaPagina}, ${acumulado.length} cards`);
    page++;
  } while (page <= ultimaPagina && page <= MAX_PAGINAS);
  } catch (e) {
    falhados.push(tag);
    console.log(`\r[${tag}] ${rotulo} — FALHOU na página ${page} (${e.name}), será refeito na próxima rodada.`);
    continue;
  }

  fs.writeFileSync(arquivo, JSON.stringify(acumulado));
  totalGeral += acumulado.length;
  const secs = ((Date.now() - tFase) / 1000).toFixed(0);
  console.log(`\r[${tag}] ${rotulo} — ${acumulado.length} cards salvos (${secs}s) — acumulado: ${totalGeral}          `);
}

console.log(`\nConcluído: ${totalGeral} cards em ${((Date.now()-t0)/60000).toFixed(1)} min.`);
if (falhados.length) console.log(`Fases que falharam (rode de novo): ${falhados.join(", ")}`);
console.log(`Arquivos em: ${OUT_DIR}`);
