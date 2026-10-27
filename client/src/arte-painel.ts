import "./arte-painel.css";

type Motor =
  "redesenho" | "redesenho-max" | "local" | "vectorizer" | "gpt" | "nesting";
type Registro = {
  id: string;
  motor: Motor;
  inicio: string;
  duracaoMs: number;
  estado: "andamento" | "sucesso" | "erro" | "interrompido";
  tokens: number | null;
  creditos: number | null;
  chapas: number;
  http?: number;
};
type Projeto = {
  id: string;
  nome: string;
  criado: string;
  valores: Record<
    "redesenho" | "redesenho-max" | "vectorizer" | "gpt",
    number | null
  >;
  registros: Registro[];
};
type Banco = { versao: 1; atual: string; projetos: Projeto[] };
const key = "arte.projetos.v1";
const $ = (id: string) => document.getElementById(id)!;
const standalone = !!document.querySelector('meta[name="arte-standalone"]');
const nomes: Record<Motor, string> = {
  redesenho: "Imagem · qualidade padrão",
  "redesenho-max": "Imagem · qualidade máxima",
  local: "Vetor local",
  vectorizer: "Vetor · Vectorizer.AI",
  gpt: "Vetor · GPT",
  nesting: "Nesting",
};
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const e = (s: string) =>
  s.replace(
    /[&<>"']/g,
    ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!
  );
function novo(nome: string): Projeto {
  return {
    id: crypto.randomUUID(),
    nome,
    criado: new Date().toISOString(),
    valores: {
      redesenho: null,
      "redesenho-max": null,
      vectorizer: null,
      gpt: null,
    },
    registros: [],
  };
}
let historicoOriginal: string | null = null;
let historicoInvalido = false;
function carregar(): Banco {
  try {
    historicoOriginal = localStorage.getItem(key);
    const b = JSON.parse(historicoOriginal || "null") as Banco;
    if (
      b?.versao !== 1 ||
      !Array.isArray(b.projetos) ||
      !b.projetos.length ||
      b.projetos.length > 100 ||
      !b.projetos.some(p => p.id === b.atual)
    )
      throw new Error();
    for (const p of b.projetos) {
      if (
        typeof p.id !== "string" ||
        typeof p.nome !== "string" ||
        !p.valores ||
        !Array.isArray(p.registros) ||
        p.registros.length > 10000
      )
        throw new Error();
      for (const v of Object.values(p.valores))
        if (
          v !== null &&
          (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        )
          throw new Error();
      for (const r of p.registros) {
        if (
          !nomes[r.motor] ||
          !["andamento", "sucesso", "erro", "interrompido"].includes(
            r.estado
          ) ||
          !Number.isFinite(r.duracaoMs) ||
          !Number.isFinite(Date.parse(r.inicio))
        )
          throw new Error();
        if (r.estado === "andamento") r.estado = "interrompido";
      }
    }
    return b;
  } catch {
    historicoInvalido = !!historicoOriginal;
    const p = novo("Projeto 1");
    return { versao: 1, atual: p.id, projetos: [p] };
  }
}
const banco = carregar();
let emAndamento = 0;
let editorBusy = false;
let armazenamentoFalhou = false;
const atual = () => banco.projetos.find(p => p.id === banco.atual)!;
function salvar() {
  if (historicoInvalido) {
    armazenamentoFalhou = true;
    aviso();
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(banco));
    armazenamentoFalhou = false;
  } catch {
    armazenamentoFalhou = true;
  }
  aviso();
}
function aviso() {
  const el = $("arte-project-note");
  if (el)
    el.textContent = historicoInvalido
      ? "O histórico salvo não pôde ser lido e foi preservado. Exporte a recuperação e o projeto atual antes de fechar."
      : armazenamentoFalhou
        ? "Não foi possível salvar neste navegador. Exporte o histórico antes de fechar a página."
        : emAndamento || editorBusy
          ? "Operação em andamento. Aguarde para trocar de projeto."
          : "Histórico e valores ficam neste navegador. Imagens e vetores não são guardados ao fechar a página. Exporte o histórico para ter uma cópia.";
  for (const id of ["arte-project-select", "arte-project-new"]) {
    const input = $(id) as HTMLInputElement;
    if (input) input.disabled = emAndamento > 0 || editorBusy;
  }
}
$("arte-project").innerHTML =
  `<div class="arte-project-row"><label>Projeto atual<select class="arte-input" id="arte-project-select"></select></label><label>Nome do projeto<input class="arte-input" id="arte-project-name" maxlength="100" /></label><button class="button secondary" id="arte-project-new" type="button">Novo projeto</button>${standalone ? '<button class="button secondary" id="arte-logout" type="button">Sair</button>' : ""}<p class="arte-project-note" id="arte-project-note"></p></div>`;
$("dashboard-content").innerHTML =
  `<section class="panel"><div class="panel-head"><div class="panel-kicker">Por projeto</div><h2>Custos, gerações e tempo</h2><p>Contagem das operações iniciadas nesta página. Repetir uma geração ou um nesting aumenta a contagem. Chamadas feitas por uma integração externa não entram neste histórico local.</p></div><div class="panel-body"><div id="arte-kpis"></div><h3>Calculadora de custo estimado</h3><p class="hint">Informe em reais o custo médio de cada chamada, conforme a sua conta. Os valores atuais recalculam a estimativa deste projeto. Campo vazio significa custo desconhecido. Nesting interno e vetor local não consomem API paga; hospedagem e serviços externos de nesting não estão incluídos.</p><form id="arte-rates" class="arte-rates">${(["redesenho", "redesenho-max", "vectorizer", "gpt"] as const).map(m => `<label>${e(nomes[m])} · R$/chamada<input class="arte-input" type="number" min="0" max="100000" step="0.0001" data-rate="${m}" /></label>`).join("")}</form><p class="explain-note">Esta calculadora não consulta a fatura. Tokens e créditos aparecem quando o provedor os informa. Tentativas com erro ou interrupção podem ter cobrança e ficam sem estimativa até você conferir o extrato.</p><div class="button-row"><button class="button secondary" id="arte-export" type="button">Exportar histórico JSON</button></div><div id="arte-summary"></div><ul class="arte-history" id="arte-history"></ul></div></section>`;
$("integration-content").innerHTML =
  `<section class="panel"><div class="panel-head"><div class="panel-kicker">Para o programador</div><h2>Integração e configuração</h2><p>A versão independente possui API no próprio domínio, com chave exclusiva para chamadas de servidor. Nenhuma chave de provedor é exibida ou salva no navegador.</p></div><div class="panel-body"><p id="arte-integration-state" class="explain-note">${standalone ? "Consulte a configuração para verificar quais serviços estão habilitados." : "A API independente é disponibilizada pelo build Estúdio de Arte. Nesta página do Radrasys, o login e as rotas existentes continuam sendo usados."}</p><div class="button-row"><button class="button secondary" id="arte-integration-check" type="button" ${standalone ? "" : "disabled"}>Consultar configuração</button><button class="button secondary" id="arte-openapi-download" type="button" ${standalone ? "" : "disabled"}>Baixar contrato OpenAPI</button></div><h3>Credenciais no servidor</h3><ul class="arte-api-list"><li><code>ARTE_PUBLIC_URL</code>: domínio completo da ferramenta, com HTTPS.</li><li><code>ARTE_ACCESS_PASSWORD</code>: senha própria de acesso à interface (16+ caracteres).</li><li><code>ARTE_SESSION_SECRET</code>: segredo aleatório de sessões e tickets (32+ caracteres).</li><li><code>ARTE_INTEGRATION_API_KEY</code>: chave Bearer separada (32+ caracteres). Vazia desativa acesso externo.</li><li><code>OPENAI_API_KEY</code>: redesenho e vetor por GPT.</li><li><code>VECTORIZER_API_ID</code> e <code>VECTORIZER_API_SECRET</code>: vetorização Vectorizer.AI.</li></ul><p class="hint">As chaves são cadastradas na hospedagem pelo responsável técnico. Para revogar a integração, substitua sua chave no servidor. Não use a chave da OpenAI como chave de integração.</p><h3>Fluxo da API</h3><ol class="arte-api-list"><li>Consultar <code>GET /api/v1/servicos</code>.</li><li>Redesenhar: <code>POST /api/v1/redesenho?qualidade=high</code>, corpo PNG/JPG, até 4 MB. O retorno é PNG.</li><li>Para vetorizar o original, aprovar antes: <code>POST /api/v1/imagem/aprovar</code>. Retorna o ticket no cabeçalho <code>X-Redesenho-Token</code>.</li><li>Vetorizar: <code>POST /api/v1/vetor/vectorizer</code> ou <code>/api/v1/vetor/gpt</code>, com os mesmos bytes da imagem e o ticket. GPT exige PNG. O retorno é SVG.</li><li>Preparar peças com SVG normalizado: <code>POST /api/v1/nesting-arte/preparar</code>. Envie <code>svg, larguraMm, alturaMm</code>.</li><li>Calcular grupo: <code>POST /api/v1/nesting-arte/calcular</code>. Envie peças e dimensões da chapa. A resposta contém SVG e métricas de cada chapa e total. Consulte o contrato para todos os campos.</li></ol><h3>Exemplo de consulta</h3><pre class="arte-pre" id="arte-api-example"></pre><h3>Ajustes e consumo</h3><p class="hint"><code>X-Arte-Instrucoes: encodeURIComponent(texto)</code> transmite até 2.000 caracteres de correção em redesenho/GPT. <code>X-Arte-Uso</code> retorna JSON com contagens disponíveis; <code>null</code> indica informação ausente. <code>X-Request-Id</code> identifica a requisição. Ticket de imagem: 30 minutos. Limite: 20 operações/minuto por IP. Não repita chamadas pagas automaticamente após falha ou timeout: confira a cobrança primeiro.</p><p class="hint">401: acesso inválido · 409: imagem/ticket divergente ou expirado · 413: arquivo grande · 422: geometria inválida · 429: limite/créditos · 502/503: serviço ou configuração indisponível. Integrações devem chamar pelo servidor; não há CORS para sites externos.</p></div></section>`;
$("arte-api-example").textContent =
  `curl "${location.origin}/api/v1/servicos" \\\n  -H "Authorization: Bearer SUA_CHAVE_DE_INTEGRACAO"\n\n# Redesenho (chamada paga)\ncurl "${location.origin}/api/v1/redesenho?qualidade=high" \\\n  -H "Authorization: Bearer SUA_CHAVE_DE_INTEGRACAO" \\\n  -H "Content-Type: image/png" \\\n  --data-binary @imagem.png --output redesenho.png --dump-header resposta.txt`;
function renderProjeto() {
  ($("arte-project-select") as HTMLSelectElement).innerHTML = banco.projetos
    .map(
      p =>
        `<option value="${e(p.id)}" ${p.id === banco.atual ? "selected" : ""}>${e(p.nome)}</option>`
    )
    .join("");
  ($("arte-project-name") as HTMLInputElement).value = atual().nome;
  document.querySelectorAll<HTMLInputElement>("[data-rate]").forEach(el => {
    const v = atual().valores[el.dataset.rate as keyof Projeto["valores"]];
    el.value = v == null ? "" : String(v);
  });
  render();
  aviso();
}
function custo(p: Projeto, r: Registro): number | null {
  if (r.motor === "local" || r.motor === "nesting") return 0;
  return r.estado === "sucesso" ? (p.valores[r.motor] ?? null) : null;
}
function tempo(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}
function render() {
  const p = atual(),
    rs = p.registros;
  const ok = rs.filter(r => r.estado === "sucesso");
  const imagem = (r: Registro) =>
    r.motor === "redesenho" || r.motor === "redesenho-max";
  const partial = rs.reduce((sum, r) => sum + (custo(p, r) || 0), 0);
  const unknown = rs.filter(r => custo(p, r) === null).length;
  const sumTime = rs
    .filter(r => r.motor !== "nesting")
    .reduce((sum, r) => sum + r.duracaoMs, 0);
  const kpis = [
    ["Imagens geradas", String(ok.filter(imagem).length)],
    [
      "Vetores gerados",
      String(
        ok.filter(r => ["local", "vectorizer", "gpt"].includes(r.motor)).length
      ),
    ],
    ["Nestings gerados", String(ok.filter(r => r.motor === "nesting").length)],
    ["Tempo de redesenho + vetor", tempo(sumTime)],
    [unknown ? "Estimativa parcial" : "Custo estimado", moeda.format(partial)],
    ["Custos desconhecidos", String(unknown)],
    ["Chapas geradas", String(ok.reduce((n, r) => n + r.chapas, 0))],
    [
      "Tentativas com erro/interrupção",
      String(
        rs.filter(r => ["erro", "interrompido"].includes(r.estado)).length
      ),
    ],
  ];
  $("arte-kpis").innerHTML =
    `<dl class="arte-grid">${kpis.map(([label, value]) => `<div class="arte-kpi"><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join("")}</dl>`;
  $("arte-summary").innerHTML =
    `<p class="hint">${rs.length} operação(ões) neste projeto. O tempo soma a duração das tentativas de redesenho e vetorização, incluindo as que falharam; não inclui revisão manual nem nesting. São exibidos os últimos 100 registros; a exportação inclui todos.</p>`;
  $("arte-history").innerHTML =
    rs
      .slice(-100)
      .reverse()
      .map(r => {
        const c = custo(p, r);
        return `<li><strong>${e(nomes[r.motor])} · ${r.estado === "sucesso" ? "concluído" : r.estado === "andamento" ? "em andamento" : r.estado === "interrompido" ? "interrompido" : "falhou"}</strong><strong class="arte-record-cost">${c == null ? "Custo desconhecido" : c === 0 ? "Sem custo de API informado" : moeda.format(c) + " estimado"}</strong><span>${e(dataHora.format(new Date(r.inicio)))} · ${tempo(r.duracaoMs)}${r.http ? " · HTTP " + r.http : ""}</span><span>Tokens: ${r.tokens == null ? "não informados" : numero.format(r.tokens)} · Créditos: ${r.creditos == null ? "não informados" : r.creditos}</span></li>`;
      })
      .join("") ||
    "<li>As operações aparecerão aqui depois que você começar.</li>";
}
function iniciar(motor: Motor): { projeto: Projeto; registro: Registro } {
  const p = atual();
  if (p.registros.length >= 10000)
    throw new Error(
      "Limite de histórico deste projeto. Exporte e crie outro projeto."
    );
  const registro: Registro = {
    id: crypto.randomUUID(),
    motor,
    inicio: new Date().toISOString(),
    duracaoMs: 0,
    estado: "andamento",
    tokens: null,
    creditos: null,
    chapas: 0,
  };
  p.registros.push(registro);
  emAndamento++;
  salvar();
  render();
  return { projeto: p, registro };
}
function finalizar(task: ReturnType<typeof iniciar>, ms: number, ok: boolean) {
  task.registro.duracaoMs = Math.max(0, ms);
  task.registro.estado = ok ? "sucesso" : "erro";
  emAndamento = Math.max(0, emAndamento - 1);
  salvar();
  render();
}
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw, location.href);
  const path = url.pathname;
  const method = (
    init?.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const motor: Motor | null =
    url.origin !== location.origin || method !== "POST"
      ? null
      : path === "/api/letra-caixa/redesenho"
        ? url.searchParams.get("qualidade") === "xhigh"
          ? "redesenho-max"
          : "redesenho"
        : path === "/api/letra-caixa/vetorizacao"
          ? "vectorizer"
          : path === "/api/letra-caixa/vetorizacao-gpt"
            ? "gpt"
            : path === "/api/letra-caixa/nesting-arte/calcular"
              ? "nesting"
              : null;
  if (!motor) return nativeFetch(input, init);
  const task = iniciar(motor),
    start = performance.now();
  let ok = false;
  try {
    const response = await nativeFetch(input, init);
    task.registro.http = response.status;
    // Aguarda o corpo completo; falha de download não vira geração concluída.
    const clone = response.clone();
    if (motor === "nesting" && response.ok) {
      const body = await clone.json();
      task.registro.chapas = Array.isArray(body.chapas)
        ? body.chapas.length
        : 0;
    } else await clone.arrayBuffer();
    ok = response.ok;
    try {
      const usage = JSON.parse(response.headers.get("X-Arte-Uso") || "null");
      if (typeof usage?.total === "number" && Number.isFinite(usage.total))
        task.registro.tokens = usage.total;
      if (
        typeof usage?.creditos === "number" &&
        Number.isFinite(usage.creditos)
      )
        task.registro.creditos = usage.creditos;
      else {
        const creditos = response.headers.get("X-Vectorizer-Credits-Charged");
        if (creditos && Number.isFinite(Number(creditos)))
          task.registro.creditos = Number(creditos);
      }
    } catch {
      /* Informação opcional do provedor. */
    }
    return response;
  } finally {
    finalizar(task, performance.now() - start, ok);
  }
};
let localTask: ReturnType<typeof iniciar> | null = null;
document.addEventListener("arte:work-state", event => {
  editorBusy = !!(event as CustomEvent).detail?.busy;
  aviso();
});
document.addEventListener("arte:local-start", () => {
  localTask = iniciar("local");
});
document.addEventListener("arte:local-end", event => {
  if (localTask) {
    const detail = (event as CustomEvent).detail;
    finalizar(localTask, detail.durationMs, detail.ok);
    localTask = null;
  }
});
$("arte-project-select").addEventListener("change", event => {
  if (emAndamento || editorBusy) return;
  banco.atual = (event.target as HTMLSelectElement).value;
  document.dispatchEvent(new CustomEvent("arte:project-change"));
  salvar();
  renderProjeto();
});
$("arte-project-name").addEventListener("change", event => {
  atual().nome =
    (event.target as HTMLInputElement).value.trim().slice(0, 100) ||
    "Projeto sem nome";
  salvar();
  renderProjeto();
});
$("arte-project-new").addEventListener("click", () => {
  if (emAndamento || editorBusy || banco.projetos.length >= 100) return;
  const p = novo(`Projeto ${banco.projetos.length + 1}`);
  banco.projetos.push(p);
  banco.atual = p.id;
  document.dispatchEvent(new CustomEvent("arte:project-change"));
  salvar();
  renderProjeto();
});
$("arte-rates").addEventListener("input", event => {
  const el = event.target as HTMLInputElement,
    rate = el.dataset.rate as keyof Projeto["valores"];
  if (!rate) return;
  if (
    el.value !== "" &&
    (!Number.isFinite(el.valueAsNumber) ||
      el.valueAsNumber < 0 ||
      el.valueAsNumber > 100000)
  )
    return;
  atual().valores[rate] = el.value === "" ? null : el.valueAsNumber;
  salvar();
  render();
});
function baixar(body: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (historicoInvalido && historicoOriginal) {
  const recovery = document.createElement("button");
  recovery.className = "button secondary";
  recovery.type = "button";
  recovery.textContent = "Exportar recuperação do histórico";
  recovery.addEventListener("click", () =>
    baixar(historicoOriginal!, "historico-arte-recuperacao.json")
  );
  $("arte-project").append(recovery);
}
$("arte-export").addEventListener("click", () =>
  baixar(
    JSON.stringify(
      {
        ...atual(),
        aviso:
          "Histórico local; custos estimados conforme valores atuais. Não representa fatura.",
      },
      null,
      2
    ),
    `projeto-${atual().id}.json`
  )
);
$("arte-integration-check").addEventListener("click", async () => {
  try {
    const res = await nativeFetch("/api/v1/integracao", { cache: "no-store" });
    if (!res.ok)
      throw new Error("Entre na ferramenta para consultar a configuração.");
    const data = await res.json();
    $("arte-integration-state").textContent =
      `Domínio: ${data.baseUrl}. Integração: ${data.integrationConfigured ? "habilitada" : "sem chave configurada"}. OpenAI: ${data.credentials.OPENAI_API_KEY ? "configurada" : "ausente"}. Vectorizer.AI: ${data.credentials.VECTORIZER_API_ID && data.credentials.VECTORIZER_API_SECRET ? "configurado" : "ausente"}. Modelos: ${data.models.redraw} / ${data.models.vector}.`;
  } catch (error) {
    $("arte-integration-state").textContent =
      error instanceof Error ? error.message : "Falha na consulta.";
  }
});
$("arte-openapi-download").addEventListener("click", async () => {
  try {
    const res = await nativeFetch("/api/v1/openapi.json");
    if (!res.ok) throw new Error();
    baixar(
      JSON.stringify(await res.json(), null, 2),
      "estudio-arte-openapi.json"
    );
  } catch {
    $("arte-integration-state").textContent =
      "Entre na ferramenta para baixar o contrato.";
  }
});
renderProjeto();
salvar();

if (standalone) void acesso();
async function acesso() {
  const dialog = document.createElement("dialog");
  dialog.className = "arte-login";
  dialog.innerHTML = `<form id="arte-login-form"><h2>Entrar no Estúdio de Arte</h2><p>Use a senha exclusiva desta ferramenta.</p><label class="arte-field" for="arte-password">Senha de acesso</label><input class="arte-input" id="arte-password" type="password" autocomplete="current-password" required maxlength="500" /><button class="button" type="submit">Entrar</button><p id="arte-login-status" role="status"></p></form>`;
  document.body.append(dialog);
  dialog.addEventListener("cancel", event => event.preventDefault());
  dialog.querySelector("form")!.addEventListener("submit", async event => {
    event.preventDefault();
    const btn = dialog.querySelector("button")!;
    btn.disabled = true;
    try {
      const password = (dialog.querySelector("input") as HTMLInputElement)
        .value;
      const res = await nativeFetch("/api/arte/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      (dialog.querySelector("input") as HTMLInputElement).value = "";
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Falha ao entrar.");
      }
      dialog.close();
    } catch (error) {
      $("arte-login-status").textContent =
        error instanceof Error ? error.message : "Não foi possível entrar.";
    } finally {
      btn.disabled = false;
    }
  });
  try {
    const res = await nativeFetch("/api/arte/session", { cache: "no-store" });
    const data = await res.json();
    if (!data.authenticated) dialog.showModal();
  } catch {
    dialog.showModal();
    $("arte-login-status").textContent =
      "A API não respondeu. Confira a hospedagem da ferramenta.";
  }
  $("arte-logout").addEventListener("click", async () => {
    if (emAndamento || editorBusy) return;
    await nativeFetch("/api/arte/logout", { method: "POST" });
    location.reload();
  });
}
