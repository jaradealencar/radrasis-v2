import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { user as userTable } from "../../drizzle/schema";
import https from "https";

// ─── HELPER: Buscar OS no Mubisys ERP ────────────────────────────────────────
async function buscarOsMubisys(numeroOs: string): Promise<{
  nomeCliente: string;
  cnpj: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  empresa: string;
  larguraM: number | null;
  alturaM: number | null;
  metrosQuadrados: number | null;
} | null> {
  const publicKey = process.env.MUBISYS_PUBLIC_KEY ?? "";
  const accessToken = process.env.MUBISYS_ACCESS_TOKEN ?? "";
  if (!publicKey || !accessToken) return null;
  try {
    const url = `https://api.mubisys.com/api/${publicKey}/ordem-servico/numero/${encodeURIComponent(numeroOs)}`;
    const data = await new Promise<string>((resolve, reject) => {
      const req = https.get(url, { headers: { "Access-Token": accessToken, "Accept": "application/json" } }, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => body += chunk);
        res.on("end", () => resolve(body));
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    const json = JSON.parse(data);
    if (!json || json.error || !json.cliente) return null;
    // Extrair CNPJ/CPF do campo cliente (ex: "RONAN MACIEL FIALHO 02886829129")
    const clienteStr: string = json.cliente ?? "";
    const cnpjMatch = clienteStr.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{0,2}|\d{11,14})$/);
    const cnpj = cnpjMatch ? cnpjMatch[0].trim() : "";
    const nomeCliente = cnpjMatch ? clienteStr.replace(cnpjMatch[0], "").trim() : clienteStr.trim();
    const enderecos: any[] = json.cliente_endereco ?? [];
    const end = enderecos[0] ?? {};
    const cep = (end.cep ?? "").replace(/\D/g, "");
    const endereco = [end.logradouro, end.numero, end.complemento, end.bairro].filter(Boolean).join(", ");
    // Extrair medidas dos itens com "letreiro" no nome e somar os m²
    // Suporta tanto itens diretos quanto itens_agrupados (quando a OS agrupa sub-itens)
    const itens: any[] = json.itens ?? [];
    let larguraM: number | null = null;
    let alturaM: number | null = null;
    let metrosQuadrados: number | null = null;
    let totalM2 = 0;
    let primeiroLetreiro: { l: number; a: number } | null = null;
    // Flatten: itens diretos + sub-itens agrupados
    const todosItens: any[] = [];
    for (const item of itens) {
      todosItens.push(item);
      if (Array.isArray(item.itens_agrupados)) {
        for (const sub of item.itens_agrupados) todosItens.push(sub);
      }
    }
    for (const item of todosItens) {
      const nomeItem: string = (item.item ?? item.descricao ?? "").toLowerCase();
      if (!nomeItem.includes("letreiro")) continue;
      const l = parseFloat(String(item.largura ?? 0));
      const a = parseFloat(String(item.altura ?? 0));
      const qtd = parseFloat(String(item.quantidade ?? 1)) || 1;
      if (l > 0 && a > 0) {
        totalM2 += l * a * qtd;
        if (!primeiroLetreiro) primeiroLetreiro = { l, a };
      }
    }
    if (totalM2 > 0) {
      larguraM = primeiroLetreiro?.l ?? null;
      alturaM = primeiroLetreiro?.a ?? null;
      metrosQuadrados = parseFloat(totalM2.toFixed(4));
    }
    return {
      nomeCliente,
      cnpj,
      cep,
      endereco,
      cidade: end.cidade ?? "",
      estado: end.estado ?? "",
      empresa: json.empresa ?? "",
      larguraM,
      alturaM,
      metrosQuadrados,
    };
  } catch {
    return null;
  }
}
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "../db/db-connection";
import {
  empacotamentoModelos,
  empacotamentoPedidos,
  empacotamentoTabelaPrecos,
  empacotamentoModelosCaixa,
  empacotamentoChecklistItens,
  empacotamentoPedidoUsuarios,
  empacotamentoPedidoFotos,
  empacotamentoPedidoChecklist,
  empacotamentoInsumos,
  empacotamentoConsumoCaixa,
  empacotamentoCustoFuncionario,
  empacotamentoInsumosLetreiro,
  empacotamentoCronometroPausas,
  empacotamentoConfigProdutividade,
  empacotamentoChecklistLetreitoItens,
  empacotamentoPedidoChecklistLetreiro,
  empacotamentoSessoes,
  empacotamentoSessoesPausas,
} from "../../drizzle/schema";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import { storagePut } from "../db/storage";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(getPool());
  return _db;
}
const db = {
  select: () => getDb().select(),
  insert: (t: Parameters<ReturnType<typeof drizzle>["insert"]>[0]) => getDb().insert(t),
  update: (t: Parameters<ReturnType<typeof drizzle>["update"]>[0]) => getDb().update(t),
  delete: (t: Parameters<ReturnType<typeof drizzle>["delete"]>[0]) => getDb().delete(t),
};


// ─── HELPER: Calcular ranking de produtividade ────────────────────────────────
// Calcula tempo estimado de um pedido em minutos
async function calcularTempoEstimadoMin(pedido: typeof empacotamentoPedidos.$inferSelect | undefined): Promise<number> {
  if (!pedido) return 0;
  if (pedido.modeloId) {
    const modelos = await getDb().select().from(empacotamentoModelos).where(eq(empacotamentoModelos.id, pedido.modeloId)).limit(1);
    const modelo = modelos[0];
    const tempoPorM2 = parseFloat(String(modelo?.tempoPorM2Min ?? '0'));
    const area = parseFloat(String(pedido.metrosQuadrados ?? '0'));
    if (tempoPorM2 > 0 && area > 0) return tempoPorM2 * area;
  } else if (pedido.modeloCaixaId) {
    const mcs = await getDb().select().from(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.id, pedido.modeloCaixaId)).limit(1);
    const mc = mcs[0];
    if (mc) {
      const tipoCaixa = (mc as any).tipoCaixa;
      if (tipoCaixa === 'personalizada') {
        const l = parseFloat(String(mc.larguraCm ?? '0')), a2 = parseFloat(String(mc.alturaCm ?? '0')), p2 = parseFloat(String(mc.profundidadeCm ?? '0'));
        const tM3 = parseFloat(String((mc as any).tempoPorM3Min ?? '0'));
        if (l > 0 && a2 > 0 && p2 > 0 && tM3 > 0) return (l * a2 * p2 / 1_000_000) * tM3;
      } else {
        const l = parseFloat(String(mc.larguraCm ?? '0')), a2 = parseFloat(String(mc.alturaCm ?? '0'));
        const tM2 = parseFloat(String((mc as any).tempoPorM2Min ?? '0'));
        if (l > 0 && a2 > 0 && tM2 > 0) return (l * a2 / 10_000) * tM2;
      }
    }
  }
  return 0;
}

async function calcularRanking(inicioTs: number, fimTs: number) {
  // Buscar sessões finalizadas no período (usando timestamps UTC em segundos)
  const sessoes = await getDb().select().from(empacotamentoSessoes)
    .where(and(
      eq(empacotamentoSessoes.status, 'finalizado'),
      sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
      sql`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
      sql`${empacotamentoSessoes.registradoEm} <= ${fimTs}`,
    ));
  const config = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1));
  const cfg = config[0] ?? { valorPorMinuto: '0.15' };
  const valorMin = parseFloat(String(cfg.valorPorMinuto));
  const pedidoIds = Array.from(new Set(sessoes.map(s => s.pedidoId)));
  let pedidos: typeof empacotamentoPedidos.$inferSelect[] = [];
  if (pedidoIds.length > 0) {
    pedidos = await getDb().select().from(empacotamentoPedidos)
      .where(sql`${empacotamentoPedidos.id} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
  }
  const porOperador: Record<string, { nome: string; totalMinutos: number; totalPedidos: number; eficienciaMedia: number; eficienciaCount: number; valorTotal: number }> = {};
  for (const sessao of sessoes) {
    const nome = sessao.operadorNome ?? 'Desconhecido';
    // Usar tempoRegistradoSegundos (tempo formal) ou totalSegundos como fallback
    const tempoSeg = sessao.tempoRegistradoSegundos ?? sessao.totalSegundos ?? 0;
    const tempoEfetivoMin = tempoSeg / 60;
    const pedido = pedidos.find(p => p.id === sessao.pedidoId);
    const tempoEstimadoMin = await calcularTempoEstimadoMin(pedido);
    let fator = 1.0;
    if (tempoEstimadoMin > 0 && tempoEfetivoMin > 0) {
      const varPct = (tempoEfetivoMin - tempoEstimadoMin) / tempoEstimadoMin;
      const passos = Math.floor(Math.abs(varPct) / 0.05);
      const ajuste = passos * 0.05;
      fator = varPct > 0 ? Math.max(0.5, 1.0 - ajuste) : Math.min(1.5, 1.0 + ajuste);
    }
    if (!porOperador[nome]) porOperador[nome] = { nome, totalMinutos: 0, totalPedidos: 0, eficienciaMedia: 0, eficienciaCount: 0, valorTotal: 0 };
    porOperador[nome].totalMinutos += tempoEfetivoMin;
    porOperador[nome].totalPedidos += 1;
    porOperador[nome].valorTotal += tempoEfetivoMin * valorMin * fator;
    if (tempoEstimadoMin > 0 && tempoEfetivoMin > 0) {
      porOperador[nome].eficienciaMedia += Math.round((tempoEstimadoMin / tempoEfetivoMin) * 100);
      porOperador[nome].eficienciaCount += 1;
    }
  }
  return Object.values(porOperador)
    .map(o => ({
      posicao: 0,
      nome: o.nome,
      totalMinutos: parseFloat(o.totalMinutos.toFixed(1)),
      totalPedidos: o.totalPedidos,
      eficienciaMedia: o.eficienciaCount > 0 ? Math.round(o.eficienciaMedia / o.eficienciaCount) : null,
      valorTotal: parseFloat(o.valorTotal.toFixed(2)),
    }))
    .sort((a, b) => (b.eficienciaMedia ?? 0) - (a.eficienciaMedia ?? 0) || b.totalMinutos - a.totalMinutos)
    .map((o, idx) => ({ ...o, posicao: idx + 1 }));
}

export const empacotamentoRouter = router({
  // ─── MODELOS DE LETREIRO ────────────────────────────────────────────────────

  modelos: router({
    list: publicProcedure.query(async () => {
      return await db
        .select()
        .from(empacotamentoModelos)
        .orderBy(asc(empacotamentoModelos.nome));
    }),

    listAtivos: publicProcedure.query(async () => {
      return await db
        .select()
        .from(empacotamentoModelos)
        .where(eq(empacotamentoModelos.ativo, 1))
        .orderBy(asc(empacotamentoModelos.nome));
    }),

    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1).max(128),
        descricao: z.string().optional(),
        tempoPorM2Min: z.number().min(0).optional(),
        valorProdutividadePorMinLetreiro: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.insert(empacotamentoModelos).values({
          nome: input.nome,
          descricao: input.descricao ?? null,
          tempoPorM2Min: input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null,
          valorProdutividadePorMinLetreiro: input.valorProdutividadePorMinLetreiro != null ? String(input.valorProdutividadePorMinLetreiro) : null,
          ativo: 1,
        } as Record<string, unknown>);
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).max(128),
        descricao: z.string().optional(),
        ativo: z.number().optional(),
        modeloCaixaIdPadrao: z.number().nullable().optional(),
        tempoPorM2Min: z.number().min(0).nullable().optional(),
        valorProdutividadePorMinLetreiro: z.number().min(0).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const upd: Record<string, unknown> = { nome: input.nome, descricao: input.descricao ?? null, ativo: input.ativo ?? 1 };
        if (input.modeloCaixaIdPadrao !== undefined) upd.modeloCaixaIdPadrao = input.modeloCaixaIdPadrao;
        if (input.tempoPorM2Min !== undefined) upd.tempoPorM2Min = input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null;
        if (input.valorProdutividadePorMinLetreiro !== undefined) upd.valorProdutividadePorMinLetreiro = input.valorProdutividadePorMinLetreiro != null ? String(input.valorProdutividadePorMinLetreiro) : null;
        await db.update(empacotamentoModelos).set(upd).where(eq(empacotamentoModelos.id, input.id));
        return { success: true };
      }),

    // Atualiza tempo e produtividade de TODOS os letreiros de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure
      .input(z.object({
        tempoPorM2Min: z.number().min(0).nullable(),
        valorProdutividadePorMinLetreiro: z.number().min(0).nullable(),
      }))
      .mutation(async ({ input }) => {
        const upd: Record<string, unknown> = {};
        if (input.tempoPorM2Min !== null) upd.tempoPorM2Min = String(input.tempoPorM2Min);
        if (input.valorProdutividadePorMinLetreiro !== null) upd.valorProdutividadePorMinLetreiro = String(input.valorProdutividadePorMinLetreiro);
        if (Object.keys(upd).length > 0) {
          await db.update(empacotamentoModelos).set(upd);
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoModelos).where(eq(empacotamentoModelos.id, input.id));
        return { success: true };
      }),
  }),

  // ─── MODELOS DE CAIXA ───────────────────────────────────────────────────────

  modelosCaixa: router({
    list: publicProcedure.query(async () => {
      return await db
        .select()
        .from(empacotamentoModelosCaixa)
        .orderBy(asc(empacotamentoModelosCaixa.nome));
    }),

    listAtivos: publicProcedure.query(async () => {
      return await db
        .select()
        .from(empacotamentoModelosCaixa)
        .where(eq(empacotamentoModelosCaixa.ativo, 1))
        .orderBy(asc(empacotamentoModelosCaixa.nome));
    }),

    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1).max(128),
        descricao: z.string().optional(),
        larguraCm: z.number().optional(),
        alturaCm: z.number().optional(),
        profundidadeCm: z.number().optional(),
        tipoCaixa: z.enum(["padronizada", "personalizada"]).default("padronizada"),
        custoAquisicao: z.number().min(0).default(0),
        tempoPorM2Min: z.number().min(0).optional(),
        tempoPorM3Min: z.number().min(0).optional(),
        tempoPorMetroArestaMin: z.number().min(0).optional(),
        valorProdutividadePorCm2: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.insert(empacotamentoModelosCaixa).values({
          nome: input.nome,
          descricao: input.descricao ?? null,
          larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
          alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
          profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
          tipoCaixa: input.tipoCaixa,
          custoAquisicao: String(input.custoAquisicao),
          custoAquisicaoAtualizadoEm: new Date(),
          tempoPorM2Min: input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null,
          tempoPorM3Min: input.tempoPorM3Min != null ? String(input.tempoPorM3Min) : null,
          tempoPorMetroArestaMin: input.tempoPorMetroArestaMin != null ? String(input.tempoPorMetroArestaMin) : null,
          valorProdutividadePorCm2: input.valorProdutividadePorCm2 != null ? String(input.valorProdutividadePorCm2) : null,
          ativo: 1,
        } as Record<string, unknown>);
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).max(128),
        descricao: z.string().optional(),
        larguraCm: z.number().optional(),
        alturaCm: z.number().optional(),
        profundidadeCm: z.number().optional(),
        tipoCaixa: z.enum(["padronizada", "personalizada"]).optional(),
        custoAquisicao: z.number().min(0).optional(),
        tempoPorM2Min: z.number().min(0).optional(),
        tempoPorM3Min: z.number().min(0).nullable().optional(),
        tempoPorMetroArestaMin: z.number().min(0).nullable().optional(),
        valorProdutividadePorCm2: z.number().min(0).nullable().optional(),
        ativo: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const setData: Record<string, unknown> = {
          nome: input.nome,
          descricao: input.descricao ?? null,
          larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
          alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
          profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
          tipoCaixa: input.tipoCaixa ?? "padronizada",
          ativo: input.ativo ?? 1,
        };
        if (input.custoAquisicao != null) {
          setData.custoAquisicao = String(input.custoAquisicao);
          setData.custoAquisicaoAtualizadoEm = new Date();
        }
        if (input.tempoPorM2Min != null) setData.tempoPorM2Min = String(input.tempoPorM2Min);
        if (input.tempoPorM3Min !== undefined) setData.tempoPorM3Min = input.tempoPorM3Min != null ? String(input.tempoPorM3Min) : null;
        if (input.tempoPorMetroArestaMin !== undefined) setData.tempoPorMetroArestaMin = input.tempoPorMetroArestaMin != null ? String(input.tempoPorMetroArestaMin) : null;
        if (input.valorProdutividadePorCm2 !== undefined) setData.valorProdutividadePorCm2 = input.valorProdutividadePorCm2 != null ? String(input.valorProdutividadePorCm2) : null;
        await db.update(empacotamentoModelosCaixa).set(setData).where(eq(empacotamentoModelosCaixa.id, input.id));
        return { success: true };
      }),

    // Atualiza tempo e produtividade de TODAS as caixas de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure
      .input(z.object({
        tempoPorM2Min: z.number().min(0).nullable(),
        tempoPorMetroArestaMin: z.number().min(0).nullable(),
        valorProdutividadePorCm2: z.number().min(0).nullable(),
      }))
      .mutation(async ({ input }) => {
        const upd: Record<string, unknown> = {};
        if (input.tempoPorM2Min !== null) upd.tempoPorM2Min = String(input.tempoPorM2Min);
        if (input.tempoPorMetroArestaMin !== null) upd.tempoPorMetroArestaMin = String(input.tempoPorMetroArestaMin);
        if (input.valorProdutividadePorCm2 !== null) upd.valorProdutividadePorCm2 = String(input.valorProdutividadePorCm2);
        if (Object.keys(upd).length > 0) {
          await db.update(empacotamentoModelosCaixa).set(upd);
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.id, input.id));
        return { success: true };
      }),
  }),

  // ─── CHECKLIST POR MODELO DE CAIXA ─────────────────────────────────────────

  checklist: router({
    listPorCaixa: publicProcedure
      .input(z.object({ modeloCaixaId: z.number() }))
      .query(async ({ input }) => {
        return await db
          .select()
          .from(empacotamentoChecklistItens)
          .where(eq(empacotamentoChecklistItens.modeloCaixaId, input.modeloCaixaId))
          .orderBy(asc(empacotamentoChecklistItens.ordem));
      }),

    addItem: publicProcedure
      .input(z.object({
        modeloCaixaId: z.number(),
        descricao: z.string().min(1).max(256),
        obrigatorio: z.number().default(1),
        ordem: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await db.insert(empacotamentoChecklistItens).values({
          modeloCaixaId: input.modeloCaixaId,
          descricao: input.descricao,
          obrigatorio: input.obrigatorio,
          ordem: input.ordem,
        });
        return { success: true };
      }),

    updateItem: publicProcedure
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).max(256),
        obrigatorio: z.number().optional(),
        ordem: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.update(empacotamentoChecklistItens)
          .set({
            descricao: input.descricao,
            obrigatorio: input.obrigatorio ?? 1,
            ordem: input.ordem ?? 0,
          })
          .where(eq(empacotamentoChecklistItens.id, input.id));
        return { success: true };
      }),

    deleteItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoChecklistItens).where(eq(empacotamentoChecklistItens.id, input.id));
        return { success: true };
      }),

    // Checklist preenchido por pedido
    getPorPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return await db
          .select()
          .from(empacotamentoPedidoChecklist)
          .where(eq(empacotamentoPedidoChecklist.pedidoId, input.pedidoId));
      }),

    marcarItem: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        itemId: z.number(),
        marcado: z.number(), // 0 ou 1
        marcadoPor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Upsert: verificar se já existe
        const existing = await getDb()
          .select()
          .from(empacotamentoPedidoChecklist)
          .where(
            and(
              eq(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
              eq(empacotamentoPedidoChecklist.itemId, input.itemId)
            )
          );

        if (existing.length > 0) {
          await db.update(empacotamentoPedidoChecklist)
            .set({
              marcado: input.marcado,
              marcadoPor: input.marcadoPor ?? null,
              marcadoEm: input.marcado ? new Date() : null,
            })
            .where(
              and(
                eq(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
                eq(empacotamentoPedidoChecklist.itemId, input.itemId)
              )
            );
        } else {
          await db.insert(empacotamentoPedidoChecklist).values({
            pedidoId: input.pedidoId,
            itemId: input.itemId,
            marcado: input.marcado,
            marcadoPor: input.marcadoPor ?? null,
            marcadoEm: input.marcado ? new Date() : null,
          });
        }
        return { success: true };
      }),
  }),

  // ─── CHECKLIST POR MODELO DE LETREIRO ────────────────────────────────────

  checklistLetreiro: router({
    listPorModelo: publicProcedure
      .input(z.object({ modeloId: z.number() }))
      .query(async ({ input }) => {
        return await db
          .select()
          .from(empacotamentoChecklistLetreitoItens)
          .where(eq(empacotamentoChecklistLetreitoItens.modeloLetreitoId, input.modeloId))
          .orderBy(asc(empacotamentoChecklistLetreitoItens.ordem));
      }),

    addItem: publicProcedure
      .input(z.object({
        modeloId: z.number(),
        descricao: z.string().min(1).max(512),
        obrigatorio: z.number().default(1),
        ordem: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await db.insert(empacotamentoChecklistLetreitoItens).values({
          modeloLetreitoId: input.modeloId,
          descricao: input.descricao,
          obrigatorio: input.obrigatorio,
          ordem: input.ordem,
        });
        return { success: true };
      }),

    updateItem: publicProcedure
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).max(512),
        obrigatorio: z.number().optional(),
        ordem: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.update(empacotamentoChecklistLetreitoItens)
          .set({ descricao: input.descricao, obrigatorio: input.obrigatorio ?? 1, ordem: input.ordem ?? 0 })
          .where(eq(empacotamentoChecklistLetreitoItens.id, input.id));
        return { success: true };
      }),

    deleteItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoChecklistLetreitoItens).where(eq(empacotamentoChecklistLetreitoItens.id, input.id));
        return { success: true };
      }),

    getPorPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return await db
          .select()
          .from(empacotamentoPedidoChecklistLetreiro)
          .where(eq(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId));
      }),

    marcarItem: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        itemId: z.number(),
        marcado: z.number(),
        marcadoPor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getDb()
          .select()
          .from(empacotamentoPedidoChecklistLetreiro)
          .where(and(
            eq(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
            eq(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
          ));
        if (existing.length > 0) {
          await db.update(empacotamentoPedidoChecklistLetreiro)
            .set({ marcado: input.marcado, marcadoPor: input.marcadoPor ?? null, marcadoEm: input.marcado ? new Date() : null })
            .where(and(
              eq(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
              eq(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
            ));
        } else {
          await db.insert(empacotamentoPedidoChecklistLetreiro).values({
            pedidoId: input.pedidoId,
            itemId: input.itemId,
            marcado: input.marcado,
            marcadoPor: input.marcadoPor ?? null,
            marcadoEm: input.marcado ? new Date() : null,
          });
        }
        return { success: true };
      }),
  }),

  // ─── TABELA DE PREÇOS (letreiro × caixa) ────────────────────────────────────

  precos: router({
    list: publicProcedure.query(async () => {
      return await db
        .select()
        .from(empacotamentoTabelaPrecos)
        .orderBy(asc(empacotamentoTabelaPrecos.modeloId), asc(empacotamentoTabelaPrecos.tipoCaixa));
    }),

    listByModelo: publicProcedure
      .input(z.object({ modeloId: z.number() }))
      .query(async ({ input }) => {
        return await db
          .select()
          .from(empacotamentoTabelaPrecos)
          .where(eq(empacotamentoTabelaPrecos.modeloId, input.modeloId))
          .orderBy(asc(empacotamentoTabelaPrecos.tipoCaixa));
      }),

    upsert: publicProcedure
      .input(z.object({
        modeloId: z.number(),
        tipoCaixa: z.string().min(1).max(64),
        valorComissao: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const existing = await getDb()
          .select()
          .from(empacotamentoTabelaPrecos)
          .where(
            and(
              eq(empacotamentoTabelaPrecos.modeloId, input.modeloId),
              eq(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
            )
          );

        if (existing.length > 0) {
          await db.update(empacotamentoTabelaPrecos)
            .set({ valorComissao: String(input.valorComissao) })
            .where(
              and(
                eq(empacotamentoTabelaPrecos.modeloId, input.modeloId),
                eq(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
              )
            );
        } else {
          await db.insert(empacotamentoTabelaPrecos).values({
            modeloId: input.modeloId,
            tipoCaixa: input.tipoCaixa,
            valorComissao: String(input.valorComissao),
          });
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoTabelaPrecos).where(eq(empacotamentoTabelaPrecos.id, input.id));
        return { success: true };
      }),
  }),

  // ─── PEDIDOS ────────────────────────────────────────────────────────────────

  pedidos: router({
    list: publicProcedure
      .input(z.object({
        kanbanStatus: z.enum(["aguardando", "embalando", "patio", "abandonado", "todos"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        if (input?.kanbanStatus && input.kanbanStatus !== "todos") {
          return await getDb()
            .select()
            .from(empacotamentoPedidos)
            .where(eq(empacotamentoPedidos.kanbanStatus, input.kanbanStatus))
            .orderBy(asc(empacotamentoPedidos.prazoEntrega), desc(empacotamentoPedidos.createdAt));
        }
        return await getDb()
          .select()
          .from(empacotamentoPedidos)
          .orderBy(asc(empacotamentoPedidos.prazoEntrega), desc(empacotamentoPedidos.createdAt));
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(eq(empacotamentoPedidos.id, input.id));
        return rows[0] ?? null;
      }),

    // ─── Lista pedidos de um vendedor específico (para alertas de status) ──────
    listPorVendedor: publicProcedure
      .input(z.object({ vendedorNome: z.string() }))
      .query(async ({ input }) => {
        const nome = input.vendedorNome.toLowerCase().trim();
        const todos = await getDb()
          .select({
            id: empacotamentoPedidos.id,
            numeroPedido: empacotamentoPedidos.numeroPedido,
            cliente: empacotamentoPedidos.cliente,
            kanbanStatus: empacotamentoPedidos.kanbanStatus,
            createdByNome: empacotamentoPedidos.createdByNome,
            updatedAt: empacotamentoPedidos.updatedAt,
          })
          .from(empacotamentoPedidos)
          .orderBy(desc(empacotamentoPedidos.updatedAt));
        return todos.filter(p => (p.createdByNome ?? "").toLowerCase().trim() === nome);
      }),

    // ─── INTEGRAÇÃO MUBISYS: Buscar dados da OS pelo número ───────────────────────────
    buscarOs: publicProcedure
      .input(z.object({ numeroOs: z.string().min(1) }))
      .query(async ({ input }) => {
        const dados = await buscarOsMubisys(input.numeroOs);
        return dados;
      }),

    create: publicProcedure
      .input(z.object({
        numeroPedido: z.string().min(1).max(64),
        cliente: z.string().min(1).max(256),
        modeloId: z.number().optional(),
        modeloNome: z.string().optional(),
        modeloCaixaId: z.number().optional(),
        modeloCaixaNome: z.string().optional(),
        tipoCaixa: z.string().max(64).default(""),
        arquivoUrl: z.string().optional(),
        arquivoKey: z.string().optional(),
        arquivoTipo: z.string().optional(),
        prazoEntrega: z.string().optional(), // ISO datetime
        horarioMaximo: z.string().optional(), // "HH:MM"
        observacoes: z.string().optional(),
        createdBy: z.number().optional(),
        createdByNome: z.string().optional(),
        larguraCm: z.number().optional(),
        alturaCm: z.number().optional(),
        profundidadeCm: z.number().optional(),
        pesoKg: z.number().min(0).optional(),
        metrosQuadrados: z.number().min(0).optional(),
        cnpjCliente: z.string().optional(),
        cepCliente: z.string().optional(),
        enderecoCliente: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const [result] = await db.insert(empacotamentoPedidos).values({
          numeroPedido: input.numeroPedido,
          cliente: input.cliente,
          modeloId: input.modeloId ?? null,
          modeloNome: input.modeloNome ?? null,
          modeloCaixaId: input.modeloCaixaId ?? null,
          modeloCaixaNome: input.modeloCaixaNome ?? null,
          tipoCaixa: input.tipoCaixa,
          arquivoUrl: input.arquivoUrl ?? null,
          arquivoKey: input.arquivoKey ?? null,
          arquivoTipo: input.arquivoTipo ?? null,
          kanbanStatus: "aguardando",
          prazoEntrega: input.prazoEntrega ? new Date(input.prazoEntrega) : null,
          horarioMaximo: input.horarioMaximo ?? null,
          observacoes: input.observacoes ?? null,
          createdBy: input.createdBy ?? null,
          createdByNome: input.createdByNome ?? null,
          larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
          alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
          profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
          pesoKg: input.pesoKg != null ? String(input.pesoKg) : null,
          metrosQuadrados: input.metrosQuadrados != null ? String(input.metrosQuadrados) : null,
          cnpjCliente: input.cnpjCliente ?? null,
          cepCliente: input.cepCliente ?? null,
          enderecoCliente: input.enderecoCliente ?? null,
        } as Record<string, unknown>).returning({ id: empacotamentoPedidos.id });
        return { success: true, id: result.id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        numeroPedido: z.string().optional(),
        cliente: z.string().optional(),
        modeloId: z.number().optional(),
        modeloNome: z.string().optional(),
        modeloCaixaId: z.number().optional(),
        modeloCaixaNome: z.string().optional(),
        tipoCaixa: z.string().optional(),
        prazoEntrega: z.string().optional(),
        horarioMaximo: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, prazoEntrega, ...rest } = input;
        await db.update(empacotamentoPedidos)
          .set({
            ...rest,
            prazoEntrega: prazoEntrega ? new Date(prazoEntrega) : undefined,
          })
          .where(eq(empacotamentoPedidos.id, id));
        return { success: true };
      }),

    atualizarDimensoes: publicProcedure
      .input(z.object({
        id: z.number(),
        larguraCm: z.number().min(0).nullable().optional(),
        alturaCm: z.number().min(0).nullable().optional(),
        profundidadeCm: z.number().min(0).nullable().optional(),
        pesoKg: z.number().min(0).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...dims } = input;
        const setData: Record<string, unknown> = {};
        if (dims.larguraCm !== undefined) setData.larguraCm = dims.larguraCm != null ? String(dims.larguraCm) : null;
        if (dims.alturaCm !== undefined) setData.alturaCm = dims.alturaCm != null ? String(dims.alturaCm) : null;
        if (dims.profundidadeCm !== undefined) setData.profundidadeCm = dims.profundidadeCm != null ? String(dims.profundidadeCm) : null;
        if (dims.pesoKg !== undefined) setData.pesoKg = dims.pesoKg != null ? String(dims.pesoKg) : null;
        await getDb().update(empacotamentoPedidos).set(setData).where(eq(empacotamentoPedidos.id, id));
        return { success: true };
      }),

    moverKanban: publicProcedure
      .input(z.object({
        id: z.number(),
        kanbanStatus: z.enum(["aguardando", "embalando", "patio", "abandonado"]),
      }))
      .mutation(async ({ input }) => {
        const updates: Record<string, unknown> = { kanbanStatus: input.kanbanStatus };
        const { cotacoesFrete } = await import("../../drizzle/schema");

        if (input.kanbanStatus === "patio") {
          updates.finalizadoEm = new Date();
          // Buscar dados do pedido para integração com Frete
          const pedidos = await getDb()
            .select()
            .from(empacotamentoPedidos)
            .where(eq(empacotamentoPedidos.id, input.id));
          const pedido = pedidos[0];
          if (pedido) {
            // ── Deduplicação: verificar se já existe card de frete para este pedido ──
            const existing = await getDb()
              .select({ id: cotacoesFrete.id })
              .from(cotacoesFrete)
              .where(eq(cotacoesFrete.empacotamentoPedidoId, input.id))
              .limit(1);
            if (existing.length === 0) {
              // Integração automática: criar pré-fila no kanban de Solicitações de Frete
              const fotos = await getDb()
                .select()
                .from(empacotamentoPedidoFotos)
                .where(eq(empacotamentoPedidoFotos.pedidoId, input.id))
                .orderBy(desc(empacotamentoPedidoFotos.id))
                .limit(1);
              const fotoUrl = fotos[0]?.url ?? pedido.arquivoUrl ?? null;
              // Tentar extrair cidade/estado do enderecoCliente (ex: "Rua X, 123, Bairro, Cidade - SP")
              let municipioAuto = "(a preencher)";
              let estadoAuto = "SP";
              const endStr = (pedido as any).enderecoCliente ?? "";
              if (endStr) {
                const partes = endStr.split(",").map((s: string) => s.trim());
                const ultimaParte = partes[partes.length - 1] ?? "";
                const cidadeEstado = ultimaParte.split("-").map((s: string) => s.trim());
                if (cidadeEstado.length >= 2) { municipioAuto = cidadeEstado[0]; estadoAuto = cidadeEstado[1]; }
                else if (cidadeEstado.length === 1 && cidadeEstado[0]) { municipioAuto = cidadeEstado[0]; }
              }
              await getDb().insert(cotacoesFrete).values({
                destinatarioNome: pedido.cliente ?? "(a preencher)",
                destinatarioCnpj: (pedido as any).cnpjCliente ?? undefined,
                cepDestino: (pedido as any).cepCliente ?? undefined,
                municipio: municipioAuto,
                estado: estadoAuto,
                observacoes: `Pedido de empacotamento #${pedido.numeroPedido ?? pedido.id} — ${pedido.modeloNome ?? ""}`.trim(),
                fotoUrl: fotoUrl ?? undefined,
                empacotamentoPedidoId: pedido.id,
                empacotamentoPedidoNumero: pedido.numeroPedido ?? String(pedido.id),
                dimensoesLargura: pedido.larguraCm ?? undefined,
                dimensoesAltura: pedido.alturaCm ?? undefined,
                dimensoesComprimento: pedido.profundidadeCm ?? undefined,
                pesoKg: (pedido as any).pesoKg ?? undefined,
                tipoMaterial: pedido.modeloNome ?? undefined,
                status: "aberta",
              } as any);
            }
            // Se já existe, reativar o card cancelado/removido se estiver cancelado
            else {
              await getDb()
                .update(cotacoesFrete)
                .set({ status: "aberta" } as any)
                .where(
                  eq(cotacoesFrete.empacotamentoPedidoId, input.id)
                );
            }
          }
        }

        // ── Ao retroagir para "embalando" ou "aguardando": remover/cancelar card de frete ──
        if (input.kanbanStatus === "embalando" || input.kanbanStatus === "aguardando") {
          // Cancelar card de frete que ainda está na fila (não iniciado)
          await getDb()
            .update(cotacoesFrete)
            .set({ status: "cancelada" } as any)
            .where(
              eq(cotacoesFrete.empacotamentoPedidoId, input.id)
            );
        }

        await getDb()
          .update(empacotamentoPedidos)
          .set(updates as { kanbanStatus: "aguardando" | "embalando" | "patio" | "abandonado"; finalizadoEm?: Date; })
          .where(eq(empacotamentoPedidos.id, input.id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(empacotamentoPedidos).where(eq(empacotamentoPedidos.id, input.id));
        return { success: true };
      }),

    uploadArquivo: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        base64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.fileName.split(".").pop() ?? "png";
        const key = `empacotamento/pedido-${input.pedidoId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        const tipo = input.mimeType.includes("pdf") ? "pdf" : "image";
        await db.update(empacotamentoPedidos)
          .set({ arquivoUrl: url, arquivoKey: key, arquivoTipo: tipo })
          .where(eq(empacotamentoPedidos.id, input.pedidoId));
        return { url, key };
      }),

    uploadFoto: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        base64: z.string(),
        mimeType: z.string(),
        usuarioNome: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : "jpg";
        const key = `empacotamento/foto-${input.pedidoId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.insert(empacotamentoPedidoFotos).values({
          pedidoId: input.pedidoId,
          storageKey: key,
          url,
          usuarioNome: input.usuarioNome ?? null,
        });
        return { url, key };
      }),

    listFotos: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return await getDb()
          .select()
          .from(empacotamentoPedidoFotos)
          .where(eq(empacotamentoPedidoFotos.pedidoId, input.pedidoId))
          .orderBy(desc(empacotamentoPedidoFotos.createdAt));
      }),

    atualizarFotoAnotada: publicProcedure
      .input(z.object({
        fotoId: z.number(),
        base64: z.string(), // PNG com anotações
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `empacotamento/foto-anotada-${input.fotoId}-${Date.now()}.png`;
        const { url } = await storagePut(key, buffer, "image/png");
        await getDb()
          .update(empacotamentoPedidoFotos)
          .set({ url, storageKey: key })
          .where(eq(empacotamentoPedidoFotos.id, input.fotoId));
        return { url };
      }),

    // Salva o arquivo do supervisor (imagem) com anotações canvas
    atualizarArquivoPedidoAnotado: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        base64: z.string(), // PNG com anotações
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `empacotamento/arquivo-anotado-${input.pedidoId}-${Date.now()}.png`;
        const { url } = await storagePut(key, buffer, "image/png");
        await getDb()
          .update(empacotamentoPedidos)
          .set({ arquivoUrl: url, arquivoKey: key, arquivoTipo: "image" })
          .where(eq(empacotamentoPedidos.id, input.pedidoId));
        return { url };
      }),
    // Verifica se um pedido pode ir para o pátio (checklist + operador)
    checkPendencias: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        const pedidos = await getDb().select().from(empacotamentoPedidos).where(eq(empacotamentoPedidos.id, input.pedidoId));
        const pedido = pedidos[0];
        if (!pedido) return { podeIrPatio: false, semOperador: true, checklistPendentes: 0, motivos: ["Pedido não encontrado"] };
        const motivos: string[] = [];
        // Verificar se já houve ao menos um colaborador no pedido (ativo ou que já saiu)
        const operadores = await getDb().select().from(empacotamentoPedidoUsuarios)
          .where(eq(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId));
        const temOperador = operadores.length > 0;
        if (!temOperador) motivos.push("Nenhum colaborador vinculado ao pedido");
        // Verificar checklist da caixa
        let checklistPendentes = 0;
        if (pedido.modeloCaixaId) {
          const itens = await getDb().select().from(empacotamentoChecklistItens)
            .where(and(eq(empacotamentoChecklistItens.modeloCaixaId, pedido.modeloCaixaId), eq(empacotamentoChecklistItens.obrigatorio, 1)));
          const marcados = await getDb().select().from(empacotamentoPedidoChecklist)
            .where(and(eq(empacotamentoPedidoChecklist.pedidoId, input.pedidoId), eq(empacotamentoPedidoChecklist.marcado, 1)));
          const marcadosIds = new Set(marcados.map(m => m.itemId));
          checklistPendentes += itens.filter(i => !marcadosIds.has(i.id)).length;
        }
        // Verificar checklist do letreiro
        if (pedido.modeloId) {
          const itensLetreiro = await getDb().select().from(empacotamentoChecklistLetreitoItens)
            .where(and(eq(empacotamentoChecklistLetreitoItens.modeloLetreitoId, pedido.modeloId), eq(empacotamentoChecklistLetreitoItens.obrigatorio, 1)));
          const marcadosLetreiro = await getDb().select().from(empacotamentoPedidoChecklistLetreiro)
            .where(and(eq(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId), eq(empacotamentoPedidoChecklistLetreiro.marcado, 1)));
          const marcadosIdsLetreiro = new Set(marcadosLetreiro.map(m => m.itemId));
          checklistPendentes += itensLetreiro.filter(i => !marcadosIdsLetreiro.has(i.id)).length;
        }
        if (checklistPendentes > 0) motivos.push(`${checklistPendentes} item(ns) obrigatório(s) do checklist pendente(s)`);
        // Verificar foto obrigatória
        const fotos = await getDb().select({ id: empacotamentoPedidoFotos.id })
          .from(empacotamentoPedidoFotos)
          .where(eq(empacotamentoPedidoFotos.pedidoId, input.pedidoId))
          .limit(1);
        const temFoto = fotos.length > 0;
        if (!temFoto) motivos.push("Fotografia do pedido embalado é obrigatória");
        // Verificar peso obrigatório
        const temPeso = pedido.pesoKg != null && parseFloat(String(pedido.pesoKg)) > 0;
        if (!temPeso) motivos.push("Peso (kg) é obrigatório");
        // Verificar medidas obrigatórias (A × L × P)
        const temMedidas = pedido.alturaCm != null && pedido.larguraCm != null && pedido.profundidadeCm != null &&
          parseFloat(String(pedido.alturaCm)) > 0 && parseFloat(String(pedido.larguraCm)) > 0 && parseFloat(String(pedido.profundidadeCm)) > 0;
        if (!temMedidas) motivos.push("Medidas da caixa (A × L × P) são obrigatórias");
        // Verificar se há sessões de temporizador ainda abertas (ativo ou pausado) sem registro
        // Sessões com status 'finalizado' já foram registradas — não bloquear
        const sessoesAbertas = await getDb().select().from(empacotamentoSessoes)
          .where(and(
            eq(empacotamentoSessoes.pedidoId, input.pedidoId),
            sql`${empacotamentoSessoes.status} IN ('ativo', 'pausado')`
          ));
        const temOperadorSemRegistro = sessoesAbertas.length > 0;
        if (temOperadorSemRegistro) motivos.push(`${sessoesAbertas.length} operador(es) com cronômetro ativo sem registrar o tempo. Clique em 'Registrar' antes de mover para o Pátio.`);
        const podeIrPatio = temOperador && checklistPendentes === 0 && temFoto && temPeso && temMedidas && !temOperadorSemRegistro;
        return { podeIrPatio, semOperador: !temOperador, checklistPendentes, temFoto, temPeso, temMedidas, temOperadorSemRegistro, motivos };
      }),
  }),

  // ─── USUÁRIOS POR PEDIDO (cronômetro + atribuição) ──────────────────────────

  pedidoUsuarios: router({
    listPorPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        return await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(eq(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId))
          .orderBy(asc(empacotamentoPedidoUsuarios.createdAt));
      }),

    entrar: publicProcedure
      .input(z.object({
        pedidoId: z.number(),
        usuarioId: z.string().optional(),
        usuarioNome: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Verificar se já está ativo neste pedido
        const existing = await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(
            and(
              eq(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
              eq(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome),
              eq(empacotamentoPedidoUsuarios.ativo, 1)
            )
          );
        if (existing.length > 0) return { success: true, id: existing[0].id };

        const [result] = await getDb()
          .insert(empacotamentoPedidoUsuarios)
          .values({
            pedidoId: input.pedidoId,
            usuarioId: input.usuarioId ?? null,
            usuarioNome: input.usuarioNome,
            iniciadoEm: new Date(),
            ativo: 1,
          })
          .returning({ id: empacotamentoPedidoUsuarios.id });
        // Mover pedido para "embalando" se ainda estiver aguardando
        const pedidos = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(eq(empacotamentoPedidos.id, input.pedidoId));
        if (pedidos[0]?.kanbanStatus === "aguardando") {
          await getDb()
            .update(empacotamentoPedidos)
            .set({ kanbanStatus: "embalando" })
            .where(eq(empacotamentoPedidos.id, input.pedidoId));
        }
        return { success: true, id: result.id };
      }),

    sair: publicProcedure
      .input(z.object({
        id: z.number(),
        tempoSegundos: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.update(empacotamentoPedidoUsuarios)
          .set({
            finalizadoEm: new Date(),
            tempoSegundos: input.tempoSegundos,
            ativo: 0,
          })
          .where(eq(empacotamentoPedidoUsuarios.id, input.id));
        return { success: true };
      }),

    atualizarTempo: publicProcedure
      .input(z.object({
        id: z.number(),
        tempoSegundos: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        await db.update(empacotamentoPedidoUsuarios)
          .set({ tempoSegundos: input.tempoSegundos })
          .where(eq(empacotamentoPedidoUsuarios.id, input.id));
        return { success: true };
      }),

    // Retorna o registro ativo do operador (por usuarioId ou nome) e o pedido correspondente
    pedidoAtivoDoOperador: publicProcedure
      .input(z.object({
        usuarioId: z.string().optional(),
        usuarioNome: z.string().optional(),
      }))
      .query(async ({ input }) => {
        if (!input.usuarioId && !input.usuarioNome) return null;
        const conditions = [eq(empacotamentoPedidoUsuarios.ativo, 1)];
        if (input.usuarioId) {
          conditions.push(eq(empacotamentoPedidoUsuarios.usuarioId, input.usuarioId));
        } else if (input.usuarioNome) {
          conditions.push(eq(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome));
        }
        const registros = await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(and(...conditions))
          .orderBy(desc(empacotamentoPedidoUsuarios.createdAt))
          .limit(1);
        if (!registros.length) return null;
        const reg = registros[0];
        const pedidos = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(and(
            eq(empacotamentoPedidos.id, reg.pedidoId),
            eq(empacotamentoPedidos.kanbanStatus, "embalando")
          ))
          .limit(1);
        if (!pedidos.length) return null;
        return { pedido: pedidos[0], registro: reg };
      }),
  }),

  // ─── RELATÓRIO DE FECHAMENTO ─────────────────────────────────────────────────

  relatorio: router({
    fechamento: publicProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const inicio = new Date(input.dataInicio);
        const fim = new Date(input.dataFim);
        fim.setHours(23, 59, 59, 999);

        const pedidos = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(
            and(
              eq(empacotamentoPedidos.kanbanStatus, "patio"),
              gte(empacotamentoPedidos.finalizadoEm, inicio),
              lte(empacotamentoPedidos.finalizadoEm, fim)
            )
          )
          .orderBy(asc(empacotamentoPedidos.finalizadoEm));

        // Buscar usuários que trabalharam em cada pedido
        const pedidoIds = pedidos.map(p => p.id);
        let usuariosTrabalho: typeof empacotamentoPedidoUsuarios.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          usuariosTrabalho = await getDb()
            .select()
            .from(empacotamentoPedidoUsuarios)
            .where(sql`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }

        // Agrupar por operador
        const porOperador: Record<string, {
          operadorNome: string;
          totalComissao: number;
          quantidade: number;
          tempoTotalSegundos: number;
        }> = {};

        for (const u of usuariosTrabalho) {
          const nome = u.usuarioNome;
          if (!porOperador[nome]) {
            porOperador[nome] = { operadorNome: nome, totalComissao: 0, quantidade: 0, tempoTotalSegundos: 0 };
          }
          porOperador[nome].tempoTotalSegundos += u.tempoSegundos ?? 0;
          porOperador[nome].quantidade += 1;
        }

        // Distribuir comissão igualmente entre os operadores de cada pedido
        for (const p of pedidos) {
          const ops = usuariosTrabalho.filter(u => u.pedidoId === p.id);
          const comissao = parseFloat(p.valorComissao ?? "0");
          if (ops.length > 0 && comissao > 0) {
            const share = comissao / ops.length;
            for (const u of ops) {
              if (porOperador[u.usuarioNome]) {
                porOperador[u.usuarioNome].totalComissao += share;
              }
            }
          }
        }

        const totalGeral = Object.values(porOperador).reduce((acc, o) => acc + o.totalComissao, 0);

        return {
          totalGeral,
          totalPedidos: pedidos.length,
          porOperador: Object.values(porOperador).sort((a, b) => b.totalComissao - a.totalComissao),
          pedidos,
        };
      }),

    resumoDia: publicProcedure.query(async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const pedidosHoje = await getDb()
        .select()
        .from(empacotamentoPedidos)
        .where(
          and(
            eq(empacotamentoPedidos.kanbanStatus, "patio"),
            gte(empacotamentoPedidos.finalizadoEm, hoje),
            lte(empacotamentoPedidos.finalizadoEm, amanha)
          )
        );

      const totalHoje = pedidosHoje.reduce((acc, p) => acc + parseFloat(p.valorComissao ?? "0"), 0);
      const aguardando = await getDb()
        .select({ count: sql<number>`COUNT(*)` })
        .from(empacotamentoPedidos)
        .where(eq(empacotamentoPedidos.kanbanStatus, "aguardando"));

      return {
        finalizadosHoje: pedidosHoje.length,
        totalComissaoHoje: totalHoje,
        pendentes: Number(aguardando[0]?.count ?? 0),
      };
    }),

    produtividadePorUsuario: publicProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const inicio = new Date(input.dataInicio);
        const fim = new Date(input.dataFim);
        fim.setHours(23, 59, 59, 999);
        const registros = await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(
            and(
              gte(empacotamentoPedidoUsuarios.createdAt, inicio),
              lte(empacotamentoPedidoUsuarios.createdAt, fim)
            )
          );
        const porUsuario: Record<string, {
          nome: string;
          totalSegundos: number;
          totalPedidos: number;
          mediaSegundosPorPedido: number;
        }> = {};
        for (const r of registros) {
          const nome = r.usuarioNome;
          if (!porUsuario[nome]) {
            porUsuario[nome] = { nome, totalSegundos: 0, totalPedidos: 0, mediaSegundosPorPedido: 0 };
          }
          porUsuario[nome].totalSegundos += r.tempoSegundos ?? 0;
          porUsuario[nome].totalPedidos += 1;
        }
        for (const u of Object.values(porUsuario)) {
          u.mediaSegundosPorPedido = u.totalPedidos > 0 ? Math.round(u.totalSegundos / u.totalPedidos) : 0;
        }
        return Object.values(porUsuario).sort((a, b) => b.totalPedidos - a.totalPedidos);
      }),
    // Relatório completo de expedidos com fotos e operadores
    expedidosCompleto: publicProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const inicio = input.dataInicio ? new Date(input.dataInicio) : new Date(0);
        const fim = input.dataFim ? new Date(input.dataFim) : new Date();
        fim.setHours(23, 59, 59, 999);

        const pedidos = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(
            and(
              eq(empacotamentoPedidos.kanbanStatus, "patio"),
              gte(empacotamentoPedidos.finalizadoEm, inicio),
              lte(empacotamentoPedidos.finalizadoEm, fim)
            )
          )
          .orderBy(desc(empacotamentoPedidos.finalizadoEm));

        const pedidoIds = pedidos.map(p => p.id);
        let fotos: typeof empacotamentoPedidoFotos.$inferSelect[] = [];
        let usuarios: typeof empacotamentoPedidoUsuarios.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          fotos = await getDb()
            .select()
            .from(empacotamentoPedidoFotos)
            .where(sql`${empacotamentoPedidoFotos.pedidoId} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
          usuarios = await getDb()
            .select()
            .from(empacotamentoPedidoUsuarios)
            .where(sql`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }

        return pedidos.map(p => ({
          ...p,
          fotos: fotos.filter(f => f.pedidoId === p.id),
          operadores: usuarios.filter(u => u.pedidoId === p.id),
        }));
      }),
  }),  // fim relatorio router

  // ─── INSUMOS DE EMBALAGEM (ERP leve) ────────────────────────────────────────────────
  insumos: router({
    list: publicProcedure.query(async () => {
      return await getDb().select().from(empacotamentoInsumos).orderBy(asc(empacotamentoInsumos.categoria), asc(empacotamentoInsumos.nome));
    }),

    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1).max(128),
        unidadeMedida: z.enum(["m²", "metro", "kg", "unidades"]),
        custoUnitario: z.number().min(0),
        categoria: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const [result] = await getDb().insert(empacotamentoInsumos).values({
          nome: input.nome,
          unidadeMedida: input.unidadeMedida,
          custoUnitario: String(input.custoUnitario),
          categoria: input.categoria ?? null,
          precoAtualizadoEm: new Date(),
        }).returning({ id: empacotamentoInsumos.id });
        return { success: true, id: result.id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).max(128).optional(),
        unidadeMedida: z.enum(["m²", "metro", "kg", "unidades"]).optional(),
        custoUnitario: z.number().min(0).optional(),
        categoria: z.string().optional(),
        ativo: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        const upd: Record<string, unknown> = {};
        if (rest.nome !== undefined) upd.nome = rest.nome;
        if (rest.unidadeMedida !== undefined) upd.unidadeMedida = rest.unidadeMedida;
        if (rest.custoUnitario !== undefined) {
          upd.custoUnitario = String(rest.custoUnitario);
          upd.precoAtualizadoEm = new Date();
        }
        if (rest.categoria !== undefined) upd.categoria = rest.categoria;
        if (rest.ativo !== undefined) upd.ativo = rest.ativo;
        await getDb().update(empacotamentoInsumos).set(upd).where(eq(empacotamentoInsumos.id, id));
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await getDb().delete(empacotamentoInsumos).where(eq(empacotamentoInsumos.id, input.id));
        return { success: true };
      }),
  }),

  // ─── CONSUMO DE INSUMOS POR CAIXA ───────────────────────────────────────────────────
  consumoCaixa: router({
    listPorCaixa: publicProcedure
      .input(z.object({ modeloCaixaId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoConsumoCaixa)
          .where(eq(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
        // Enriquecer com dados do insumo
        const insumos = await getDb().select().from(empacotamentoInsumos);
        return rows.map(r => ({
          ...r,
          insumo: insumos.find(i => i.id === r.insumoId),
        }));
      }),

    upsert: publicProcedure
      .input(z.object({
        modeloCaixaId: z.number(),
        insumoId: z.number(),
        quantidadePorCaixa: z.number().min(0),
        formulaConsumo: z.string().optional().default("fixo"),
        fator: z.number().optional().default(1),
      }))
      .mutation(async ({ input }) => {
        const existing = await getDb()
          .select()
          .from(empacotamentoConsumoCaixa)
          .where(and(
            eq(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId),
            eq(empacotamentoConsumoCaixa.insumoId, input.insumoId)
          ));
        const setData = {
          quantidadePorCaixa: String(input.quantidadePorCaixa),
          formulaConsumo: input.formulaConsumo,
          fator: String(input.fator),
        };
        if (existing.length > 0) {
          await getDb().update(empacotamentoConsumoCaixa)
            .set(setData)
            .where(eq(empacotamentoConsumoCaixa.id, existing[0].id));
        } else {
          await getDb().insert(empacotamentoConsumoCaixa).values({
            modeloCaixaId: input.modeloCaixaId,
            insumoId: input.insumoId,
            ...setData,
          });
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await getDb().delete(empacotamentoConsumoCaixa).where(eq(empacotamentoConsumoCaixa.id, input.id));
        return { success: true };
      }),
  }),

  // ─── CUSTO DE FUNCIONÁRIO ───────────────────────────────────────────────────────────────────────
  custoFuncionario: router({
    list: publicProcedure.query(async () => {
      return await getDb().select().from(empacotamentoCustoFuncionario).orderBy(asc(empacotamentoCustoFuncionario.nome));
    }),

    upsert: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        nome: z.string().min(1).max(128),
        salarioMensal: z.number().min(0),
        horasMes: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        const custoHora = input.salarioMensal / input.horasMes;
        if (input.id) {
          await getDb().update(empacotamentoCustoFuncionario).set({
            nome: input.nome,
            salarioMensal: String(input.salarioMensal),
            horasMes: String(input.horasMes),
            custoHora: String(custoHora.toFixed(4)),
          }).where(eq(empacotamentoCustoFuncionario.id, input.id));
        } else {
          await getDb().insert(empacotamentoCustoFuncionario).values({
            nome: input.nome,
            salarioMensal: String(input.salarioMensal),
            horasMes: String(input.horasMes),
            custoHora: String(custoHora.toFixed(4)),
          });
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await getDb().delete(empacotamentoCustoFuncionario).where(eq(empacotamentoCustoFuncionario.id, input.id));
        return { success: true };
      }),
  }),


  // ─── PRECIFICAÇÃO DE CAIXAS ──────────────────────────────────────────────────────────────────
  // Fórmulas geométricas:
  //   Área externa (m²) = 2*(L*A + L*P + A*P) / 10000  → papelão, plástico bolha
  //   Volume interno (m³) = L*A*P / 1000000            → espuma, enchimento volumétrico
  //   Perímetro (m) = 4*(L+A+P)/2 / 100               → fita de arquear, cantoneiras
  //   Fixo = quantidade fixa por caixa
  precificacao: router({
    calcular: publicProcedure
      .input(z.object({
        modeloCaixaId: z.number(),
        larguraCm: z.number().min(0.1).optional(),
        alturaCm: z.number().min(0.1).optional(),
        profundidadeCm: z.number().min(0.1).optional(),
        tempoExecucaoMin: z.number().min(0).optional(),
        margemPercent: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        const caixas = await getDb().select().from(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.id, input.modeloCaixaId));
        if (!caixas.length) throw new Error("Modelo de caixa não encontrado");
        const caixa = caixas[0];

        const L = input.larguraCm ?? parseFloat(String(caixa.larguraCm ?? 0));
        const A = input.alturaCm ?? parseFloat(String(caixa.alturaCm ?? 0));
        const P = input.profundidadeCm ?? parseFloat(String(caixa.profundidadeCm ?? 0));

        const areaExternaM2 = (L > 0 && A > 0 && P > 0) ? 2 * (L * A + L * P + A * P) / 10000 : 0;
        const volumeInternoM3 = (L > 0 && A > 0 && P > 0) ? (L * A * P) / 1000000 : 0;
        const perimetroM = (L > 0 && A > 0 && P > 0) ? (4 * (L + A + P) / 2) / 100 : 0;

        const consumos = await getDb().select().from(empacotamentoConsumoCaixa).where(eq(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
        const insumos = await getDb().select().from(empacotamentoInsumos);

        let custoInsumos = 0;
        const detalhesInsumos: {
          nome: string; unidade: string; formula: string;
          quantidadeBase: number; fator: number; quantidadeReal: number;
          custoUnit: number; custoTotal: number;
        }[] = [];

        for (const c of consumos) {
          const insumo = insumos.find(i => i.id === c.insumoId);
          if (!insumo) continue;
          const fator = parseFloat(String(c.fator ?? 1));
          const custo = parseFloat(String(insumo.custoUnitario));
          const formula = c.formulaConsumo ?? "fixo";

          let quantidadeBase = 0;
          if (formula === "area_externa_m2") quantidadeBase = areaExternaM2;
          else if (formula === "volume_interno_m3") quantidadeBase = volumeInternoM3;
          else if (formula === "perimetro_m") quantidadeBase = perimetroM;
          else quantidadeBase = parseFloat(String(c.quantidadePorCaixa ?? 0));

          const quantidadeReal = quantidadeBase * fator;
          const total = quantidadeReal * custo;
          custoInsumos += total;
          detalhesInsumos.push({
            nome: insumo.nome, unidade: insumo.unidadeMedida, formula,
            quantidadeBase: parseFloat(quantidadeBase.toFixed(6)),
            fator, quantidadeReal: parseFloat(quantidadeReal.toFixed(6)),
            custoUnit: custo, custoTotal: parseFloat(total.toFixed(4)),
          });
        }

        const funcionarios = await getDb().select().from(empacotamentoCustoFuncionario).where(eq(empacotamentoCustoFuncionario.ativo, 1));
        const custoHora = funcionarios.length > 0 ? parseFloat(String(funcionarios[0].custoHora ?? 0)) : 0;
        const tempoMin = input.tempoExecucaoMin ?? 0;
        const custoMaoDeObra = (tempoMin / 60) * custoHora;

        const custoTotal = custoInsumos + custoMaoDeObra;
        const margem = input.margemPercent ?? 30;
        const precoSugerido = custoTotal > 0 ? custoTotal / (1 - margem / 100) : 0;

        return {
          caixa: { id: caixa.id, nome: caixa.nome, tipoCaixa: caixa.tipoCaixa, larguraCm: caixa.larguraCm, alturaCm: caixa.alturaCm, profundidadeCm: caixa.profundidadeCm },
          dimensoesUsadas: { larguraCm: L, alturaCm: A, profundidadeCm: P },
          geometria: {
            areaExternaM2: parseFloat(areaExternaM2.toFixed(4)),
            volumeInternoM3: parseFloat(volumeInternoM3.toFixed(6)),
            perimetroM: parseFloat(perimetroM.toFixed(4)),
          },
          custoInsumos: parseFloat(custoInsumos.toFixed(4)),
          custoMaoDeObra: parseFloat(custoMaoDeObra.toFixed(4)),
          custoTotal: parseFloat(custoTotal.toFixed(4)),
          precoSugerido: parseFloat(precoSugerido.toFixed(2)),
          margemPercent: margem,
          tempoExecucaoMin: tempoMin,
          custoHora,
          detalhesInsumos,
        };
      }),
  }),

  // ─── OPERADORES (para seleção no novo pedido) ───────────────────────────────
  operadores: router({
    list: publicProcedure.query(async () => {
      // Retorna todos os usuários ativos para seleção de operador
      // Prioriza role empacotamento, mas inclui todos para flexibilidade
      return await getDb()
        .select({ id: userTable.id, name: userTable.name, role: userTable.role })
        .from(userTable)
        .orderBy(asc(userTable.name));
    }),
    listEmpacotadores: publicProcedure.query(async () => {
      // Lista apenas empacotadores para seleção rápida no kanban
      const rows = await getDb()
        .select({ id: userTable.id, name: userTable.name, role: userTable.role })
        .from(userTable)
        .where(eq(userTable.role, "empacotamento"))
        .orderBy(asc(userTable.name));
      return rows;
    }),
  }),

  // ─── PAUSAS DO CRONÔMETRO ─────────────────────────────────────────────────────
  cronometroPausas: router({
    listPorPedidoUsuario: publicProcedure
      .input(z.object({ pedidoUsuarioId: z.number() }))
      .query(async ({ input }) => {
        return await getDb()
          .select()
          .from(empacotamentoCronometroPausas)
          .where(eq(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId))
          .orderBy(asc(empacotamentoCronometroPausas.pausadoEm));
      }),

    // Retorna true se há alguma pausa aberta para qualquer operador do pedido
    temPausaAbertaPorPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select({ id: empacotamentoCronometroPausas.id })
          .from(empacotamentoCronometroPausas)
          .innerJoin(
            empacotamentoPedidoUsuarios,
            eq(empacotamentoCronometroPausas.pedidoUsuarioId, empacotamentoPedidoUsuarios.id)
          )
          .where(
            and(
              eq(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
              sql`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
            )
          )
          .limit(1);
        return { pausado: rows.length > 0 };
      }),

    pausar: publicProcedure
      .input(z.object({ pedidoUsuarioId: z.number(), tempoSegundosAtual: z.number().int().min(0).optional() }))
      .mutation(async ({ input }) => {
        // Verificar se já existe pausa aberta
        const abertas = await getDb()
          .select()
          .from(empacotamentoCronometroPausas)
          .where(and(
            eq(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId),
            sql`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
          ));
        if (abertas.length > 0) return { success: true, id: abertas[0].id };
        // Salva o tempo acumulado atual antes de pausar
        if (input.tempoSegundosAtual !== undefined) {
          await getDb()
            .update(empacotamentoPedidoUsuarios)
            .set({ tempoSegundos: input.tempoSegundosAtual })
            .where(eq(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
        }
        const [result] = await getDb().insert(empacotamentoCronometroPausas).values({
          pedidoUsuarioId: input.pedidoUsuarioId,
          pausadoEm: new Date(),
        }).returning({ id: empacotamentoCronometroPausas.id });
        return { success: true, id: result.id };
      }),

    retomar: publicProcedure
      .input(z.object({ pedidoUsuarioId: z.number() }))
      .mutation(async ({ input }) => {
        // Fecha a pausa aberta
        await getDb().execute(
          sql`UPDATE empacotamento_cronometro_pausas SET retomadoEm = NOW() WHERE pedidoUsuarioId = ${input.pedidoUsuarioId} AND retomadoEm IS NULL`
        );
        // Reinicia iniciadoEm para agora — o display calcula tempoSegundos + (agora - iniciadoEm)
        await getDb()
          .update(empacotamentoPedidoUsuarios)
          .set({ iniciadoEm: new Date() })
          .where(eq(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
        return { success: true };
      }),

    // Pausa automática: pausa todos os operadores ativos de um pedido (ou todos os pedidos)
    pausarTodosAtivos: publicProcedure
      .input(z.object({ motivo: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Buscar todos os registros de operadores ativos (ativo=1)
        const ativos = await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(eq(empacotamentoPedidoUsuarios.ativo, 1));
        let pausados = 0;
        for (const op of ativos) {
          // Verificar se já tem pausa aberta
          const abertas = await getDb()
            .select()
            .from(empacotamentoCronometroPausas)
            .where(and(
              eq(empacotamentoCronometroPausas.pedidoUsuarioId, op.id),
              sql`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
            ));
          if (abertas.length === 0) {
            await getDb().insert(empacotamentoCronometroPausas).values({
              pedidoUsuarioId: op.id,
              pausadoEm: new Date(),
            });
            pausados++;
          }
        }
        return { success: true, pausados, motivo: input.motivo ?? 'automatico' };
      }),

    tempoTotalPausadoSegundos: publicProcedure
      .input(z.object({ pedidoUsuarioId: z.number() }))
      .query(async ({ input }) => {
        const pausas = await getDb()
          .select()
          .from(empacotamentoCronometroPausas)
          .where(eq(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId));
        let total = 0;
        const agora = Date.now();
        for (const p of pausas) {
          const inicio = p.pausadoEm ? new Date(p.pausadoEm).getTime() : agora;
          const fim = p.retomadoEm ? new Date(p.retomadoEm).getTime() : agora;
          total += Math.max(0, fim - inicio);
        }
        return { totalSegundos: Math.round(total / 1000) };
      }),
  }),

  // ─── CONFIGURAÇÃO DE PRODUTIVIDADE ────────────────────────────────────────────
  configProdutividade: router({
    get: publicProcedure.query(async () => {
      const rows = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1)).orderBy(desc(empacotamentoConfigProdutividade.updatedAt));
      if (rows.length > 0) return rows[0];
      // Retornar defaults se não configurado
      return {
        id: 0,
        valorPorMinuto: "0.1500",
        bonusPorcentagem: "20.00",
        penalidadePorcentagem: "30.00",
        descricao: null,
        ativo: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

    upsert: publicProcedure
      .input(z.object({
        valorPorMinuto: z.number().min(0),
        bonusPorcentagem: z.number().min(0).max(100),
        penalidadePorcentagem: z.number().min(0).max(100),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1));
        if (existing.length > 0) {
          await getDb().update(empacotamentoConfigProdutividade).set({
            valorPorMinuto: String(input.valorPorMinuto),
            bonusPorcentagem: String(input.bonusPorcentagem),
            penalidadePorcentagem: String(input.penalidadePorcentagem),
            descricao: input.descricao ?? null,
          }).where(eq(empacotamentoConfigProdutividade.id, existing[0].id));
        } else {
          await getDb().insert(empacotamentoConfigProdutividade).values({
            valorPorMinuto: String(input.valorPorMinuto),
            bonusPorcentagem: String(input.bonusPorcentagem),
            penalidadePorcentagem: String(input.penalidadePorcentagem),
            descricao: input.descricao ?? null,
            ativo: 1,
          });
        }
        return { success: true };
      }),
  }),

  // ─── CÁLCULO DE TEMPO ESTIMADO DO PEDIDO ─────────────────────────────────────
  tempoEstimado: router({
    calcular: publicProcedure
      .input(z.object({
        modeloId: z.number().optional(),
        modeloCaixaId: z.number().optional(),
        metrosQuadrados: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        let tempoCaixaMin = 0;
        let tempoLetreiMin = 0;

        if (input.modeloCaixaId) {
          const caixas = await getDb().select().from(empacotamentoModelosCaixa).where(eq(empacotamentoModelosCaixa.id, input.modeloCaixaId));
          if (caixas.length > 0) {
            const caixa = caixas[0];
            const L = parseFloat(String(caixa.larguraCm ?? 0));
            const A = parseFloat(String(caixa.alturaCm ?? 0));
            const P = parseFloat(String(caixa.profundidadeCm ?? 0));
            if (caixa.tipoCaixa === "personalizada") {
              // Caixa personalizada: calcular por m³ (volume interno)
              const tempoPorM3 = parseFloat(String((caixa as any).tempoPorM3Min ?? 0));
              const volumeM3 = (L > 0 && A > 0 && P > 0) ? (L * A * P) / 1000000 : 0;
              tempoCaixaMin = tempoPorM3 > 0 ? volumeM3 * tempoPorM3 : 0;
            } else {
              // Caixa padronizada: calcular por m² (área externa)
              const tempoPorM2 = parseFloat(String(caixa.tempoPorM2Min ?? 0));
              const areaM2 = (L > 0 && A > 0 && P > 0) ? 2 * (L * A + L * P + A * P) / 10000 : 0;
              tempoCaixaMin = tempoPorM2 > 0 ? areaM2 * tempoPorM2 : 0;
            }
          }
        }

        if (input.modeloId && (input.metrosQuadrados ?? 0) > 0) {
          const modelos = await getDb().select().from(empacotamentoModelos).where(eq(empacotamentoModelos.id, input.modeloId));
          if (modelos.length > 0) {
            const tempoPorM2 = parseFloat(String(modelos[0].tempoPorM2Min ?? 0));
            tempoLetreiMin = tempoPorM2 > 0 ? tempoPorM2 * (input.metrosQuadrados ?? 0) : 0;
          }
        }

        const totalMin = tempoCaixaMin + tempoLetreiMin;
        return {
          tempoCaixaMin: parseFloat(tempoCaixaMin.toFixed(2)),
          tempoLetreiMin: parseFloat(tempoLetreiMin.toFixed(2)),
          totalMin: parseFloat(totalMin.toFixed(2)),
          totalHoras: parseFloat((totalMin / 60).toFixed(3)),
        };
      }),
  }),

  // ─── RELATÓRIO DE PRODUTIVIDADE DETALHADO ────────────────────────────────────
  relatorioProdutividade: router({
    porColaborador: publicProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const inicio = new Date(input.dataInicio);
        const fim = new Date(input.dataFim);
        fim.setHours(23, 59, 59, 999);

        const config = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1));
        const cfg = config[0] ?? { valorPorMinuto: "0.15", bonusPorcentagem: "20", penalidadePorcentagem: "30" };
        const valorMin = parseFloat(String(cfg.valorPorMinuto));
        const bonusPct = parseFloat(String(cfg.bonusPorcentagem));
        const penalidadePct = parseFloat(String(cfg.penalidadePorcentagem));

        const registros = await getDb()
          .select()
          .from(empacotamentoPedidoUsuarios)
          .where(and(
            gte(empacotamentoPedidoUsuarios.createdAt, inicio),
            lte(empacotamentoPedidoUsuarios.createdAt, fim)
          ));

        // Buscar pedidos para saber se foram entregues dentro do prazo
        const pedidoIds = Array.from(new Set(registros.map(r => r.pedidoId)));
        let pedidos: typeof empacotamentoPedidos.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          pedidos = await getDb()
            .select()
            .from(empacotamentoPedidos)
            .where(sql`${empacotamentoPedidos.id} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }

        // Buscar pausas para descontar
        const usuarioIds = registros.map(r => r.id);
        let pausas: typeof empacotamentoCronometroPausas.$inferSelect[] = [];
        if (usuarioIds.length > 0) {
          pausas = await getDb()
            .select()
            .from(empacotamentoCronometroPausas)
            .where(sql`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql.join(usuarioIds.map(id => sql`${id}`), sql`, `)})`);
        }

        // Calcular tempo efetivo por registro (descontando pausas)
        const porColaborador: Record<string, {
          nome: string;
          totalMinutosEfetivos: number;
          totalMinutosPausados: number;
          totalPedidos: number;
          valorBase: number;
          valorComBonus: number;
          pedidosNoPrazo: number;
          pedidosForaDoPrazo: number;
        }> = {};

        for (const r of registros) {
          const nome = r.usuarioNome;
          if (!porColaborador[nome]) {
            porColaborador[nome] = { nome, totalMinutosEfetivos: 0, totalMinutosPausados: 0, totalPedidos: 0, valorBase: 0, valorComBonus: 0, pedidosNoPrazo: 0, pedidosForaDoPrazo: 0 };
          }
          const tempoTotal = (r.tempoSegundos ?? 0) / 60;
          const pausasDoReg = pausas.filter(p => p.pedidoUsuarioId === r.id);
          let tempoPausado = 0;
          for (const p of pausasDoReg) {
            const ini = p.pausadoEm ? new Date(p.pausadoEm).getTime() : 0;
            const fim2 = p.retomadoEm ? new Date(p.retomadoEm).getTime() : Date.now();
            tempoPausado += Math.max(0, fim2 - ini) / 60000;
          }
          const tempoEfetivo = Math.max(0, tempoTotal - tempoPausado);
          porColaborador[nome].totalMinutosEfetivos += tempoEfetivo;
          porColaborador[nome].totalMinutosPausados += tempoPausado;
          porColaborador[nome].totalPedidos += 1;

          // Verificar se pedido foi entregue no prazo
          const pedido = pedidos.find(p => p.id === r.pedidoId);
          const noPrazo = pedido?.prazoEntrega && pedido?.finalizadoEm
            ? new Date(pedido.finalizadoEm) <= new Date(pedido.prazoEntrega)
            : null;

          const valorBruto = tempoEfetivo * valorMin;
          let valorFinal = valorBruto;
          // Fórmula progressiva baseada em tempo estimado vs real
          // Buscar tempo estimado do pedido para calcular o fator
          const pedidoRef = pedidos.find(p => p.id === r.pedidoId);
          if (pedidoRef) {
            // Calcular tempo estimado do pedido (simplificado: usar campo se disponível)
            // O fator progressivo é calculado no relatório detalhado; aqui usamos bônus/penalidade de prazo
            if (noPrazo === true) {
              valorFinal = valorBruto * (1 + bonusPct / 100);
              porColaborador[nome].pedidosNoPrazo += 1;
            } else if (noPrazo === false) {
              valorFinal = valorBruto * (1 - penalidadePct / 100);
              porColaborador[nome].pedidosForaDoPrazo += 1;
            }
          } else {
            if (noPrazo === true) {
              valorFinal = valorBruto * (1 + bonusPct / 100);
              porColaborador[nome].pedidosNoPrazo += 1;
            } else if (noPrazo === false) {
              valorFinal = valorBruto * (1 - penalidadePct / 100);
              porColaborador[nome].pedidosForaDoPrazo += 1;
            }
          }
          porColaborador[nome].valorBase += valorBruto;
          porColaborador[nome].valorComBonus += valorFinal;
        }

        return {
          config: { valorPorMinuto: valorMin, bonusPorcentagem: bonusPct, penalidadePorcentagem: penalidadePct },
          colaboradores: Object.values(porColaborador).sort((a, b) => b.totalMinutosEfetivos - a.totalMinutosEfetivos),
        };
      }),
  }),

  // ─── RELATÓRIO DETALHADO: TEMPO PREVISTO vs REAL POR PEDIDO ────────────────
  relatorioDetalhado: router({
    porPeriodo: publicProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const inicio = new Date(input.dataInicio);
        const fim = new Date(input.dataFim);
        fim.setHours(23, 59, 59, 999);

        // Buscar pedidos finalizados no período
        const pedidos = await getDb()
          .select()
          .from(empacotamentoPedidos)
          .where(and(
            gte(empacotamentoPedidos.finalizadoEm, inicio),
            lte(empacotamentoPedidos.finalizadoEm, fim),
          ))
          .orderBy(desc(empacotamentoPedidos.finalizadoEm));

        // Buscar modelos de letreiro e caixa para calcular tempo estimado
        const modelos = await getDb().select().from(empacotamentoModelos);
        const modelosCaixa = await getDb().select().from(empacotamentoModelosCaixa);

        // Buscar registros de tempo por pedido
        const pedidoIds = pedidos.map(p => p.id);
        let registros: typeof empacotamentoPedidoUsuarios.$inferSelect[] = [];
        let pausas: typeof empacotamentoCronometroPausas.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          registros = await getDb()
            .select()
            .from(empacotamentoPedidoUsuarios)
            .where(sql`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
          const usuarioIds = registros.map(r => r.id);
          if (usuarioIds.length > 0) {
            pausas = await getDb()
              .select()
              .from(empacotamentoCronometroPausas)
              .where(sql`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql.join(usuarioIds.map(id => sql`${id}`), sql`, `)})`);
          }
        }

        // Buscar config de produtividade
        const configs = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1));
        const cfg = configs[0] ?? { valorPorMinuto: "0.15", bonusPorcentagem: "20", penalidadePorcentagem: "30" };
        const valorMin = parseFloat(String(cfg.valorPorMinuto));

        const resultado = pedidos.map(pedido => {
          // Calcular tempo estimado
          let tempoCaixaMin = 0;
          let tempoLetreiMin = 0;
          if (pedido.modeloCaixaId) {
            const caixa = modelosCaixa.find(c => c.id === pedido.modeloCaixaId);
            if (caixa) {
              const L = parseFloat(String(caixa.larguraCm ?? 0));
              const A = parseFloat(String(caixa.alturaCm ?? 0));
              const P = parseFloat(String(caixa.profundidadeCm ?? 0));
              if (caixa.tipoCaixa === "personalizada") {
                const tempoPorM3 = parseFloat(String((caixa as any).tempoPorM3Min ?? 0));
                const volumeM3 = (L > 0 && A > 0 && P > 0) ? (L * A * P) / 1000000 : 0;
                tempoCaixaMin = tempoPorM3 > 0 ? volumeM3 * tempoPorM3 : 0;
              } else {
                const tempoPorM2 = parseFloat(String(caixa.tempoPorM2Min ?? 0));
                const areaM2 = (L > 0 && A > 0 && P > 0) ? 2 * (L * A + L * P + A * P) / 10000 : 0;
                tempoCaixaMin = tempoPorM2 > 0 ? areaM2 * tempoPorM2 : 0;
              }
            }
          }
          if (pedido.modeloId && parseFloat(String(pedido.metrosQuadrados ?? 0)) > 0) {
            const modelo = modelos.find(m => m.id === pedido.modeloId);
            if (modelo) {
              const tempoPorM2 = parseFloat(String(modelo.tempoPorM2Min ?? 0));
              tempoLetreiMin = tempoPorM2 > 0 ? tempoPorM2 * parseFloat(String(pedido.metrosQuadrados ?? 0)) : 0;
            }
          }
          const tempoEstimadoMin = tempoCaixaMin + tempoLetreiMin;

          // Calcular tempo real (soma de todos os operadores, descontando pausas)
          const regsP = registros.filter(r => r.pedidoId === pedido.id);
          let tempoRealMin = 0;
          const operadores: string[] = [];
          for (const r of regsP) {
            const pausasReg = pausas.filter(p => p.pedidoUsuarioId === r.id);
            let tempoPausado = 0;
            for (const p of pausasReg) {
              const ini = p.pausadoEm ? new Date(p.pausadoEm).getTime() : 0;
              const fim2 = p.retomadoEm ? new Date(p.retomadoEm).getTime() : Date.now();
              tempoPausado += Math.max(0, fim2 - ini) / 60000;
            }
            const efetivo = Math.max(0, (r.tempoSegundos ?? 0) / 60 - tempoPausado);
            tempoRealMin += efetivo;
            if (r.usuarioNome && !operadores.includes(r.usuarioNome)) operadores.push(r.usuarioNome);
          }

          const eficiencia = tempoEstimadoMin > 0 && tempoRealMin > 0
            ? Math.round((tempoEstimadoMin / tempoRealMin) * 100)
            : null;
          // Fórmula progressiva: +/-5% a cada 5% de variação no tempo
          // Se adiantou (real < estimado): bônus progressivo
          // Se atrasou (real > estimado): penalidade progressiva
          let fatorProdutividade = 1.0;
          if (tempoEstimadoMin > 0 && tempoRealMin > 0) {
            const variacaoPct = (tempoRealMin - tempoEstimadoMin) / tempoEstimadoMin; // positivo = atrasou, negativo = adiantou
            const passos = Math.floor(Math.abs(variacaoPct) / 0.05); // quantos passos de 5%
            const ajuste = passos * 0.05; // 5% por passo
            fatorProdutividade = variacaoPct > 0
              ? Math.max(0.5, 1.0 - ajuste)  // atrasou: reduz (mínimo 50%)
              : Math.min(1.5, 1.0 + ajuste);  // adiantou: aumenta (máximo 150%)
          }
          const valorProdutividade = tempoRealMin * valorMin * fatorProdutividade;

          return {
            id: pedido.id,
            numeroPedido: pedido.numeroPedido,
            cliente: pedido.cliente,
            modeloNome: pedido.modeloNome ?? null,
            modeloCaixaNome: pedido.modeloCaixaNome ?? null,
            finalizadoEm: pedido.finalizadoEm,
            prazoEntrega: pedido.prazoEntrega,
            noPrazo: pedido.prazoEntrega && pedido.finalizadoEm
              ? new Date(pedido.finalizadoEm) <= new Date(pedido.prazoEntrega)
              : null,
            tempoEstimadoMin: parseFloat(tempoEstimadoMin.toFixed(1)),
            tempoRealMin: parseFloat(tempoRealMin.toFixed(1)),
            eficiencia,
            operadores,
            valorProdutividade: parseFloat(valorProdutividade.toFixed(2)),
          };
        });

        // Totais
        const totalEstimadoMin = resultado.reduce((a, r) => a + r.tempoEstimadoMin, 0);
        const totalRealMin = resultado.reduce((a, r) => a + r.tempoRealMin, 0);
        const totalValor = resultado.reduce((a, r) => a + r.valorProdutividade, 0);
        const eficienciaGeral = totalEstimadoMin > 0 && totalRealMin > 0
          ? Math.round((totalEstimadoMin / totalRealMin) * 100)
          : null;

        return {
          pedidos: resultado,
          totais: {
            totalPedidos: resultado.length,
            totalEstimadoMin: parseFloat(totalEstimadoMin.toFixed(1)),
            totalRealMin: parseFloat(totalRealMin.toFixed(1)),
            totalValor: parseFloat(totalValor.toFixed(2)),
            eficienciaGeral,
          },
          valorPorMinuto: valorMin,
        };
      }),
  }),

  // ─── EVOLUÇÃO DIÁRIA DE PRODUTIVIDADE ─────────────────────────────────────────
  evolucaoDiaria: router({
    porPeriodo: publicProcedure
      .input(z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        tipoProduto: z.enum(['todos', 'letreiro', 'caixa']).default('todos'),
      }))
      .query(async ({ input }) => {
        const inicio = new Date(input.dataInicio);
        const fim = new Date(input.dataFim);
        fim.setHours(23, 59, 59, 999);
        const pedidos = await getDb().select().from(empacotamentoPedidos)
          .where(and(gte(empacotamentoPedidos.finalizadoEm, inicio), lte(empacotamentoPedidos.finalizadoEm, fim)));
        const modelos = await getDb().select().from(empacotamentoModelos);
        const modelosCaixa = await getDb().select().from(empacotamentoModelosCaixa);
        const pedidoIds = pedidos.map(p => p.id);
        let registros: typeof empacotamentoPedidoUsuarios.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          registros = await getDb().select().from(empacotamentoPedidoUsuarios)
            .where(sql`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }
        const porDia: Record<string, { data: string; tempoMedioMin: number; totalPedidos: number; eficienciaTotal: number; eficienciaCount: number }> = {};
        for (const pedido of pedidos) {
          if (!pedido.finalizadoEm) continue;
          const tipoPedido = pedido.modeloId ? 'letreiro' : 'caixa';
          if (input.tipoProduto !== 'todos' && tipoPedido !== input.tipoProduto) continue;
          const dia = new Date(pedido.finalizadoEm).toISOString().split('T')[0];
          const regsP = registros.filter(r => r.pedidoId === pedido.id);
          const tempoRealMin = regsP.reduce((a, r) => a + (r.tempoSegundos ?? 0), 0) / 60;
          let tempoEstimadoMin = 0;
          if (pedido.modeloId) {
            const modelo = modelos.find(m => m.id === pedido.modeloId);
            const tM2 = parseFloat(String(modelo?.tempoPorM2Min ?? '0'));
            const area = parseFloat(String(pedido.metrosQuadrados ?? '0'));
            if (tM2 > 0 && area > 0) tempoEstimadoMin = tM2 * area;
          } else if (pedido.modeloCaixaId) {
            const mc = modelosCaixa.find(m => m.id === pedido.modeloCaixaId);
            if (mc) {
              const tipoCaixa = (mc as any).tipoCaixa;
              if (tipoCaixa === 'personalizada') {
                const l = parseFloat(String(mc.larguraCm ?? '0')), a2 = parseFloat(String(mc.alturaCm ?? '0')), p2 = parseFloat(String(mc.profundidadeCm ?? '0'));
                const tM3 = parseFloat(String((mc as any).tempoPorM3Min ?? '0'));
                if (l > 0 && a2 > 0 && p2 > 0 && tM3 > 0) tempoEstimadoMin = (l * a2 * p2 / 1_000_000) * tM3;
              } else {
                const l = parseFloat(String(mc.larguraCm ?? '0')), a2 = parseFloat(String(mc.alturaCm ?? '0'));
                const tM2 = parseFloat(String((mc as any).tempoPorM2Min ?? '0'));
                if (l > 0 && a2 > 0 && tM2 > 0) tempoEstimadoMin = (l * a2 / 10_000) * tM2;
              }
            }
          }
          if (!porDia[dia]) porDia[dia] = { data: dia, tempoMedioMin: 0, totalPedidos: 0, eficienciaTotal: 0, eficienciaCount: 0 };
          porDia[dia].totalPedidos += 1;
          porDia[dia].tempoMedioMin += tempoRealMin;
          if (tempoEstimadoMin > 0 && tempoRealMin > 0) {
            porDia[dia].eficienciaTotal += Math.round((tempoEstimadoMin / tempoRealMin) * 100);
            porDia[dia].eficienciaCount += 1;
          }
        }
        return Object.values(porDia)
          .map(d => ({
            data: d.data,
            totalPedidos: d.totalPedidos,
            tempoMedioMin: d.totalPedidos > 0 ? parseFloat((d.tempoMedioMin / d.totalPedidos).toFixed(1)) : 0,
            eficienciaMedia: d.eficienciaCount > 0 ? Math.round(d.eficienciaTotal / d.eficienciaCount) : null,
          }))
          .sort((a, b) => a.data.localeCompare(b.data));
      }),
  }),
  // ─── RANKING DE PRODUTIVIDADE ─────────────────────────────────────────────────
  rankingProdutividade: router({
    semanal: publicProcedure
      .input(z.object({ semanas: z.number().default(1) }))
      .query(async ({ input }) => {
        const fimMs = new Date(); fimMs.setHours(23, 59, 59, 999);
        const inicioMs = new Date(); inicioMs.setDate(inicioMs.getDate() - (input.semanas * 7)); inicioMs.setHours(0, 0, 0, 0);
        return calcularRanking(Math.floor(inicioMs.getTime() / 1000), Math.floor(fimMs.getTime() / 1000));
      }),
    mensal: publicProcedure
      .input(z.object({ meses: z.number().default(1) }))
      .query(async ({ input }) => {
        const fimMs = new Date(); fimMs.setHours(23, 59, 59, 999);
        const inicioMs = new Date(); inicioMs.setMonth(inicioMs.getMonth() - input.meses); inicioMs.setHours(0, 0, 0, 0);
        return calcularRanking(Math.floor(inicioMs.getTime() / 1000), Math.floor(fimMs.getTime() / 1000));
      }),
  }),
  // ─── INSUMOS POR MODELO DE CAIXA (consumo configurado por modelo) ───────────
  insumosCaixa: router({
    listPorModelo: publicProcedure
      .input(z.object({ modeloCaixaId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoConsumoCaixa)
          .where(eq(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId))
          .orderBy(asc(empacotamentoConsumoCaixa.id));
        const insumos = await getDb().select().from(empacotamentoInsumos);
        return rows.map(r => ({ ...r, insumo: insumos.find(i => i.id === r.insumoId) ?? null }));
      }),
  }),

  // ─── INSUMOS POR MODELO DE LETREIRO ─────────────────────────────────────────
  insumosLetreiro: router({
    listPorModelo: publicProcedure
      .input(z.object({ modeloLetreiId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoInsumosLetreiro)
          .where(eq(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId))
          .orderBy(asc(empacotamentoInsumosLetreiro.id));
        const insumos = await getDb().select().from(empacotamentoInsumos);
        return rows.map(r => ({ ...r, insumo: insumos.find(i => i.id === r.insumoId) ?? null }));
      }),

    upsert: publicProcedure
      .input(z.object({
        modeloLetreiId: z.number(),
        insumoId: z.number(),
        fatorM2: z.number().min(0).default(1),
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getDb()
          .select()
          .from(empacotamentoInsumosLetreiro)
          .where(and(
            eq(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId),
            eq(empacotamentoInsumosLetreiro.insumoId, input.insumoId),
          ));
        if (existing.length > 0) {
          await getDb()
            .update(empacotamentoInsumosLetreiro)
            .set({ fatorM2: String(input.fatorM2), observacao: input.observacao ?? null })
            .where(eq(empacotamentoInsumosLetreiro.id, existing[0].id));
        } else {
          await getDb().insert(empacotamentoInsumosLetreiro).values({
            modeloLetreiId: input.modeloLetreiId,
            insumoId: input.insumoId,
            quantidade: String(input.fatorM2), // compatibilidade legado
            fatorM2: String(input.fatorM2),
            observacao: input.observacao ?? null,
          });
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await getDb().delete(empacotamentoInsumosLetreiro).where(eq(empacotamentoInsumosLetreiro.id, input.id));
        return { success: true };
      }),
  }),

  // ─── SESSÕES OPERACIONAIS (TEMPORIZADOR PERSISTENTE) ─────────────────────────
  // Fonte de verdade: banco de dados. Frontend apenas reflete o estado.
  // Timezone operacional: America/Campo_Grande
  sessoes: router({
    // Retorna a sessão ativa (ativo/pausado) de um operador em um pedido
    getAtiva: publicProcedure
      .input(z.object({ pedidoId: z.number(), operadorId: z.string() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(and(
            eq(empacotamentoSessoes.pedidoId, input.pedidoId),
            eq(empacotamentoSessoes.operadorId, input.operadorId),
            sql`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
          ))
          .orderBy(desc(empacotamentoSessoes.id))
          .limit(1);
        if (rows.length === 0) return null;
        const sessao = rows[0];
        // Buscar pausas desta sessão
        const pausas = await getDb()
          .select()
          .from(empacotamentoSessoesPausas)
          .where(eq(empacotamentoSessoesPausas.sessaoId, sessao.id))
          .orderBy(asc(empacotamentoSessoesPausas.id));
        // LÓGICA SIMPLES E CORRETA:
        // - totalSegundos: tempo acumulado salvo no banco (atualizado ao pausar)
        // - Se ativo: tempo = totalSegundos + (agora - ultimaRetomada)
        //   onde ultimaRetomada = última pausa sem retomadoEm (pausa aberta) NÃO existe (sessão ativa)
        //   ou = iniciadoEm se nunca houve pausa
        // - Se pausado/finalizado: tempo = totalSegundos (congelado)
        const agoraSeg = Math.floor(Date.now() / 1000);
        let tempoAtualSegundos = sessao.totalSegundos;
        if (sessao.status === 'ativo') {
          // Encontrar quando a sessão foi retomada pela última vez
          // (última pausa fechada, ou iniciadoEm se nunca pausou)
          const pausasFechadas = pausas.filter(p => p.retomadoEm !== null && p.retomadoEm !== undefined);
          const ultimaRetomada = pausasFechadas.length > 0
            ? Math.max(...pausasFechadas.map(p => p.retomadoEm!))
            : sessao.iniciadoEm;
          // Tempo correndo desde a última retomada
          const tempoDesdeRetomada = agoraSeg - ultimaRetomada;
          tempoAtualSegundos = sessao.totalSegundos + Math.max(0, tempoDesdeRetomada);
        }
        return {
          ...sessao,
          tempoAtualSegundos: Math.max(0, tempoAtualSegundos),
          pausas,
          agoraServidor: agoraSeg,
        };
      }),

    // Retorna resumo de todas as sessões de um pedido (para o card do kanban)
    resumoPorPedido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        const sessoes = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(eq(empacotamentoSessoes.pedidoId, input.pedidoId))
          .orderBy(desc(empacotamentoSessoes.id));
        const agoraSeg = Math.floor(Date.now() / 1000);
        // Calcular tempo total acumulado de todas as sessões
        let totalSegundos = 0;
        let temRegistroValido = false;
        let temSessaoAtiva = false;
        let temSessaoPausada = false;
        for (const s of sessoes) {
          if (s.status === 'ativo') {
            temSessaoAtiva = true;
            const pausas = await getDb()
              .select()
              .from(empacotamentoSessoesPausas)
              .where(eq(empacotamentoSessoesPausas.sessaoId, s.id));
            const totalPausado = pausas.reduce((acc, p) => {
              if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
              return acc;
            }, 0);
            totalSegundos += Math.max(0, (agoraSeg - s.iniciadoEm) - totalPausado);
          } else if (s.status === 'pausado') {
            temSessaoPausada = true;
            totalSegundos += s.totalSegundos;
          } else {
            totalSegundos += s.totalSegundos;
          }
          if (s.registradoEm) temRegistroValido = true;
        }
        return {
          totalSegundos,
          temRegistroValido,
          temSessaoAtiva,
          temSessaoPausada,
          agoraServidor: agoraSeg,
          sessoes: sessoes.map(s => ({ id: s.id, operadorNome: s.operadorNome, status: s.status, registradoEm: s.registradoEm })),
        };
      }),

    // Inicia uma nova sessão operacional
    iniciar: publicProcedure
      .input(z.object({ pedidoId: z.number(), operadorId: z.string(), operadorNome: z.string() }))
      .mutation(async ({ input }) => {
        // Verificar se já tem sessão ativa ou pausada
        const existente = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(and(
            eq(empacotamentoSessoes.pedidoId, input.pedidoId),
            eq(empacotamentoSessoes.operadorId, input.operadorId),
            sql`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
          ))
          .limit(1);
        if (existente.length > 0) {
          // Se pausada, retomar automaticamente
          if (existente[0].status === 'pausado') {
            return await retomarSessao(existente[0].id);
          }
          return { success: true, sessaoId: existente[0].id, action: 'already_active' };
        }
        const agoraUtcSeg = Math.floor(Date.now() / 1000);
        const [result] = await getDb().insert(empacotamentoSessoes).values({
          pedidoId: input.pedidoId,
          operadorId: input.operadorId,
          operadorNome: input.operadorNome,
          iniciadoEm: agoraUtcSeg,
          status: 'ativo',
          totalSegundos: 0,
        }).returning({ id: empacotamentoSessoes.id });
        return { success: true, sessaoId: result.id, action: 'started' };
      }),

    // Pausa a sessão ativa
    pausar: publicProcedure
      .input(z.object({ sessaoId: z.number() }))
      .mutation(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(and(eq(empacotamentoSessoes.id, input.sessaoId), eq(empacotamentoSessoes.status, 'ativo')))
          .limit(1);
        if (rows.length === 0) return { success: false, error: 'sessao_nao_ativa' };
        const sessao = rows[0];
        const agoraUtcSeg = Math.floor(Date.now() / 1000);
        // Calcular tempo acumulado até agora
        const pausas = await getDb()
          .select()
          .from(empacotamentoSessoesPausas)
          .where(eq(empacotamentoSessoesPausas.sessaoId, sessao.id));
        const totalPausado = pausas.reduce((acc, p) => {
          if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
          return acc;
        }, 0);
        const tempoAcumulado = Math.max(0, (agoraUtcSeg - sessao.iniciadoEm) - totalPausado);
        // Registrar pausa
        await getDb().insert(empacotamentoSessoesPausas).values({
          sessaoId: sessao.id,
          pausadoEm: agoraUtcSeg,
        });
        // Atualizar status e salvar tempo acumulado
        await getDb().update(empacotamentoSessoes).set({
          status: 'pausado',
          totalSegundos: tempoAcumulado,
        }).where(eq(empacotamentoSessoes.id, sessao.id));
        return { success: true, tempoAcumuladoSegundos: tempoAcumulado };
      }),

    // Retoma uma sessão pausada
    retomar: publicProcedure
      .input(z.object({ sessaoId: z.number() }))
      .mutation(async ({ input }) => {
        return await retomarSessao(input.sessaoId);
      }),

    // Registra formalmente o tempo (não encerra a sessão)
    registrar: publicProcedure
      .input(z.object({ sessaoId: z.number() }))
      .mutation(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(eq(empacotamentoSessoes.id, input.sessaoId))
          .limit(1);
        if (rows.length === 0) return { success: false, error: 'sessao_nao_encontrada' };
        const sessao = rows[0];
        const agoraUtcSeg = Math.floor(Date.now() / 1000);
        // Calcular tempo atual
        let tempoAtual = sessao.totalSegundos;
        if (sessao.status === 'ativo') {
          const pausas = await getDb()
            .select()
            .from(empacotamentoSessoesPausas)
            .where(eq(empacotamentoSessoesPausas.sessaoId, sessao.id));
          const totalPausado = pausas.reduce((acc, p) => {
            if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
            return acc;
          }, 0);
          tempoAtual = Math.max(0, (agoraUtcSeg - sessao.iniciadoEm) - totalPausado);
        }
        // Se a sessão está ativa, pausar antes de registrar (para o relógio parar)
        if (sessao.status === 'ativo') {
          await getDb().insert(empacotamentoSessoesPausas).values({
            sessaoId: sessao.id,
            pausadoEm: agoraUtcSeg,
          });
        }
        // Marcar como finalizado (status = 'finalizado') para parar o relógio no frontend
        await getDb().update(empacotamentoSessoes).set({
          registradoEm: agoraUtcSeg,
          tempoRegistradoSegundos: tempoAtual,
          totalSegundos: tempoAtual,
          status: 'finalizado',
          finalizadoEm: agoraUtcSeg,
        }).where(eq(empacotamentoSessoes.id, sessao.id));
        return { success: true, tempoRegistradoSegundos: tempoAtual };
      }),

    // Pausa automática: pausa todas as sessões ativas (chamada pelo scheduler)
    pausarTodosAtivos: publicProcedure
      .input(z.object({ motivo: z.string().optional() }))
      .mutation(async ({ input: _input }) => {
        const ativas = await getDb()
          .select()
          .from(empacotamentoSessoes)
          .where(eq(empacotamentoSessoes.status, 'ativo'));
        let pausados = 0;
        for (const sessao of ativas) {
          const agoraUtcSeg = Math.floor(Date.now() / 1000);
          const pausas = await getDb()
            .select()
            .from(empacotamentoSessoesPausas)
            .where(eq(empacotamentoSessoesPausas.sessaoId, sessao.id));
          const totalPausado = pausas.reduce((acc, p) => {
            if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
            return acc;
          }, 0);
          const tempoAcumulado = Math.max(0, (agoraUtcSeg - sessao.iniciadoEm) - totalPausado);
          await getDb().insert(empacotamentoSessoesPausas).values({
            sessaoId: sessao.id,
            pausadoEm: agoraUtcSeg,
          });
          await getDb().update(empacotamentoSessoes).set({
            status: 'pausado',
            totalSegundos: tempoAcumulado,
          }).where(eq(empacotamentoSessoes.id, sessao.id));
          pausados++;
        }
        return { success: true, pausados };
      }),

    // Apaga sessões com tempo zero (registros falsos no ranking)
    deletarSessoesZero: publicProcedure
      .mutation(async () => {
        // Deleta sessões finalizadas com tempo zero (tempoRegistradoSegundos = 0 ou null E totalSegundos = 0 ou null)
        const result = await getDb()
          .delete(empacotamentoSessoes)
          .where(and(
            eq(empacotamentoSessoes.status, 'finalizado'),
            sql`(${empacotamentoSessoes.tempoRegistradoSegundos} IS NULL OR ${empacotamentoSessoes.tempoRegistradoSegundos} = 0)`,
            sql`(${empacotamentoSessoes.totalSegundos} IS NULL OR ${empacotamentoSessoes.totalSegundos} = 0)`,
          ));
        return { deletados: (result as any).rowsAffected ?? 0 };
      }),

    // Verifica se o pedido tem pelo menos um registro válido (para liberar mover para pátio)
    temRegistroValido: publicProcedure
      .input(z.object({ pedidoId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select({ id: empacotamentoSessoes.id })
          .from(empacotamentoSessoes)
          .where(and(
            eq(empacotamentoSessoes.pedidoId, input.pedidoId),
            sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`
          ))
          .limit(1);
        return { temRegistro: rows.length > 0 };
      }),
  }),

  // ─── PAINEL DE REGISTROS DE TEMPO POR PEDIDO ─────────────────────────────────
  registrosTempo: router({
    list: publicProcedure
      .input(z.object({
        periodo: z.enum(['semana', 'mes', 'tudo']).default('semana'),
      }))
      .query(async ({ input }) => {
        const agora = Math.floor(Date.now() / 1000);
        let inicioTs = 0;
        if (input.periodo === 'semana') {
          const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
          inicioTs = Math.floor(d.getTime() / 1000);
        } else if (input.periodo === 'mes') {
          const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0);
          inicioTs = Math.floor(d.getTime() / 1000);
        }
        const where = input.periodo === 'tudo'
          ? and(eq(empacotamentoSessoes.status, 'finalizado'), sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`)
          : and(
              eq(empacotamentoSessoes.status, 'finalizado'),
              sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
              sql`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
              sql`${empacotamentoSessoes.registradoEm} <= ${agora}`,
            );
        const sessoes = await getDb().select().from(empacotamentoSessoes).where(where).orderBy(sql`${empacotamentoSessoes.registradoEm} DESC`);
        const pedidoIds = Array.from(new Set(sessoes.map(s => s.pedidoId)));
        let pedidos: typeof empacotamentoPedidos.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          pedidos = await getDb().select().from(empacotamentoPedidos)
            .where(sql`${empacotamentoPedidos.id} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }
        const config = await getDb().select().from(empacotamentoConfigProdutividade).where(eq(empacotamentoConfigProdutividade.ativo, 1));
        const cfg = config[0] ?? { valorPorMinuto: '0.15' };
        const valorMin = parseFloat(String(cfg.valorPorMinuto));
        // Agrupar por pedido
        const porPedido: Record<number, { pedidoId: number; pedidoCodigo: string; colaboradores: { nome: string; tempoSegundos: number; valorProdutividade: number }[]; tempoTotalSegundos: number; registradoEm: number }> = {};
        for (const s of sessoes) {
          const pedido = pedidos.find(p => p.id === s.pedidoId);
          const tempoSeg = s.tempoRegistradoSegundos ?? s.totalSegundos ?? 0;
          const tempoMin = tempoSeg / 60;
          const tempoEstimadoMin = await calcularTempoEstimadoMin(pedido);
          let fator = 1.0;
          if (tempoEstimadoMin > 0 && tempoMin > 0) {
            const varPct = (tempoMin - tempoEstimadoMin) / tempoEstimadoMin;
            const passos = Math.floor(Math.abs(varPct) / 0.05);
            const ajuste = passos * 0.05;
            fator = varPct > 0 ? Math.max(0.5, 1.0 - ajuste) : Math.min(1.5, 1.0 + ajuste);
          }
          const valorProd = parseFloat((tempoMin * valorMin * fator).toFixed(2));
          if (!porPedido[s.pedidoId]) {
            porPedido[s.pedidoId] = {
              pedidoId: s.pedidoId,
              pedidoCodigo: pedido ? String(pedido.id) : String(s.pedidoId),
              colaboradores: [],
              tempoTotalSegundos: 0,
              registradoEm: s.registradoEm ?? 0,
            };
          }
          porPedido[s.pedidoId].colaboradores.push({ nome: s.operadorNome, tempoSegundos: tempoSeg, valorProdutividade: valorProd });
          porPedido[s.pedidoId].tempoTotalSegundos += tempoSeg;
        }
        return Object.values(porPedido).sort((a, b) => b.registradoEm - a.registradoEm);
      }),
  }),

  // ─── PAINEL PREVISTO VS REALIZADO ─────────────────────────────────────────────
  previstoVsRealizado: router({
    list: publicProcedure
      .input(z.object({
        periodo: z.enum(['semana', 'mes', 'tudo']).default('semana'),
      }))
      .query(async ({ input }) => {
        const agora = Math.floor(Date.now() / 1000);
        let inicioTs = 0;
        if (input.periodo === 'semana') {
          const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
          inicioTs = Math.floor(d.getTime() / 1000);
        } else if (input.periodo === 'mes') {
          const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0);
          inicioTs = Math.floor(d.getTime() / 1000);
        }
        const where = input.periodo === 'tudo'
          ? and(eq(empacotamentoSessoes.status, 'finalizado'), sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`)
          : and(
              eq(empacotamentoSessoes.status, 'finalizado'),
              sql`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
              sql`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
              sql`${empacotamentoSessoes.registradoEm} <= ${agora}`,
            );
        // Agregar por pedido (somar tempo de todos os colaboradores)
        const sessoes = await getDb().select().from(empacotamentoSessoes).where(where);
        const pedidoIds = Array.from(new Set(sessoes.map(s => s.pedidoId)));
        let pedidos: typeof empacotamentoPedidos.$inferSelect[] = [];
        if (pedidoIds.length > 0) {
          pedidos = await getDb().select().from(empacotamentoPedidos)
            .where(sql`${empacotamentoPedidos.id} IN (${sql.join(pedidoIds.map(id => sql`${id}`), sql`, `)})`);
        }
        const porPedido: Record<number, { pedidoId: number; pedidoCodigo: string; tempoRealizadoSegundos: number; tempoEstimadoSegundos: number; registradoEm: number }> = {};
        for (const s of sessoes) {
          const tempoSeg = s.tempoRegistradoSegundos ?? s.totalSegundos ?? 0;
          if (!porPedido[s.pedidoId]) {
            const pedido = pedidos.find(p => p.id === s.pedidoId);
            const tempoEstMin = await calcularTempoEstimadoMin(pedido);
            porPedido[s.pedidoId] = {
              pedidoId: s.pedidoId,
              pedidoCodigo: pedido ? String(pedido.id) : String(s.pedidoId),
              tempoRealizadoSegundos: 0,
              tempoEstimadoSegundos: Math.round(tempoEstMin * 60),
              registradoEm: s.registradoEm ?? 0,
            };
          }
          porPedido[s.pedidoId].tempoRealizadoSegundos += tempoSeg;
        }
        return Object.values(porPedido)
          .sort((a, b) => b.registradoEm - a.registradoEm)
          .map(p => ({
            ...p,
            variacaoPct: p.tempoEstimadoSegundos > 0
              ? parseFloat((((p.tempoRealizadoSegundos - p.tempoEstimadoSegundos) / p.tempoEstimadoSegundos) * 100).toFixed(1))
              : null,
          }));
      }),
  }),

});

// Helper: retoma uma sessão pausada
async function retomarSessao(sessaoId: number) {
  const rows = await getDb()
    .select()
    .from(empacotamentoSessoes)
    .where(and(eq(empacotamentoSessoes.id, sessaoId), eq(empacotamentoSessoes.status, 'pausado')))
    .limit(1);
  if (rows.length === 0) return { success: false, error: 'sessao_nao_pausada' };
  const sessao = rows[0];
  const agoraUtcSeg = Math.floor(Date.now() / 1000);
  // Fechar a última pausa aberta com o timestamp atual
  await getDb().execute(
    sql`UPDATE empacotamento_sessoes_pausas SET retomadoEm = ${agoraUtcSeg} WHERE sessaoId = ${sessao.id} AND retomadoEm IS NULL`
  );
  // Apenas mudar status para ativo — NÃO alterar iniciadoEm nem totalSegundos
  // O getAtiva calcula: totalSegundos + (agora - ultimaRetomada)
  await getDb().update(empacotamentoSessoes).set({
    status: 'ativo',
  }).where(eq(empacotamentoSessoes.id, sessao.id));
  return { success: true, sessaoId, action: 'resumed' };
}
