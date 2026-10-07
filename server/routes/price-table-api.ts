/**
 * Export REST somente-leitura da Tabela de Preços para o precificador
 * automatizado externo consumir:
 *
 *   GET /api/v1/price-table/export
 *
 * Devolve todas as seções com os IDs estáveis atribuídos a cada linha de
 * margem e a cada regra (ver server/integrations/priceTableIds.ts) — o
 * precificador cruza os próprios dados usando esses IDs em vez do texto do
 * label, que pode ser editado a qualquer momento pela tela. Protegido por
 * `Authorization: Bearer <PRICE_TABLE_API_KEY>` (ou header `x-api-key`),
 * seguindo o mesmo padrão de server/routes/campanhas-whatsapp-api.ts. Sem a
 * variável configurada, responde 503 (API desligada) — nunca fica aberto
 * por esquecimento.
 */

import { timingSafeEqual } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { getDb, listPriceTableSections, getPriceTableMeta } from "../db/db";
import { priceTableAffiliations, priceTableBlockPairs } from "../../drizzle/schema";
import type { ConfigItem, MarginRow } from "../../shared/price-table";

function chaveConfere(recebida: string, esperada: string): boolean {
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function exigirChaveApi(req: Request, res: Response, next: NextFunction) {
  const esperada = process.env.PRICE_TABLE_API_KEY;
  if (!esperada) {
    res
      .status(503)
      .json({
        erro: "API desativada: configure PRICE_TABLE_API_KEY no servidor.",
      });
    return;
  }
  const cabecalho = String(req.headers.authorization ?? "");
  const recebida = cabecalho.startsWith("Bearer ")
    ? cabecalho.slice(7).trim()
    : String(req.headers["x-api-key"] ?? "");
  if (!recebida || !chaveConfere(recebida, esperada)) {
    res.status(401).json({ erro: "Chave de API inválida ou ausente." });
    return;
  }
  next();
}

/** "Clientes Antigos" = páginas 1-3, "Novo Cliente" = páginas 11-13 (mesmo
 * critério usado em TabelaPrecos.tsx). Páginas 4-5 são de consulta, sem
 * linhas/regras editáveis com ID. */
function abaDaPagina(
  page: number
): "clientes_antigos" | "novo_cliente" | "consulta" {
  if (page >= 11 && page <= 13) return "novo_cliente";
  if (page >= 1 && page <= 3) return "clientes_antigos";
  return "consulta";
}

export function registrarRotasPriceTableApi(app: Express) {
  app.get("/api/v1/price-table/export", exigirChaveApi, async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Banco local indisponivel.");
      const [secoes, meta, pares, afiliacoes] = await Promise.all([
        listPriceTableSections(),
        getPriceTableMeta(),
        db.select().from(priceTableBlockPairs),
        db.select().from(priceTableAffiliations),
      ]);
      const parPorSecao = new Map<number, typeof pares[number]>();
      const produtosPorPar = new Map<number, Array<{ id: number; mubisys_produto_id: number; nome: string; categoria: string | null }>>();
      for (const par of pares) {
        parPorSecao.set(par.principalSectionId, par);
        parPorSecao.set(par.novoClienteSectionId, par);
      }
      for (const produto of afiliacoes) {
        const lista = produtosPorPar.get(produto.blockPairId) ?? [];
        lista.push({ id: produto.id, mubisys_produto_id: produto.mubisysProdutoId, nome: produto.nomeProduto, categoria: produto.categoria });
        produtosPorPar.set(produto.blockPairId, lista);
      }

      const resultado = secoes.map(sec => {
        let conteudo: {
          type?: string;
          columns?: string[];
          rows?: MarginRow[];
          items?: ConfigItem[];
        } = {};
        try {
          conteudo = JSON.parse(sec.contentJson);
        } catch {
          conteudo = {};
        }

        const isMargin =
          conteudo.type === "margin_table" ||
          conteudo.type === "margin_table_multi";
        const isConfig = conteudo.type === "config";

        // As condições comerciais legadas da página 5 aparecem como página 6 na interface.
        const pagina = sec.page === 5 ? 6 : sec.page;
        return {
          secao_id: sec.id,
          pagina,
          aba: abaDaPagina(pagina),
          titulo: sec.sectionTitle,
          bloco_pareado: parPorSecao.has(sec.id) ? {
            id: parPorSecao.get(sec.id)!.id,
            secao_clientes_antigos_id: parPorSecao.get(sec.id)!.principalSectionId,
            secao_novo_cliente_id: parPorSecao.get(sec.id)!.novoClienteSectionId,
            produtos: produtosPorPar.get(parPorSecao.get(sec.id)!.id) ?? [],
          } : null,
          faixa_ids: Array.isArray((conteudo as { faixaIds?: unknown }).faixaIds) ? (conteudo as { faixaIds: number[] }).faixaIds : null,
          tipo: conteudo.type ?? null,
          colunas: isMargin ? (conteudo.columns ?? []) : null,
          linhas: isMargin
            ? (conteudo.rows ?? []).map(r => ({
                id: r.id,
                rotulo: r.label,
                valores: r.values,
              }))
            : null,
          regras: isConfig
            ? (conteudo.items ?? []).map(it => ({
                id: it.id,
                rotulo: it.label,
                valor: it.value,
                observacao: it.note ?? null,
              }))
            : null,
        };
      });

      res.json({
        versao: meta?.versao ?? null,
        atualizado_em: meta?.dataModificacao ?? null,
        secoes: resultado,
      });
    } catch (erro) {
      console.error("[price-table-api] export:", erro);
      res
        .status(500)
        .json({ erro: "Erro interno ao gerar o export da Tabela de Preços." });
    }
  });
}
