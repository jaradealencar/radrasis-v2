import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { clientesPerfilCnpj, historicoOs, erpOsCache } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { consultarCnpj, normalizarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";
import { isOsNormalDb, normalizeEmpresaKey } from "./performanceComercial";
import { calcularPerfilAgregado } from "../services/perfilClienteCnpj";

/** Extrai o CNPJ de um resultado da OpenCNPJ para os campos planos da tabela. */
function extrairCamposPerfil(dados: Awaited<ReturnType<typeof consultarCnpj>>) {
  const idadeAnos = (() => {
    const d = new Date(dados.data_inicio_atividade);
    if (isNaN(d.getTime())) return null;
    return Number((((Date.now() - d.getTime()) / (365.25 * 86400000))).toFixed(1));
  })();
  return {
    razaoSocial: dados.razao_social,
    situacaoCadastral: dados.situacao_cadastral || null,
    dataInicioAtividade: dados.data_inicio_atividade || null,
    idadeAnos: idadeAnos !== null ? String(idadeAnos) : null,
    porte: dados.porte_empresa || null,
    naturezaJuridica: dados.natureza_juridica || null,
    qtdSocios: Array.isArray(dados.QSA) ? dados.QSA.length : null,
    capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
    uf: dados.uf || null,
    municipio: dados.municipio || null,
    cnaePrincipal: dados.cnae_principal || null,
    dadosJson: JSON.stringify(dados),
  };
}

export const perfilClientesCnpjRouter = router({
  // ─── Perfil de Clientes por CNPJ (Inteligência de Clientes) ──────────────
  // Enriquecimento manual/semi-automático — ver server/services/perfilClienteCnpj.ts
  // e a nota de limitação na definição de clientesPerfilCnpj (drizzle/schema.ts).

  getPerfilAgregado: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const [perfis, osRows] = await Promise.all([
      db.select().from(clientesPerfilCnpj),
      db.select({ empresa: historicoOs.empresa, tipoOs: historicoOs.tipoOs, status: historicoOs.status }).from(historicoOs),
    ]);
    const clientesDistintos = new Set<string>();
    for (const r of osRows) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (nome) clientesDistintos.add(normalizeEmpresaKey(nome));
    }
    return calcularPerfilAgregado(perfis, clientesDistintos.size);
  }),

  listarPerfis: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    return db.select().from(clientesPerfilCnpj).orderBy(clientesPerfilCnpj.empresaExibicao);
  }),

  /** Clientes da base (historico_os) ainda sem perfil de CNPJ vinculado —
   * ordenados por valor histórico comprado (prioriza enriquecer quem mais compra). */
  listarClientesSemCnpj: publicProcedure
    .input(z.object({ limite: z.number().min(1).max(500).default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [osRows, mapeados] = await Promise.all([
        db.select({
          empresa: historicoOs.empresa, tipoOs: historicoOs.tipoOs, status: historicoOs.status,
          valorTotal: historicoOs.valorTotal, valorOs: historicoOs.valorOs,
        }).from(historicoOs),
        db.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj),
      ]);
      const jaMapeados = new Set(mapeados.map(m => m.empresaKey));
      const valorPorCliente = new Map<string, { empresa: string; valor: number }>();
      for (const r of osRows) {
        if (!isOsNormalDb(r)) continue;
        const nome = (r.empresa ?? "").trim();
        if (!nome) continue;
        const key = normalizeEmpresaKey(nome);
        if (jaMapeados.has(key)) continue;
        const valor = parseFloat(String(r.valorOs ?? r.valorTotal ?? "0")) || 0;
        const atual = valorPorCliente.get(key) ?? { empresa: nome, valor: 0 };
        atual.valor += valor;
        valorPorCliente.set(key, atual);
      }
      return [...valorPorCliente.entries()]
        .map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, valorHistorico: v.valor }))
        .sort((a, b) => b.valorHistorico - a.valorHistorico)
        .slice(0, input.limite);
    }),

  /** Vincula um CNPJ a um cliente manualmente — consulta a OpenCNPJ e grava o perfil. */
  vincularCnpj: protectedProcedure
    .input(z.object({ empresaKey: z.string().min(1), empresaExibicao: z.string().min(1), cnpj: z.string().min(11) }))
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
      const campos = extrairCamposPerfil(dados);
      const agora = new Date();
      const valores = {
        empresaKey: input.empresaKey,
        empresaExibicao: input.empresaExibicao,
        cnpj: cnpjLimpo,
        ...campos,
        origem: "manual" as const,
        vinculadoPor: ctx.user?.name ?? ctx.user?.id ?? "desconhecido",
        vinculadoEm: agora,
        updatedAt: agora,
      };
      const existente = await db.select({ id: clientesPerfilCnpj.id }).from(clientesPerfilCnpj)
        .where(eq(clientesPerfilCnpj.empresaKey, input.empresaKey)).limit(1);
      if (existente.length > 0) {
        await db.update(clientesPerfilCnpj).set(valores).where(eq(clientesPerfilCnpj.empresaKey, input.empresaKey));
      } else {
        await db.insert(clientesPerfilCnpj).values(valores);
      }
      return { ok: true, dados };
    }),

  /** Backfill automático a partir de erp_os_cache (cache de outra funcionalidade,
   * cotação de frete, que por acaso guarda CNPJ) — cobre uma fração pequena da
   * carteira (só quem já teve cotação de frete gerada), mas é dado real já
   * disponível, sem custo. Roda sequencialmente com tolerância a falha por item. */
  sincronizarDeErpCache: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const [cacheRows, mapeados] = await Promise.all([
      db.select({ razaoSocial: erpOsCache.razaoSocial, cnpj: erpOsCache.cnpj }).from(erpOsCache),
      db.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj),
    ]);
    const jaMapeados = new Set(mapeados.map(m => m.empresaKey));
    const candidatos = new Map<string, { empresa: string; cnpj: string }>();
    for (const r of cacheRows) {
      if (!r.razaoSocial || !r.cnpj) continue;
      const key = normalizeEmpresaKey(r.razaoSocial);
      if (jaMapeados.has(key) || candidatos.has(key)) continue;
      candidatos.set(key, { empresa: r.razaoSocial, cnpj: r.cnpj });
    }

    let sucesso = 0, falha = 0;
    const agora = new Date();
    for (const [empresaKey, c] of candidatos) {
      try {
        const cnpjLimpo = normalizarCnpj(c.cnpj);
        const dados = await consultarCnpj(cnpjLimpo);
        const campos = extrairCamposPerfil(dados);
        await db.insert(clientesPerfilCnpj).values({
          empresaKey, empresaExibicao: c.empresa, cnpj: cnpjLimpo, ...campos,
          origem: "erp_os_cache", vinculadoEm: agora, updatedAt: agora,
        });
        sucesso++;
      } catch {
        falha++; // CNPJ inválido, não encontrado, ou falha de rede — segue para o próximo
      }
    }
    return { tentativas: candidatos.size, sucesso, falha };
  }),
});
