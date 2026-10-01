import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { auth } from "../_core/auth";
import { listPriceTableSections } from "../db/db";
import {
  listarMateriasPrimas,
  listarProdutos,
  MubiSysError,
} from "../integrations/mubisys-client";
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
    })),
  };
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
    margens,
    carregadoEm: new Date().toISOString(),
  });
}
