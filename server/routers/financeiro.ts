import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { financeiroMensal, custoMarketing, custosFixos, dividasParcelamentos, dreMensal } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const financeiroRouter = router({
  // Buscar dados financeiros de um mês/ano específico
  get: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano)))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Listar todos os registros financeiros
  list: publicProcedure
    .input(z.object({ ano: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(financeiroMensal);
      if (input?.ano) return rows.filter(r => r.ano === input.ano);
      return rows.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
    }),

  // Criar ou atualizar registro financeiro mensal
  upsert: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      faturamentoOficial: z.number().nullable().optional(),
      despesasFixas: z.number().nullable().optional(),
      despesasVariaveis: z.number().nullable().optional(),
      numColaboradores: z.number().int().nullable().optional(),
      lucroBruto: z.number().nullable().optional(),
      lucroLiquido: z.number().nullable().optional(),
      notas: z.string().nullable().optional(),
      // Novos campos a partir de Abr/2026
      impostoDas: z.number().nullable().optional(),
      impostoIcmsDifal: z.number().nullable().optional(),
      impostoDaems: z.number().nullable().optional(),
      comissoesBv: z.number().nullable().optional(),
      produtividadeSolda: z.number().nullable().optional(),
      freteRetrabalho: z.number().nullable().optional(),
      devSoftware: z.number().nullable().optional(),
      receitaOperacionalOs: z.number().nullable().optional(),
      resultadoEfetivo: z.number().nullable().optional(),
      saldoMes: z.number().nullable().optional(),
      tl1: z.number().nullable().optional(),
      tl2: z.number().nullable().optional(),
      tl3: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const existing = await db
        .select()
        .from(financeiroMensal)
        .where(and(eq(financeiroMensal.mes, input.mes), eq(financeiroMensal.ano, input.ano)))
        .limit(1);

      const toStr = (v: number | null | undefined) => v != null ? String(v) : null;
      const data = {
        faturamentoOficial: toStr(input.faturamentoOficial),
        despesasFixas: toStr(input.despesasFixas),
        despesasVariaveis: toStr(input.despesasVariaveis),
        numColaboradores: input.numColaboradores ?? null,
        lucroBruto: toStr(input.lucroBruto),
        lucroLiquido: toStr(input.lucroLiquido),
        notas: input.notas ?? null,
        // Novos campos a partir de Abr/2026
        impostoDas: toStr(input.impostoDas),
        impostoIcmsDifal: toStr(input.impostoIcmsDifal),
        impostoDaems: toStr(input.impostoDaems),
        comissoesBv: toStr(input.comissoesBv),
        produtividadeSolda: toStr(input.produtividadeSolda),
        freteRetrabalho: toStr(input.freteRetrabalho),
        devSoftware: toStr(input.devSoftware),
        receitaOperacionalOs: toStr(input.receitaOperacionalOs),
        resultadoEfetivo: toStr(input.resultadoEfetivo),
        saldoMes: toStr(input.saldoMes),
        tl1: toStr(input.tl1),
        tl2: toStr(input.tl2),
        tl3: toStr(input.tl3),
      };

      if (existing.length > 0) {
        await db.update(financeiroMensal).set(data).where(eq(financeiroMensal.id, existing[0].id));
        return { ...existing[0], ...data };
      } else {
        const result = await db.insert(financeiroMensal).values({ mes: input.mes, ano: input.ano, ...data });
        return { id: Number(result[0].insertId), mes: input.mes, ano: input.ano, ...data };
      }
    }),

  // ─── Custo Marketing ─────────────────────────────────────────────────────────
  getCustoMarketing: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(custoMarketing)
        .where(and(eq(custoMarketing.mes, input.mes), eq(custoMarketing.ano, input.ano)))
        .limit(1);
      return rows[0] ?? null;
    }),

  getCustoMarketingAno: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(custoMarketing)
        .where(eq(custoMarketing.ano, input.ano));
      return rows.sort((a, b) => a.mes - b.mes);
    }),

  upsertCustoMarketing: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      investimento: z.number().min(0),
      observacao: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existing = await db
        .select()
        .from(custoMarketing)
        .where(and(eq(custoMarketing.mes, input.mes), eq(custoMarketing.ano, input.ano)))
        .limit(1);
      const data = {
        investimento: String(input.investimento),
        observacao: input.observacao ?? null,
      };
      if (existing.length > 0) {
        await db.update(custoMarketing).set(data).where(eq(custoMarketing.id, existing[0].id));
        return { ...existing[0], ...data };
      } else {
        const result = await db.insert(custoMarketing).values({ mes: input.mes, ano: input.ano, ...data });
        return { id: Number(result[0].insertId), mes: input.mes, ano: input.ano, ...data };
      }
    }),

  // ─── Custos Fixos ────────────────────────────────────────────────────────────
  getCustosFixos: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(custosFixos).where(eq(custosFixos.ativo, true));
      return rows.map(r => ({ ...r, valor: Number(r.valor) }));
    }),

  upsertCustoFixo: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      plano: z.string(),
      categoria: z.string(),
      grupoCategoria: z.string(),
      fornecedor: z.string(),
      tipo: z.string(),
      valor: z.number().min(0),
      vencimento: z.number().nullable().optional(),
      observacao: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const data = {
        plano: input.plano,
        categoria: input.categoria,
        grupoCategoria: input.grupoCategoria,
        fornecedor: input.fornecedor,
        tipo: input.tipo,
        valor: String(input.valor),
        vencimento: input.vencimento ?? null,
        observacao: input.observacao ?? null,
      };
      if (input.id) {
        await db.update(custosFixos).set(data).where(eq(custosFixos.id, input.id));
        return { id: input.id, ...data };
      } else {
        const result = await db.insert(custosFixos).values(data);
        return { id: Number(result[0].insertId), ...data };
      }
    }),

  deleteCustoFixo: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(custosFixos).set({ ativo: false }).where(eq(custosFixos.id, input.id));
      return { ok: true };
    }),

  // ─── Dívidas e Parcelamentos ─────────────────────────────────────────────────
  getDividas: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dividasParcelamentos).where(eq(dividasParcelamentos.ativo, true));
      return rows.map(r => ({
        ...r,
        media: r.media ? Number(r.media) : null,
        janValor: r.janValor ? Number(r.janValor) : null,
        fevValor: r.fevValor ? Number(r.fevValor) : null,
        marValor: r.marValor ? Number(r.marValor) : null,
        abrValor: r.abrValor ? Number(r.abrValor) : null,
        maiValor: r.maiValor ? Number(r.maiValor) : null,
        junValor: r.junValor ? Number(r.junValor) : null,
        julValor: r.julValor ? Number(r.julValor) : null,
        agoValor: r.agoValor ? Number(r.agoValor) : null,
        setValor: r.setValor ? Number(r.setValor) : null,
        outValor: r.outValor ? Number(r.outValor) : null,
        novValor: r.novValor ? Number(r.novValor) : null,
        dezValor: r.dezValor ? Number(r.dezValor) : null,
      }));
    }),

  // ─── DRE Mensal ──────────────────────────────────────────────────────────────
  getDreMensal: publicProcedure
    .input(z.object({ ano: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dreMensal);
      const filtered = input.ano ? rows.filter(r => r.ano === input.ano) : rows;
      return filtered
        .sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)
        .map(r => ({
          ...r,
          receitaOperacionalBruta: r.receitaOperacionalBruta ? Number(r.receitaOperacionalBruta) : null,
          receitaFinanceira: r.receitaFinanceira ? Number(r.receitaFinanceira) : null,
          receitaNaoOperacional: r.receitaNaoOperacional ? Number(r.receitaNaoOperacional) : null,
          totalEntradas: r.totalEntradas ? Number(r.totalEntradas) : null,
          impostosVendas: r.impostosVendas ? Number(r.impostosVendas) : null,
          despesaVariavel: r.despesaVariavel ? Number(r.despesaVariavel) : null,
          despesaOperacional: r.despesaOperacional ? Number(r.despesaOperacional) : null,
          materiaPrima: r.materiaPrima ? Number(r.materiaPrima) : null,
          gastosGeraisFabricacao: r.gastosGeraisFabricacao ? Number(r.gastosGeraisFabricacao) : null,
          despesasPessoal: r.despesasPessoal ? Number(r.despesasPessoal) : null,
          despesasFixas: r.despesasFixas ? Number(r.despesasFixas) : null,
          despesasFinanceiras: r.despesasFinanceiras ? Number(r.despesasFinanceiras) : null,
          despesasNaoOperacionais: r.despesasNaoOperacionais ? Number(r.despesasNaoOperacionais) : null,
          totalSaidas: r.totalSaidas ? Number(r.totalSaidas) : null,
          receitaBrutaOperacional: r.receitaBrutaOperacional ? Number(r.receitaBrutaOperacional) : null,
          lucroBruto: r.lucroBruto ? Number(r.lucroBruto) : null,
          lucroOperacional: r.lucroOperacional ? Number(r.lucroOperacional) : null,
          lucroLiquido: r.lucroLiquido ? Number(r.lucroLiquido) : null,
          valorPedidos: r.valorPedidos ? Number(r.valorPedidos) : null,
          resultadoEfetivo: r.resultadoEfetivo ? Number(r.resultadoEfetivo) : null,
          margemResultadoEfetivo: r.margemResultadoEfetivo ? Number(r.margemResultadoEfetivo) : null,
          percMateriaPrima: r.percMateriaPrima ? Number(r.percMateriaPrima) : null,
          percFixoRateado: r.percFixoRateado ? Number(r.percFixoRateado) : null,
          percTributos: r.percTributos ? Number(r.percTributos) : null,
          percComissaoInterna: r.percComissaoInterna ? Number(r.percComissaoInterna) : null,
          percDescontos: r.percDescontos ? Number(r.percDescontos) : null,
        }));
    }),
});
