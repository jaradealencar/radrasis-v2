import { and, eq } from "drizzle-orm";
import {
  abcCache,
  mubisysVendasItens,
  mubisysVendasSyncStatus,
  mubisysVariacoes,
  type InsertMubisysVendasItem,
} from "../../drizzle/schema";
import { getDb } from "../db/db";
import { listarOSMubiSys, MubiSysError, type MubiSysOS } from "../integrations/mubisys-client";
import { catalogoPrecisaSincronizar, sincronizarCatalogoMubiSys } from "./mubisysEspelho";

export const TTL_VENDAS_MUBISYS_MS = 6 * 60 * 60 * 1000;
const TAMANHO_LOTE = 250;
const emCurso = new Map<string, Promise<ResultadoSyncVendas>>();

type LinhaOS = MubiSysOS["itens"][number] & Record<string, unknown>;
type ItemCurva = {
  nome: string; total: number; count: number; pct: string; pctAcum: string;
  classe: "A" | "B" | "C"; produtoId: number | null; modeloId: number | null;
  variacaoId: number | null; skuErp: string | null;
};
export interface ResultadoSyncVendas {
  mes: number; ano: number; ordens: number; linhas: number;
  linhasSemValor: number; faturamento: number; sincronizadoEm: Date;
}
export interface CurvaVendasMubiSys extends ResultadoSyncVendas {
  itens: ItemCurva[]; fromCache: boolean; stale: boolean; syncError?: string;
}

function chavePeriodo(mes: number, ano: number) { return `${ano}-${String(mes).padStart(2, "0")}`; }
function inteiroPositivo(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function numero(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const texto = value.trim().replace(/\s/g, "");
  const n = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
  return Number.isFinite(n) ? n : null;
}
function normalizarNome(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function janela(mes: number, ano: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fimMes = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  const hoje = new Date().toISOString().slice(0, 10);
  return { inicio, fim: fimMes > hoje ? hoje : fimMes };
}
function valorLinha(linha: LinhaOS): number | null {
  return numero(linha.valor_final ?? linha.sub_total ?? linha.valor_total);
}
function identidade(venda: Pick<InsertMubisysVendasItem, "produtoId" | "modeloId" | "variacaoId" | "nome">) {
  if (venda.variacaoId) return `variacao:${venda.variacaoId}`;
  if (venda.modeloId) return `modelo:${venda.modeloId}`;
  if (venda.produtoId) return `produto:${venda.produtoId}`;
  return `nome:${normalizarNome(venda.nome)}`;
}

export function montarCurvaABC(vendas: Array<Pick<InsertMubisysVendasItem,
  "produtoId" | "modeloId" | "variacaoId" | "skuErp" | "nome" | "modeloNome" | "variacaoNome" | "quantidade" | "faturamento">>) {
  const agregado = new Map<string, ItemCurva & { total: number; count: number }>();
  for (const venda of vendas) {
    const key = identidade(venda);
    const atual = agregado.get(key) ?? {
      nome: [venda.nome, venda.modeloNome, venda.variacaoNome].filter(Boolean)
        .filter((part, index, all) => all.indexOf(part) === index).join(" · ").slice(0, 256),
      total: 0, count: 0, pct: "0", pctAcum: "0", classe: "C" as const,
      produtoId: venda.produtoId ?? null, modeloId: venda.modeloId ?? null,
      variacaoId: venda.variacaoId ?? null, skuErp: venda.skuErp ?? null,
    };
    atual.total += Number(venda.faturamento ?? 0);
    atual.count += Number(venda.quantidade ?? 0);
    if (!atual.skuErp) atual.skuErp = venda.skuErp ?? null;
    agregado.set(key, atual);
  }
  const itens = [...agregado.values()].sort((a, b) => b.total - a.total);
  const faturamento = itens.reduce((soma, item) => soma + item.total, 0);
  let acumulado = 0;
  const classificados = itens.map(item => {
    acumulado += item.total;
    const pct = faturamento > 0 ? item.total / faturamento * 100 : 0;
    const pctAcum = faturamento > 0 ? acumulado / faturamento * 100 : 0;
    return { ...item, pct: pct.toFixed(1), pctAcum: pctAcum.toFixed(1), classe: (pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C") as "A" | "B" | "C" };
  });
  return { itens: classificados, faturamento };
}

export async function sincronizarVendasMubiSys(mes: number, ano: number, forcar = false): Promise<ResultadoSyncVendas> {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error("Mês inválido para sincronizar vendas.");
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2030) throw new Error("Ano inválido para sincronizar vendas.");
  const chave = chavePeriodo(mes, ano);
  const existente = emCurso.get(chave);
  if (existente) return existente;
  const trabalho = executarSync(mes, ano, forcar);
  emCurso.set(chave, trabalho);
  try { return await trabalho; } finally { emCurso.delete(chave); }
}

async function executarSync(mes: number, ano: number, forcar: boolean): Promise<ResultadoSyncVendas> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para sincronizar vendas MubiSys.");
  const chave = chavePeriodo(mes, ano);
  const [statusAtual] = await db.select().from(mubisysVendasSyncStatus)
    .where(eq(mubisysVendasSyncStatus.chave, chave)).limit(1);
  if (!forcar && statusAtual?.status === "sucesso" && statusAtual.ultimaSincronizacaoEm
    && Date.now() - statusAtual.ultimaSincronizacaoEm.getTime() < TTL_VENDAS_MUBISYS_MS) {
    return { mes, ano, ordens: statusAtual.ordensSincronizadas, linhas: statusAtual.linhasSincronizadas,
      linhasSemValor: statusAtual.linhasSemValor, faturamento: Number(statusAtual.faturamentoTotal),
      sincronizadoEm: statusAtual.ultimaSincronizacaoEm };
  }
  const agora = new Date();
  await db.insert(mubisysVendasSyncStatus).values({ chave, mes, ano, status: "executando", ultimaTentativaEm: agora, updatedAt: agora })
    .onConflictDoUpdate({ target: mubisysVendasSyncStatus.chave, set: { status: "executando", ultimaTentativaEm: agora, ultimoErro: null, updatedAt: agora } });
  try {
    if (await catalogoPrecisaSincronizar(db)) await sincronizarCatalogoMubiSys();
    const datas = janela(mes, ano);
    const { itens: ordensApi, completo } = await listarOSMubiSys({ status: "TODOS", filtrodata: "FATURAMENTO", datainicial: datas.inicio, datafinal: datas.fim });
    if (!completo) throw new Error("A API MubiSys retornou uma página incompleta; os dados locais anteriores foram preservados.");
    const ordens = ordensApi.filter(os => os.tipo !== "Retrabalho" && os.status !== "CANCELADO" && os.data_faturamento);
    const espelho = await db.select().from(mubisysVariacoes);
    const skuVariacao = new Map(espelho.filter(i => i.mubisysVariacaoId != null).map(i => [i.mubisysVariacaoId!, i.skuErp]));
    const skuModelo = new Map(espelho.filter(i => i.tipo === "modelo").map(i => [i.mubisysModeloId, i.skuErp]));
    const linhas: InsertMubisysVendasItem[] = [];
    let linhasSemValor = 0;
    for (const os of ordens) for (const [index, apiLine] of (os.itens ?? []).entries()) {
      const line = apiLine as LinhaOS;
      const valor = valorLinha(line);
      if (valor == null) linhasSemValor++;
      const produtoId = inteiroPositivo(line.produto_id);
      const modeloId = inteiroPositivo(line.modelo_id);
      const variacaoId = inteiroPositivo(line.variacao_id);
      const skuErp = variacaoId ? skuVariacao.get(variacaoId) ?? `MUBISYS-VAR-${variacaoId}`
        : modeloId ? skuModelo.get(modeloId) ?? `MUBISYS-MOD-${modeloId}`
          : produtoId ? `MUBISYS-PROD-${produtoId}` : null;
      linhas.push({
        osId: Number(os.id), osNumero: inteiroPositivo(os.sequencial_ordem),
        itemId: inteiroPositivo(line.id) ?? -(index + 1),
        faturadaEm: String(os.data_faturamento).slice(0, 32), mes, ano,
        produtoId, modeloId, variacaoId, skuErp,
        nome: String(line.item ?? line.descricao ?? line.modelo ?? "Item sem descrição").trim().slice(0, 256),
        modeloNome: String(line.modelo ?? "").trim().slice(0, 256) || null,
        variacaoNome: String(line.variacao ?? "").trim().slice(0, 256) || null,
        quantidade: String(numero(line.quantidade) ?? 1), faturamento: String(valor ?? 0), atualizadoEm: agora,
      });
    }
    const curva = montarCurvaABC(linhas);
    const total = Number(curva.faturamento.toFixed(2));
    await db.transaction(async tx => {
      await tx.delete(mubisysVendasItens).where(and(eq(mubisysVendasItens.mes, mes), eq(mubisysVendasItens.ano, ano)));
      for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) await tx.insert(mubisysVendasItens).values(linhas.slice(i, i + TAMANHO_LOTE));
      const [cache] = await tx.select({ id: abcCache.id }).from(abcCache)
        .where(and(eq(abcCache.mes, mes), eq(abcCache.ano, ano), eq(abcCache.tipo, "produtos"))).limit(1);
      const dados = JSON.stringify(curva.itens);
      if (cache) await tx.update(abcCache).set({ dados, totalOs: ordens.length, faturamentoTotal: total.toFixed(2), updatedAt: agora }).where(eq(abcCache.id, cache.id));
      else await tx.insert(abcCache).values({ mes, ano, tipo: "produtos", dados, totalOs: ordens.length, faturamentoTotal: total.toFixed(2), updatedAt: agora });
      await tx.insert(mubisysVendasSyncStatus).values({ chave, mes, ano, status: "sucesso", ultimaTentativaEm: agora,
        ultimaSincronizacaoEm: agora, ordensSincronizadas: ordens.length, linhasSincronizadas: linhas.length,
        linhasSemValor, faturamentoTotal: total.toFixed(2), ultimoErro: null, updatedAt: agora })
        .onConflictDoUpdate({ target: mubisysVendasSyncStatus.chave, set: { status: "sucesso", ultimaTentativaEm: agora,
          ultimaSincronizacaoEm: agora, ordensSincronizadas: ordens.length, linhasSincronizadas: linhas.length,
          linhasSemValor, faturamentoTotal: total.toFixed(2), ultimoErro: null, updatedAt: agora } });
    });
    return { mes, ano, ordens: ordens.length, linhas: linhas.length, linhasSemValor, faturamento: total, sincronizadoEm: agora };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar vendas MubiSys.";
    await db.insert(mubisysVendasSyncStatus).values({ chave, mes, ano, status: "erro", ultimaTentativaEm: agora, ultimoErro: message.slice(0, 4000), updatedAt: new Date() })
      .onConflictDoUpdate({ target: mubisysVendasSyncStatus.chave, set: { status: "erro", ultimaTentativaEm: agora, ultimoErro: message.slice(0, 4000), updatedAt: new Date() } });
    throw error;
  }
}

export async function obterCurvaVendasMubiSys(mes: number, ano: number, forcar = false): Promise<CurvaVendasMubiSys> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para ler a Curva ABC local.");
  const chave = chavePeriodo(mes, ano);
  const [antes] = await db.select().from(mubisysVendasSyncStatus).where(eq(mubisysVendasSyncStatus.chave, chave)).limit(1);
  const fromCache = !forcar && antes?.status === "sucesso" && !!antes.ultimaSincronizacaoEm
    && Date.now() - antes.ultimaSincronizacaoEm.getTime() < TTL_VENDAS_MUBISYS_MS;
  const [cache] = await db.select().from(abcCache).where(and(eq(abcCache.mes, mes), eq(abcCache.ano, ano), eq(abcCache.tipo, "produtos"))).limit(1);
  try {
    const sync = await sincronizarVendasMubiSys(mes, ano, forcar);
    const [atualizado] = await db.select().from(abcCache).where(and(eq(abcCache.mes, mes), eq(abcCache.ano, ano), eq(abcCache.tipo, "produtos"))).limit(1);
    return { ...sync, itens: atualizado ? JSON.parse(atualizado.dados) as ItemCurva[] : [], fromCache, stale: false };
  } catch (error) {
    if (!cache) throw error;
    const message = error instanceof MubiSysError
      ? `MubiSys HTTP ${error.status}: não foi possível atualizar; mostrando o último cache.`
      : "Não foi possível atualizar MubiSys; mostrando o último cache local.";
    return { mes, ano, ordens: antes?.ordensSincronizadas ?? 0, linhas: antes?.linhasSincronizadas ?? 0,
      linhasSemValor: antes?.linhasSemValor ?? 0, faturamento: Number(cache.faturamentoTotal),
      sincronizadoEm: cache.updatedAt, itens: JSON.parse(cache.dados) as ItemCurva[], fromCache: true, stale: true, syncError: message };
  }
}