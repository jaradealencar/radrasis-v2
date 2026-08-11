import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { abcCache } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import https from "https";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fetchMubisysOsList(
  publicKey: string,
  accessToken: string,
  datainicial: string,
  datafinal: string,
  page = 1
): Promise<{ status: number; data: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const path = `/ordem-servico?status=TODOS&filtrodata=CADASTRO&datainicial=${datainicial}&datafinal=${datafinal}&page=${page}&per_page=500`;
    const url = `https://api.mubisys.com/api/${publicKey}${path}`;
    const req = https.get(
      url,
      { headers: { "Access-Token": accessToken, Accept: "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c: Buffer) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: {} });
          }
        });
      }
    );
    req.on("error", () => resolve({ status: 0, data: {} }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ status: 0, data: { error: "timeout" } });
    });
  });
}

interface OsItem {
  cliente?: string;
  tipo?: string;
  valor_total?: string | number;
  itens?: Array<{
    item?: string;
    descricao?: string;
    produto?: string;
    nome?: string;
    valor_final?: string | number;
    sub_total?: string | number;
    quantidade?: number;
    [key: string]: unknown;
  }>;
}

async function fetchAllOsForMonth(
  publicKey: string,
  accessToken: string,
  ano: number,
  mes: number
): Promise<OsItem[]> {
  const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const end = `${ano}-${String(mes).padStart(2, "0")}-${lastDay}`;

  let all: OsItem[] = [];
  let page = 1;

  while (true) {
    const { status, data } = await fetchMubisysOsList(
      publicKey,
      accessToken,
      start,
      end,
      page
    );
    if (status !== 201) break;

    const items = (data as { data?: OsItem[] }).data ?? [];
    all = all.concat(items);

    const pagination = (data as { pagination?: { last_page?: number } })
      .pagination;
    if (!pagination || page >= (pagination.last_page ?? 1)) break;
    page++;
  }

  return all;
}

interface AbcItem {
  nome: string;
  total: number;
  count: number;
  pct: string;
  pctAcum: string;
  classe: "A" | "B" | "C";
}

function buildAbcClientes(osArray: OsItem[]): {
  items: AbcItem[];
  totalOs: number;
  faturamento: number;
} {
  const clientMap: Record<string, { total: number; count: number }> = {};
  let totalOs = 0;

  for (const os of osArray) {
    if (os.tipo === "Retrabalho") continue;
    totalOs++;
    const client = os.cliente ?? "Desconhecido";
    const valor = parseFloat(String(os.valor_total ?? 0));
    if (!clientMap[client]) clientMap[client] = { total: 0, count: 0 };
    clientMap[client].total += valor;
    clientMap[client].count++;
  }

  const sorted = Object.entries(clientMap)
    .map(([nome, d]) => ({ nome, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total);

  const faturamento = sorted.reduce((s, r) => s + r.total, 0);
  let acum = 0;

  const items: AbcItem[] = sorted.slice(0, 50).map((r) => {
    acum += r.total;
    const pct = faturamento > 0 ? (r.total / faturamento) * 100 : 0;
    const pctAcum = faturamento > 0 ? (acum / faturamento) * 100 : 0;
    const classe: "A" | "B" | "C" =
      pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
    return {
      nome: r.nome,
      total: r.total,
      count: r.count,
      pct: pct.toFixed(1),
      pctAcum: pctAcum.toFixed(1),
      classe,
    };
  });

  return { items, totalOs, faturamento };
}

function buildAbcProdutos(osArray: OsItem[]): {
  items: AbcItem[];
  totalOs: number;
  faturamento: number;
} {
  const prodMap: Record<string, { total: number; count: number }> = {};
  let totalOs = 0;

  for (const os of osArray) {
    if (os.tipo === "Retrabalho") continue;
    totalOs++;
    for (const item of os.itens ?? []) {
      // Tentar múltiplos campos de nome antes de desistir
      const prod = (
        item.item ??
        item.descricao ??
        item.produto ??
        item.nome ??
        ""
      ).toString().trim();
      // Pular itens sem nome identificável — não exibir como 'Desconhecido'
      if (!prod) continue;
      const valor = parseFloat(
        String(item.valor_final ?? item.sub_total ?? 0)
      );
      if (!prodMap[prod]) prodMap[prod] = { total: 0, count: 0 };
      prodMap[prod].total += valor;
      prodMap[prod].count += item.quantidade ?? 1;
    }
  }

  const sorted = Object.entries(prodMap)
    .map(([nome, d]) => ({ nome, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total);

  const faturamento = sorted.reduce((s, r) => s + r.total, 0);
  let acum = 0;

  const items: AbcItem[] = sorted.slice(0, 50).map((r) => {
    acum += r.total;
    const pct = faturamento > 0 ? (r.total / faturamento) * 100 : 0;
    const pctAcum = faturamento > 0 ? (acum / faturamento) * 100 : 0;
    const classe: "A" | "B" | "C" =
      pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
    return {
      nome: r.nome,
      total: r.total,
      count: r.count,
      pct: pct.toFixed(1),
      pctAcum: pctAcum.toFixed(1),
      classe,
    };
  });

  return { items, totalOs, faturamento };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const performanceAbcRouter = router({
  // Retorna mapa de clientes com retrabalho e/ou atraso no mês
  getClienteTags: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020).max(2030) }))
    .query(async ({ input }) => {
      const { mes, ano } = input;
      const dbClient = await getDb();
      if (!dbClient) return { retrabalhos: {}, atrasos: {} };

      // Importar tabelas necessárias
      const { cotacoesFrete } = await import("../../drizzle/schema");
      const { sql: sqlFn, gte, lte } = await import("drizzle-orm");

      // Datas do mês
      const startDate = new Date(ano, mes - 1, 1);
      const endDate = new Date(ano, mes, 0, 23, 59, 59);

      // Buscar cotações do mês com destinatário, retrabalho e datas
      const cotacoes = await dbClient
        .select({
          destinatarioNome: cotacoesFrete.destinatarioNome,
          temRetrabalho: cotacoesFrete.temRetrabalho,
          dataEntregaPrevista: cotacoesFrete.dataEntregaPrevista,
          dataDespacho: cotacoesFrete.dataDespacho,
          status: cotacoesFrete.status,
        })
        .from(cotacoesFrete)
        .where(
          sqlFn`${cotacoesFrete.createdAt} >= ${startDate} AND ${cotacoesFrete.createdAt} <= ${endDate}`
        );

      const retrabalhosMap: Record<string, number> = {};
      const atrasosMap: Record<string, number> = {};

      for (const c of cotacoes) {
        const nome = c.destinatarioNome ?? "Desconhecido";
        // Retrabalho
        if (c.temRetrabalho) {
          retrabalhosMap[nome] = (retrabalhosMap[nome] ?? 0) + 1;
        }
        // Atraso: despacho depois da entrega prevista, ou concluído sem despacho com entrega prevista no passado
        if (c.dataEntregaPrevista) {
          const prevista = new Date(c.dataEntregaPrevista);
          const despacho = c.dataDespacho ? new Date(c.dataDespacho) : null;
          const atrasado = despacho
            ? despacho > prevista
            : c.status === "enviada" && prevista < new Date();
          if (atrasado) {
            atrasosMap[nome] = (atrasosMap[nome] ?? 0) + 1;
          }
        }
      }

      return { retrabalhos: retrabalhosMap, atrasos: atrasosMap };
    }),

  // Get ABC curve for a given month/year (from cache or fresh fetch)
  getAbc: protectedProcedure
    .input(
      z.object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020).max(2030),
        tipo: z.enum(["clientes", "produtos"]),
        forceRefresh: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const { mes, ano, tipo, forceRefresh } = input;

      const dbClient = await getDb();
      if (!dbClient) return { items: [], totalOs: 0, faturamento: 0, fromCache: false, updatedAt: new Date() };

      // Check cache first
      if (!forceRefresh) {
        const cached = await dbClient
          .select()
          .from(abcCache)
          .where(
            and(
              eq(abcCache.mes, mes),
              eq(abcCache.ano, ano),
              eq(abcCache.tipo, tipo)
            )
          )
          .limit(1);

        if (cached.length > 0) {
          const row = cached[0];
          return {
            items: JSON.parse(row.dados) as AbcItem[],
            totalOs: row.totalOs ?? 0,
            faturamento: parseFloat(row.faturamentoTotal ?? "0"),
            fromCache: true,
            updatedAt: row.updatedAt,
          };
        }
      }

      // Fetch from ERP
      const publicKey = process.env.MUBISYS_PUBLIC_KEY ?? "";
      const accessToken = process.env.MUBISYS_ACCESS_TOKEN ?? "";

      if (!publicKey || !accessToken) {
        return { items: [], totalOs: 0, faturamento: 0, fromCache: false, updatedAt: new Date() };
      }

      const osArray = await fetchAllOsForMonth(publicKey, accessToken, ano, mes);

      const result =
        tipo === "clientes"
          ? buildAbcClientes(osArray)
          : buildAbcProdutos(osArray);

      // Save to cache
      const existing = await dbClient
        .select()
        .from(abcCache)
        .where(
          and(
            eq(abcCache.mes, mes),
            eq(abcCache.ano, ano),
            eq(abcCache.tipo, tipo)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await dbClient
          .update(abcCache)
          .set({
            dados: JSON.stringify(result.items),
            totalOs: result.totalOs,
            faturamentoTotal: String(result.faturamento.toFixed(2)),
          })
          .where(eq(abcCache.id, existing[0].id));
      } else {
        await dbClient.insert(abcCache).values({
          mes,
          ano,
          tipo,
          dados: JSON.stringify(result.items),
          totalOs: result.totalOs,
          faturamentoTotal: String(result.faturamento.toFixed(2)),
        });
      }

      return {
        items: result.items,
        totalOs: result.totalOs,
        faturamento: result.faturamento,
        fromCache: false,
        updatedAt: new Date(),
      };
    }),

  // Retorna evolução mensal dos principais produtos (para gráfico de área empilhada)
  getEvolucaoProdutos: protectedProcedure
    .input(z.object({
      meses: z.array(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020).max(2030) })),
      topN: z.number().min(3).max(15).optional().default(8),
    }))
    .query(async ({ input }) => {
      const { meses, topN } = input;
      const dbClient = await getDb();
      if (!dbClient) return { chartData: [], tabela: [], topProdutos: [], mesesLabels: [] };

      // Buscar todos os caches dos meses solicitados
      const caches = await Promise.all(
        meses.map(async ({ mes, ano }) => {
          const rows = await dbClient
            .select()
            .from(abcCache)
            .where(and(eq(abcCache.mes, mes), eq(abcCache.ano, ano), eq(abcCache.tipo, "produtos")))
            .limit(1);
          if (rows.length === 0) return { mes, ano, items: [] as AbcItem[] };
          return { mes, ano, items: JSON.parse(rows[0].dados) as AbcItem[] };
        })
      );

      // Descobrir os top N produtos mais relevantes (por faturamento total somado)
      const prodTotals: Record<string, number> = {};
      for (const c of caches) {
        for (const item of c.items) {
          prodTotals[item.nome] = (prodTotals[item.nome] ?? 0) + item.total;
        }
      }
      const topProdutos = Object.entries(prodTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([nome]) => nome);

      // Montar labels dos meses
      const MESES_NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const mesesLabels = meses.map(({ mes, ano }) => `${MESES_NOMES[mes - 1]} ${ano}`);

      // Montar dados para o gráfico: cada ponto tem { mes, [produto]: pct }
      const chartData = caches.map(({ mes, ano, items }) => {
        const label = `${MESES_NOMES[mes - 1]} ${ano}`;
        const faturamentoTotal = items.reduce((s, i) => s + i.total, 0);
        const row: Record<string, string | number> = { mes: label };
        for (const prod of topProdutos) {
          const item = items.find(i => i.nome === prod);
          row[prod] = item && faturamentoTotal > 0
            ? parseFloat(((item.total / faturamentoTotal) * 100).toFixed(1))
            : 0;
        }
        return row;
      });

      // Montar tabela comparativa
      const tabela = topProdutos.map(prod => {
        const row: Record<string, string | number> = { produto: prod };
        for (const c of caches) {
          const label = `${MESES_NOMES[c.mes - 1]} ${c.ano}`;
          const faturamentoTotal = c.items.reduce((s, i) => s + i.total, 0);
          const item = c.items.find(i => i.nome === prod);
          row[label] = item && faturamentoTotal > 0
            ? parseFloat(((item.total / faturamentoTotal) * 100).toFixed(1))
            : 0;
          row[`${label}_valor`] = item?.total ?? 0;
        }
        return row;
      });

      return { chartData, tabela, topProdutos, mesesLabels };
    }),

  // Busca lista de produtos do ERP via CADASTRO/PRODUTOS
  getProdutosERP: protectedProcedure
    .input(z.object({ busca: z.string().optional().default("") }))
    .query(async ({ input }) => {
      const publicKey = process.env.MUBISYS_PUBLIC_KEY ?? "";
      const accessToken = process.env.MUBISYS_ACCESS_TOKEN ?? "";
      if (!publicKey || !accessToken) return { produtos: [] };

      const { busca } = input;
      const searchParam = busca ? `&search=${encodeURIComponent(busca)}` : "";

      const result = await new Promise<{ status: number; data: Record<string, unknown> }>((resolve) => {
        const path = `/produto?per_page=100&page=1${searchParam}`;
        const url = `https://api.mubisys.com/api/${publicKey}${path}`;
        const req = https.get(
          url,
          { headers: { "Access-Token": accessToken, Accept: "application/json" } },
          (res) => {
            let body = "";
            res.on("data", (c: Buffer) => (body += c));
            res.on("end", () => {
              try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(body) }); }
              catch { resolve({ status: res.statusCode ?? 0, data: {} }); }
            });
          }
        );
        req.on("error", () => resolve({ status: 0, data: {} }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, data: {} }); });
      });

      if (result.status !== 200 && result.status !== 201) return { produtos: [] };

      const rawData = (result.data as { data?: unknown[] }).data ?? [];
      const produtos = (rawData as Record<string, unknown>[]).map((p) => ({
        id: String(p.id ?? p.codigo ?? ""),
        nome: String(p.nome ?? p.descricao ?? p.name ?? ""),
        codigo: String(p.codigo ?? p.id ?? ""),
        categoria: String(p.categoria ?? p.group ?? ""),
        ativo: p.ativo !== false,
      })).filter(p => p.nome);

      return { produtos };
    }),
});
