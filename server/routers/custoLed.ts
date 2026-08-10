import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { ledTipos, custoLedLancamentos } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Tipos de LED ─────────────────────────────────────────────────────────────

export const custoLedRouter = router({
  // Listar todos os tipos de LED ativos
  listTipos: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(ledTipos).orderBy(ledTipos.nome);
  }),

  // Criar ou atualizar tipo de LED
  upsertTipo: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      nome: z.string().min(1),
      descricao: z.string().optional(),
      custoUnitario: z.number().min(0),
      unidade: z.string().default("un"),
      ativo: z.enum(["sim", "nao"]).default("sim"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...data } = input;
      const payload = {
        nome: data.nome,
        descricao: data.descricao ?? null,
        custoUnitario: String(data.custoUnitario),
        unidade: data.unidade,
        ativo: data.ativo,
      };
      if (id) {
        await db.update(ledTipos).set(payload).where(eq(ledTipos.id, id));
        return { ok: true, id };
      } else {
        const [res] = await db.insert(ledTipos).values(payload);
        return { ok: true, id: (res as any).insertId };
      }
    }),

  // Excluir tipo de LED
  deleteTipo: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(ledTipos).where(eq(ledTipos.id, input.id));
      return { ok: true };
    }),

  // ─── Lançamentos de custo de LED por OS ──────────────────────────────────────

  // Listar lançamentos de um mês/ano
  listLancamentos: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(custoLedLancamentos)
        .where(and(
          eq(custoLedLancamentos.mes, input.mes),
          eq(custoLedLancamentos.ano, input.ano)
        ))
        .orderBy(custoLedLancamentos.os, custoLedLancamentos.createdAt);
      return rows;
    }),

  // Criar ou atualizar lançamento
  upsertLancamento: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      os: z.string().min(1),
      ledTipoId: z.number(),
      ledTipoEfetivoId: z.number().nullable().optional(),
      qtdPrevista: z.number().min(0),
      qtdEfetiva: z.number().min(0).nullable().optional(),
      mes: z.number().min(1).max(12),
      ano: z.number(),
      observacao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...data } = input;
      const payload = {
        os: data.os,
        ledTipoId: data.ledTipoId,
        ledTipoEfetivoId: data.ledTipoEfetivoId ?? null,
        qtdPrevista: String(data.qtdPrevista),
        qtdEfetiva: data.qtdEfetiva != null ? String(data.qtdEfetiva) : null,
        mes: data.mes,
        ano: data.ano,
        observacao: data.observacao ?? null,
      };
      if (id) {
        await db.update(custoLedLancamentos).set(payload).where(eq(custoLedLancamentos.id, id));
        return { ok: true, id };
      } else {
        const [res] = await db.insert(custoLedLancamentos).values(payload);
        return { ok: true, id: (res as any).insertId };
      }
    }),

  // Excluir lançamento
  deleteLancamento: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(custoLedLancamentos).where(eq(custoLedLancamentos.id, input.id));
      return { ok: true };
    }),

  // Resumo mensal: total previsto, efetivo, diferença (por tipo de LED)
  getResumoMensal: publicProcedure
    .input(z.object({ mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { lancamentos: [], tipos: [], totalPrevisto: 0, totalEfetivo: 0, diferenca: 0 };

      const [lancamentos, tipos] = await Promise.all([
        db.select().from(custoLedLancamentos)
          .where(and(
            eq(custoLedLancamentos.mes, input.mes),
            eq(custoLedLancamentos.ano, input.ano)
          )),
        db.select().from(ledTipos),
      ]);

      const tiposMap = Object.fromEntries(tipos.map(t => [t.id, t]));

      // Calcular totais por lançamento
      const lancamentosComCalc = lancamentos.map(l => {
        const tipoPrevisto = tiposMap[l.ledTipoId];
        const tipoEfetivo = l.ledTipoEfetivoId ? tiposMap[l.ledTipoEfetivoId] : null;
        const custoPrev = tipoPrevisto ? parseFloat(String(tipoPrevisto.custoUnitario)) : 0;
        const custoEfet = tipoEfetivo ? parseFloat(String(tipoEfetivo.custoUnitario)) : custoPrev;
        const previsto = parseFloat(String(l.qtdPrevista)) * custoPrev;
        const efetivo = l.qtdEfetiva != null ? parseFloat(String(l.qtdEfetiva)) * custoEfet : null;
        const diferenca = efetivo != null ? efetivo - previsto : null;
        return {
          ...l,
          tipoNome: tipoPrevisto?.nome ?? "Desconhecido",
          tipoEfetivoNome: tipoEfetivo?.nome ?? null,
          custoUnitario: custoPrev,
          custoUnitarioEfetivo: custoEfet,
          custoPrevisto: previsto,
          custoEfetivo: efetivo,
          diferenca,
          isMistura: !!l.ledTipoEfetivoId && l.ledTipoEfetivoId !== l.ledTipoId,
        };
      });

      const totalPrevisto = lancamentosComCalc.reduce((s, l) => s + l.custoPrevisto, 0);
      const totalEfetivo = lancamentosComCalc
        .filter(l => l.custoEfetivo != null)
        .reduce((s, l) => s + (l.custoEfetivo ?? 0), 0);
      const diferenca = totalEfetivo - totalPrevisto;

      return {
        lancamentos: lancamentosComCalc,
        tipos,
        totalPrevisto,
        totalEfetivo,
        diferenca,
      };
    }),
});
