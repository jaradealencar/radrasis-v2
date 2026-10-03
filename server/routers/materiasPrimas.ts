import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import {
  estudioChapas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
} from "../../drizzle/schema";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { getDb } from "../db/db";
import { protectedProcedure, requireRole, router } from "../_core/trpc";

const gestorCadastroProcedure = protectedProcedure.use(requireRole("gestor", "admin", "master"));

const categoriaInput = z.object({
  nome: z.string().trim().min(1).max(128),
  usaDadosChapa: z.boolean().default(false),
});

const formatosChapaInput = z.array(z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(1).max(256),
  larguraMm: z.number().int().min(10).max(50_000),
  alturaMm: z.number().int().min(10).max(50_000),
  ativo: z.boolean().default(true),
  principal: z.boolean().default(false),
}).strict()).max(50);

export const materiasPrimasRouter = router({
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [catalogo, cadastros, categorias, chapas] = await Promise.all([
      listarMateriasPrimas(),
      db.select().from(materiaPrimaCadastros),
      db.select().from(materiaPrimaCategorias).orderBy(asc(materiaPrimaCategorias.nome)),
      db.select().from(estudioChapas).orderBy(asc(estudioChapas.larguraMm), asc(estudioChapas.alturaMm)),
    ]);
    const cadastroPorId = new Map(cadastros.map(item => [item.mubisysMateriaPrimaId, item]));
    const categoriaPorId = new Map(categorias.map(item => [item.id, item]));
    const chapasPorId = new Map<number, typeof chapas>();
    for (const chapa of chapas) {
      const lista = chapasPorId.get(chapa.mubisysMateriaPrimaId) ?? [];
      lista.push(chapa);
      chapasPorId.set(chapa.mubisysMateriaPrimaId, lista);
    }
    return catalogo
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(material => {
        const cadastro = cadastroPorId.get(material.id);
        const categoria = cadastro?.categoriaId == null ? null : categoriaPorId.get(cadastro.categoriaId) ?? null;
        return {
          id: material.id,
          nome: material.nome,
          categoriaMubiSys: material.categoria,
          tipo: material.tipo,
          unidadeCusto: material.unidade_custo,
          unidadeMovimentacao: material.unidade_movimentacao,
          valorCusto: Number(material.valor_custo ?? 0),
          dataReferencia: material.data_referencia,
          status: material.status,
          categoriaId: categoria?.id ?? null,
          categoriaNome: categoria?.nome ?? null,
          categoriaUsaDadosChapa: categoria?.usaDadosChapa ?? false,
          espessuraMm: cadastro?.espessuraMm == null ? null : Number(cadastro.espessuraMm),
          densidadeKgM3: cadastro?.densidadeKgM3 == null ? null : Number(cadastro.densidadeKgM3),
          chapas: (chapasPorId.get(material.id) ?? []).map(chapa => ({
            id: chapa.id,
            nome: chapa.nome,
            larguraMm: chapa.larguraMm,
            alturaMm: chapa.alturaMm,
            ativo: chapa.ativo,
            principal: chapa.principal,
          })),
        };
      });
  }),

  categoriasListar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(materiaPrimaCategorias).orderBy(asc(materiaPrimaCategorias.nome));
  }),

  categoriaCriar: gestorCadastroProcedure
    .input(categoriaInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const categorias = await db.select({ nome: materiaPrimaCategorias.nome }).from(materiaPrimaCategorias);
      if (categorias.some(item => item.nome.localeCompare(input.nome, "pt-BR", { sensitivity: "base" }) === 0))
        throw new Error("Já existe uma categoria com esse nome.");
      const [categoria] = await db.insert(materiaPrimaCategorias).values(input).returning();
      return categoria;
    }),

  categoriaAtualizar: gestorCadastroProcedure
    .input(categoriaInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [atual] = await db.select().from(materiaPrimaCategorias).where(eq(materiaPrimaCategorias.id, input.id));
      if (!atual) throw new Error("Categoria não encontrada.");
      const categorias = await db.select({ id: materiaPrimaCategorias.id, nome: materiaPrimaCategorias.nome }).from(materiaPrimaCategorias);
      if (categorias.some(item => item.id !== input.id && item.nome.localeCompare(input.nome, "pt-BR", { sensitivity: "base" }) === 0))
        throw new Error("Já existe uma categoria com esse nome.");
      if (atual.usaDadosChapa && !input.usaDadosChapa) {
        const materiaisVinculados = await db.select({ id: materiaPrimaCadastros.mubisysMateriaPrimaId })
          .from(materiaPrimaCadastros)
          .where(eq(materiaPrimaCadastros.categoriaId, input.id));
        if (materiaisVinculados.length)
          throw new Error("Reclassifique as matérias-primas desta categoria antes de desativar os campos de chapa.");
      }
      const [categoria] = await db.update(materiaPrimaCategorias)
        .set({ nome: input.nome, usaDadosChapa: input.usaDadosChapa, updatedAt: new Date() })
        .where(eq(materiaPrimaCategorias.id, input.id))
        .returning();
      return categoria;
    }),

  categoriaRemover: gestorCadastroProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const materiaisVinculados = await db.select({ id: materiaPrimaCadastros.mubisysMateriaPrimaId })
        .from(materiaPrimaCadastros)
        .where(eq(materiaPrimaCadastros.categoriaId, input.id));
      if (materiaisVinculados.length)
        throw new Error("A categoria está em uso. Reclassifique as matérias-primas antes de removê-la.");
      await db.delete(materiaPrimaCategorias).where(eq(materiaPrimaCategorias.id, input.id));
      return { success: true };
    }),

  salvar: gestorCadastroProcedure
    .input(z.object({
      mubisysMateriaPrimaId: z.number().int().positive(),
      categoriaId: z.number().int().positive().nullable(),
      espessuraMm: z.number().finite().positive().max(10_000).nullable(),
      densidadeKgM3: z.number().finite().positive().max(1_000_000).nullable(),
      chapas: formatosChapaInput,
    }).strict())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const catalogo = await listarMateriasPrimas();
      const material = catalogo.find(item => item.id === input.mubisysMateriaPrimaId);
      if (!material) throw new Error("A matéria-prima não está no catálogo atual do MubiSys.");

      let categoria: typeof materiaPrimaCategorias.$inferSelect | null = null;
      if (input.categoriaId != null) {
        const [encontrada] = await db.select().from(materiaPrimaCategorias).where(eq(materiaPrimaCategorias.id, input.categoriaId));
        if (!encontrada) throw new Error("Selecione uma categoria cadastrada.");
        categoria = encontrada;
      }
      const formatosAtivos = input.chapas.filter(chapa => chapa.ativo);
      const usaDadosChapa = categoria?.usaDadosChapa ?? false;
      if (usaDadosChapa && (!input.espessuraMm || !input.densidadeKgM3 || formatosAtivos.length === 0))
        throw new Error("Para salvar uma chapa, informe espessura, densidade e ao menos um formato ativo.");
      if (usaDadosChapa && input.chapas.filter(chapa => chapa.ativo && chapa.principal).length > 1)
        throw new Error("Marque no máximo um formato principal.");
      const idsInformados = input.chapas.flatMap(chapa => chapa.id == null ? [] : [chapa.id]);
      if (new Set(idsInformados).size !== idsInformados.length)
        throw new Error("Há formatos de chapa repetidos no formulário.");
      const dimensoes = input.chapas.map(chapa => [Math.max(chapa.larguraMm, chapa.alturaMm), Math.min(chapa.larguraMm, chapa.alturaMm)].join("x"));
      if (new Set(dimensoes).size !== dimensoes.length)
        throw new Error("Cada formato precisa ter um tamanho diferente.");

      await db.transaction(async tx => {
        const existentes = await tx.select().from(estudioChapas)
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));
        const existentesPorId = new Map(existentes.map(chapa => [chapa.id, chapa]));
        for (const formato of input.chapas) {
          if (formato.id != null && !existentesPorId.has(formato.id))
            throw new Error("Um formato enviado não pertence a esta matéria-prima.");
        }

        const now = new Date();
        await tx.insert(materiaPrimaCadastros).values({
          mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
          categoriaId: input.categoriaId,
          espessuraMm: usaDadosChapa ? String(input.espessuraMm) : null,
          densidadeKgM3: usaDadosChapa ? String(input.densidadeKgM3) : null,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: materiaPrimaCadastros.mubisysMateriaPrimaId,
          set: {
            categoriaId: input.categoriaId,
            espessuraMm: usaDadosChapa ? String(input.espessuraMm) : null,
            densidadeKgM3: usaDadosChapa ? String(input.densidadeKgM3) : null,
            updatedAt: now,
          },
        });

        await tx.update(estudioChapas).set({ principal: false })
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));
        await tx.update(estudioChapas).set({ ativo: false, updatedAt: now })
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));

        const formatoPrincipal = formatosAtivos.find(formato => formato.principal) ?? formatosAtivos[0];
        for (const formato of input.chapas) {
          const larguraMm = Math.max(formato.larguraMm, formato.alturaMm);
          const alturaMm = Math.min(formato.larguraMm, formato.alturaMm);
          const existentePorTamanho = existentes.find(chapa => chapa.larguraMm === larguraMm && chapa.alturaMm === alturaMm);
          const id = existentePorTamanho?.id ?? formato.id;
          const values = {
            mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
            nome: formato.nome,
            larguraMm,
            alturaMm,
            ativo: usaDadosChapa && formato.ativo,
            principal: usaDadosChapa && formato.ativo && formato === formatoPrincipal,
            updatedAt: now,
          };
          if (id != null) {
            await tx.update(estudioChapas).set(values).where(eq(estudioChapas.id, id));
          } else {
            await tx.insert(estudioChapas).values(values);
          }
        }
      });
      return { success: true, materiaPrima: material.nome };
    }),
});
