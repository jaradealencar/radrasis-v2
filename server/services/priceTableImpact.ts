import { and, eq } from "drizzle-orm";
import {
  mubisysVendasItens,
  mubisysVariacoes,
  priceTableAffiliations,
  priceTableBlockPairs,
  priceTableHistory,
  priceTableSections,
} from "../../drizzle/schema";
import { getDb } from "../db/db";
import { obterCurvaVendasMubiSys } from "./mubisysVendas";
import { filtrarVendasPorProdutosAfiliados } from "./priceTableAffiliationImpact";

const percentual = (s: unknown): number | null => {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  return m ? Number(m[1].replace(",", ".")) : null;
};
type Row = { id: number; label: string; values: string[] };
type Snapshot = { type?: string; rows?: Row[] };

export async function obterImpactoHistoricoTabela(mes: number, ano: number, tabela: "principal" | "novo_cliente") {
  const db = await getDb();
  if (!db) throw new Error("Banco local indisponivel.");
  const curva = await obterCurvaVendasMubiSys(mes, ano);
  const [historico, secoes, vendas, pares, afiliacoes, catalogo] = await Promise.all([
    db.select().from(priceTableHistory).where(eq(priceTableHistory.campoAlterado, "contentJson")),
    db.select().from(priceTableSections),
    db.select().from(mubisysVendasItens).where(and(eq(mubisysVendasItens.mes, mes), eq(mubisysVendasItens.ano, ano))),
    db.select().from(priceTableBlockPairs),
    db.select().from(priceTableAffiliations),
    db.select({ produtoId: mubisysVariacoes.mubisysProdutoId, modeloId: mubisysVariacoes.mubisysModeloId, variacaoId: mubisysVariacoes.mubisysVariacaoId }).from(mubisysVariacoes),
  ]);
  const paginaBase = tabela === "novo_cliente" ? 11 : 1;
  const paginaPorSecao = new Map(secoes.map(s => [s.id, s.page]));
  const parPorSecao = new Map<number, number>();
  for (const par of pares) parPorSecao.set(tabela === "novo_cliente" ? par.novoClienteSectionId : par.principalSectionId, par.id);
  const idsProdutoPorPar = new Map<number, Set<number>>();
  for (const item of afiliacoes) {
    const ids = idsProdutoPorPar.get(item.blockPairId) ?? new Set<number>();
    ids.add(item.mubisysProdutoId);
    idsProdutoPorPar.set(item.blockPairId, ids);
  }
  const produtoPorModelo = new Map(catalogo.map(item => [item.modeloId, item.produtoId]));
  const produtoPorVariacao = new Map(catalogo.flatMap(item => item.variacaoId == null ? [] : [[item.variacaoId, item.produtoId] as const]));
  const classePorVariacao = new Map(curva.itens.flatMap(i => i.variacaoId == null ? [] : [[i.variacaoId, i.classe] as const]));
  const classePorModelo = new Map(curva.itens.flatMap(i => i.modeloId == null ? [] : [[i.modeloId, i.classe] as const]));
  const classePorProduto = new Map(curva.itens.flatMap(i => i.produtoId == null ? [] : [[i.produtoId, i.classe] as const]));
  const parse = (s: string | null): Snapshot | null => { try { return s ? JSON.parse(s) as Snapshot : null; } catch { return null; } };
  const eventos = historico.filter(h => {
    const page = paginaPorSecao.get(h.sectionId);
    return page != null && page >= paginaBase && page <= paginaBase + 2;
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const itens: Array<{ versao: string; data: Date; secao: string; item: string; deltaPp: number; classe: "A" | "B" | "C" | null; faturamento: number; impactoMin: number; impactoMax: number; correspondencia: string }> = [];
  for (const evento of eventos) {
    const antes = parse(evento.valorAnterior);
    const depois = parse(evento.valorNovo);
    if (!antes || !depois) continue;
    const rowsAntes = new Map((antes.rows ?? []).map(r => [r.id, r]));
    const mudancas = (depois.rows ?? []).flatMap(nova => {
      const antiga = rowsAntes.get(nova.id);
      if (!antiga) return [];
      return (nova.values ?? []).flatMap((v, idx) => {
        const a = percentual(antiga.values?.[idx]); const n = percentual(v);
        return a == null || n == null || a === n ? [] : [{ anterior: a, nova: n }];
      });
    });
    if (!mudancas.length) continue;
    const parId = parPorSecao.get(evento.sectionId);
    const idsProduto = parId == null ? new Set<number>() : (idsProdutoPorPar.get(parId) ?? new Set<number>());
    const vendasCorrespondentes = filtrarVendasPorProdutosAfiliados(
      vendas,
      idsProduto,
      produtoPorVariacao,
      produtoPorModelo,
    );
    const receita = vendasCorrespondentes.reduce((s, v) => s + Number(v.faturamento), 0);
    const classes = vendasCorrespondentes.map(v =>
      (v.variacaoId != null ? classePorVariacao.get(v.variacaoId) : undefined)
      ?? (v.modeloId != null ? classePorModelo.get(v.modeloId) : undefined)
      ?? (v.produtoId != null ? classePorProduto.get(v.produtoId) : undefined)
    ).filter((c): c is "A" | "B" | "C" => !!c);
    const classe = classes.includes("A") ? "A" : classes.includes("B") ? "B" : classes.includes("C") ? "C" : null;
    const fatores = mudancas.map(({ anterior, nova }) => anterior < 100 && nova < 100 ? (1 - anterior / 100) / (1 - nova / 100) - 1 : Number.NaN).filter(Number.isFinite);
    const impactos = fatores.map(f => receita * f);
    const correspondencia = !parId ? "bloco sem par" : !idsProduto.size ? "sem produtos vinculados" : vendasCorrespondentes.length ? "afiliacao explicita por produto" : "produto vinculado sem venda no periodo";
    itens.push({
      versao: evento.versao,
      data: evento.createdAt,
      secao: evento.sectionTitle ?? "Seção",
      item: (depois.rows ?? []).length + " linha(s) / " + mudancas.length + " faixa(s)",
      deltaPp: mudancas.reduce((s, m) => s + m.nova - m.anterior, 0) / mudancas.length,
      classe,
      faturamento: receita,
      impactoMin: impactos.length ? Math.min(...impactos) : 0,
      impactoMax: impactos.length ? Math.max(...impactos) : 0,
      correspondencia,
    });
  }
  return {
    mes,
    ano,
    tabela,
    atualizadoEm: curva.sincronizadoEm,
    faturamentoMes: curva.faturamento,
    itens,
    cobertura: itens.filter(i => i.correspondencia === "afiliacao explicita por produto").length,
    observacao: "Impacto estimado somente sobre produtos explicitamente afiliados ao bloco, mantendo custo, volume e conversao constantes. A venda nao informa a faixa de margem selecionada nem desconto. Eventos repetidos do mesmo bloco tem exposicao compartilhada e nao devem ser somados como impacto liquido.",
  };
}
