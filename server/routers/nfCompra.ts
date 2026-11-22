import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db/db";
import {
  materiasPrimas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
  estudioChapas,
  nfCompraImportacoes,
  nfCompraItens,
  nfMpVinculos,
} from "../../drizzle/schema";
import { eq, inArray, ilike, or, and, desc, sql } from "drizzle-orm";
import { parseNfXml } from "../services/nfXmlParser";
import {
  sugerirVinculoItem,
  resolverFatorUnidadeParaChapaM2,
  type CandidatoMateriaPrima,
  type MemoriaVinculo,
} from "../services/nfSugestaoVinculo";
import { calcularNfCompra, type ItemCalculoEntrada } from "../services/nfCalculo";

export const nfCompraRouter = router({
  /**
   * Passo 1: Recebe o XML cru da NF (texto ou payload do upload), faz o parse
   * de cada item (<det>), consulta a memória para aquele fornecedor e devolve
   * a NF estruturada com os itens já pré-sugeridos.
   */
  processarXml: protectedProcedure
    .input(
      z.object({
        xmlConteudo: z.string().min(20, "XML vazio ou inválido"),
        freteModo: z.enum(["por_kg", "valor_total"]).default("por_kg"),
        freteValor: z.number().nonnegative().default(0), // se por_kg: R$/kg; se valor_total: R$ total
        percentualIcms: z.number().min(0).max(100).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const nf = parseNfXml(input.xmlConteudo);

      // 1. Buscar memórias existentes para este fornecedor (aprendizado prévio)
      const codigos = nf.itens.map(i => i.codigoFornecedor);
      const memoriasRows = await db
        .select()
        .from(nfMpVinculos)
        .where(
          and(
            eq(nfMpVinculos.cnpjFornecedor, nf.cnpjFornecedor),
            inArray(nfMpVinculos.codigoFornecedor, codigos)
          )
        );

      const memoriasPorCodigo = new Map<string, MemoriaVinculo>();
      for (const m of memoriasRows) {
        memoriasPorCodigo.set(m.codigoFornecedor, {
          materiaPrimaId: m.materiaPrimaId,
          unidadeErp: m.unidadeErp as any,
          fatorConversao: Number(m.fatorConversao),
          origemFator: m.origemFator,
          baseCalculoTexto: m.baseCalculoTexto,
          vezesUsado: m.vezesUsado,
        });
      }

      // 2. Para os itens sem memória, tentar achar candidatos pelo nome no cadastro de MPs
      const idsMpsParaCarregar = new Set<number>();
      for (const m of memoriasRows) idsMpsParaCarregar.add(m.materiaPrimaId);

      // Buscar as MPs que estão na memória
      const mpsMemoria = idsMpsParaCarregar.size > 0
        ? await db
            .select()
            .from(materiasPrimas)
            .where(inArray(materiasPrimas.id, Array.from(idsMpsParaCarregar)))
        : [];

      const mpsPorId = new Map(mpsMemoria.map(m => [m.id, m]));

      // Carregar cadastros técnicos das MPs de memória
      const cadTecnicos = idsMpsParaCarregar.size > 0
        ? await db
            .select({
              mpId: materiasPrimas.id,
              mubisysId: materiasPrimas.mubisysMateriaPrimaId,
              catNome: materiaPrimaCategorias.nome,
              usaChapa: materiaPrimaCategorias.usaDadosChapa,
              usaPerfil: materiaPrimaCategorias.usaDadosPerfil,
              usaBobina: materiaPrimaCategorias.usaDadosBobina,
              espessuraMm: materiaPrimaCadastros.espessuraMm,
              densidadeKgM3: materiaPrimaCadastros.densidadeKgM3,
              perfilFormato: materiaPrimaCadastros.perfilFormato,
              perfilAlturaMm: materiaPrimaCadastros.perfilAlturaMm,
              perfilLarguraMm: materiaPrimaCadastros.perfilLarguraMm,
            })
            .from(materiasPrimas)
            .leftJoin(materiaPrimaCadastros, eq(materiaPrimaCadastros.mubisysMateriaPrimaId, materiasPrimas.mubisysMateriaPrimaId))
            .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCategorias.id, materiaPrimaCadastros.categoriaId))
            .where(inArray(materiasPrimas.id, Array.from(idsMpsParaCarregar)))
        : [];

      const cadPorMpId = new Map(cadTecnicos.map(c => [c.mpId, c]));

      // 3. Montar a lista de itens com as sugestões
      const itensComSugestao = nf.itens.map(item => {
        const memoria = memoriasPorCodigo.get(item.codigoFornecedor) ?? null;
        let candidatos: CandidatoMateriaPrima[] = [];

        if (memoria && mpsPorId.has(memoria.materiaPrimaId)) {
          const mp = mpsPorId.get(memoria.materiaPrimaId)!;
          const cad = cadPorMpId.get(mp.id);
          candidatos = [
            {
              id: mp.id,
              nome: mp.nome,
              mubisysMateriaPrimaId: mp.mubisysMateriaPrimaId,
              unidadeMedida: mp.unidadeMedida,
              custoUnitarioCadastrado: mp.custoUnitario ? Number(mp.custoUnitario) : null,
              dadosTecnicos: cad
                ? {
                    tipo: cad.usaPerfil ? "perfil" : cad.usaChapa ? "chapa" : cad.usaBobina ? "bobina" : "outro",
                    espessuraMm: cad.espessuraMm ? Number(cad.espessuraMm) : null,
                    densidadeGCm3: cad.densidadeKgM3 ? Number(cad.densidadeKgM3) / 1000 : null,
                    perfilFormato: cad.perfilFormato,
                    perfilAlturaMm: cad.perfilAlturaMm ? Number(cad.perfilAlturaMm) : null,
                    perfilLarguraMm: cad.perfilLarguraMm ? Number(cad.perfilLarguraMm) : null,
                  }
                : null,
            },
          ];
        }

        const sugestao = sugerirVinculoItem(
          {
            codigoFornecedor: item.codigoFornecedor,
            descricao: item.descricao,
            unidadeCompra: item.unidadeCompra as any,
          },
          memoria,
          candidatos
        );

        return {
          numeroItem: item.numeroItem,
          codigoFornecedor: item.codigoFornecedor,
          descricaoNf: item.descricao,
          ncm: item.ncm,
          unidadeCompra: item.unidadeCompra,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotalItem: item.valorTotalItem,
          // Sugestão resolvida (memória ou vazio)
          materiaPrimaId: sugestao.materiaPrimaId,
          nomeMateriaPrima: sugestao.nomeMateriaPrima,
          unidadeErp: sugestao.unidadeErp,
          fatorConversao: sugestao.fatorConversao,
          origemFator: sugestao.origemFator,
          baseCalculoTexto: sugestao.baseCalculoTexto,
          confianca: sugestao.confianca,
          pendencias: sugestao.pendencias,
          custoCadastrado: candidatos[0]?.custoUnitarioCadastrado ?? null,
        };
      });

      return {
        cabecalho: {
          numero: nf.numero,
          serie: nf.serie,
          chaveAcesso: nf.chaveAcesso,
          dataEmissao: nf.dataEmissao,
          cnpjFornecedor: nf.cnpjFornecedor,
          nomeFornecedor: nf.nomeFornecedor,
          valorProdutos: nf.valorProdutos,
          valorFreteNf: nf.valorFreteNf,
          pesoLiquidoTotalKg: nf.pesoLiquidoTotalKg,
        },
        itens: itensComSugestao,
      };
    }),

  /**
   * Autocomplete/busca de matérias-primas cadastradas no Radrasys (espelho Mubisys).
   * Traz junto os dados técnicos de conversão se já estiverem preenchidos.
   */
  buscarMateriasPrimas: protectedProcedure
    .input(z.object({ busca: z.string().default(""), limite: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const termo = input.busca.trim();
      const rows = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
          catNome: materiaPrimaCategorias.nome,
          usaChapa: materiaPrimaCategorias.usaDadosChapa,
          usaPerfil: materiaPrimaCategorias.usaDadosPerfil,
          usaBobina: materiaPrimaCategorias.usaDadosBobina,
          espessuraMm: materiaPrimaCadastros.espessuraMm,
          densidadeKgM3: materiaPrimaCadastros.densidadeKgM3,
          perfilFormato: materiaPrimaCadastros.perfilFormato,
          perfilAlturaMm: materiaPrimaCadastros.perfilAlturaMm,
          perfilLarguraMm: materiaPrimaCadastros.perfilLarguraMm,
        })
        .from(materiasPrimas)
        .leftJoin(materiaPrimaCadastros, eq(materiaPrimaCadastros.mubisysMateriaPrimaId, materiasPrimas.mubisysMateriaPrimaId))
        .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCategorias.id, materiaPrimaCadastros.categoriaId))
        .where(
          termo ? or(ilike(materiasPrimas.nome, `%${termo}%`), ilike(materiasPrimas.skuErp, `%${termo}%`)) : undefined
        )
        .limit(input.limite);

      return rows.map(r => ({
        id: r.id,
        nome: r.nome,
        mubisysId: r.mubisysId,
        unidadeMedida: r.unidadeMedida,
        custoUnitario: r.custoUnitario ? Number(r.custoUnitario) : null,
        categoria: r.catNome,
        tecnico: {
          tipo: r.usaPerfil ? "perfil" : r.usaChapa ? "chapa" : r.usaBobina ? "bobina" : "outro",
          espessuraMm: r.espessuraMm ? Number(r.espessuraMm) : null,
          densidadeGCm3: r.densidadeKgM3 ? Number(r.densidadeKgM3) / 1000 : null,
          perfilFormato: r.perfilFormato,
          perfilAlturaMm: r.perfilAlturaMm ? Number(r.perfilAlturaMm) : null,
          perfilLarguraMm: r.perfilLarguraMm ? Number(r.perfilLarguraMm) : null,
        },
      }));
    }),

  /**
   * Simula o cálculo em tempo real quando o usuário edita a linkagem, o frete
   * ou o fator na tela, sem gravar nada ainda.
   */
  calcularPrevia: protectedProcedure
    .input(
      z.object({
        valorMercadoria: z.number().positive(),
        modoRateioFrete: z.enum(["por_kg", "valor_total"]),
        freteValor: z.number().nonnegative(),
        percentualIcms: z.number().min(0).max(100).default(10),
        itens: z.array(
          z.object({
            descricao: z.string(),
            quantidade: z.number().positive(),
            unidadeCompra: z.enum(["KG", "UN", "LT", "ML", "M2"]),
            valorUnitario: z.number().nonnegative(),
            valorTotalItem: z.number().nonnegative(),
            materiaPrimaId: z.number().optional().nullable(),
            unidadeErp: z.enum(["ML", "M2", "UN", "LT"]).optional().nullable(),
            fatorConversao: z.number().positive().optional().nullable(),
            custoCadastrado: z.number().nonnegative().optional().nullable(),
            pesoKg: z.number().optional().nullable(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      const freteValorPorKg = input.modoRateioFrete === "por_kg" ? input.freteValor : undefined;
      const valorFrete = input.modoRateioFrete === "valor_total" ? input.freteValor : 0;

      const entradaCalculo: Parameters<typeof calcularNfCompra>[0] = {
        valorMercadoria: input.valorMercadoria,
        valorFrete,
        freteValorPorKg,
        percentualIcms: input.percentualIcms,
        itens: input.itens.map(i => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeCompra: i.unidadeCompra,
          valorUnitario: i.valorUnitario,
          valorTotalItem: i.valorTotalItem,
          materiaPrimaId: i.materiaPrimaId ?? undefined,
          unidadeErp: i.unidadeErp ?? undefined,
          fatorConversao: i.fatorConversao ?? undefined,
          custoCadastrado: i.custoCadastrado ?? undefined,
          pesoKg: i.pesoKg ?? undefined,
        })),
      };

      return calcularNfCompra(entradaCalculo);
    }),

  /**
   * Confirmação final: grava o cabeçalho, os itens com o cálculo definitivo
   * e faz o upsert na tabela de memória `nf_mp_vinculos` para cada item
   * linkado. É aqui que o sistema "aprende" e fica mais hábil sozinho.
   */
  salvarEGravarMemoria: protectedProcedure
    .input(
      z.object({
        cabecalho: z.object({
          numero: z.string().optional(),
          serie: z.string().optional(),
          chaveAcesso: z.string().optional(),
          cnpjFornecedor: z.string(),
          nomeFornecedor: z.string().optional(),
          dataEmissao: z.string().optional(),
          valorProdutos: z.number(),
          valorFreteNf: z.number().default(0),
          pesoLiquidoTotalKg: z.number().optional().nullable(),
          modoRateioFrete: z.enum(["por_kg", "valor_total"]),
          freteValorPorKg: z.number().optional().nullable(),
          percentualIcms: z.number().default(10),
          arquivoOriginalUrl: z.string().optional().nullable(),
          arquivoTipo: z.string().optional().nullable(),
        }),
        itens: z.array(
          z.object({
            numeroItem: z.number(),
            codigoFornecedor: z.string(),
            descricaoNf: z.string(),
            ncm: z.string().optional().nullable(),
            unidadeCompra: z.string(),
            quantidade: z.number(),
            valorUnitario: z.number(),
            valorTotalItem: z.number(),
            materiaPrimaId: z.number().optional().nullable(),
            origemVinculo: z.string().optional().nullable(),
            unidadeErp: z.string().optional().nullable(),
            fatorConversao: z.number().optional().nullable(),
            origemFator: z.string().optional().nullable(),
            baseCalculoTexto: z.string().optional().nullable(),
            rateioFrete: z.number(),
            rateioIcms: z.number(),
            custoItemTotal: z.number(),
            quantidadeErp: z.number().optional().nullable(),
            custoRealErp: z.number(),
            custoCadastradoErp: z.number().optional().nullable(),
            divergenciaPct: z.number().optional().nullable(),
            defasado: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      // 1. Gravar cabeçalho
      const [importacao] = await db
        .insert(nfCompraImportacoes)
        .values({
          numero: input.cabecalho.numero ?? null,
          serie: input.cabecalho.serie ?? null,
          chaveAcesso: input.cabecalho.chaveAcesso ?? null,
          cnpjFornecedor: input.cabecalho.cnpjFornecedor,
          nomeFornecedor: input.cabecalho.nomeFornecedor ?? null,
          dataEmissao: input.cabecalho.dataEmissao ?? null,
          valorProdutos: String(input.cabecalho.valorProdutos),
          valorFreteNf: String(input.cabecalho.valorFreteNf),
          pesoLiquidoTotalKg: input.cabecalho.pesoLiquidoTotalKg ? String(input.cabecalho.pesoLiquidoTotalKg) : null,
          modoRateioFrete: input.cabecalho.modoRateioFrete,
          freteValorPorKg: input.cabecalho.freteValorPorKg ? String(input.cabecalho.freteValorPorKg) : null,
          percentualIcms: String(input.cabecalho.percentualIcms),
          arquivoOriginalUrl: input.cabecalho.arquivoOriginalUrl ?? null,
          arquivoTipo: input.cabecalho.arquivoTipo ?? null,
          status: "concluida",
          criadoPor: userId,
          concluidoEm: new Date(),
        })
        .returning();

      // 2. Gravar itens da importação
      for (const item of input.itens) {
        await db.insert(nfCompraItens).values({
          importacaoId: importacao.id,
          numeroItem: item.numeroItem,
          codigoFornecedor: item.codigoFornecedor,
          descricaoNf: item.descricaoNf,
          ncm: item.ncm ?? null,
          unidadeCompra: item.unidadeCompra,
          quantidade: String(item.quantidade),
          valorUnitario: String(item.valorUnitario),
          valorTotalItem: String(item.valorTotalItem),
          materiaPrimaId: item.materiaPrimaId ?? null,
          origemVinculo: item.origemVinculo ?? null,
          unidadeErp: item.unidadeErp ?? null,
          fatorConversao: item.fatorConversao ? String(item.fatorConversao) : null,
          origemFator: item.origemFator ?? null,
          baseCalculoTexto: item.baseCalculoTexto ?? null,
          rateioFrete: String(item.rateioFrete),
          rateioIcms: String(item.rateioIcms),
          custoItemTotal: String(item.custoItemTotal),
          quantidadeErp: item.quantidadeErp ? String(item.quantidadeErp) : null,
          custoRealErp: String(item.custoRealErp),
          custoCadastradoErp: item.custoCadastradoErp ? String(item.custoCadastradoErp) : null,
          divergenciaPct: item.divergenciaPct ? String(item.divergenciaPct) : null,
          defasado: item.defasado,
        });

        // 3. MEMÓRIA: se o item foi linkado a uma MP com fator válido, salvar/atualizar
        if (item.materiaPrimaId && item.unidadeErp && item.fatorConversao) {
          const valoresMemoria = {
            cnpjFornecedor: input.cabecalho.cnpjFornecedor,
            codigoFornecedor: item.codigoFornecedor,
            descricaoReferencia: item.descricaoNf,
            materiaPrimaId: item.materiaPrimaId,
            unidadeErp: item.unidadeErp,
            fatorConversao: String(item.fatorConversao),
            origemFator: item.origemFator ?? "manual",
            baseCalculoTexto: item.baseCalculoTexto ?? null,
            confirmadoPor: userId,
            updatedAt: new Date(),
          };

          // Upsert por (cnpjFornecedor, codigoFornecedor)
          await db
            .insert(nfMpVinculos)
            .values({ ...valoresMemoria, vezesUsado: 1 })
            .onConflictDoUpdate({
              target: [nfMpVinculos.cnpjFornecedor, nfMpVinculos.codigoFornecedor],
              set: {
                ...valoresMemoria,
                vezesUsado: sql`${nfMpVinculos.vezesUsado} + 1`,
              },
            });
        }
      }

      return { importacaoId: importacao.id, ok: true };
    }),

  /**
   * Painel de Auditoria da Memória: lista todos os vínculos aprendidos
   * para um fornecedor, mostrando o cálculo guardado para conferência.
   */
  listarMemoriaPorFornecedor: protectedProcedure
    .input(z.object({ cnpjFornecedor: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db
        .select({
          id: nfMpVinculos.id,
          cnpjFornecedor: nfMpVinculos.cnpjFornecedor,
          codigoFornecedor: nfMpVinculos.codigoFornecedor,
          descricaoReferencia: nfMpVinculos.descricaoReferencia,
          materiaPrimaId: nfMpVinculos.materiaPrimaId,
          nomeMateriaPrima: materiasPrimas.nome,
          unidadeErp: nfMpVinculos.unidadeErp,
          fatorConversao: nfMpVinculos.fatorConversao,
          origemFator: nfMpVinculos.origemFator,
          baseCalculoTexto: nfMpVinculos.baseCalculoTexto,
          vezesUsado: nfMpVinculos.vezesUsado,
          updatedAt: nfMpVinculos.updatedAt,
        })
        .from(nfMpVinculos)
        .innerJoin(materiasPrimas, eq(materiasPrimas.id, nfMpVinculos.materiaPrimaId))
        .orderBy(desc(nfMpVinculos.updatedAt));

      if (input.cnpjFornecedor) {
        return query.where(eq(nfMpVinculos.cnpjFornecedor, input.cnpjFornecedor));
      }
      return query.limit(100);
    }),

  /**
   * Histórico de NFs importadas e conferidas.
   */
  listarImportacoes: protectedProcedure
    .input(z.object({ limite: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(nfCompraImportacoes)
        .orderBy(desc(nfCompraImportacoes.createdAt))
        .limit(input.limite);
    }),
});
