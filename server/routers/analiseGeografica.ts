import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db/db";
import { historicoOs } from "../../drizzle/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";

/**
 * Análise Geográfica: distribuição de OS e faturamento por Estado do cliente.
 * Fonte: `historicoOs.estado`/`cidade`, preenchidos por cruzamento (nome de
 * empresa normalizado) com o cadastro de clientes na importação — o relatório
 * de vendas do ERP não traz endereço.
 *
 * "Sinalizadas e selecionadas" (linguagem do usuário para "cash realizado"):
 * todo status exceto "Cancelada" — inclui Entregue, Concluída e Em produção.
 */
function osValidaCondition() {
  return ne(historicoOs.status, "Cancelada");
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

export const analiseGeograficaRouter = router({
  getAnosDisponiveis: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.selectDistinct({ ano: historicoOs.ano }).from(historicoOs);
    return rows.map((r) => r.ano).sort((a, b) => b - a);
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

      const conditions = [eq(historicoOs.ano, input.ano), osValidaCondition()];
      if (input.mes) conditions.push(eq(historicoOs.mes, input.mes));

      const rows = await db.select({
        estado: historicoOs.estado,
        cidade: historicoOs.cidade,
        empresa: historicoOs.empresa,
        valorTotal: historicoOs.valorTotal,
      }).from(historicoOs).where(and(...conditions));

      const porEstado = new Map<string, { qtdOs: number; faturamento: number; clientes: Set<string>; cidades: Map<string, { qtdOs: number; faturamento: number }> }>();
      let totalOs = 0;
      let totalFaturamento = 0;
      let semEstado = 0;
      let semEstadoFaturamento = 0;

      for (const r of rows) {
        const valor = Number(r.valorTotal ?? 0);
        totalOs++;
        totalFaturamento += valor;

        if (!r.estado) {
          semEstado++;
          semEstadoFaturamento += valor;
          continue;
        }

        if (!porEstado.has(r.estado)) {
          porEstado.set(r.estado, { qtdOs: 0, faturamento: 0, clientes: new Set(), cidades: new Map() });
        }
        const e = porEstado.get(r.estado)!;
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
    }),

  getEvolucaoMensal: publicProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { meses: [], topEstados: [] as string[] };

      const rows = await db.select({
        mes: historicoOs.mes,
        estado: historicoOs.estado,
        valorTotal: historicoOs.valorTotal,
      }).from(historicoOs).where(and(
        eq(historicoOs.ano, input.ano),
        osValidaCondition(),
        isNotNull(historicoOs.estado),
      ));

      const totalPorEstado = new Map<string, number>();
      for (const r of rows) {
        const v = Number(r.valorTotal ?? 0);
        totalPorEstado.set(r.estado!, (totalPorEstado.get(r.estado!) ?? 0) + v);
      }
      const topEstados = Array.from(totalPorEstado.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([uf]) => uf);
      const topSet = new Set(topEstados);

      const porMes = new Map<number, Record<string, number>>();
      for (let m = 1; m <= 12; m++) porMes.set(m, { outros: 0 });
      for (const r of rows) {
        const mesData = porMes.get(r.mes!)!;
        const key = topSet.has(r.estado!) ? r.estado! : "outros";
        mesData[key] = (mesData[key] ?? 0) + Number(r.valorTotal ?? 0);
      }

      const meses = Array.from(porMes.entries()).map(([mes, valores]) => ({ mes, ...valores }));
      return { meses, topEstados };
    }),

  /** Lista completa de clientes (cadastro cruzado na importação), agrupada
   * por Estado — usada para exportação em Excel na Análise Geográfica.
   * Se `estado` for informado, retorna só os clientes daquele Estado (ex.: MS, SP, PR). */
  getListaClientes: publicProcedure
    .input(z.object({ estado: z.string().length(2).nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [osValidaCondition(), isNotNull(historicoOs.estado)];
      if (input?.estado) conditions.push(eq(historicoOs.estado, input.estado));

      const rows = await db.select({
        estado: historicoOs.estado,
        cidade: historicoOs.cidade,
        empresa: historicoOs.empresa,
        valorTotal: historicoOs.valorTotal,
      }).from(historicoOs).where(and(...conditions));

      const porCliente = new Map<string, { estado: string; empresa: string; cidade: string; qtdOs: number; faturamento: number }>();
      for (const r of rows) {
        const empresaNorm = (r.empresa ?? "").trim().toUpperCase();
        if (!empresaNorm) continue;
        const key = `${r.estado}__${empresaNorm}`;
        if (!porCliente.has(key)) {
          porCliente.set(key, {
            estado: r.estado!,
            empresa: (r.empresa ?? "").trim(),
            cidade: r.cidade ? tituloCidade(r.cidade.trim()) : "—",
            qtdOs: 0,
            faturamento: 0,
          });
        }
        const c = porCliente.get(key)!;
        c.qtdOs++;
        c.faturamento += Number(r.valorTotal ?? 0);
      }

      return Array.from(porCliente.values()).sort((a, b) => {
        if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
        return b.faturamento - a.faturamento;
      });
    }),
});
