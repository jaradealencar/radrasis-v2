import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { getDb } from "../db/db";
import { listarOSMubiSys } from "../integrations/mubisys-client";
import { historicoOs, mubisysApiCache } from "../../drizzle/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * Análise Geográfica: distribuição de OS e faturamento por Estado do cliente.
 *
 * FONTE DE VERDADE: API MubiSys, em tempo real — cada OS já vem com o
 * endereço do cliente (`cliente_endereco[0].cidade/estado`), então não é
 * mais necessário cruzar com um cadastro local. Se a API estiver fora do ar
 * ou der timeout, cai para o snapshot local (`historico_os`, importado
 * anteriormente) daquele mês — mesmo padrão de fallback já usado em
 * Performance Comercial (`getMesFromApi`/`getAno`).
 *
 * "Sinalizadas e selecionadas" (linguagem do usuário para "cash realizado"):
 * todo status exceto "Cancelada" — inclui Entregue, Concluída e Em produção.
 */
function osValidaCondition() {
  return ne(historicoOs.status, "Cancelada");
}

function osValidaMubisys(os: any): boolean {
  return String(os.status ?? "").toLowerCase() !== "cancelada";
}

/** Normaliza nome de cidade pra chave de agrupamento — a planilha do ERP
 * mistura "CAMPO GRANDE" e "Campo Grande" pra mesma cidade. Mantém o nome
 * em title case pra exibição. */
function tituloCidade(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function normalizarUf(uf: string | null | undefined): string | null {
  if (!uf) return null;
  const s = String(uf).trim().toUpperCase();
  return UFS_VALIDAS.has(s) ? s : null;
}

function extrairClienteOs(os: any): string {
  const raw = os.cliente;
  if (typeof raw === "object" && raw !== null) {
    return String((raw as any)?.nome ?? (raw as any)?.razao_social ?? "").trim();
  }
  return String(raw ?? "").trim();
}

function extrairEnderecoOs(os: any): { cidade: string | null; estado: string | null } {
  const enderecos: any[] = Array.isArray(os.cliente_endereco)
    ? os.cliente_endereco
    : (os.cliente_endereco ? [os.cliente_endereco] : []);
  const primeiro = enderecos[0];
  const cidade = primeiro?.cidade ? String(primeiro.cidade).trim() : null;
  const estado = (primeiro?.estado || primeiro?.uf) ? String(primeiro.estado || primeiro.uf).trim() : null;
  return { cidade, estado };
}

type LinhaOs = { estado: string | null; cidade: string | null; empresa: string; valorTotal: number };

function normalizarOsMubisys(os: any): LinhaOs {
  const endereco = extrairEnderecoOs(os);
  return {
    estado: endereco.estado,
    cidade: endereco.cidade,
    empresa: extrairClienteOs(os),
    valorTotal: parseFloat(String(os.valor_total ?? "0")) || 0,
  };
}

function isMesAtual(mes: number, ano: number): boolean {
  const now = new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}

// ─── Cache persistente de OS brutas por mês (tabela compartilhada com
// Performance Comercial) ────────────────────────────────────────────────────
// Lê a chave `raw_${mes}_${ano}` (escrita por Performance Comercial, que
// também guarda orçamentos) só em modo leitura — nunca escreve nela, pra não
// sobrescrever o campo de orçamentos com um update parcial. Quando precisa
// buscar da API, grava sob uma chave própria (`geo_raw_`), evitando qualquer
// risco de corromper o cache de outra tela.
async function lerCacheOsBrutas(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, cacheKey: string): Promise<any[] | null> {
  const rows = await db.select().from(mubisysApiCache).where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date() > new Date(row.expiresAt) || !row.osData) return null;
  try {
    return JSON.parse(row.osData);
  } catch {
    return null;
  }
}

async function buscarOsBrutasDoMes(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  mes: number,
  ano: number,
): Promise<{ itens: any[]; completo: boolean }> {
  const compartilhado = await lerCacheOsBrutas(db, `raw_${mes}_${ano}`);
  if (compartilhado) return { itens: compartilhado, completo: true };

  const cacheKeyProprio = `geo_raw_${mes}_${ano}`;
  const proprio = await lerCacheOsBrutas(db, cacheKeyProprio);
  if (proprio) return { itens: proprio, completo: true };

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad(mes)}-01`;
  const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;
  const resultado = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });

  if (resultado.completo) {
    const now = new Date();
    const ttlMs = isMesAtual(mes, ano) ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await db.select({ id: mubisysApiCache.id }).from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKeyProprio)).limit(1);
    const payload = { osData: JSON.stringify(resultado.itens), fetchedAt: now, expiresAt };
    if (existing.length > 0) {
      await db.update(mubisysApiCache).set(payload).where(eq(mubisysApiCache.cacheKey, cacheKeyProprio));
    } else {
      await db.insert(mubisysApiCache).values({ cacheKey: cacheKeyProprio, mes, ano, ...payload });
    }
  }

  return resultado;
}

/** Fallback: snapshot local (`historico_os`, importado anteriormente),
 * usado só quando a API MubiSys não está configurada, falha ou dá timeout. */
async function linhasDoMesLocal(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  mes: number,
  ano: number,
): Promise<LinhaOs[]> {
  const rows = await db.select({
    estado: historicoOs.estado,
    cidade: historicoOs.cidade,
    empresa: historicoOs.empresa,
    valorTotal: historicoOs.valorTotal,
  }).from(historicoOs).where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano), osValidaCondition()));
  return rows.map((r) => ({ estado: r.estado, cidade: r.cidade, empresa: r.empresa ?? "", valorTotal: Number(r.valorTotal ?? 0) }));
}

/** Busca as OS de um mês — API MubiSys em tempo real (com timeout de 55s,
 * mesma folga usada em Performance Comercial), caindo para o snapshot local
 * se a API não estiver configurada, falhar ou não responder a tempo. */
async function linhasDoMes(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  mes: number,
  ano: number,
): Promise<LinhaOs[]> {
  if (ENV.MUBISYS_PUBLIC_KEY && ENV.MUBISYS_ACCESS_TOKEN) {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 55000));
      const resultado = await Promise.race([buscarOsBrutasDoMes(db, mes, ano), timeoutPromise]);
      if (resultado) {
        return resultado.itens.filter(osValidaMubisys).map(normalizarOsMubisys);
      }
    } catch {
      // API falhou — cai para o fallback local abaixo
    }
  }
  return linhasDoMesLocal(db, mes, ano);
}

/** Busca o ano inteiro (12 meses), com concorrência limitada a 2 chamadas
 * simultâneas — mesmo padrão de `getAno` em Performance Comercial, pra não
 * disparar 12 chamadas de uma vez na API MubiSys. */
async function linhasDoAno(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ano: number): Promise<LinhaOs[]> {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const CONCURRENCY = 2;
  let todas: LinhaOs[] = [];
  for (let i = 0; i < meses.length; i += CONCURRENCY) {
    const batch = meses.slice(i, i + CONCURRENCY);
    const resultados = await Promise.all(batch.map((mes) => linhasDoMes(db, mes, ano)));
    for (const r of resultados) todas = todas.concat(r);
  }
  return todas;
}

function agregarPorEstado(linhas: LinhaOs[]) {
  const porEstado = new Map<string, { qtdOs: number; faturamento: number; clientes: Set<string>; cidades: Map<string, { qtdOs: number; faturamento: number }> }>();
  let totalOs = 0;
  let totalFaturamento = 0;
  let semEstado = 0;
  let semEstadoFaturamento = 0;

  for (const r of linhas) {
    const valor = r.valorTotal;
    totalOs++;
    totalFaturamento += valor;

    const estado = normalizarUf(r.estado);
    if (!estado) {
      semEstado++;
      semEstadoFaturamento += valor;
      continue;
    }

    if (!porEstado.has(estado)) {
      porEstado.set(estado, { qtdOs: 0, faturamento: 0, clientes: new Set(), cidades: new Map() });
    }
    const e = porEstado.get(estado)!;
    e.qtdOs++;
    e.faturamento += valor;
    e.clientes.add((r.empresa ?? "").trim().toUpperCase());

    const cidadeNome = r.cidade ? tituloCidade(r.cidade.trim()) : "—";
    if (!e.cidades.has(cidadeNome)) e.cidades.set(cidadeNome, { qtdOs: 0, faturamento: 0 });
    const c = e.cidades.get(cidadeNome)!;
    c.qtdOs++;
    c.faturamento += valor;
  }

  const estados = Array.from(porEstado.entries())
    .map(([estado, d]) => ({
      estado,
      qtdOs: d.qtdOs,
      pctOs: totalOs > 0 ? (d.qtdOs / totalOs) * 100 : 0,
      faturamento: d.faturamento,
      pctFaturamento: totalFaturamento > 0 ? (d.faturamento / totalFaturamento) * 100 : 0,
      qtdClientes: d.clientes.size,
      ticketMedio: d.qtdOs > 0 ? d.faturamento / d.qtdOs : 0,
      topCidades: Array.from(d.cidades.entries())
        .map(([cidade, cd]) => ({ cidade, qtdOs: cd.qtdOs, faturamento: cd.faturamento }))
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 5),
    }))
    .sort((a, b) => b.faturamento - a.faturamento);

  return { estados, totalOs, totalFaturamento, semEstado, semEstadoFaturamento };
}

export const analiseGeograficaRouter = router({
  // DIAGNÓSTICO TEMPORÁRIO — remover depois de confirmar as credenciais em produção.
  _diagCredenciais: publicProcedure.query(async () => {
    return {
      hasPublicKey: !!ENV.MUBISYS_PUBLIC_KEY,
      hasToken: !!ENV.MUBISYS_ACCESS_TOKEN,
      publicKeyLen: ENV.MUBISYS_PUBLIC_KEY.length,
      tokenLen: ENV.MUBISYS_ACCESS_TOKEN.length,
      publicKeyPrefix: ENV.MUBISYS_PUBLIC_KEY.slice(0, 6),
    };
  }),

  // DIAGNÓSTICO TEMPORÁRIO — remover depois de confirmar a chamada à API em produção.
  _diagChamadaApi: publicProcedure.query(async () => {
    const t0 = Date.now();
    try {
      const resultado = await listarOSMubiSys({
        status: "TODOS",
        filtrodata: "APROVACAO",
        datainicial: "2026-08-01",
        datafinal: "2026-08-19",
      });
      return {
        ok: true,
        ms: Date.now() - t0,
        completo: resultado.completo,
        qtdItens: resultado.itens.length,
      };
    } catch (erro: any) {
      return {
        ok: false,
        ms: Date.now() - t0,
        erroNome: erro?.name ?? null,
        erroMensagem: String(erro?.message ?? erro),
        erroStatus: erro?.status ?? null,
      };
    }
  }),

  getAnosDisponiveis: publicProcedure.query(async () => {
    const anoAtual = new Date().getFullYear();
    const db = await getDb();
    if (!db) return [anoAtual, anoAtual - 1, anoAtual - 2];
    const rows = await db.selectDistinct({ ano: historicoOs.ano }).from(historicoOs);
    const anos = new Set(rows.map((r) => r.ano));
    anos.add(anoAtual);
    anos.add(anoAtual - 1);
    return Array.from(anos).sort((a, b) => b - a);
  }),

  getPorEstado: publicProcedure
    .input(z.object({
      ano: z.number(),
      // null/undefined = ano inteiro
      mes: z.number().min(1).max(12).nullable().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { estados: [], totalOs: 0, totalFaturamento: 0, semEstado: 0, semEstadoFaturamento: 0 };

      const linhas = input.mes ? await linhasDoMes(db, input.mes, input.ano) : await linhasDoAno(db, input.ano);
      return agregarPorEstado(linhas);
    }),

  getEvolucaoMensal: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { meses: [], topEstados: [] as string[] };

      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      const CONCURRENCY = 2;
      const porMesLinhas: LinhaOs[][] = new Array(12);
      for (let i = 0; i < meses.length; i += CONCURRENCY) {
        const batch = meses.slice(i, i + CONCURRENCY);
        const resultados = await Promise.all(batch.map((mes) => linhasDoMes(db, mes, input.ano)));
        batch.forEach((mes, idx) => { porMesLinhas[mes - 1] = resultados[idx]; });
      }

      const totalPorEstado = new Map<string, number>();
      for (const linhas of porMesLinhas) {
        for (const r of linhas) {
          const estado = normalizarUf(r.estado);
          if (!estado) continue;
          totalPorEstado.set(estado, (totalPorEstado.get(estado) ?? 0) + r.valorTotal);
        }
      }
      const topEstados = Array.from(totalPorEstado.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([uf]) => uf);
      const topSet = new Set(topEstados);

      const mesesResult = meses.map((mes) => {
        const valores: Record<string, number> = { outros: 0 };
        for (const r of porMesLinhas[mes - 1]) {
          const estado = normalizarUf(r.estado);
          const key = estado && topSet.has(estado) ? estado : "outros";
          valores[key] = (valores[key] ?? 0) + r.valorTotal;
        }
        return { mes, ...valores };
      });

      return { meses: mesesResult, topEstados };
    }),

  /** Lista de clientes por Estado, no período selecionado — usada para
   * exportação em Excel na Análise Geográfica. Se `estado` for informado,
   * retorna só os clientes daquele Estado (ex.: MS, SP, PR). */
  getListaClientes: publicProcedure
    .input(z.object({
      ano: z.number(),
      mes: z.number().min(1).max(12).nullable().optional(),
      estado: z.string().length(2).nullable().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const linhas = input.mes ? await linhasDoMes(db, input.mes, input.ano) : await linhasDoAno(db, input.ano);

      const porCliente = new Map<string, { estado: string; empresa: string; cidade: string; qtdOs: number; faturamento: number }>();
      for (const r of linhas) {
        const estado = normalizarUf(r.estado);
        if (!estado) continue;
        if (input.estado && estado !== input.estado) continue;

        const empresaNorm = (r.empresa ?? "").trim().toUpperCase();
        if (!empresaNorm) continue;
        const key = `${estado}__${empresaNorm}`;
        if (!porCliente.has(key)) {
          porCliente.set(key, {
            estado,
            empresa: (r.empresa ?? "").trim(),
            cidade: r.cidade ? tituloCidade(r.cidade.trim()) : "—",
            qtdOs: 0,
            faturamento: 0,
          });
        }
        const c = porCliente.get(key)!;
        c.qtdOs++;
        c.faturamento += r.valorTotal;
      }

      return Array.from(porCliente.values()).sort((a, b) => {
        if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
        return b.faturamento - a.faturamento;
      });
    }),
});
