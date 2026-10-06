import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { auth } from "../_core/auth";
import { listPriceTableSections } from "../db/db";
import {
  listarMateriasPrimas,
  listarProdutos,
  MubiSysError,
} from "../integrations/mubisys-client";
import { buscarComposicoesMubiSys, cookieSessaoMubiSys } from "./estudio-mubisys-session";
import type {
  MubiSysMateriaPrima,
  MubiSysProduto,
} from "../integrations/mubisys-client";

function responderErroCatalogo(res: Response, erro: unknown): void {
  console.error("[EstudioCatalogoMubiSys] Falha ao carregar catálogo:", erro);

  if (erro instanceof MubiSysError) {
    if (erro.message.startsWith("Credenciais MubiSys não configuradas")) {
      res.status(503).json({
        error: "As credenciais da API do MubiSys não estão configuradas no servidor.",
      });
      return;
    }
    if (erro.status === 401 || erro.status === 403) {
      res.status(502).json({
        error: "O MubiSys recusou as credenciais do servidor. O token precisa ser revisado.",
      });
      return;
    }
    if (erro.status === 0) {
      res.status(503).json({
        error: "Não foi possível conectar à API do MubiSys. Tente novamente em instantes.",
      });
      return;
    }
    res.status(502).json({
      error: `A API do MubiSys respondeu com erro HTTP ${erro.status}.`,
    });
    return;
  }

  res.status(500).json({
    error: "Não foi possível carregar o catálogo do MubiSys agora.",
  });
}

function mapearProduto(produto: MubiSysProduto) {
  return {
    id: produto.id,
    nome: produto.nome,
    categoria: produto.categoria || "",
    status: produto.status || "",
    modelos: (produto.modelos || []).map(modelo => ({
      id: modelo.id,
      nome: modelo.nome,
      unidade: modelo.unidade_cobranca || "",
      status: modelo.status || "",
      valorFinal: Number(modelo.valor_final) || 0,
      variacoes: (Array.isArray(modelo.variacoes) ? modelo.variacoes : []).map(variacao => ({
        id: Number(variacao.id),
        nome: String(variacao.nome || ""),
        descricao: String(variacao.descricao || ""),
        status: String(variacao.status || ""),
        valorFinal: Number(variacao.valor_final) || 0,
        padrao: variacao.padrao === true || ["sim", "1", "true"].includes(String(variacao.padrao || "").toLowerCase()),
      })).filter(variacao => Number.isInteger(variacao.id) && variacao.id > 0 && variacao.nome),
    })),
  };
}

type ComposicaoMubiSys = {
  modeloId: number | null;
  variacaoId: number | null;
  materiaPrimaId: number;
  quantidade: number;
  unidade: string;
};

function normalizarCampo(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numeroValido(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

const CAMPOS_MODELO = new Set(["idmodelo", "modelo_id", "modeloId", "modeloid", "modelid", "idmod", "mod_id"]);
const CAMPOS_VARIACAO = new Set([
  "idvariacao", "variacao_id", "variacaoId", "variacaoid", "idvariante", "variante_id",
  "idmodelo_variacao", "modelo_variacao_id", "idvariacaomodelo",
]);
const CAMPOS_MATERIAL = new Set([
  "idmateriaprima", "materia_prima_id", "materiaPrimaId", "materiaprimaid", "materia_id", "idmateria",
  "materiais_id", "idmateriais", "materiaprimas_id", "idmateriaprimas",
  "idmaterial", "material_id", "materialId", "materialid",
]);
const CAMPOS_QUANTIDADE = new Set([
  "quantidade", "qtd", "qtde", "consumo", "quantidadeconsumo", "consumoquantidade", "quantidadeusada",
  "quantidadeconsumida", "quantidadematerial", "qtdconsumo", "qtdeconsumo",
]);
const CAMPOS_UNIDADE = new Set(["unidade", "unidademedida", "unidadedconsumo", "unidadeconsumo", "consumounidade"]);

function valorPorAlias(campos: Record<string, unknown>, aliases: Set<string>): unknown {
  const aliasesNormalizados = new Set([...aliases].map(normalizarCampo));
  for (const [chave, valor] of Object.entries(campos)) {
    const normalizada = normalizarCampo(chave);
    if (aliasesNormalizados.has(normalizada) || [...aliasesNormalizados].some(alias => normalizada.endsWith(alias))) return valor;
  }
  return undefined;
}

function mapearLinhaComposicao(campos: Record<string, unknown>): ComposicaoMubiSys | null {
  const modeloId = numeroValido(valorPorAlias(campos, CAMPOS_MODELO));
  const variacaoId = numeroValido(valorPorAlias(campos, CAMPOS_VARIACAO));
  const materiaPrimaId = numeroValido(valorPorAlias(campos, CAMPOS_MATERIAL));
  const quantidade = numeroValido(valorPorAlias(campos, CAMPOS_QUANTIDADE));
  if (!materiaPrimaId || materiaPrimaId <= 0 || quantidade === null || quantidade < 0 || (!modeloId && !variacaoId)) return null;
  const unidade = valorPorAlias(campos, CAMPOS_UNIDADE);
  return {
    modeloId: modeloId && modeloId > 0 ? modeloId : null,
    variacaoId: variacaoId && variacaoId > 0 ? variacaoId : null,
    materiaPrimaId: Math.trunc(materiaPrimaId),
    quantidade,
    unidade: typeof unidade === "string" ? unidade.trim() : "",
  };
}

function camposEscalares(objeto: Record<string, unknown>, prefixo = ""): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(objeto)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (valor === null || ["string", "number", "boolean"].includes(typeof valor)) campos[caminho] = valor;
    else if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      for (const [subChave, subValor] of Object.entries(valor)) {
        const caminhoFilho = `${caminho}.${subChave}`;
        if (subValor === null || ["string", "number", "boolean"].includes(typeof subValor)) campos[caminhoFilho] = subValor;
      }
    }
  }
  return campos;
}

function linhasJsonComposicao(conteudo: unknown): ComposicaoMubiSys[] {
  const linhas: ComposicaoMubiSys[] = [];
  const visitar = (valor: unknown, herdados: Record<string, unknown> = {}, prefixo = ""): void => {
    if (Array.isArray(valor)) {
      valor.forEach(item => visitar(item, herdados, prefixo));
      return;
    }
    if (!valor || typeof valor !== "object") return;
    const registro = valor as Record<string, unknown>;
    const campos = { ...herdados, ...camposEscalares(registro, prefixo) };
    const linha = mapearLinhaComposicao(campos);
    if (linha) linhas.push(linha);
    for (const [chave, filho] of Object.entries(registro)) {
      if (filho && typeof filho === "object") {
        visitar(filho, campos, prefixo ? `${prefixo}.${chave}` : chave);
      } else if (typeof filho === "string" && /<table\b/i.test(filho)) {
        linhas.push(...linhasHtmlComposicao(filho));
      }
    }
  };
  visitar(conteudo);
  return linhas;
}

function decodificarHtml(valor: string): string {
  return valor
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function linhasHtmlComposicao(html: string): ComposicaoMubiSys[] {
  const linhas: ComposicaoMubiSys[] = [];
  for (const tabela of html.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
    const trs = [...tabela.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (trs.length < 2) continue;
    const celulas = (row: string) => [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(match => decodificarHtml(match[1]));
    const cabecalho = celulas(trs[0][1]).map(normalizarCampo);
    if (!cabecalho.length) continue;
    for (const tr of trs.slice(1)) {
      const valores = celulas(tr[1]);
      const campos: Record<string, unknown> = {};
      cabecalho.forEach((nome, index) => { if (nome && valores[index] !== undefined) campos[nome] = valores[index]; });
      const linha = mapearLinhaComposicao(campos);
      if (linha) linhas.push(linha);
    }
  }
  return linhas;
}

function temListaVaziaReconhecida(conteudo: unknown): boolean {
  if (Array.isArray(conteudo)) return conteudo.length === 0;
  if (!conteudo || typeof conteudo !== "object") return false;
  return Object.entries(conteudo as Record<string, unknown>).some(([chave, valor]) =>
    /^(data|dados|composicoes|composicao|rows|itens|materiais)$/.test(normalizarCampo(chave)) && Array.isArray(valor) && valor.length === 0,
  );
}

function temTabelaComposicaoVazia(html: string): boolean {
  for (const tabela of html.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
    const trs = [...tabela.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (!trs.length) continue;
    const celulas = (row: string) => [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
      .map(match => normalizarCampo(decodificarHtml(match[1])));
    const cabecalho = celulas(trs[0][1]);
    const temMaterial = cabecalho.some(campo => campo.includes("materiaprima") || campo === "material");
    const temQuantidade = cabecalho.some(campo => campo.includes("quantidade") || ["qtd", "qtde", "consumo"].includes(campo));
    if (!temMaterial || !temQuantidade) continue;
    if (trs.length === 1) return true;
    const textoDados = trs.slice(1).map(tr => decodificarHtml(tr[1])).join(" ");
    if (/\b(nenhum|nenhuma|sem)\b.*\b(registro|item|materia|material)/i.test(textoDados)) return true;
  }
  return false;
}

export function mapearComposicoes(conteudo: unknown): { linhas: ComposicaoMubiSys[]; reconhecido: boolean } {
  const html = typeof conteudo === "string" ? conteudo : "";
  const jsonRows = typeof conteudo === "string" ? [] : linhasJsonComposicao(conteudo);
  const htmlRows = html ? linhasHtmlComposicao(html) : [];
  const linhas = [...jsonRows, ...htmlRows];
  const deduplicadas = [...new Map(linhas.map(linha => [
    `${linha.modeloId || ""}:${linha.variacaoId || ""}:${linha.materiaPrimaId}:${linha.quantidade}:${linha.unidade}`,
    linha,
  ])).values()];
  // Uma tabela qualquer da página (layout, menu etc.) não prova que a ficha veio vazia.
  // Se houver linhas que o parser não entendeu, falhamos explicitamente em vez de dizer
  // silenciosamente que o modelo não possui matéria-prima cadastrada.
  const reconhecido = deduplicadas.length > 0 || temListaVaziaReconhecida(conteudo) || temTabelaComposicaoVazia(html);
  return { linhas: deduplicadas, reconhecido };
}

function mapearMateriaPrima(materia: MubiSysMateriaPrima) {
  return {
    id: materia.id,
    nome: materia.nome,
    categoria: materia.categoria || "",
    tipo: materia.tipo || "",
    unidade: materia.unidade_movimentacao || materia.unidade_custo || "",
    valor: Number(materia.valor_custo) || 0,
    atualizado: materia.data_referencia || "",
    status: materia.status || "",
  };
}

function mapearTabelaPrecos(secoes: Awaited<ReturnType<typeof listPriceTableSections>>) {
  return secoes.flatMap(secao => {
    let conteudo: {
      type?: string;
      columns?: string[];
      rows?: Array<{ id: number; label: string; values: string[] }>;
    };
    try {
      conteudo = JSON.parse(secao.contentJson);
    } catch {
      return [];
    }
    if (conteudo.type !== "margin_table" && conteudo.type !== "margin_table_multi") {
      return [];
    }
    return (conteudo.rows || []).map(linha => ({
      lineId: linha.id,
      secaoTitulo: secao.sectionTitle,
      rotulo: linha.label,
      colunas: conteudo.columns || [],
      valores: linha.values || [],
    }));
  });
}

/** Consulta os catálogos no servidor para manter as credenciais do MubiSys protegidas. */
export function registrarRotaEstudioCatalogoMubiSys(app: Express): void {
  app.get("/api/letra-caixa/catalogo", (req: Request, res: Response) => {
    void carregarCatalogo(req, res).catch(erro => responderErroCatalogo(res, erro));
  });
}

async function carregarCatalogo(req: Request, res: Response): Promise<void> {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        res.status(403).json({ error: "A solicitação precisa vir do próprio sistema." });
        return;
      }
    } catch {
      res.status(403).json({ error: "A origem da solicitação é inválida." });
      return;
    }
  }

  const sessao = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  }).catch(() => null);
  if (!sessao) {
    res.status(401).json({ error: "Entre no Radrasys para carregar o catálogo do MubiSys." });
    return;
  }

  const [produtos, materias] = await Promise.all([
    listarProdutos(),
    listarMateriasPrimas(),
  ]);

  const cookieWebMubiSys = cookieSessaoMubiSys(req, sessao.user.id);
  let sessaoWebConectada = !!cookieWebMubiSys;
  let composicoesMubiSys: ComposicaoMubiSys[] = [];
  let erroComposicoesMubiSys: string | null = null;
  if (cookieWebMubiSys) {
    try {
      const resposta = await buscarComposicoesMubiSys(cookieWebMubiSys);
      if (resposta.unauthorized) {
        sessaoWebConectada = false;
        erroComposicoesMubiSys = "A sessão do MubiSys expirou. Conecte novamente para atualizar os consumos.";
      } else {
        const resultado = mapearComposicoes(resposta.conteudo);
        if (!resultado.reconhecido) {
          erroComposicoesMubiSys = "O MubiSys respondeu, mas o formato do cadastro de consumos mudou. A composição manual continua disponível.";
        } else {
          composicoesMubiSys = resultado.linhas;
        }
      }
    } catch {
      erroComposicoesMubiSys = "Não foi possível consultar os consumos no MubiSys agora.";
    }
  }

  let margens: ReturnType<typeof mapearTabelaPrecos> = [];
  try {
    margens = mapearTabelaPrecos(await listPriceTableSections());
  } catch (erro) {
    // A falha ao consultar a Tabela de Preços não deve esconder os catálogos do ERP.
    console.error("[EstudioCatalogoMubiSys] Falha ao carregar Tabela de Preços:", erro);
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    produtos: produtos.map(mapearProduto),
    materias: materias.map(mapearMateriaPrima),
    composicoesMubiSys,
    mubisysWebConectado: sessaoWebConectada,
    erroComposicoesMubiSys,
    margens,
    carregadoEm: new Date().toISOString(),
  });
}
