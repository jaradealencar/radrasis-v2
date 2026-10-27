import "./arte-nesting.css";
import { fmtNum } from "./lib/format";
import { dimensoesArteSvg, normalizarSvgArte } from "./lib/arte-svg";
import {
  somarMetricasNestingArte,
  type MetricasNestingArte,
  type PreparacaoNestingArte,
  type ResultadoNestingArte,
} from "../../shared/arte-nesting";

type Formato = {
  id: string;
  nome: string;
  larguraMm: number;
  alturaMm: number;
};
type Grupo = {
  id: string;
  nome: string;
  formatoId: string;
  espacamentoMm: number;
  margemBordaMm: number;
  rotacao: "livre" | "veio";
  pecas: Set<string>;
  resultado: ResultadoNestingArte | null;
  urls: string[];
  erro: string;
};
type Fonte = {
  svg: string;
  referenceUrl?: string;
  originalUrl?: string;
  referenceLabel?: string;
};
const NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "cpq.arte.formatos-chapa.v1";
const root = document.getElementById("arte-nesting");

if (root) iniciar(root);

function iniciar(root: HTMLElement) {
  const e = (valor: unknown) =>
    String(valor ?? "").replace(
      /[&<>"']/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!
    );
  const novoGrupo = (numero: number): Grupo => ({
    id: crypto.randomUUID(),
    nome: `Nesting ${numero}`,
    formatoId: "",
    espacamentoMm: 3,
    margemBordaMm: 5,
    rotacao: "livre",
    pecas: new Set(),
    resultado: null,
    urls: [],
    erro: "",
  });
  const grupos = [novoGrupo(1)];
  let ativo = grupos[0].id;
  let formatos: Formato[] = [];
  let fonte: Fonte | null = null;
  let preparacao: PreparacaoNestingArte | null = null;
  let selecionadas = new Set<string>();
  let proporcao = 1;
  let busy = false;
  let revisao = 0;
  let controller: AbortController | null = null;
  let mostrarOriginal = false;
  try {
    const salvos: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    if (Array.isArray(salvos))
      formatos = salvos
        .filter(
          (f): f is Formato =>
            !!f &&
            typeof f.id === "string" &&
            typeof f.nome === "string" &&
            f.nome.length <= 100 &&
            Number.isInteger(f.larguraMm) &&
            f.larguraMm >= 10 &&
            f.larguraMm <= 50_000 &&
            Number.isInteger(f.alturaMm) &&
            f.alturaMm >= 10 &&
            f.alturaMm <= 50_000
        )
        .slice(0, 50);
  } catch {
    /* O cadastro pode ser refeito se o armazenamento estiver indisponível. */
  }

  root.innerHTML = `
    <section class="panel an-intro"><div class="panel-head"><div class="panel-kicker">Etapa opcional · sem tokens</div><h2>Nesting por grupo e cor</h2>
      <p>Informe o tamanho real do desenho, selecione as peças e distribua em nestings independentes. Cada grupo pode usar uma chapa diferente.</p></div>
      <div class="panel-body an-source">
        <p id="an-source-name">Vetorize uma imagem na aba “Criar vetor” ou carregue um SVG já pronto.</p>
        <label class="button secondary an-file">Carregar SVG pronto<input id="an-svg-file" type="file" accept=".svg,image/svg+xml" class="visually-hidden"></label>
        <div class="an-fields"><label>Largura real do desenho (mm)<input id="an-width" type="number" min="0.1" max="50000" step="any" placeholder="Informe a medida real"></label>
          <label>Altura real do desenho (mm)<input id="an-height" type="number" min="0.1" max="50000" step="any" placeholder="Calculada proporcionalmente"></label>
          <button class="button" id="an-prepare" type="button">Preparar peças para seleção</button></div>
        <p class="hint">Medida da arte inteira, sem margens vazias da prancheta SVG; inclui o fundo, se ele fizer parte do vetor. Largura e altura mantêm a proporção. Pixels não definem o tamanho de fabricação.</p>
        <div id="an-status" class="status" role="status" aria-live="polite"></div>
      </div></section>
    <details class="panel an-sizes" id="an-sizes"><summary>Cadastro de tamanhos de chapa <span id="an-size-count"></span></summary><div class="panel-body">
      <p class="hint">Formatos salvos neste navegador. Você escolhe um formato para cada nesting; esse cadastro não altera o ERP.</p>
      <form id="an-size-form" class="an-fields"><input type="hidden" id="an-size-id">
        <label>Nome do formato<input id="an-size-name" required maxlength="100" placeholder="Ex.: Chapa grande"></label>
        <label>Largura (mm)<input id="an-size-width" type="number" required min="10" max="50000" step="1" placeholder="Ex.: 2000"></label>
        <label>Altura (mm)<input id="an-size-height" type="number" required min="10" max="50000" step="1" placeholder="Ex.: 1000"></label>
        <button class="button secondary" type="submit">Salvar tamanho</button><button class="button secondary" id="an-size-cancel" type="button" hidden>Cancelar edição</button>
      </form><div id="an-size-list" class="an-size-list"></div></div></details>
    <div class="an-layout">
      <section class="panel"><div class="panel-head"><h2>Editor de seleção das peças</h2><p>Clique no desenho ou use a lista. Vazados continuam ligados à peça; ilhas separadas podem ser selecionadas individualmente.</p></div>
        <div class="panel-body"><div class="an-toolbar"><button class="button secondary" type="button" data-act="select-all">Selecionar todas</button>
          <button class="button secondary" type="button" data-act="select-unassigned">Não atribuídas</button><button class="button secondary" type="button" data-act="select-none">Limpar seleção</button>
          <label class="an-check"><input id="an-labels" type="checkbox" checked> Numerar peças</label></div>
          <div id="an-colors" class="an-colors" aria-label="Selecionar peças pela cor"></div>
          <div id="an-canvas" class="an-canvas"><p>As peças aparecerão depois de confirmar a escala e preparar o vetor.</p></div>
          <p id="an-selection-count" class="an-selection-count" aria-live="polite">Nenhuma peça selecionada.</p>
          <div id="an-pieces" class="an-pieces"></div></div></section>
      <aside class="an-sidebar">
        <section class="panel an-reference"><div class="panel-head"><h2>Referência rápida</h2><p>Consulte o redesenho para separar as cores e ordenar os nestings.</p></div><div class="panel-body">
          <p id="an-reference-label" class="hint">A referência acompanha o vetor gerado nesta página.</p>
          <button type="button" id="an-reference-open" class="an-reference-open" aria-label="Ampliar imagem de referência" hidden><img id="an-reference-image" alt="Imagem de referência do projeto"></button>
          <div class="button-row"><button type="button" id="an-reference-toggle" class="button secondary" hidden>Ver original</button></div>
        </div></section>
        <section class="panel"><div class="panel-head"><h2>Grupos de nesting</h2><p>Uma peça pertence a um grupo por vez. Atribuir a outro grupo move a peça.</p></div><div class="panel-body">
          <div id="an-group-tabs" class="an-group-tabs" aria-label="Escolher nesting"></div>
          <div class="an-toolbar"><button class="button secondary" id="an-add-group" type="button">+ Adicionar nesting</button>
            <button class="button secondary" id="an-group-up" type="button" aria-label="Mover nesting para cima">↑</button><button class="button secondary" id="an-group-down" type="button" aria-label="Mover nesting para baixo">↓</button>
            <button class="button secondary" id="an-delete-group" type="button">Excluir grupo</button></div>
          <div class="an-group-fields"><label>Nome / cor do nesting<input id="an-group-name" maxlength="100"></label>
            <label>Tamanho da chapa<select id="an-group-format"></select></label>
            <div class="an-fields"><label>Entre peças (mm)<input id="an-group-gap" type="number" min="0" max="50" step="0.1"></label>
              <label>Margem de borda (mm)<input id="an-group-margin" type="number" min="0" max="50" step="0.1"></label></div>
            <label>Rotação das peças<select id="an-group-rotation"><option value="livre">Livre</option><option value="veio">Manter orientação: 0° ou 180°</option></select></label></div>
          <div class="button-row"><button class="button" id="an-assign" type="button">Incluir seleção neste nesting</button><button class="button secondary" id="an-unassign" type="button">Retirar seleção do grupo</button></div>
          <p id="an-group-summary" class="hint"></p><div class="button-row"><button class="button" id="an-calculate" type="button">Calcular este nesting</button><button class="button secondary" id="an-calculate-all" type="button">Calcular todos</button></div>
        </div></section>
      </aside>
    </div>
    <section class="panel an-results-panel"><div class="panel-head"><h2>Resultados por chapa e totais</h2><p>Área utilizada = retângulo ocupado pelo layout, incluindo as margens. Área líquida = material das peças, descontando vazados. Perímetro inclui bordas externas e vazados.</p></div>
      <div class="panel-body"><div id="an-totals"></div><div id="an-results"></div></div></section>
    <dialog id="an-reference-dialog" class="an-dialog"><button class="button secondary" id="an-reference-close" type="button">Fechar referência</button><img id="an-reference-large" alt="Imagem ampliada de referência"></dialog>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const input = (id: string) => $<HTMLInputElement>(id);
  const atual = () => grupos.find(grupo => grupo.id === ativo)!;
  const formato = (grupo: Grupo) =>
    formatos.find(item => item.id === grupo.formatoId);
  const status = (mensagem: string, erro = false) => {
    $("an-status").className = `status is-visible${erro ? " is-error" : ""}`;
    $("an-status").replaceChildren(document.createTextNode(mensagem));
    if (/entre no|sessão/i.test(mensagem)) {
      const link = document.createElement("a");
      link.href = "/login";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = " Entrar no Radrasys";
      $("an-status").append(link);
    }
  };
  const limparResultado = (grupo: Grupo) => {
    grupo.urls.forEach(url => URL.revokeObjectURL(url));
    grupo.urls = [];
    grupo.resultado = null;
    grupo.erro = "";
  };
  const limparPecas = () => {
    preparacao = null;
    selecionadas = new Set();
    grupos.forEach(grupo => {
      grupo.pecas.clear();
      limparResultado(grupo);
    });
  };

  async function api<T>(rota: string, dados: unknown): Promise<T> {
    const resposta = await fetch(`/api/letra-caixa/nesting-arte/${rota}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      signal: controller?.signal,
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok)
      throw new Error(
        corpo.error ||
          `O cálculo não respondeu corretamente (HTTP ${resposta.status}).`
      );
    return corpo as T;
  }

  function metricasHtml(m: MetricasNestingArte): string {
    return `<dl class="an-metrics"><div><dt>Área da chapa</dt><dd>${fmtNum(m.areaChapaM2, 4)} m²</dd></div>
      <div><dt>Área utilizada</dt><dd>${fmtNum(m.areaUtilizadaM2, 4)} m²</dd></div>
      <div><dt>Área líquida</dt><dd>${fmtNum(m.areaLiquidaM2, 4)} m²</dd></div>
      <div><dt>Perímetro de corte</dt><dd>${fmtNum(m.perimetroM, 3)} m</dd></div></dl>`;
  }

  function renderResultados() {
    const calculados = grupos.filter(grupo => grupo.resultado);
    const preenchidos = grupos.filter(grupo => grupo.pecas.size);
    const total = somarMetricasNestingArte(
      calculados.map(grupo => grupo.resultado!.total)
    );
    $("an-totals").innerHTML = calculados.length
      ? `<section class="an-project-total"><h3>Total do projeto · ${total.quantidadeChapas} chapa(s) · ${total.quantidadePecas} peça(s)</h3>
      <p>${calculados.length} de ${preenchidos.length} nesting(s) com peças calculado(s). ${preparacao ? preparacao.pecas.filter(peca => !grupos.some(grupo => grupo.pecas.has(peca.id))).length : 0} peça(s) fora dos grupos.</p>${metricasHtml(total)}</section>`
      : '<p class="hint">Calcule um grupo para ver as métricas. Os totais só incluem resultados atuais.</p>';
    $("an-results").innerHTML = grupos
      .map((grupo, index) => {
        if (grupo.erro)
          return `<article class="an-group-result"><h3>${index + 1}. ${e(grupo.nome)}</h3><p class="an-error">${e(grupo.erro)}</p></article>`;
        const r = grupo.resultado;
        if (!r)
          return grupo.pecas.size
            ? `<article class="an-group-result"><h3>${index + 1}. ${e(grupo.nome)}</h3><p class="hint">${grupo.pecas.size} peça(s) · cálculo pendente.</p></article>`
            : "";
        return `<article class="an-group-result"><h3>${index + 1}. ${e(grupo.nome)} · ${r.chapas.length} chapa(s)</h3>
        <p class="hint">${r.motor === "deepnest" ? "Deepnest" : "Motor interno do CPQ · estimativa geométrica conservadora"} · espaço ${fmtNum(r.espacamentoMm, 1)} mm · margem ${fmtNum(r.margemBordaMm, 1)} mm</p>
        <h4>Total deste nesting</h4>${metricasHtml(r.total)}<div class="an-sheet-grid">${r.chapas
          .map(
            (chapa, i) => `<section class="an-sheet">
          <h4>Chapa ${i + 1} · ${fmtNum(chapa.larguraMm)} × ${fmtNum(chapa.alturaMm)} mm</h4>
          <img src="${e(grupo.urls[i])}" alt="Layout da chapa ${i + 1} de ${e(grupo.nome)}" style="aspect-ratio:${chapa.larguraMm}/${chapa.alturaMm}">
          <p class="hint">${chapa.metricas.quantidadePecas} peça(s) · bloco ocupado ${fmtNum((100 * chapa.metricas.areaUtilizadaM2) / chapa.metricas.areaChapaM2, 1)}% · material líquido ${fmtNum((100 * chapa.metricas.areaLiquidaM2) / chapa.metricas.areaChapaM2, 1)}%</p>
          ${metricasHtml(chapa.metricas)}<button class="button secondary" type="button" data-download-group="${grupo.id}" data-sheet="${i}">Baixar esta chapa em SVG</button>
        </section>`
          )
          .join("")}</div></article>`;
      })
      .join("");
  }

  function renderFormatos() {
    $("an-size-count").textContent = `· ${formatos.length} formato(s)`;
    $("an-size-list").innerHTML = formatos
      .map(
        item => `<div><span><strong>${e(item.nome)}</strong> · ${fmtNum(item.larguraMm)} × ${fmtNum(item.alturaMm)} mm</span>
      <button class="button secondary" type="button" data-edit-size="${e(item.id)}">Editar</button><button class="button secondary" type="button" data-delete-size="${e(item.id)}">Excluir</button></div>`
      )
      .join("");
    if (!formatos.length) $<HTMLDetailsElement>("an-sizes").open = true;
    renderGrupo();
  }

  function renderTabs() {
    $("an-group-tabs").innerHTML = grupos
      .map(
        (
          grupo,
          index
        ) => `<button class="an-group-tab${grupo.id === ativo ? " is-active" : ""}" type="button" data-group="${grupo.id}" aria-pressed="${grupo.id === ativo}">
      <strong>${index + 1}. ${e(grupo.nome || "Sem nome")}</strong><span>${grupo.pecas.size} peça(s) · ${grupo.resultado ? "calculado" : grupo.erro ? "revisar" : "pendente"}</span></button>`
      )
      .join("");
  }

  function renderGrupo() {
    const grupo = atual();
    input("an-group-name").value = grupo.nome;
    $<HTMLSelectElement>("an-group-format").innerHTML =
      '<option value="">Escolha um tamanho cadastrado</option>' +
      formatos
        .map(
          f =>
            `<option value="${e(f.id)}">${e(f.nome)} · ${fmtNum(f.larguraMm)} × ${fmtNum(f.alturaMm)} mm</option>`
        )
        .join("");
    $<HTMLSelectElement>("an-group-format").value = grupo.formatoId;
    input("an-group-gap").value = String(grupo.espacamentoMm);
    input("an-group-margin").value = String(grupo.margemBordaMm);
    $<HTMLSelectElement>("an-group-rotation").value = grupo.rotacao;
    renderTabs();
    renderSelecao();
  }

  function renderEditor() {
    const tela = $("an-canvas");
    tela.replaceChildren();
    if (!preparacao) {
      tela.innerHTML =
        "<p>As peças aparecerão depois de confirmar a escala e preparar o vetor.</p>";
      $("an-pieces").replaceChildren();
      $("an-colors").replaceChildren();
      renderSelecao();
      return;
    }
    const svg = document.createElementNS(NS, "svg");
    const folga = Math.max(preparacao.larguraMm, preparacao.alturaMm) * 0.025;
    svg.setAttribute(
      "viewBox",
      `${-folga} ${-folga} ${preparacao.larguraMm + 2 * folga} ${preparacao.alturaMm + 2 * folga}`
    );
    svg.setAttribute("aria-label", "Editor de seleção das peças do projeto");
    for (const [i, peca] of preparacao.pecas.entries()) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", peca.dProjeto);
      path.setAttribute("fill", peca.cor);
      path.setAttribute("fill-rule", "evenodd");
      path.dataset.piece = peca.id;
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "checkbox");
      path.setAttribute("aria-label", `Peça ${i + 1}, cor ${peca.cor}`);
      const titulo = document.createElementNS(NS, "title");
      titulo.textContent = `Peça ${i + 1} · ${fmtNum(peca.larguraMm, 1)} × ${fmtNum(peca.alturaMm, 1)} mm`;
      path.append(titulo);
      svg.append(path);
      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", String(peca.xMm + peca.larguraMm / 2));
      label.setAttribute("y", String(peca.yMm + peca.alturaMm / 2));
      label.setAttribute(
        "font-size",
        String(Math.max(preparacao.larguraMm, preparacao.alturaMm) / 50)
      );
      label.textContent = String(i + 1);
      label.classList.add("an-piece-number");
      svg.append(label);
    }
    tela.append(svg);
    tela.classList.toggle("an-hide-numbers", !input("an-labels").checked);
    const cores = [...new Set(preparacao.pecas.map(peca => peca.cor))];
    $("an-colors").innerHTML = cores
      .map(
        cor =>
          `<button class="button secondary" type="button" data-color="${cor}"><span class="an-swatch" style="background:${cor}"></span>${cor} · ${preparacao!.pecas.filter(peca => peca.cor === cor).length}</button>`
      )
      .join("");
    renderListaPecas();
    renderSelecao();
  }

  function renderListaPecas() {
    $("an-pieces").innerHTML =
      preparacao?.pecas
        .map((peca, i) => {
          const grupo = grupos.find(item => item.pecas.has(peca.id));
          return `<label class="an-piece-row"><input type="checkbox" data-piece="${peca.id}"><span class="an-swatch" style="background:${peca.cor}"></span><span><strong>Peça ${i + 1}</strong> · ${fmtNum(peca.larguraMm, 1)} × ${fmtNum(peca.alturaMm, 1)} mm
        <small>${fmtNum(peca.areaLiquidaM2, 5)} m² líquidos · ${fmtNum(peca.perimetroM, 3)} m de corte</small><small>${grupo ? e(grupo.nome) : "Fora dos nestings"}</small></span></label>`;
        })
        .join("") || "";
  }

  function renderSelecao() {
    $("an-selection-count").textContent =
      `${selecionadas.size} de ${preparacao?.pecas.length ?? 0} peça(s) selecionada(s).`;
    root
      .querySelectorAll<SVGPathElement | HTMLInputElement>("[data-piece]")
      .forEach(elemento => {
        const marcada = selecionadas.has(elemento.dataset.piece!);
        if (elemento instanceof HTMLInputElement) elemento.checked = marcada;
        else {
          elemento.classList.toggle("is-selected", marcada);
          elemento.setAttribute("aria-checked", String(marcada));
        }
      });
    $("an-group-summary").textContent =
      `${atual().pecas.size} peça(s) neste grupo. Máximo de 100 peças por nesting e 10 grupos.`;
    renderBotoes();
  }

  function grupoValido(grupo: Grupo) {
    return (
      grupo.nome.trim() &&
      grupo.pecas.size > 0 &&
      formato(grupo) &&
      Number.isFinite(grupo.espacamentoMm) &&
      grupo.espacamentoMm >= 0 &&
      grupo.espacamentoMm <= 50 &&
      Number.isFinite(grupo.margemBordaMm) &&
      grupo.margemBordaMm >= 0 &&
      grupo.margemBordaMm <= 50
    );
  }
  function renderBotoes() {
    root
      .querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement
      >("input,button,select")
      .forEach(el => {
        el.disabled = busy;
      });
    const desabilitar = (id: string, valor: boolean) => {
      $<HTMLButtonElement>(id).disabled = busy || valor;
    };
    desabilitar("an-prepare", !fonte);
    desabilitar("an-assign", !preparacao || !selecionadas.size);
    desabilitar(
      "an-unassign",
      ![...selecionadas].some(id => atual().pecas.has(id))
    );
    desabilitar("an-add-group", grupos.length >= 10);
    desabilitar("an-delete-group", grupos.length <= 1);
    desabilitar("an-group-up", grupos[0].id === ativo);
    desabilitar("an-group-down", grupos.at(-1)!.id === ativo);
    desabilitar("an-calculate", !preparacao || !grupoValido(atual()));
    desabilitar(
      "an-calculate-all",
      !preparacao || !grupos.some(g => g.pecas.size)
    );
  }

  function renderReferencia() {
    const url = mostrarOriginal ? fonte?.originalUrl : fonte?.referenceUrl;
    $("an-reference-open").hidden = !url;
    $("an-reference-toggle").hidden =
      !fonte?.originalUrl ||
      !fonte.referenceUrl ||
      fonte.originalUrl === fonte.referenceUrl;
    $("an-reference-toggle").textContent = mostrarOriginal
      ? `Ver ${fonte?.referenceLabel || "redesenho"}`
      : "Ver original";
    $("an-reference-label").textContent = url
      ? (mostrarOriginal
          ? "Imagem original"
          : fonte?.referenceLabel || "Redesenho") + " · clique para ampliar"
      : "Sem imagem de referência vinculada a este SVG.";
    for (const id of ["an-reference-image", "an-reference-large"]) {
      const imagem = $<HTMLImageElement>(id);
      if (url) imagem.src = url;
      else imagem.removeAttribute("src");
    }
  }

  function carregarFonte(nova: Fonte, nome = "Vetor atual da ferramenta") {
    const svg = normalizarSvgArte(nova.svg);
    const vb = dimensoesArteSvg(svg);
    revisao++;
    controller?.abort();
    busy = false;
    limparPecas();
    fonte = { ...nova, svg };
    mostrarOriginal = false;
    proporcao = vb.largura / vb.altura;
    input("an-width").value = input("an-height").value = "";
    $("an-source-name").textContent = nome;
    status(
      "Informe o tamanho real do desenho e prepare as peças para selecionar."
    );
    renderEditor();
    renderGrupo();
    renderReferencia();
    renderResultados();
  }

  async function preparar() {
    if (!fonte || busy) return;
    const larguraMm = input("an-width").valueAsNumber,
      alturaMm = input("an-height").valueAsNumber;
    if (
      ![larguraMm, alturaMm].every(
        n => Number.isFinite(n) && n > 0 && n <= 50_000
      )
    )
      return status(
        "Informe o tamanho real do desenho em milímetros (até 50.000 mm).",
        true
      );
    const versao = ++revisao;
    controller = new AbortController();
    busy = true;
    limparPecas();
    renderEditor();
    renderResultados();
    status("Separando peças e vazados do vetor…");
    try {
      const svg = fonte.svg;
      const novaPreparacao = await api<PreparacaoNestingArte>("preparar", {
        svg,
        larguraMm,
        alturaMm,
      });
      if (versao !== revisao) return;
      preparacao = novaPreparacao;
      status(
        `${preparacao.pecas.length} peça(s) preparada(s). Selecione as peças e atribua ao nesting desejado.`
      );
      renderEditor();
      renderGrupo();
    } catch (erro) {
      if (versao === revisao) {
        preparacao = null;
        status(
          erro instanceof Error
            ? erro.message
            : "Não foi possível preparar o vetor.",
          true
        );
      }
    } finally {
      if (versao === revisao) {
        busy = false;
        renderBotoes();
      }
    }
  }

  async function calcular(todos: boolean) {
    if (!preparacao || busy) return;
    const alvos = todos ? grupos.filter(g => g.pecas.size) : [atual()];
    const invalido = alvos.find(g => !grupoValido(g));
    if (invalido) {
      ativo = invalido.id;
      renderGrupo();
      return status(
        `Confira o nome, tamanho da chapa e parâmetros de ${invalido.nome}.`,
        true
      );
    }
    const versao = revisao;
    busy = true;
    controller = new AbortController();
    renderBotoes();
    let concluidos = 0;
    try {
      for (const [index, grupo] of alvos.entries()) {
        limparResultado(grupo);
        const chapa = formato(grupo)!;
        status(
          `Calculando ${index + 1} de ${alvos.length}: ${grupo.nome}. Aguarde o encaixe das peças…`
        );
        renderResultados();
        try {
          const resultado = await api<ResultadoNestingArte>("calcular", {
            grupoId: grupo.id,
            nome: grupo.nome.trim(),
            larguraChapaMm: chapa.larguraMm,
            alturaChapaMm: chapa.alturaMm,
            espacamentoMm: grupo.espacamentoMm,
            margemBordaMm: grupo.margemBordaMm,
            rotacao: grupo.rotacao,
            pecas: preparacao!.pecas
              .filter(peca => grupo.pecas.has(peca.id))
              .map(({ id, svg, larguraMm, alturaMm, cor }) => ({
                id,
                svg,
                larguraMm,
                alturaMm,
                cor,
              })),
          });
          if (versao !== revisao) return;
          grupo.resultado = resultado;
          grupo.urls = resultado.chapas.map(folha =>
            URL.createObjectURL(
              new Blob([folha.svg], { type: "image/svg+xml;charset=utf-8" })
            )
          );
          concluidos++;
        } catch (erro) {
          if (versao !== revisao) return;
          grupo.erro =
            erro instanceof Error
              ? erro.message
              : "O cálculo deste grupo falhou.";
        }
        renderTabs();
        renderResultados();
      }
      status(
        `${concluidos} de ${alvos.length} nesting(s) concluído(s). ${concluidos < alvos.length ? "Confira os avisos nos grupos que falharam." : "As chapas e os SVGs estão disponíveis abaixo."}`,
        concluidos < alvos.length
      );
    } finally {
      if (versao === revisao) {
        busy = false;
        renderBotoes();
      }
    }
  }

  const invalidarAtual = () => {
    limparResultado(atual());
    renderTabs();
    renderResultados();
    renderBotoes();
  };
  root.addEventListener("input", event => {
    const alvo = event.target as HTMLInputElement;
    if (alvo.id === "an-width" || alvo.id === "an-height") {
      const valor = alvo.valueAsNumber;
      const outro = input(alvo.id === "an-width" ? "an-height" : "an-width");
      outro.value =
        Number.isFinite(valor) && valor > 0
          ? String(
              Number(
                (alvo.id === "an-width"
                  ? valor / proporcao
                  : valor * proporcao
                ).toFixed(6)
              )
            )
          : "";
      if (preparacao) {
        limparPecas();
        renderEditor();
        renderGrupo();
        renderResultados();
        status("A escala mudou. Prepare novamente as peças antes de calcular.");
      }
    } else if (alvo.id === "an-group-name") {
      atual().nome = alvo.value;
      invalidarAtual();
      renderListaPecas();
      renderSelecao();
    } else if (alvo.id === "an-group-gap") {
      atual().espacamentoMm = alvo.valueAsNumber;
      invalidarAtual();
    } else if (alvo.id === "an-group-margin") {
      atual().margemBordaMm = alvo.valueAsNumber;
      invalidarAtual();
    }
  });
  root.addEventListener("change", event => {
    const alvo = event.target as HTMLInputElement;
    if (alvo.id === "an-svg-file") {
      const file = alvo.files?.[0];
      if (!file) return;
      if (file.size > 1_500_000)
        return status("Envie um SVG de até 1,5 MB.", true);
      void file
        .text()
        .then(svg => carregarFonte({ svg }, `SVG carregado: ${file.name}`))
        .catch(erro => status(erro.message, true));
      alvo.value = "";
    } else if (alvo.dataset.piece) {
      alvo.checked
        ? selecionadas.add(alvo.dataset.piece)
        : selecionadas.delete(alvo.dataset.piece);
      renderSelecao();
    } else if (alvo.id === "an-group-format") {
      atual().formatoId = alvo.value;
      invalidarAtual();
    } else if (alvo.id === "an-group-rotation") {
      atual().rotacao = alvo.value as Grupo["rotacao"];
      invalidarAtual();
    } else if (alvo.id === "an-labels")
      $("an-canvas").classList.toggle("an-hide-numbers", !alvo.checked);
  });

  root.addEventListener("click", event => {
    const alvo = (event.target as Element).closest<HTMLElement>(
      "button,[data-piece]"
    );
    if (!alvo || busy) return;
    if (alvo.dataset.piece && alvo instanceof SVGElement) {
      selecionadas.has(alvo.dataset.piece)
        ? selecionadas.delete(alvo.dataset.piece)
        : selecionadas.add(alvo.dataset.piece);
      renderSelecao();
    } else if (alvo.dataset.group) {
      ativo = alvo.dataset.group;
      renderGrupo();
    } else if (alvo.dataset.color) {
      selecionadas = new Set(
        preparacao?.pecas
          .filter(peca => peca.cor === alvo.dataset.color)
          .map(peca => peca.id)
      );
      renderSelecao();
    } else if (alvo.dataset.act) {
      selecionadas = new Set(
        alvo.dataset.act === "select-none"
          ? []
          : preparacao?.pecas
              .filter(
                peca =>
                  alvo.dataset.act === "select-all" ||
                  !grupos.some(g => g.pecas.has(peca.id))
              )
              .map(peca => peca.id)
      );
      renderSelecao();
    } else if (alvo.dataset.downloadGroup) {
      const grupo = grupos.find(g => g.id === alvo.dataset.downloadGroup)!;
      const indice = Number(alvo.dataset.sheet);
      const link = document.createElement("a");
      link.href = grupo.urls[indice];
      link.download = `${String(grupos.indexOf(grupo) + 1).padStart(2, "0")}-${
        grupo.nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9_-]+/gi, "-") || "nesting"
      }-chapa-${indice + 1}.svg`;
      document.body.append(link);
      link.click();
      link.remove();
    } else if (alvo.dataset.editSize) {
      const f = formatos.find(item => item.id === alvo.dataset.editSize)!;
      input("an-size-id").value = f.id;
      input("an-size-name").value = f.nome;
      input("an-size-width").value = String(f.larguraMm);
      input("an-size-height").value = String(f.alturaMm);
      $("an-size-cancel").hidden = false;
      input("an-size-name").focus();
    } else if (alvo.dataset.deleteSize) {
      formatos = formatos.filter(f => f.id !== alvo.dataset.deleteSize);
      grupos
        .filter(g => g.formatoId === alvo.dataset.deleteSize)
        .forEach(g => {
          g.formatoId = "";
          limparResultado(g);
        });
      salvarFormatos();
      renderFormatos();
      renderResultados();
      renderBotoes();
    }
  });
  $("an-canvas").addEventListener("keydown", event => {
    const alvo = event.target as SVGElement;
    if (
      !busy &&
      alvo.dataset.piece &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      alvo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  function salvarFormatos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formatos));
    } catch {
      status(
        "O navegador não permitiu salvar os formatos. Eles continuam disponíveis enquanto esta página estiver aberta.",
        true
      );
    }
  }
  $("an-size-form").addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const id = input("an-size-id").value || crypto.randomUUID();
    const nome = input("an-size-name").value.trim();
    const larguraMm = input("an-size-width").valueAsNumber,
      alturaMm = input("an-size-height").valueAsNumber;
    if (
      !nome ||
      ![larguraMm, alturaMm].every(
        n => Number.isInteger(n) && n >= 10 && n <= 50_000
      )
    )
      return status(
        "Confira o nome e as dimensões inteiras da chapa em milímetros.",
        true
      );
    if (formatos.length >= 50 && !formatos.some(f => f.id === id))
      return status("O cadastro aceita até 50 formatos.", true);
    const existe = formatos.findIndex(f => f.id === id);
    const f = { id, nome, larguraMm, alturaMm };
    if (existe >= 0) formatos[existe] = f;
    else formatos.push(f);
    grupos.filter(g => g.formatoId === id).forEach(limparResultado);
    if (!atual().formatoId) atual().formatoId = id;
    salvarFormatos();
    $<HTMLFormElement>("an-size-form").reset();
    $("an-size-cancel").hidden = true;
    renderFormatos();
    renderResultados();
    renderBotoes();
  });
  $("an-size-cancel").addEventListener("click", () => {
    $<HTMLFormElement>("an-size-form").reset();
    $("an-size-cancel").hidden = true;
  });
  $("an-prepare").addEventListener("click", () => void preparar());
  $("an-calculate").addEventListener("click", () => void calcular(false));
  $("an-calculate-all").addEventListener("click", () => void calcular(true));
  $("an-add-group").addEventListener("click", () => {
    if (grupos.length >= 10 || busy) return;
    const grupo = novoGrupo(grupos.length + 1);
    grupos.push(grupo);
    ativo = grupo.id;
    renderGrupo();
    renderResultados();
  });
  $("an-delete-group").addEventListener("click", () => {
    if (grupos.length <= 1 || busy) return;
    const index = grupos.findIndex(g => g.id === ativo);
    limparResultado(atual());
    grupos.splice(index, 1);
    ativo = grupos[Math.min(index, grupos.length - 1)].id;
    renderGrupo();
    renderListaPecas();
    renderSelecao();
    renderResultados();
  });
  const mover = (delta: number) => {
    const index = grupos.findIndex(g => g.id === ativo),
      destino = index + delta;
    if (busy || destino < 0 || destino >= grupos.length) return;
    [grupos[index], grupos[destino]] = [grupos[destino], grupos[index]];
    renderGrupo();
    renderResultados();
  };
  $("an-group-up").addEventListener("click", () => mover(-1));
  $("an-group-down").addEventListener("click", () => mover(1));
  $("an-assign").addEventListener("click", () => {
    if (busy || !preparacao) return;
    const destino = atual();
    if (new Set([...destino.pecas, ...selecionadas]).size > 100)
      return status(
        "Cada nesting aceita até 100 peças. Distribua a seleção em mais grupos.",
        true
      );
    for (const grupo of grupos) {
      if (
        grupo === destino ||
        [...selecionadas].some(id => grupo.pecas.has(id))
      )
        limparResultado(grupo);
      selecionadas.forEach(id =>
        grupo === destino ? grupo.pecas.add(id) : grupo.pecas.delete(id)
      );
    }
    renderGrupo();
    renderListaPecas();
    renderSelecao();
    renderResultados();
  });
  $("an-unassign").addEventListener("click", () => {
    if (busy) return;
    selecionadas.forEach(id => atual().pecas.delete(id));
    limparResultado(atual());
    renderGrupo();
    renderListaPecas();
    renderSelecao();
    renderResultados();
  });
  $("an-reference-toggle").addEventListener("click", () => {
    mostrarOriginal = !mostrarOriginal;
    renderReferencia();
  });
  $("an-reference-open").addEventListener("click", () =>
    $<HTMLDialogElement>("an-reference-dialog").showModal()
  );
  $("an-reference-close").addEventListener("click", () =>
    $<HTMLDialogElement>("an-reference-dialog").close()
  );
  document.addEventListener("cpq:vector-ready", event => {
    try {
      carregarFonte((event as CustomEvent<Fonte>).detail);
    } catch (erro) {
      status(
        erro instanceof Error
          ? erro.message
          : "Não foi possível ler este vetor.",
        true
      );
    }
  });
  document.addEventListener("cpq:vector-reset", () => {
    revisao++;
    controller?.abort();
    busy = false;
    fonte = null;
    limparPecas();
    input("an-width").value = input("an-height").value = "";
    $("an-source-name").textContent =
      "Gere um novo vetor ou carregue um SVG pronto para começar.";
    renderEditor();
    renderGrupo();
    renderReferencia();
    renderResultados();
    status(
      "O vetor mudou. Os nestings anteriores foram descartados para evitar medidas desatualizadas."
    );
  });
  window.addEventListener("pagehide", () => {
    controller?.abort();
    grupos.forEach(limparResultado);
  });
  renderFormatos();
  renderEditor();
  renderReferencia();
  renderResultados();
  renderBotoes();
}
