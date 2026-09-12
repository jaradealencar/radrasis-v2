import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { leadsCnpjQualificados } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { consultarCnpj, normalizarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";
import { qualificarLeadCnpj } from "../services/qualificacaoLeadCnpj";

export const leadsCnpjRouter = router({
  // ─── Qualificação de Leads por CNPJ ──────────────────────────────────────
  // Ver docs/inteligencia-mercado-leads-cnpj.md. Fonte: OpenCNPJ (gratuita,
  // sem chave). Score é heurística determinística — não é probabilidade de compra.

  consultar: protectedProcedure
    .input(z.object({ cnpj: z.string().min(11) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const cnpjLimpo = normalizarCnpj(input.cnpj);

      let dados;
      try {
        dados = await consultarCnpj(cnpjLimpo);
      } catch (e) {
        if (e instanceof CnpjNaoEncontradoError) throw new Error(e.message);
        throw e;
      }

      const resultado = qualificarLeadCnpj(dados);
      const agora = new Date();

      const valores = {
        cnpj: cnpjLimpo,
        razaoSocial: dados.razao_social,
        nomeFantasia: dados.nome_fantasia || null,
        uf: dados.uf || null,
        municipio: dados.municipio || null,
        cnaePrincipal: dados.cnae_principal || null,
        situacaoCadastral: dados.situacao_cadastral || null,
        porte: dados.porte_empresa || null,
        capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
        dataInicioAtividade: dados.data_inicio_atividade || null,
        aprovado: resultado.aprovado,
        score: resultado.score,
        motivoRejeicao: resultado.motivoRejeicao,
        cnaesRelevantesJson: JSON.stringify(resultado.cnaesRelevantes),
        fatoresScoreJson: resultado.fatoresScore ? JSON.stringify(resultado.fatoresScore) : null,
        qsaJson: JSON.stringify(dados.QSA ?? []),
        dadosJson: JSON.stringify(dados),
        consultadoPor: ctx.user?.name ?? ctx.user?.id ?? "desconhecido",
        consultadoEm: agora,
        updatedAt: agora,
      };

      const existente = await db.select({ id: leadsCnpjQualificados.id }).from(leadsCnpjQualificados)
        .where(eq(leadsCnpjQualificados.cnpj, cnpjLimpo)).limit(1);

      if (existente.length > 0) {
        await db.update(leadsCnpjQualificados).set(valores).where(eq(leadsCnpjQualificados.cnpj, cnpjLimpo));
      } else {
        await db.insert(leadsCnpjQualificados).values(valores);
      }

      return { dados, resultado };
    }),

  listar: protectedProcedure
    .input(z.object({
      score: z.enum(["A", "B", "C", "D"]).optional(),
      uf: z.string().length(2).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const filtros = [] as any[];
      if (input.score) filtros.push(eq(leadsCnpjQualificados.score, input.score));
      if (input.uf) filtros.push(eq(leadsCnpjQualificados.uf, input.uf));
      const rows = await db.select().from(leadsCnpjQualificados)
        .where(filtros.length > 0 ? and(...filtros) : undefined)
        .orderBy(desc(leadsCnpjQualificados.consultadoEm));
      return rows.map(r => ({
        ...r,
        cnaesRelevantes: r.cnaesRelevantesJson ? JSON.parse(r.cnaesRelevantesJson) : [],
        fatoresScore: r.fatoresScoreJson ? JSON.parse(r.fatoresScoreJson) : null,
        qsa: r.qsaJson ? JSON.parse(r.qsaJson) : [],
      }));
    }),
});
