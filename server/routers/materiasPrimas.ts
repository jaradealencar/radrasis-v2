import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import {
  estudioChapas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
} from "../../drizzle/schema";
import { formatoPerfilUsaAltura, formatoPerfilUsaEspessura, PERFIL_FORMATOS, secaoPerfilMm2, type FormatoPerfil, normalizarFormatoPerfil } from "@shared/peso";
import { BOBINA_COMPRIMENTO_MAXIMO_MM, BOBINA_LARGURA_MINIMA_MM } from "@shared/bobina";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { getDb } from "../db/db";
import { protectedProcedure, requireRole, router } from "../_core/trpc";

const gestorCadastroProcedure = protectedProcedure.use(requireRole("gestor", "admin", "master"));

const categoriaInput = z.object({
  nome: z.string().trim().min(1).max(128),
  usaDadosChapa: z.boolean().default(false),
  usaDadosBobina: z.boolean().default(false),
  usaDadosPerfil: z.boolean().default(false),
});

function exigirChapaOuBobina(input: { usaDadosChapa: boolean; usaDadosBobina: boolean; usaDadosPerfil: boolean }) {
  if ([input.usaDadosChapa, input.usaDadosBobina, input.usaDadosPerfil].filter(Boolean).length > 1)
    throw new Error("Uma categoria é de chapa, de bobina ou de perfil, não de mais de um tipo.");
}

const formatosBobinaInput = z.array(z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(1).max(256),
  larguraMm: z.number().int().min(BOBINA_LARGURA_MINIMA_MM).max(BOBINA_COMPRIMENTO_MAXIMO_MM),
  ativo: z.boolean().default(true),
  principal: z.boolean().default(false),
}).strict()).max(20);

const formatosChapaInput = z.array(z.object({
  id: z.number().int().positive().optional(),
  nome: z.string().trim().min(1).max(256),
  larguraMm: z.number().int().min(10).max(50_000),
  alturaMm: z.number().int().min(10).max(50_000),
  pantoneCode: z.string().trim().max(32).nullable().optional(),
  cmykC: z.number().finite().min(0).max(100).nullable().optional(),
  cmykM: z.number().finite().min(0).max(100).nullable().optional(),
  cmykY: z.number().finite().min(0).max(100).nullable().optional(),
  cmykK: z.number().finite().min(0).max(100).nullable().optional(),
  transmissaoLuzPct: z.number().finite().min(0).max(100).nullable().optional(),
  transparenciaTipo: z.enum(["opaca", "translucida", "transparente"]).nullable().optional(),
  temCor: z.boolean().default(true),
  ativo: z.boolean().default(true),
  principal: z.boolean().default(false),
}).strict().superRefine((input, context) => {
  const cmyk = [input.cmykC, input.cmykM, input.cmykY, input.cmykK];
  if (cmyk.some(value => value != null) && cmyk.some(value => value == null))
    context.addIssue({ code: "custom", message: "Preencha os quatro canais CMYK ou deixe todos vazios." });
})).max(50);

const perfilSecaoInvalida = (input: { perfilFormato: FormatoPerfil; perfilAlturaMm: number | null; perfilLarguraMm: number | null; espessuraMm: number | null }) =>
  secaoPerfilMm2(input.perfilFormato, input.perfilAlturaMm ?? 0, input.perfilLarguraMm ?? 0, input.espessuraMm) == null;

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
          categoriaUsaDadosBobina: categoria?.usaDadosBobina ?? false,
          categoriaUsaDadosPerfil: categoria?.usaDadosPerfil ?? false,
          espessuraMm: cadastro?.espessuraMm == null ? null : Number(cadastro.espessuraMm),
          densidadeKgM3: cadastro?.densidadeKgM3 == null ? null : Number(cadastro.densidadeKgM3),
          pesoEspecificoKg: cadastro?.pesoEspecificoKg == null ? null : Number(cadastro.pesoEspecificoKg),
          perfilFormato: normalizarFormatoPerfil(cadastro?.perfilFormato),
          perfilAlturaMm: cadastro?.perfilAlturaMm == null ? null : Number(cadastro.perfilAlturaMm),
          perfilLarguraMm: cadastro?.perfilLarguraMm == null ? null : Number(cadastro.perfilLarguraMm),
          perfilComprimentoMm: cadastro?.perfilComprimentoMm == null ? null : Number(cadastro.perfilComprimentoMm),
          bobinas: (chapasPorId.get(material.id) ?? []).filter(chapa => chapa.bobina).map(bobina => ({
            id: bobina.id,
            nome: bobina.nome,
            larguraMm: bobina.alturaMm,
            ativo: bobina.ativo,
            principal: bobina.principal,
          })),
          chapas: (chapasPorId.get(material.id) ?? []).filter(chapa => !chapa.bobina).map(chapa => ({
            id: chapa.id,
            nome: chapa.nome,
            larguraMm: chapa.larguraMm,
            alturaMm: chapa.alturaMm,
            pantoneCode: chapa.pantoneCode,
            cmykC: chapa.cmykC == null ? null : Number(chapa.cmykC),
            cmykM: chapa.cmykM == null ? null : Number(chapa.cmykM),
            cmykY: chapa.cmykY == null ? null : Number(chapa.cmykY),
            cmykK: chapa.cmykK == null ? null : Number(chapa.cmykK),
            transmissaoLuzPct: chapa.transmissaoLuzPct == null ? null : Number(chapa.transmissaoLuzPct),
            transparenciaTipo: chapa.transparenciaTipo,
            temCor: chapa.temCor,
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
      exigirChapaOuBobina(input);
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
      exigirChapaOuBobina(input);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [atual] = await db.select().from(materiaPrimaCategorias).where(eq(materiaPrimaCategorias.id, input.id));
      if (!atual) throw new Error("Categoria não encontrada.");
      const categorias = await db.select({ id: materiaPrimaCategorias.id, nome: materiaPrimaCategorias.nome }).from(materiaPrimaCategorias);
      if (categorias.some(item => item.id !== input.id && item.nome.localeCompare(input.nome, "pt-BR", { sensitivity: "base" }) === 0))
        throw new Error("Já existe uma categoria com esse nome.");
      if ((atual.usaDadosChapa && !input.usaDadosChapa) || (atual.usaDadosBobina && !input.usaDadosBobina) || (atual.usaDadosPerfil && !input.usaDadosPerfil)) {
        const materiaisVinculados = await db.select({ id: materiaPrimaCadastros.mubisysMateriaPrimaId })
          .from(materiaPrimaCadastros)
          .where(eq(materiaPrimaCadastros.categoriaId, input.id));
        if (materiaisVinculados.length)
          throw new Error("Reclassifique as matérias-primas desta categoria antes de desativar os campos de chapa, bobina ou perfil.");
      }
      const [categoria] = await db.update(materiaPrimaCategorias)
        .set({ nome: input.nome, usaDadosChapa: input.usaDadosChapa, usaDadosBobina: input.usaDadosBobina, usaDadosPerfil: input.usaDadosPerfil, updatedAt: new Date() })
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
      pesoEspecificoKg: z.number().finite().positive().max(1_000_000).nullable().default(null),
      perfilFormato: z.enum(PERFIL_FORMATOS).default("tubo"),
      perfilAlturaMm: z.number().finite().positive().max(100_000).nullable().default(null),
      perfilLarguraMm: z.number().finite().positive().max(100_000).nullable().default(null),
      perfilComprimentoMm: z.number().finite().positive().max(1_000_000).nullable().default(null),
      chapas: formatosChapaInput,
      bobinas: formatosBobinaInput.default([]),
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
      const usaDadosChapa = categoria?.usaDadosChapa ?? false;
      const usaDadosBobina = categoria?.usaDadosBobina ?? false;
      const usaDadosPerfil = categoria?.usaDadosPerfil ?? false;
      // Bobina: só a largura é informada; o comprimento gravado é apenas o teto do nesting.
      const formatos = usaDadosBobina
        ? input.bobinas.map(bobina => ({
            id: bobina.id,
            nome: bobina.nome,
            larguraMm: BOBINA_COMPRIMENTO_MAXIMO_MM,
            alturaMm: bobina.larguraMm,
            ativo: bobina.ativo,
            principal: bobina.principal,
          }))
        : input.chapas;
      const formatosAtivos = formatos.filter(formato => formato.ativo);
      if (usaDadosChapa && (!input.espessuraMm || !input.densidadeKgM3 || formatosAtivos.length === 0))
        throw new Error("Para salvar uma chapa, informe espessura, densidade e ao menos um formato ativo.");
      const perfilUsaAltura = formatoPerfilUsaAltura(input.perfilFormato);
      const perfilUsaEspessura = formatoPerfilUsaEspessura(input.perfilFormato);
      if (usaDadosPerfil && (!input.densidadeKgM3 || (perfilUsaAltura && !input.perfilAlturaMm) || !input.perfilLarguraMm || !input.perfilComprimentoMm || (perfilUsaEspessura && !input.espessuraMm)))
        throw new Error(`Para salvar este perfil, informe ${[perfilUsaAltura ? "altura" : "diâmetro (largura)", perfilUsaAltura ? "largura" : null, perfilUsaEspessura ? "espessura" : null, "comprimento", "densidade"].filter(Boolean).join(", ")}.`);
      if (usaDadosPerfil && perfilSecaoInvalida(input))
        throw new Error("As medidas do perfil não formam uma seção válida (confira se a espessura cabe na altura/largura).");
      if (usaDadosBobina && !input.espessuraMm)
        throw new Error("Para salvar uma bobina, informe a espessura.");
      if (usaDadosBobina && formatosAtivos.length === 0)
        throw new Error("Para salvar uma bobina, informe ao menos uma largura ativa.");
      if ((usaDadosChapa || usaDadosBobina) && formatos.filter(formato => formato.ativo && formato.principal).length > 1)
        throw new Error("Marque no máximo um formato principal.");
      const idsInformados = formatos.flatMap(formato => formato.id == null ? [] : [formato.id]);
      if (new Set(idsInformados).size !== idsInformados.length)
        throw new Error("Há formatos repetidos no formulário.");
      const dimensoes = formatos.map(formato => [Math.max(formato.larguraMm, formato.alturaMm), Math.min(formato.larguraMm, formato.alturaMm)].join("x"));
      if (new Set(dimensoes).size !== dimensoes.length)
        throw new Error(usaDadosBobina ? "Cada bobina precisa ter uma largura diferente." : "Cada formato precisa ter um tamanho diferente.");
      const usaFormatos = usaDadosChapa || usaDadosBobina;

      await db.transaction(async tx => {
        const existentes = await tx.select().from(estudioChapas)
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));
        const existentesPorId = new Map(existentes.map(chapa => [chapa.id, chapa]));
        for (const formato of formatos) {
          if (formato.id != null && !existentesPorId.has(formato.id))
            throw new Error("Um formato enviado não pertence a esta matéria-prima.");
        }

        const now = new Date();
        const pesoEspecificoSalvo = !usaDadosChapa && !usaDadosPerfil && input.pesoEspecificoKg != null ? String(input.pesoEspecificoKg) : null;
        const perfilSalvo = (valor: number | null) => usaDadosPerfil && valor != null ? String(valor) : null;
        const espessuraSalva = input.espessuraMm && (usaDadosChapa || usaDadosBobina || (usaDadosPerfil && perfilUsaEspessura)) ? String(input.espessuraMm) : null;
        await tx.insert(materiaPrimaCadastros).values({
          mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
          categoriaId: input.categoriaId,
          espessuraMm: espessuraSalva,
          densidadeKgM3: usaDadosChapa || usaDadosPerfil ? String(input.densidadeKgM3) : null,
          pesoEspecificoKg: pesoEspecificoSalvo,
          perfilFormato: usaDadosPerfil ? input.perfilFormato : "tubo",
          perfilAlturaMm: perfilSalvo(input.perfilAlturaMm),
          perfilLarguraMm: perfilSalvo(input.perfilLarguraMm),
          perfilComprimentoMm: perfilSalvo(input.perfilComprimentoMm),
          updatedAt: now,
        }).onConflictDoUpdate({
          target: materiaPrimaCadastros.mubisysMateriaPrimaId,
          set: {
            categoriaId: input.categoriaId,
            espessuraMm: espessuraSalva,
            densidadeKgM3: usaDadosChapa || usaDadosPerfil ? String(input.densidadeKgM3) : null,
            pesoEspecificoKg: pesoEspecificoSalvo,
            perfilFormato: usaDadosPerfil ? input.perfilFormato : "tubo",
            perfilAlturaMm: perfilSalvo(input.perfilAlturaMm),
            perfilLarguraMm: perfilSalvo(input.perfilLarguraMm),
            perfilComprimentoMm: perfilSalvo(input.perfilComprimentoMm),
            updatedAt: now,
          },
        });

        await tx.update(estudioChapas).set({ principal: false })
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));
        await tx.update(estudioChapas).set({ ativo: false, updatedAt: now })
          .where(eq(estudioChapas.mubisysMateriaPrimaId, input.mubisysMateriaPrimaId));

        const formatoPrincipal = formatosAtivos.find(formato => formato.principal) ?? formatosAtivos[0];
        for (const formato of formatos) {
          const larguraMm = Math.max(formato.larguraMm, formato.alturaMm);
          const alturaMm = Math.min(formato.larguraMm, formato.alturaMm);
          const existentePorTamanho = existentes.find(chapa => chapa.larguraMm === larguraMm && chapa.alturaMm === alturaMm);
          const id = existentePorTamanho?.id ?? formato.id;
          const cor = "pantoneCode" in formato ? formato : null;
          const values = {
            mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
            nome: formato.nome,
            larguraMm,
            alturaMm,
            bobina: usaDadosBobina,
            temCor: usaDadosChapa ? cor?.temCor ?? true : true,
            pantoneCode: usaDadosChapa && cor?.temCor !== false ? cor?.pantoneCode?.trim().toUpperCase() || null : null,
            cmykC: usaDadosChapa && cor?.temCor !== false && cor?.cmykC != null ? String(cor.cmykC) : null,
            cmykM: usaDadosChapa && cor?.temCor !== false && cor?.cmykM != null ? String(cor.cmykM) : null,
            cmykY: usaDadosChapa && cor?.temCor !== false && cor?.cmykY != null ? String(cor.cmykY) : null,
            cmykK: usaDadosChapa && cor?.temCor !== false && cor?.cmykK != null ? String(cor.cmykK) : null,
            transmissaoLuzPct: usaDadosChapa && cor?.temCor !== false && cor?.transmissaoLuzPct != null ? String(cor.transmissaoLuzPct) : null,
            transparenciaTipo: usaDadosChapa && cor?.temCor !== false ? cor?.transparenciaTipo ?? null : null,
            ativo: usaFormatos && formato.ativo,
            principal: usaFormatos && formato.ativo && formato === formatoPrincipal,
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
