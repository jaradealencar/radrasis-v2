#!/usr/bin/env node
/**
 * Serviço HTTP do Deepnest para o nesting do CPQ. Roda numa máquina própria (Node 20 + checkout do Deepnest com o
 * addon compilado) e atende o app hospedado na Vercel, que não executa o addon nativo.
 *
 *   DEEPNEST_SERVICE_TOKEN=<segredo>  DEEPNEST_NODE_ENTRY=<módulo que exporta nest>  node cpq-deepnest-service.mjs
 *
 * No app (Vercel): DEEPNEST_REMOTE_URL=https://<host>:<porta>  e  DEEPNEST_REMOTE_TOKEN=<o mesmo segredo>.
 * Sem este serviço (ou com ele fora do ar) o app usa o motor interno por caixas, sem travar o orçamento.
 *
 * POST /nesting  (Authorization: Bearer <token>)  corpo: { pecas, larguraMm, alturaMm, espacamentoMm, timeoutMs }
 *                resposta: o JSON do worker (cpq-deepnest-worker.mjs) ou { error } com status 422.
 * GET  /health   → { ok: true }
 */
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(aqui, "cpq-deepnest-worker.mjs");
const LIMITE_CORPO = 64 * 1024 * 1024;

const token = process.env.DEEPNEST_SERVICE_TOKEN?.trim();
const entrada = process.env.DEEPNEST_NODE_ENTRY?.trim();
if (!token || token.length < 16) {
  console.error("Defina DEEPNEST_SERVICE_TOKEN com pelo menos 16 caracteres.");
  process.exit(1);
}
if (!entrada) {
  console.error("Defina DEEPNEST_NODE_ENTRY (módulo do checkout do Deepnest que exporta nest).");
  process.exit(1);
}
const concorrencia = Math.max(1, Number(process.env.DEEPNEST_SERVICE_CONCURRENCY) || 1);
const filaMaxima = Math.max(0, Number(process.env.DEEPNEST_SERVICE_QUEUE) || 8);

const tokenConfere = recebido => {
  const esperado = Buffer.from(token);
  const atual = Buffer.from(String(recebido ?? ""));
  return atual.length === esperado.length && timingSafeEqual(atual, esperado);
};

let emExecucao = 0;
const fila = [];
const liberar = () => {
  emExecucao -= 1;
  const proximo = fila.shift();
  if (proximo) proximo();
};
const esperarVaga = () => new Promise((resolverVaga, rejeitar) => {
  if (emExecucao < concorrencia) { emExecucao += 1; resolverVaga(); return; }
  if (fila.length >= filaMaxima) { rejeitar(new Error("fila cheia")); return; }
  fila.push(() => { emExecucao += 1; resolverVaga(); });
});

function executarWorker(entrada_json, timeoutMs) {
  return new Promise(resolverWorker => {
    const filho = spawn(process.execPath, [workerPath], {
      env: { ...process.env, DEEPNEST_NODE_ENTRY: resolve(entrada) },
      cwd: dirname(resolve(entrada)),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let saida = "";
    let erro = "";
    let encerrado = false;
    const fim = (status, corpo) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(limite);
      resolverWorker({ status, corpo });
    };
    const limite = setTimeout(() => {
      filho.kill();
      fim(422, { error: "O Deepnest excedeu o tempo de cálculo configurado." });
    }, timeoutMs + 5_000);
    filho.stdout.setEncoding("utf8");
    filho.stderr.setEncoding("utf8");
    filho.stdout.on("data", pedaco => { saida += pedaco; if (saida.length > 12_000_000) filho.kill(); });
    filho.stderr.on("data", pedaco => { erro = (erro + pedaco).slice(-4_000); });
    filho.on("error", e => fim(500, { error: `Não foi possível iniciar o worker Deepnest: ${e.message}` }));
    filho.on("close", codigo => {
      try {
        const resultado = JSON.parse(saida);
        if (codigo !== 0 || resultado.error) fim(422, { error: resultado.error || erro || "O worker Deepnest encerrou com erro." });
        else fim(200, resultado);
      } catch {
        fim(422, { error: erro || "O worker Deepnest não devolveu um resultado válido." });
      }
    });
    filho.stdin.end(entrada_json);
  });
}

async function lerCorpo(req) {
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE_CORPO) throw Object.assign(new Error("Corpo acima de 64 MB."), { status: 413 });
    partes.push(parte);
  }
  return Buffer.concat(partes).toString("utf8");
}

const responder = (res, status, corpo) => {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(texto), "Cache-Control": "no-store" });
  res.end(texto);
};

const servidor = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return responder(res, 200, { ok: true });
    if (req.method !== "POST" || req.url !== "/nesting") return responder(res, 404, { error: "Rota não encontrada." });
    const autorizacao = req.headers.authorization ?? "";
    if (!autorizacao.startsWith("Bearer ") || !tokenConfere(autorizacao.slice(7))) return responder(res, 401, { error: "Não autorizado." });
    const texto = await lerCorpo(req);
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return responder(res, 400, { error: "JSON inválido." }); }
    const timeoutMs = Number(corpo?.timeoutMs);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) return responder(res, 400, { error: "timeoutMs precisa estar entre 1000 e 120000." });
    try { await esperarVaga(); } catch { return responder(res, 503, { error: "Serviço Deepnest ocupado; tente novamente." }); }
    try {
      const { status, corpo: resposta } = await executarWorker(texto, timeoutMs);
      responder(res, status, resposta);
    } finally {
      liberar();
    }
  } catch (e) {
    responder(res, e?.status || 500, { error: e instanceof Error ? e.message : "Falha no serviço Deepnest." });
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.DEEPNEST_SERVICE_PORT) || 8787;
  servidor.listen(porta, process.env.DEEPNEST_SERVICE_HOST || "0.0.0.0", () => {
    console.log(`Serviço Deepnest do CPQ ouvindo na porta ${porta}.`);
  });
}
