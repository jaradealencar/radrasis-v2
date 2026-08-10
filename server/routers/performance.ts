import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "../db-connection";
import { performanceMensal, retrabalhos as retrabalhosTable, faturamento as faturamentoTable } from "../../drizzle/schema";
import { eq, and, asc, sql } from "drizzle-orm";

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

export const performanceRouter = router({
  // Listar todos os registros (ordenados por ano/mês)
  list: publicProcedure.query(async () => {
    return await db
      .select()
      .from(performanceMensal)
      .orderBy(asc(performanceMensal.ano), asc(performanceMensal.mes));
  }),

  // Buscar um mês específico (inclui retrabalhos automáticos do mês)
  getByMesAno: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      // Busca o registro de performance
      const rows = await db
        .select()
        .from(performanceMensal)
        .where(
          and(
            eq(performanceMensal.mes, input.mes),
            eq(performanceMensal.ano, input.ano)
          )
        );
      const row = rows[0] ?? null;

      // Conta retrabalhos do mês automaticamente usando o campo 'data' (timestamp)
      const retrabCountRows = await getDb()
        .select({ total: sql<number>`COUNT(*)` })
        .from(retrabalhosTable)
        .where(
          sql`EXTRACT(MONTH FROM ${retrabalhosTable.data}) = ${input.mes} AND EXTRACT(YEAR FROM ${retrabalhosTable.data}) = ${input.ano}`
        );
      const retrabCount = [{ total: Number(retrabCountRows[0]?.total ?? 0) }];

      // Busca pedidos do mês na tabela faturamento (mes é varchar, ex: "Janeiro", "Fevereiro")
      // Filtra apenas pelo ano, pois mes é string
      const fatRows = await db
        .select()
        .from(faturamentoTable)
        .where(eq(faturamentoTable.ano, input.ano));
      // Mapeia número do mês para nome do mês
      const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      const nomeMes = MESES_NOMES[input.mes - 1];
      // Aceita variações: "Janeiro", "JANEIRO", "janeiro", "1", etc.
      const fatMes = fatRows.find(f =>
        f.mes.toUpperCase() === nomeMes.toUpperCase() ||
        f.mes === String(input.mes)
      );
      const pedidosMes = fatMes?.totalPedidos ?? 0;

      return {
        ...row,
        // Dados automáticos de retrabalho extraídos da tabela de retrabalhos
        retrabalhosAutoCount: retrabCount[0]?.total ?? 0,
        pedidosAutoCount: pedidosMes,
      };
    }),

  // Inserir ou atualizar (upsert) dados de um mês
  upsert: publicProcedure
    .input(
      z.object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020),
        osGeradas: z.number().nullish(),
        osExpedicao: z.number().nullish(),
        percExpedicao: z.number().nullish(),
        metaOsDia: z.number().nullish(),
        capacidadeOsDiaMin: z.number().nullish(),
        capacidadeOsDiaMax: z.number().nullish(),
        deficitFinalizacao: z.number().nullish(),
        metaEmbalagemDia: z.number().nullish(),
        producaoEmbalagemDia: z.number().nullish(),
        metaAcabamentoDia: z.number().nullish(),
        capacidadeAcabamentoDia: z.number().nullish(),
        capacidadeNominalSolda: z.number().nullish(),
        producaoInternaSolda: z.number().nullish(),
        demandaTotalSolda: z.number().nullish(),
        osTerceirizadas: z.number().nullish(),
        metrosTerceirizados: z.number().nullish(),
        metaOsGeradas: z.number().nullish(),
        metaOsExpedicao: z.number().nullish(),
        metaProducaoSolda: z.number().nullish(),
        metaPercTerceirizacao: z.number().nullish(),
        observacoes: z.string().nullish(),
        destaques: z.string().nullish(),
        gargalos: z.string().nullish(),
        // Custo de solda
        numSoldadores: z.number().nullish(),
        soldadorSalarioBase: z.number().nullish(),
        soldadorHorasExtras: z.number().nullish(),
        soldadorValorHoraExtra: z.number().nullish(),
        soldadorOutrosCustos: z.number().nullish(),
        custoProdutividadeSolda: z.number().nullish(),
        gestorSalarioBase: z.number().nullish(),
        gestorHorasExtras: z.number().nullish(),
        gestorValorHoraExtra: z.number().nullish(),
        gestorOutrosCustos: z.number().nullish(),
        custoMetroTerceirizado: z.number().nullish(),
        precoVendaMetro: z.number().nullish(),
        // ─── Novos campos de performance ─────────────────────────────────────
        faturamentoRealizado: z.number().nullish(),
        metaFaturamento: z.number().nullish(),
        projetosEntregues: z.number().nullish(),
        projetosNoPrazo: z.number().nullish(),
        projetosForaPrazo: z.number().nullish(),
        metaEntregaNoPrazoPct: z.number().nullish(),
        metaRetrabalhoPct: z.number().nullish(),
        totalPedidos: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const { mes, ano, ...fields } = input;

      const existing = await db
        .select()
        .from(performanceMensal)
        .where(
          and(
            eq(performanceMensal.mes, mes),
            eq(performanceMensal.ano, ano)
          )
        );

      const toStr = (v: number | null | undefined) => (v != null ? String(v) : undefined);

      const data = {
        osGeradas: fields.osGeradas ?? undefined,
        osExpedicao: fields.osExpedicao ?? undefined,
        percExpedicao: toStr(fields.percExpedicao),
        metaOsDia: toStr(fields.metaOsDia),
        capacidadeOsDiaMin: toStr(fields.capacidadeOsDiaMin),
        capacidadeOsDiaMax: toStr(fields.capacidadeOsDiaMax),
        deficitFinalizacao: toStr(fields.deficitFinalizacao),
        metaEmbalagemDia: toStr(fields.metaEmbalagemDia),
        producaoEmbalagemDia: toStr(fields.producaoEmbalagemDia),
        metaAcabamentoDia: toStr(fields.metaAcabamentoDia),
        capacidadeAcabamentoDia: toStr(fields.capacidadeAcabamentoDia),
        capacidadeNominalSolda: fields.capacidadeNominalSolda ?? undefined,
        producaoInternaSolda: fields.producaoInternaSolda ?? undefined,
        demandaTotalSolda: fields.demandaTotalSolda ?? undefined,
        osTerceirizadas: fields.osTerceirizadas ?? undefined,
        metrosTerceirizados: fields.metrosTerceirizados ?? undefined,
        metaOsGeradas: fields.metaOsGeradas ?? undefined,
        metaOsExpedicao: fields.metaOsExpedicao ?? undefined,
        metaProducaoSolda: fields.metaProducaoSolda ?? undefined,
        metaPercTerceirizacao: toStr(fields.metaPercTerceirizacao),
        observacoes: fields.observacoes ?? undefined,
        destaques: fields.destaques ?? undefined,
        gargalos: fields.gargalos ?? undefined,
        numSoldadores: fields.numSoldadores ?? undefined,
        soldadorSalarioBase: toStr(fields.soldadorSalarioBase),
        soldadorHorasExtras: toStr(fields.soldadorHorasExtras),
        soldadorValorHoraExtra: toStr(fields.soldadorValorHoraExtra),
        soldadorOutrosCustos: toStr(fields.soldadorOutrosCustos),
        custoProdutividadeSolda: toStr(fields.custoProdutividadeSolda),
        gestorSalarioBase: toStr(fields.gestorSalarioBase),
        gestorHorasExtras: toStr(fields.gestorHorasExtras),
        gestorValorHoraExtra: toStr(fields.gestorValorHoraExtra),
        gestorOutrosCustos: toStr(fields.gestorOutrosCustos),
        custoMetroTerceirizado: toStr(fields.custoMetroTerceirizado),
        precoVendaMetro: toStr(fields.precoVendaMetro),
        // Novos campos
        faturamentoRealizado: toStr(fields.faturamentoRealizado),
        metaFaturamento: toStr(fields.metaFaturamento),
        projetosEntregues: fields.projetosEntregues ?? undefined,
        projetosNoPrazo: fields.projetosNoPrazo ?? undefined,
        projetosForaPrazo: fields.projetosForaPrazo ?? undefined,
        metaEntregaNoPrazoPct: toStr(fields.metaEntregaNoPrazoPct),
        metaRetrabalhoPct: toStr(fields.metaRetrabalhoPct),
        totalPedidos: fields.totalPedidos ?? undefined,
      };

      if (existing.length > 0) {
        await db
          .update(performanceMensal)
          .set(data)
          .where(eq(performanceMensal.id, existing[0].id));
        return { action: "updated", id: existing[0].id };
      } else {
        const [result] = await db.insert(performanceMensal).values({ mes, ano, ...data }).returning({ id: performanceMensal.id });
        return { action: "created", id: result.id };
      }
    }),

  // Excluir um registro
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(performanceMensal).where(eq(performanceMensal.id, input.id));
      return { success: true };
    }),
});
