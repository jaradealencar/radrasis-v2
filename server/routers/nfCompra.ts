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
import { sincronizarCatalogoMubiSys } from "../services/mubisysEspelho";

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
        freteModo: z.enum(["gratis", "por_kg", "valor_total"]).default("por_kg"),
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
              pesoEspecificoKg: materiaPrimaCadastros.pesoEspecificoKg,
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
          valorIpi: item.valorIpi,
          pesoUnitarioFreteKg:
            sugestao.unidadeErp === "UN" && sugestao.fatorConversao === 1 &&
            /^(UN|UND|UNID|PC|PÇ)$/i.test(item.unidadeCompra.trim())
              ? Number(cadPorMpId.get(sugestao.materiaPrimaId ?? -1)?.pesoEspecificoKg ?? 0) || null
              : null,
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
          // Dados tecnicos da MP para calculo de peso (frete por kg)
          espessuraMm: candidatos[0]?.dadosTecnicos?.espessuraMm ?? null,
          densidadeKgM3: candidatos[0]?.dadosTecnicos?.densidadeGCm3
            ? Number(candidatos[0].dadosTecnicos.densidadeGCm3) * 1000
            : null,
          larguraMm: candidatos[0]?.dadosTecnicos?.perfilLarguraMm ?? null,
          alturaMm: candidatos[0]?.dadosTecnicos?.perfilAlturaMm ?? null,
          perfilFormato: candidatos[0]?.dadosTecnicos?.perfilFormato ?? null,
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
          pesoEspecificoKg: materiaPrimaCadastros.pesoEspecificoKg,
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
          pesoEspecificoKg: r.pesoEspecificoKg ? Number(r.pesoEspecificoKg) : null,
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
        modoRateioFrete: z.enum(["gratis", "por_kg", "valor_total", "total_peso", "total_qtd", "total_valor", "total_valor_ipi"]),
        freteValor: z.number().nonnegative(),
        criterioRateioFrete: z.enum(["peso", "quantidade", "valor"]).optional(),
        baseValorRateioFrete: z.enum(["valor_total", "valor_total_ipi"]).optional(),
        percentualIcms: z.number().min(0).max(100).default(10),
        itens: z.array(
          z.object({
            descricao: z.string(),
            quantidade: z.number().positive(),
            unidadeCompra: z.enum(["KG", "UN", "LT", "ML", "M2"]),
            valorUnitario: z.number().nonnegative(),
            valorTotalItem: z.number().nonnegative(),
            valorIpi: z.number().nonnegative().optional(),
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
      const criterioRateioFrete = input.criterioRateioFrete ?? (
        input.modoRateioFrete === "total_peso" ? "peso" :
        input.modoRateioFrete === "total_qtd" ? "quantidade" : "valor"
      );
      const baseValorRateioFrete = input.baseValorRateioFrete ?? (
        input.modoRateioFrete === "total_valor_ipi" ? "valor_total_ipi" : "valor_total"
      );
      const modoFrete = input.modoRateioFrete === "gratis"
        ? "gratis"
        : input.modoRateioFrete === "por_kg"
          ? "por_kg"
          : "valor_total";
      const freteValorPorKg = modoFrete === "por_kg" ? input.freteValor : undefined;
      const valorFrete = modoFrete === "valor_total" ? input.freteValor : 0;

      const entradaCalculo: Parameters<typeof calcularNfCompra>[0] = {
        valorMercadoria: input.valorMercadoria,
        valorFrete,
        modoFrete,
        criterioRateioFrete,
        baseValorRateioFrete,
        freteValorPorKg,
        percentualIcms: input.percentualIcms,
        itens: input.itens.map(i => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeCompra: i.unidadeCompra,
          valorUnitario: i.valorUnitario,
          valorTotalItem: i.valorTotalItem,
          valorIpi: i.valorIpi,
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
          modoRateioFrete: z.enum(["gratis", "por_kg", "valor_total", "total_peso", "total_qtd", "total_valor", "total_valor_ipi"]),
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

  /**
   * Função 1 para o Comprador: Histórico de Compras de uma Matéria-Prima
   * Mostra se o sistema já processou a MP, qual foi o último preço pago na unidade
   * original da NF (ex: R$/kg) e histórico das compras passadas.
   */
  historicoPorMateriaPrima: protectedProcedure
    .input(z.object({ materiaPrimaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Buscar cadastro atual da MP no Mubisys
      const [mp] = await db
        .select()
        .from(materiasPrimas)
        .where(eq(materiasPrimas.id, input.materiaPrimaId))
        .limit(1);

      if (!mp) return null;

      // Buscar todos os itens de NF que foram vinculados a essa MP
      const itensComprados = await db
        .select({
          itemId: nfCompraItens.id,
          numeroItem: nfCompraItens.numeroItem,
          codigoFornecedor: nfCompraItens.codigoFornecedor,
          descricaoNf: nfCompraItens.descricaoNf,
          quantidade: nfCompraItens.quantidade,
          unidadeCompra: nfCompraItens.unidadeCompra,
          valorUnitarioOriginal: nfCompraItens.valorUnitario,
          valorTotalItem: nfCompraItens.valorTotalItem,
          custoRealErp: nfCompraItens.custoRealErp,
          custoCadastradoErp: nfCompraItens.custoCadastradoErp,
          unidadeErp: nfCompraItens.unidadeErp,
          fatorConversao: nfCompraItens.fatorConversao,
          divergenciaPct: nfCompraItens.divergenciaPct,
          baseCalculoTexto: nfCompraItens.baseCalculoTexto,
          // Dados da NF
          numeroNf: nfCompraImportacoes.numero,
          fornecedorNome: nfCompraImportacoes.nomeFornecedor,
          fornecedorCnpj: nfCompraImportacoes.cnpjFornecedor,
          dataEmissao: nfCompraImportacoes.dataEmissao,
          dataImportacao: nfCompraImportacoes.createdAt,
        })
        .from(nfCompraItens)
        .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
        .where(eq(nfCompraItens.materiaPrimaId, input.materiaPrimaId))
        .orderBy(desc(nfCompraImportacoes.createdAt))
        .limit(20);

      const ultimaCompra = itensComprados[0] ?? null;

      return {
        materiaPrima: {
          id: mp.id,
          nome: mp.nome,
          mubisysId: mp.mubisysMateriaPrimaId,
          unidadeMedida: mp.unidadeMedida,
          custoUnitarioAtual: mp.custoUnitario ? Number(mp.custoUnitario) : null,
          referenciaCusto: mp.referenciaCusto,
        },
        jaProcessado: itensComprados.length > 0,
        totalComprasRegistradas: itensComprados.length,
        ultimaCompra: ultimaCompra
          ? {
              data: ultimaCompra.dataEmissao || ultimaCompra.dataImportacao,
              fornecedor: ultimaCompra.fornecedorNome,
              precoUnitarioOriginal: Number(ultimaCompra.valorUnitarioOriginal),
              unidadeOriginal: ultimaCompra.unidadeCompra,
              custoRealErp: Number(ultimaCompra.custoRealErp),
              unidadeErp: ultimaCompra.unidadeErp,
              divergenciaPct: Number(ultimaCompra.divergenciaPct),
            }
          : null,
        historico: itensComprados.map(i => ({
          ...i,
          quantidade: Number(i.quantidade),
          valorUnitarioOriginal: Number(i.valorUnitarioOriginal),
          valorTotalItem: Number(i.valorTotalItem),
          custoRealErp: Number(i.custoRealErp),
          custoCadastradoErp: i.custoCadastradoErp ? Number(i.custoCadastradoErp) : null,
          divergenciaPct: i.divergenciaPct ? Number(i.divergenciaPct) : null,
        })),
      };
    }),

  /**
   * Função 2 para o Comprador: Análise de Cotação em PDF com IA
   * Extrai os itens do PDF, tenta achar vínculos automáticos e compara os preços
   * cotados contra as últimas compras reais registradas no sistema.
   */
  analisarCotacaoPdf: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string().min(100, "Arquivo PDF em base64 obrigatório"),
        nomeArquivo: z.string().default("cotacao.pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const { extrairCotacaoDePdf } = await import("../services/nfCotacaoPdf");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const buffer = Buffer.from(input.pdfBase64, "base64");
      const cotacao = await extrairCotacaoDePdf(buffer, input.nomeArquivo);

      // Carregar todas as MPs para busca de correspondência por similaridade de nome
      const todasMps = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
        })
        .from(materiasPrimas)
        .where(eq(materiasPrimas.ativa, true));

      // Para cada item da cotação, buscar histórico de última compra e comparar
      const itensAnalisados = await Promise.all(
        cotacao.itens.map(async (itemCotado) => {
          // Tentar encontrar MP correspondente pelo nome (busca simples por termos)
          const termos = itemCotado.descricao.toLowerCase().split(/\s+/).filter(t => t.length > 2);
          let melhorMp: (typeof todasMps)[0] | null = null;
          let maiorScore = 0;

          for (const mp of todasMps) {
            const mpNome = mp.nome.toLowerCase();
            let score = 0;
            for (const t of termos) {
              if (mpNome.includes(t)) score++;
            }
            if (score > maiorScore && score >= 2) {
              maiorScore = score;
              melhorMp = mp;
            }
          }

          // Se achou uma MP candidata, buscar o histórico da última compra
          let ultimaCompraReal: any = null;
          let variacaoPrecoCotadoVsUltimaCompra: number | null = null;
          let variacaoPrecoCotadoVsMubisys: number | null = null;

          if (melhorMp) {
            const [ultima] = await db
              .select({
                valorUnitarioOriginal: nfCompraItens.valorUnitario,
                unidadeCompra: nfCompraItens.unidadeCompra,
                dataEmissao: nfCompraImportacoes.dataEmissao,
                fornecedorNome: nfCompraImportacoes.nomeFornecedor,
              })
              .from(nfCompraItens)
              .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
              .where(eq(nfCompraItens.materiaPrimaId, melhorMp.id))
              .orderBy(desc(nfCompraImportacoes.createdAt))
              .limit(1);

            if (ultima) {
              ultimaCompraReal = {
                precoUnitario: Number(ultima.valorUnitarioOriginal),
                unidade: ultima.unidadeCompra,
                data: ultima.dataEmissao,
                fornecedor: ultima.fornecedorNome,
              };

              // Se a unidade for a mesma, calcular variação direta
              if (ultima.unidadeCompra.toUpperCase() === itemCotado.unidade.toUpperCase()) {
                const uPreco = Number(ultima.valorUnitarioOriginal);
                if (uPreco > 0) {
                  variacaoPrecoCotadoVsUltimaCompra = Number(
                    (((itemCotado.precoUnitario - uPreco) / uPreco) * 100).toFixed(2)
                  );
                }
              }
            }

            // Comparar contra custo Mubisys atual
            const custoErp = melhorMp.custoUnitario ? Number(melhorMp.custoUnitario) : null;
            if (custoErp && custoErp > 0) {
              variacaoPrecoCotadoVsMubisys = Number(
                (((itemCotado.precoUnitario - custoErp) / custoErp) * 100).toFixed(2)
              );
            }
          }

          return {
            ...itemCotado,
            materiaPrimaVinculada: melhorMp
              ? {
                  id: melhorMp.id,
                  nome: melhorMp.nome,
                  mubisysId: melhorMp.mubisysId,
                  custoUnitarioMubisys: melhorMp.custoUnitario ? Number(melhorMp.custoUnitario) : null,
                  unidadeMubisys: melhorMp.unidadeMedida,
                }
              : null,
            ultimaCompraReal,
            variacaoPrecoCotadoVsUltimaCompra,
            variacaoPrecoCotadoVsMubisys,
          };
        })
      );

      return {
        fornecedor: cotacao.fornecedor,
        cnpjFornecedor: cotacao.cnpjFornecedor,
        dataCotacao: cotacao.dataCotacao,
        valorTotalCotado: cotacao.valorTotal,
        itens: itensAnalisados,
      };
    }),

  /**
   * Função 3 para o Comprador / Gestor: Painel Inteligente de Defasagens
   * Agrega estatísticas completas das divergências de preços entre o custo real
   * das NFs e o valor cadastrado no Mubisys.
   */
  obterPainelDivergencias: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    // Buscar todos os itens de NF que foram vinculados e calculados
    const itens = await db
      .select({
        id: nfCompraItens.id,
        materiaPrimaId: nfCompraItens.materiaPrimaId,
        descricaoNf: nfCompraItens.descricaoNf,
        custoRealErp: nfCompraItens.custoRealErp,
        custoCadastradoErp: nfCompraItens.custoCadastradoErp,
        divergenciaPct: nfCompraItens.divergenciaPct,
        defasado: nfCompraItens.defasado,
        unidadeErp: nfCompraItens.unidadeErp,
        dataImportacao: nfCompraImportacoes.createdAt,
        fornecedorNome: nfCompraImportacoes.nomeFornecedor,
        mpNome: materiasPrimas.nome,
        mpMubisysId: materiasPrimas.mubisysMateriaPrimaId,
      })
      .from(nfCompraItens)
      .innerJoin(nfCompraImportacoes, eq(nfCompraImportacoes.id, nfCompraItens.importacaoId))
      .leftJoin(materiasPrimas, eq(materiasPrimas.id, nfCompraItens.materiaPrimaId))
      .where(sql`${nfCompraItens.materiaPrimaId} IS NOT NULL AND ${nfCompraItens.divergenciaPct} IS NOT NULL`)
      .orderBy(desc(nfCompraImportacoes.createdAt));

    if (itens.length === 0) {
      return {
        totalItensAuditados: 0,
        defasagemMediaGeralPct: 0,
        faixas: [],
        maioresDivergencias: [],
      };
    }

    const divergencias = itens.map(i => Number(i.divergenciaPct));
    const somaDivergencias = divergencias.reduce((a, b) => a + b, 0);
    const mediaGeral = somaDivergencias / divergencias.length;

    // Distribuição por faixas percentuais
    let faixaMaisDe25 = 0; // Crítico: mercado subiu > 25% acima do Mubisys
    let faixa10a25 = 0;   // Alto: subiu 10% a 25%
    let faixa2a10 = 0;    // Moderado: subiu 2% a 10%
    let faixaEstavel = 0; // Estável: entre -2% e +2%
    let faixaMaisBarato = 0; // Mercado está mais barato que o Mubisys (< -2%)

    for (const d of divergencias) {
      if (d > 25) faixaMaisDe25++;
      else if (d >= 10) faixa10a25++;
      else if (d >= 2) faixa2a10++;
      else if (d >= -2) faixaEstavel++;
      else faixaMaisBarato++;
    }

    const total = itens.length;
    const faixas = [
      {
        faixa: "Crítica (+25% ou mais defasado no Mubisys)",
        cor: "vermelho_escuro",
        quantidade: faixaMaisDe25,
        percentualItens: Number(((faixaMaisDe25 / total) * 100).toFixed(1)),
        descricao: "Preço de mercado muito acima do cadastro do ERP. Risco de prejuízo direto em cotações!",
      },
      {
        faixa: "Alta (+10% a +25% defasado)",
        cor: "laranja",
        quantidade: faixa10a25,
        percentualItens: Number(((faixa10a25 / total) * 100).toFixed(1)),
        descricao: "Recomenda-se ajuste rápido no Mubisys.",
      },
      {
        faixa: "Moderada (+2% a +10% defasado)",
        cor: "amarelo",
        quantidade: faixa2a10,
        percentualItens: Number(((faixa2a10 / total) * 100).toFixed(1)),
        descricao: "Pequena defasagem acumulada.",
      },
      {
        faixa: "Estável (-2% a +2%)",
        cor: "verde",
        quantidade: faixaEstavel,
        percentualItens: Number(((faixaEstavel / total) * 100).toFixed(1)),
        descricao: "Custo cadastrado no Mubisys condiz com as compras reais.",
      },
      {
        faixa: "Mercado mais barato que o Mubisys (abaixo de -2%)",
        cor: "azul",
        quantidade: faixaMaisBarato,
        percentualItens: Number(((faixaMaisBarato / total) * 100).toFixed(1)),
        descricao: "Você pagou menos na NF do que está cadastrado. Propostas podem estar com preço acima do mercado.",
      },
    ];

    // Ordenar itens com maiores desvios absolutos
    const maioresDivergencias = [...itens]
      .sort((a, b) => Math.abs(Number(b.divergenciaPct)) - Math.abs(Number(a.divergenciaPct)))
      .slice(0, 10)
      .map(i => ({
        id: i.id,
        materiaPrimaNome: i.mpNome || i.descricaoNf,
        mubisysId: i.mpMubisysId,
        fornecedor: i.fornecedorNome,
        data: i.dataImportacao,
        custoRealErp: Number(i.custoRealErp),
        custoCadastradoErp: Number(i.custoCadastradoErp),
        unidadeErp: i.unidadeErp,
        divergenciaPct: Number(i.divergenciaPct),
      }));

    return {
      totalItensAuditados: total,
      defasagemMediaGeralPct: Number(mediaGeral.toFixed(2)),
      faixas,
      maioresDivergencias,
    };
  }),
  sincronizarEspelhoMubiSys: protectedProcedure.mutation(async ({ ctx }) => {
    const role = String(ctx.user?.role ?? "");
    if (!["admin", "master", "gestor"].includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Somente gestor, admin ou master pode atualizar o espelho do MubiSys.",
      });
    }
    const resultado = await sincronizarCatalogoMubiSys();
    return { ok: true, ...resultado };
  }),
  buscarMateriasPrimasPorIds: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
          ativa: materiasPrimas.ativa,
        })
        .from(materiasPrimas)
        .where(inArray(materiasPrimas.id, input.ids));
      return rows.map(row => ({
        ...row,
        custoUnitario: row.custoUnitario == null ? null : Number(row.custoUnitario),
      }));
    }),
});
