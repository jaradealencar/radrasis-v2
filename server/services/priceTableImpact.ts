import { and, eq } from "drizzle-orm";
import { mubisysVendasItens, priceTableHistory, priceTableSections, produtos } from "../../drizzle/schema";
import { getDb } from "../db/db";
import { obterCurvaVendasMubiSys } from "./mubisysVendas";

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const percentual = (s: unknown): number | null => {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  return m ? Number(m[1].replace(",", ".")) : null;
};
type Row = { id: number; label: string; values: string[] };
type Snapshot = { type?: string; rows?: Row[] };
const ignorarTermos = new Set(["servico", "pintura", "poliuretano", "somente", "areas", "internas", "clientes", "todas", "cores", "brasil"]);

export async function obterImpactoHistoricoTabela(mes: number, ano: number, tabela: "principal" | "novo_cliente") {
  const db = await getDb();
  if (!db) throw new Error("Banco local indisponível.");
  const curva = await obterCurvaVendasMubiSys(mes, ano);
  const [historico, secoes, vendas, cadastro] = await Promise.all([
    db.select().from(priceTableHistory).where(eq(priceTableHistory.campoAlterado, "contentJson")),
    db.select().from(priceTableSections),
    db.select().from(mubisysVendasItens).where(and(eq(mubisysVendasItens.mes, mes), eq(mubisysVendasItens.ano, ano))),
    db.select({ idPrecificacao: produtos.idPrecificacao, modeloId: produtos.mubisysModeloId, nome: produtos.nome }).from(produtos).where(eq(produtos.ativo, true)),
  ]);
  const paginaBase = tabela === "novo_cliente" ? 11 : 1;
  const paginaPorSecao = new Map(secoes.map(s => [s.id, s.page]));
  const regras = cadastro.filter(p => p.idPrecificacao != null && p.modeloId != null);
  const classePorModelo = new Map(curva.itens.flatMap(i => i.modeloId == null ? [] : [[i.modeloId, i.classe] as const]));
  const parse = (s: string | null): Snapshot | null => { try { return s ? JSON.parse(s) as Snapshot : null; } catch { return null; } };
  const eventos = historico.filter(h => {
    const page = paginaPorSecao.get(h.sectionId);
    return page != null && page >= paginaBase && page <= paginaBase + 2;
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const itens: Array<{ versao: string; data: Date; secao: string; item: string; deltaPp: number; classe: "A" | "B" | "C" | "—"; faturamento: number; impactoMin: number; impactoMax: number; correspondencia: string }> = [];
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
    const tokens = normalizar(evento.sectionTitle ?? "").split(" ").filter(t => t.length >= 3 && !ignorarTermos.has(t));
    const vendasCorrespondentes = vendas.filter(v => {
      const descricoes = [v.nome, v.modeloNome, v.variacaoNome].filter(Boolean).map(s => normalizar(s!));
      const materiais = tokens.filter(token => ["galvanizado", "pvc", "verniz", "dourado", "inox", "acrilico", "acm", "latao"].includes(token));
        const chaves = materiais.length ? materiais : tokens;
        return chaves.length > 0 && descricoes.some(desc => chaves.some(token => desc.split(" ").includes(token)));
    });
    const depoisDoEvento = vendasCorrespondentes;
    const receita = depoisDoEvento.reduce((s, v) => s + Number(v.faturamento), 0);
    const modelos = [...new Set(depoisDoEvento.map(v => v.modeloId).filter((n): n is number => n != null))];
    const classes = modelos.map(id => classePorModelo.get(id)).filter((c): c is "A" | "B" | "C" => !!c);
    const classe = classes.includes("A") ? "A" : classes.includes("B") ? "B" : classes.includes("C") ? "C" : "—";
    const fatores = mudancas.map(({ anterior, nova }) => anterior < 100 && nova < 100 ? (1 - anterior / 100) / (1 - nova / 100) - 1 : Number.NaN).filter(Number.isFinite);
    const impactos = fatores.map(f => receita * f);
    const normalTitulo = normalizar(evento.sectionTitle ?? "");
    const regra = regras.find(p => {
      if (!normalTitulo || normalizar(p.nome).length < 8) return false;
      const nome = normalizar(p.nome);
      return nome === normalTitulo || nome.includes(normalTitulo) || normalTitulo.includes(nome);
    });
    itens.push({ versao: evento.versao, data: evento.createdAt, secao: evento.sectionTitle ?? "Seção", item: `${(depois.rows ?? []).length} linha(s) / ${mudancas.length} faixa(s)`, deltaPp: mudancas.reduce((s, m) => s + m.nova - m.anterior, 0) / mudancas.length, classe, faturamento: receita, impactoMin: impactos.length ? Math.min(...impactos) : 0, impactoMax: impactos.length ? Math.max(...impactos) : 0, correspondencia: regra && depoisDoEvento.some(v => v.modeloId === regra.modeloId) ? "modelo MubiSys" : depoisDoEvento.length ? "descrição da OS" : "sem venda compatível" });
  }
  return { mes, ano, tabela, atualizadoEm: curva.sincronizadoEm, faturamentoMes: curva.faturamento, itens, cobertura: itens.filter(i => i.correspondencia !== "sem venda compatível").length, observacao: "Impacto estimado mantendo custo, volume e conversão constantes. A venda não informa a faixa de margem selecionada nem desconto. Eventos repetidos do mesmo item têm exposição compartilhada e não devem ser somados como impacto líquido." };
}