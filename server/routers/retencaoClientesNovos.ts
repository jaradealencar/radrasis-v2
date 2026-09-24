/**
 * Retenção de Clientes Novos — jornada de 1 ano (endpoints tRPC).
 *
 * Ver server/services/retencaoClientesNovos.ts para o cálculo puro e
 * docs/inteligencia-clientes.md para o resto do módulo de Inteligência de
 * Clientes, do qual esta é uma sub-aba nova ("Retenção").
 *
 * Identificação de clientes elegíveis é local e rápida (historico_os), igual
 * ao resto do módulo. Nome do contato-pessoa e telefone, porém, não existem
 * em historico_os (só a empresa) — por isso são buscados ao vivo na API
 * MubiSys, sob demanda (só para os clientes do grupo aberto na tela, nunca em
 * massa) via `buscarOSPorNumero`, e cacheados em `retencao_contato_cache`.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { historicoOs, retencaoDisparos, retencaoContatoCache, retencaoScripts } from "../../drizzle/schema";
import { eq, and, desc, inArray, lte, sql } from "drizzle-orm";
import { construirBaseClientes, calcularRecompraNovosReativados } from "../services/inteligenciaClientes";
import { listarPendenciasRetencao, ESTAGIOS_JORNADA } from "../services/retencaoClientesNovos";
import { diasUteisComFeriadosEntre } from "../../shared/feriados-nacionais";
import { extrairContatoDaOs, formatarLinkWhatsApp } from "./performanceComercial";
import { buscarOSPorNumero } from "../integrations/mubisys-client";

const estagioSchema = z.enum(["d16u", "d30", "d60", "d90", "d180", "d270", "d365"]);

function formatarDataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sincroniza (idempotente) os marcos calculados com `retencao_disparos`: cria
 * os que ainda não existem, atualiza os dados descritivos dos existentes (sem
 * mexer em status/disparo já registrados pelo vendedor), e descarta pendências
 * de quem já recomprou (2+ compras válidas) — mesmo padrão de
 * sincronizarFilaAcoesClientes em performanceComercial.ts. */
async function sincronizarRetencaoDisparos(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  const rows = await db.select().from(historicoOs);
  const base = construirBaseClientes(rows as any);
  const hoje = new Date();
  const pendencias = listarPendenciasRetencao(base, hoje);

  for (const p of pendencias) {
    const existentes = await db.select().from(retencaoDisparos)
      .where(and(eq(retencaoDisparos.empresaKey, p.empresaKey), eq(retencaoDisparos.estagio, p.estagio)))
      .limit(1);
    if (existentes[0]) {
      await db.update(retencaoDisparos)
        .set({
          empresa: p.empresa,
          osNumero: p.osNumero,
          vendedor: p.vendedor,
          valorPrimeiraCompra: String(p.valorPrimeiraCompra),
          dataPrimeiraCompra: formatarDataISO(p.dataPrimeiraCompra),
          dataAgendada: formatarDataISO(p.dataAgendada),
          updatedAt: hoje,
        })
        .where(eq(retencaoDisparos.id, existentes[0].id));
    } else {
      await db.insert(retencaoDisparos).values({
        empresaKey: p.empresaKey,
        empresa: p.empresa,
        osNumero: p.osNumero,
        vendedor: p.vendedor,
        valorPrimeiraCompra: String(p.valorPrimeiraCompra),
        dataPrimeiraCompra: formatarDataISO(p.dataPrimeiraCompra),
        estagio: p.estagio,
        dataAgendada: formatarDataISO(p.dataAgendada),
      });
    }
  }

  const empresasComRecompra = [...base.values()].filter(c => c.compras.length >= 2).map(c => c.empresaKey);
  if (empresasComRecompra.length > 0) {
    await db.update(retencaoDisparos)
      .set({ status: "descartado", observacao: "Cliente recomprou", updatedAt: hoje })
      .where(and(inArray(retencaoDisparos.empresaKey, empresasComRecompra), eq(retencaoDisparos.status, "pendente")));
  }
}

export const retencaoClientesNovosRouter = router({

  /** Marcos vencidos (ou todos, se apenasVencidos=false), agrupados por data agendada. */
  getGrupos: protectedProcedure
    .input(z.object({
      estagio: estagioSchema.optional(),
      status: z.enum(["pendente", "disparado", "descartado"]).optional().default("pendente"),
      apenasVencidos: z.boolean().optional().default(true),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await sincronizarRetencaoDisparos(db);

      const filtros = [eq(retencaoDisparos.status, input.status)];
      if (input.estagio) filtros.push(eq(retencaoDisparos.estagio, input.estagio));
      if (input.apenasVencidos) filtros.push(lte(retencaoDisparos.dataAgendada, formatarDataISO(new Date())));

      const linhasBrutas = await db.select().from(retencaoDisparos)
        .where(and(...filtros))
        .orderBy(retencaoDisparos.dataAgendada);

      const hoje = new Date();
      const linhas = linhasBrutas.map(l => ({
        ...l,
        diasUteisDecorridos: diasUteisComFeriadosEntre(new Date(`${l.dataPrimeiraCompra}T00:00:00`), hoje),
      }));

      const grupos = new Map<string, typeof linhas>();
      for (const l of linhas) {
        if (!grupos.has(l.dataAgendada)) grupos.set(l.dataAgendada, []);
        grupos.get(l.dataAgendada)!.push(l);
      }
      return Array.from(grupos.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dataAgendada, clientes]) => ({ dataAgendada, clientes }));
    }),

  /** Config dos 7 estágios (label/descrição) — para montar filtros e legendas na tela. */
  getEstagios: publicProcedure.query(() => ESTAGIOS_JORNADA),

  /** Nome do contato-pessoa + telefone + link wa.me, buscado ao vivo por OS (cache de 30 dias). */
  getContatoCliente: protectedProcedure
    .input(z.object({ empresaKey: z.string().min(1), osNumero: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
      const cacheRows = await db.select().from(retencaoContatoCache)
        .where(eq(retencaoContatoCache.empresaKey, input.empresaKey)).limit(1);
      const cache = cacheRows[0];
      if (cache && Date.now() - new Date(cache.atualizadoEm).getTime() < TRINTA_DIAS_MS) {
        return { contato: cache.contato ?? "", telefone: cache.telefone ?? "", whatsappLink: cache.whatsappLink ?? "" };
      }

      const os = await buscarOSPorNumero(input.osNumero);
      const extraido = os ? extrairContatoDaOs(os) : { telefone: "", contato: "", cidade: "", estado: "" };
      const whatsappLink = formatarLinkWhatsApp(extraido.telefone);

      await db.insert(retencaoContatoCache).values({
        empresaKey: input.empresaKey,
        osNumero: input.osNumero,
        contato: extraido.contato,
        telefone: extraido.telefone,
        whatsappLink,
      }).onConflictDoUpdate({
        target: retencaoContatoCache.empresaKey,
        set: { osNumero: input.osNumero, contato: extraido.contato, telefone: extraido.telefone, whatsappLink, atualizadoEm: new Date() },
      });

      return { contato: extraido.contato, telefone: extraido.telefone, whatsappLink };
    }),

  marcarDisparado: protectedProcedure
    .input(z.object({ empresaKey: z.string().min(1), estagio: estagioSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(retencaoDisparos)
        .set({ status: "disparado", disparadoEm: new Date(), disparadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido", updatedAt: new Date() })
        .where(and(eq(retencaoDisparos.empresaKey, input.empresaKey), eq(retencaoDisparos.estagio, input.estagio)));
      return { ok: true };
    }),

  marcarDescartado: protectedProcedure
    .input(z.object({ empresaKey: z.string().min(1), estagio: estagioSchema, observacao: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(retencaoDisparos)
        .set({ status: "descartado", observacao: input.observacao ?? null, updatedAt: new Date() })
        .where(and(eq(retencaoDisparos.empresaKey, input.empresaKey), eq(retencaoDisparos.estagio, input.estagio)));
      return { ok: true };
    }),

  /** Taxa atual de recompra de clientes novos (últimos 12 meses) vs. a meta de 50%. */
  getResumoConversao: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const rows = await db.select().from(historicoOs);
    const base = construirBaseClientes(rows as any);
    const hoje = new Date();
    const umAnoAtras = new Date(hoje);
    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
    const resumo = calcularRecompraNovosReativados(base, umAnoAtras, hoje, hoje);
    return { taxaAtualPct: resumo.novos.taxaPct, metaPct: 50, novos: resumo.novos };
  }),

  // ─── Scripts sugeridos por estágio — mesmo padrão de crm.ts (crmScripts) ───

  listScriptsRetencao: protectedProcedure
    .input(z.object({ estagio: estagioSchema }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      return db.select().from(retencaoScripts)
        .where(and(eq(retencaoScripts.estagio, input.estagio), eq(retencaoScripts.ativo, true)))
        .orderBy(retencaoScripts.ordem);
    }),

  addScriptRetencao: protectedProcedure
    .input(z.object({
      estagio: estagioSchema,
      titulo: z.string().max(128).optional(),
      conteudo: z.string().min(1),
      conteudoVoz: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const existing = await db.select({ ordem: retencaoScripts.ordem })
        .from(retencaoScripts)
        .where(eq(retencaoScripts.estagio, input.estagio))
        .orderBy(desc(retencaoScripts.ordem))
        .limit(1);
      const nextOrdem = (existing[0]?.ordem ?? 0) + 1;
      const [inserted] = await db.insert(retencaoScripts).values({
        estagio: input.estagio,
        ordem: nextOrdem,
        titulo: input.titulo,
        conteudo: input.conteudo,
        conteudoVoz: input.conteudoVoz ?? null,
      }).returning({ id: retencaoScripts.id });
      return { ok: true, id: inserted.id };
    }),

  updateScriptRetencao: protectedProcedure
    .input(z.object({
      id: z.number(),
      titulo: z.string().max(128).optional(),
      conteudo: z.string().min(1),
      conteudoVoz: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(retencaoScripts)
        .set({ titulo: input.titulo, conteudo: input.conteudo, conteudoVoz: input.conteudoVoz ?? null, updatedAt: new Date() })
        .where(eq(retencaoScripts.id, input.id));
      return { ok: true };
    }),

  deleteScriptRetencao: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(retencaoScripts).set({ ativo: false }).where(eq(retencaoScripts.id, input.id));
      return { ok: true };
    }),

  incrementCopiaRetencao: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.execute(sql`UPDATE retencao_scripts SET copia_count = copia_count + 1 WHERE id = ${input.id}`);
      return { ok: true };
    }),

  reorderScriptsRetencao: protectedProcedure
    .input(z.object({ estagio: estagioSchema, orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await Promise.all(input.orderedIds.map((id, index) =>
        db.update(retencaoScripts).set({ ordem: index }).where(eq(retencaoScripts.id, id))
      ));
      return { ok: true };
    }),
});
