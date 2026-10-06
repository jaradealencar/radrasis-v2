import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { auth } from "../_core/auth";
import { listPriceTableSections } from "../db/db";
import {
  carregarCatalogoEspelhado,
  catalogoPrecisaSincronizar,
  sincronizarCatalogoMubiSys,
} from "../services/mubisysEspelho";

function erro(res: Response, status: number, mensagem: string): void { res.status(status).json({ error: mensagem }); }

function mapearTabelaPrecos(secoes: Awaited<ReturnType<typeof listPriceTableSections>>) {
  return secoes.flatMap(secao => {
    let conteudo: { type?: string; columns?: string[]; rows?: Array<{ id: number; label: string; values: string[] }> };
    try { conteudo = JSON.parse(secao.contentJson); } catch { return []; }
    if (conteudo.type !== "margin_table" && conteudo.type !== "margin_table_multi") return [];
    return (conteudo.rows || []).map(linha => ({
      lineId: linha.id, secaoTitulo: secao.sectionTitle, rotulo: linha.label,
      colunas: conteudo.columns || [], valores: linha.values || [],
    }));
  });
}

/** Catálogo do CPQ servido do espelho PostgreSQL; nenhuma sessão de tela do ERP é usada. */
export function registrarRotaEstudioCatalogoMubiSys(app: Express): void {
  app.get("/api/letra-caixa/catalogo", (req: Request, res: Response) => {
    void carregarCatalogo(req, res).catch(error => {
      console.error("[EstudioCatalogoMubiSys] Falha ao ler o espelho:", error);
      if (!res.headersSent) erro(res, 503, error instanceof Error ? error.message : "Não foi possível carregar o espelho local do MubiSys.");
    });
  });
}

async function carregarCatalogo(req: Request, res: Response): Promise<void> {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) return erro(res, 403, "A solicitação precisa vir do próprio sistema.");
    } catch { return erro(res, 403, "A origem da solicitação é inválida."); }
  }
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) return erro(res, 401, "Entre no Radrasys para carregar o catálogo espelhado.");

  let catalogo = await carregarCatalogoEspelhado();
  const temSnapshot = catalogo.produtos.length > 0 && catalogo.materias.length > 0;
  if (!temSnapshot) {
    // Primeiro uso: precisa obter o catálogo público antes de ter dados para responder.
    await sincronizarCatalogoMubiSys();
    catalogo = await carregarCatalogoEspelhado();
  } else if (await catalogoPrecisaSincronizar()) {
    // Stale-while-revalidate: não bloqueia orçamento por latência/indisponibilidade do ERP.
    void sincronizarCatalogoMubiSys().catch(error => console.error("[MubiSysEspelho] Atualização em segundo plano falhou:", error));
  }

  let margens: ReturnType<typeof mapearTabelaPrecos> = [];
  try { margens = mapearTabelaPrecos(await listPriceTableSections()); }
  catch (error) { console.error("[EstudioCatalogoMubiSys] Falha ao carregar Tabela de Preços:", error); }

  const disponivel = !!catalogo.espelhoStatus?.ultimaSincronizacaoEm;
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    ...catalogo,
    mubisysWebConectado: disponivel,
    erroComposicoesMubiSys: null,
    margens,
    carregadoEm: new Date().toISOString(),
  });
}
