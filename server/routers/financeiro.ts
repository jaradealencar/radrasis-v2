import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { financeiroMensal, custoMarketing, custoMarketingItens, custosFixos, dividasParcelamentos, dreMensal } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { perguntarSobreFinanceiro, type MensagemChat } from "../integrations/anthropic-client";

const MESES_NOMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Monta o contexto de dados financeiros (texto) enviado como system message ao Claude.
 *  Reconstruído a cada pergunta para refletir o estado mais recente do banco. */
async function montarContextoFinanceiro(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<string> {
  const [mensal, dre, fixosAtivos, marketingRows, dividasAtivas] = await Promise.all([
    db.select().from(financeiroMensal),
    db.select().from(dreMensal),
    db.select().from(custosFixos).where(eq(custosFixos.ativo, true)),
    db.select().from(custoMarketing),
    db.select().from(dividasParcelamentos).where(eq(dividasParcelamentos.ativo, true)),
  ]);

  const linhasMensal = mensal
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
    .map(r => {
      const campos: string[] = [];
      const add = (label: string, v: string | number | null) => { if (v != null) campos.push(`${label}=${fmtR(Number(v))}`); };
      add("Faturamento", r.faturamentoOficial);
      add("DespFixas", r.despesasFixas);
      add("DespVariaveis", r.despesasVariaveis);
      add("LucroLiquido", r.lucroLiquido);
      add("SaldoMes", r.saldoMes);
      add("TL1", r.tl1); add("TL2", r.tl2); add("TL3", r.tl3);
      add("ImpostoDAS", r.impostoDas); add("ICMS_DIFAL", r.impostoIcmsDifal); add("DAEMS", r.impostoDaems);
      add("ComissoesBV", r.comissoesBv); add("ProdutividadeSolda", r.produtividadeSolda);
      add("FreteRetrabalho", r.freteRetrabalho); add("DevSoftware", r.devSoftware);
      if (r.numColaboradores != null) campos.push(`Colaboradores=${r.numColaboradores}`);
      return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados preenchidos)"}`;
    });

  const linhasDre = dre
    .sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes))
    .map(r => {
      const campos: string[] = [];
      const add = (label: string, v: string | number | null) => { if (v != null) campos.push(`${label}=${fmtR(Number(v))}`); };
      add("ReceitaOpBruta", r.receitaOperacionalBruta);
      add("LucroBruto", r.lucroBruto);
      add("LucroOperacional", r.lucroOperacional);
      add("LucroLiquido", r.lucroLiquido);
      add("MateriaPrima", r.materiaPrima);
      add("DespesasFixas", r.despesasFixas);
      return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados)"}`;
    });

  const totalCustosFixos = fixosAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalMarketing = marketingRows.reduce((s, m) => s + Number(m.investimento || 0), 0);

  return `## DADOS FINANCEIROS DISPONÍVEIS (banco de produção, consultado agora)

### Painel Financeiro mensal (financeiro_mensal) — fonte oficial de faturamento
${linhasMensal.length ? linhasMensal.join("\n") : "Nenhum mês cadastrado."}

### DRE Gerencial mensal (dre_mensal) — alimentado pelo ERP (MubiSys), pode divergir do faturamento oficial acima
${linhasDre.length ? linhasDre.join("\n") : "Nenhum mês cadastrado."}

### Custos Fixos ativos cadastrados
Total mensal previsto: ${fmtR(totalCustosFixos)} (${fixosAtivos.length} itens ativos)

### Marketing
Investimento total acumulado (todos os meses cadastrados): ${fmtR(totalMarketing)}

### Dívidas e Parcelamentos ativos
${dividasAtivas.length} registro(s) ativo(s).

## O QUE NÃO ESTÁ DISPONÍVEL NESTE CONTEXTO (não invente estes números)
- Orçado/Budget mensal (não existe cadastro de metas no sistema hoje)
- Depreciação/amortização e juros separados de despesas fixas (portanto EBITDA calculado aqui é aproximado e coincide com Lucro Líquido)
- Dados por cliente/produto/canal (necessários para Coorte, Pareto, LTV/CAC, margem de contribuição por canal)
- Capital investido e patrimônio líquido (necessários para ROIC/ROE)
- Prazos de recebimento/pagamento (necessários para Capital de Giro e Ciclo de Caixa)`;
}

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
        const [result] = await db.insert(financeiroMensal).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: financeiroMensal.id });
        return { id: result.id, mes: input.mes, ano: input.ano, ...data };
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
      investimentoAquisicao: z.number().min(0),
      investimentoReativacao: z.number().min(0),
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
        investimentoAquisicao: String(input.investimentoAquisicao),
        investimentoReativacao: String(input.investimentoReativacao),
        investimento: String(input.investimentoAquisicao + input.investimentoReativacao),
        observacao: input.observacao ?? null,
      };
      if (existing.length > 0) {
        await db.update(custoMarketing).set(data).where(eq(custoMarketing.id, existing[0].id));
        return { ...existing[0], ...data };
      } else {
        const [result] = await db.insert(custoMarketing).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: custoMarketing.id });
        return { id: result.id, mes: input.mes, ano: input.ano, ...data };
      }
    }),

  // Importação em lote (planilha): agrega valores por mês/ano/categoria e faz upsert
  importCustoMarketingLote: publicProcedure
    .input(z.array(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020).max(2100),
      categoria: z.enum(["aquisicao", "reativacao"]),
      valor: z.number().min(0),
    })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const agregados = new Map<string, { mes: number; ano: number; aquisicao: number; reativacao: number }>();
      for (const linha of input) {
        const chave = `${linha.ano}-${linha.mes}`;
        const atual = agregados.get(chave) ?? { mes: linha.mes, ano: linha.ano, aquisicao: 0, reativacao: 0 };
        if (linha.categoria === "aquisicao") atual.aquisicao += linha.valor;
        else atual.reativacao += linha.valor;
        agregados.set(chave, atual);
      }

      const resultados = [];
      for (const { mes, ano, aquisicao, reativacao } of agregados.values()) {
        const existing = await db
          .select()
          .from(custoMarketing)
          .where(and(eq(custoMarketing.mes, mes), eq(custoMarketing.ano, ano)))
          .limit(1);

        const aquisicaoTotal = (existing[0] ? Number(existing[0].investimentoAquisicao) : 0) + aquisicao;
        const reativacaoTotal = (existing[0] ? Number(existing[0].investimentoReativacao) : 0) + reativacao;
        const data = {
          investimentoAquisicao: String(aquisicaoTotal),
          investimentoReativacao: String(reativacaoTotal),
          investimento: String(aquisicaoTotal + reativacaoTotal),
        };

        if (existing.length > 0) {
          await db.update(custoMarketing).set(data).where(eq(custoMarketing.id, existing[0].id));
          resultados.push({ id: existing[0].id, mes, ano, ...data });
        } else {
          const [result] = await db.insert(custoMarketing).values({ mes, ano, ...data }).returning({ id: custoMarketing.id });
          resultados.push({ id: result.id, mes, ano, ...data });
        }
      }
      return resultados;
    }),

  // ─── Lançamentos detalhados de Marketing (fornecedor/despesa) ────────────────
  getCustoMarketingItensAno: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(custoMarketingItens)
        .where(eq(custoMarketingItens.ano, input.ano));
      return rows
        .map(r => ({ ...r, valor: Number(r.valor) }))
        .sort((a, b) => a.mes !== b.mes ? a.mes - b.mes : (a.dataVencimento?.getTime() ?? 0) - (b.dataVencimento?.getTime() ?? 0));
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
        const [result] = await db.insert(custosFixos).values(data).returning({ id: custosFixos.id });
        return { id: result.id, ...data };
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

  // ─── Chat de IA (CFO virtual) ──────────────────────────────────────────────
  perguntarIA: publicProcedure
    .input(z.object({
      pergunta: z.string().min(1),
      historico: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        texto: z.string(),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const contexto = await montarContextoFinanceiro(db);
      const historico: MensagemChat[] = input.historico;
      const resposta = await perguntarSobreFinanceiro(contexto, historico, input.pergunta);
      return { resposta };
    }),
});
