import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import {
  estudioChapas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
} from "../../drizzle/schema";
import { formatoPerfilUsaAltura, formatoPerfilUsaEspessura, PERFIL_FORMATOS, secaoPerfilMm2, type FormatoPerfil, normalizarFormatoPerfil } from "@shared/peso";
import { listaPantoneValida, normalizarListaPantone } from "@shared/pantone-referencia";
import { BOBINA_COMPRIMENTO_MAXIMO_MM, BOBINA_CUSTO_BASES, BOBINA_LARGURA_MINIMA_MM } from "@shared/bobina";
import { ehProcessoCorte, normalizarRotacao, PROCESSOS_CORTE, ROTACOES_PERMITIDAS } from "@shared/politica-corte";
import { ehCategoriaProdutividade, ehMateriaProdutividade, erroMateriaisSolda, erroTamanhosProdutividade, erroTiposSolda, MATERIAIS_SOLDA, normalizarMateriaisSolda, normalizarTamanhosProdutividade, normalizarTiposSolda, TAMANHOS_PRODUTIVIDADE, TIPOS_SOLDA } from "@shared/produtividade-solda";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { statusCadastroDeLinhas } from "../services/cpqCadastroMateria";
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
  pantoneCode: z.string().trim().max(200).nullable().optional().refine(valor => valor == null || listaPantoneValida(valor), { message: "Informe até 6 referências Pantone de até 30 caracteres cada." }),
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

const texturaUploadUrlValida = (url: string | null) => {
  if (url == null) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ["ufs.sh", "utfs.io", "uploadthing.com"].some(dominio => hostname === dominio || hostname.endsWith("." + dominio));
  } catch {
    return false;
  }
};

export const materiasPrimasRouter = router({
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [catalogo, cadastros, categorias, chapas] = await Promise.all([
      listarMateriasPrimas(),
      db.select().from(materiaPrimaCadastros),
      db.select().from(materiaPrimaCategorias).orderBy(asc(materiaPrimaCategorias.nome)),
      db.select().from(estudioChapas).orderBy(asc(estudioChapas.larguraMm), asc(estudioChapas.alturaMm), asc(estudioChapas.id)),
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
        const situacao = statusCadastroDeLinhas(categoria, cadastro, chapasPorId.get(material.id) ?? []);
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
          statusCadastro: situacao.status,
          pendenciasCadastro: situacao.pendencias,
          processoCorte: ehProcessoCorte(cadastro?.processoCorte) ? cadastro!.processoCorte : null,
          rotacaoPermitida: normalizarRotacao(cadastro?.rotacaoPermitida),
          espacamentoMm: cadastro?.espacamentoMm == null ? null : Number(cadastro.espacamentoMm),
          margemBordaMm: cadastro?.margemBordaMm == null ? null : Number(cadastro.margemBordaMm),
          bobinaCustoBase: (BOBINA_CUSTO_BASES as readonly string[]).includes(cadastro?.bobinaCustoBase ?? "") ? (cadastro!.bobinaCustoBase as (typeof BOBINA_CUSTO_BASES)[number]) : null,
          bobinaComprimentoRoloMm: cadastro?.bobinaComprimentoRoloMm == null ? null : Number(cadastro.bobinaComprimentoRoloMm),
          categoriaUsaDadosPerfil: categoria?.usaDadosPerfil ?? false,
          espessuraMm: cadastro?.espessuraMm == null ? null : Number(cadastro.espessuraMm),
          densidadeKgM3: cadastro?.densidadeKgM3 == null ? null : Number(cadastro.densidadeKgM3),
          pesoEspecificoKg: cadastro?.pesoEspecificoKg == null ? null : Number(cadastro.pesoEspecificoKg),
          perfilFormato: normalizarFormatoPerfil(cadastro?.perfilFormato),
          perfilAlturaMm: cadastro?.perfilAlturaMm == null ? null : Number(cadastro.perfilAlturaMm),
          perfilLarguraMm: cadastro?.perfilLarguraMm == null ? null : Number(cadastro.perfilLarguraMm),
          perfilComprimentoMm: cadastro?.perfilComprimentoMm == null ? null : Number(cadastro.perfilComprimentoMm),
          ehProdutividade: ehMateriaProdutividade(material.nome),
          aparenciaModo: cadastro?.aparenciaModo ?? "nao_informada",
          aparenciaCorHex: cadastro?.aparenciaCorHex ?? null,
          aparenciaCorDescricao: cadastro?.aparenciaCorDescricao ?? null,
          texturaImagemUrl: cadastro?.texturaImagemUrl ?? null,
          texturaImagemKey: cadastro?.texturaImagemKey ?? null,
          texturaDescricao: cadastro?.texturaDescricao ?? null,
          renderTransparenciaTipo: cadastro?.renderTransparenciaTipo ?? null,
          renderTransmissaoLuzPct: cadastro?.renderTransmissaoLuzPct == null ? null : Number(cadastro.renderTransmissaoLuzPct),
          produtividadeTiposSolda: normalizarTiposSolda(cadastro?.produtividadeTiposSolda),
          produtividadeTamanhos: normalizarTamanhosProdutividade(cadastro?.produtividadeTamanhos),
          produtividadeMateriais: normalizarMateriaisSolda(cadastro?.produtividadeMateriais),
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

  produtividadeClassificacaoSalvar: gestorCadastroProcedure
    .input(z.object({
      mubisysMateriaPrimaId: z.number().int().positive(),
      produtividadeTiposSolda: z.array(z.enum(TIPOS_SOLDA)),
      produtividadeTamanhos: z.array(z.enum(TAMANHOS_PRODUTIVIDADE)),
      produtividadeMateriais: z.array(z.enum(MATERIAIS_SOLDA)),
    }).strict())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const catalogo = await listarMateriasPrimas();
      const material = catalogo.find(item => item.id === input.mubisysMateriaPrimaId);
      if (!material || !ehMateriaProdutividade(material.nome))
        throw new Error("Esta materia-prima nao e uma produtividade de solda do catalogo atual do MubiSys.");
      const erroSolda = erroTiposSolda(input.produtividadeTiposSolda);
      if (erroSolda) throw new Error(erroSolda);
      const erroMateriais = erroMateriaisSolda(input.produtividadeMateriais);
      if (erroMateriais) throw new Error(erroMateriais);
      const erroTamanhos = erroTamanhosProdutividade(input.produtividadeTamanhos);
      if (erroTamanhos) throw new Error(erroTamanhos);
      const now = new Date();
      await db.insert(materiaPrimaCadastros).values({
        mubisysMateriaPrimaId: material.id,
        produtividadeTiposSolda: normalizarTiposSolda(input.produtividadeTiposSolda),
        produtividadeTamanhos: normalizarTamanhosProdutividade(input.produtividadeTamanhos),
        produtividadeMateriais: normalizarMateriaisSolda(input.produtividadeMateriais),
        updatedAt: now,
      }).onConflictDoUpdate({
        target: materiaPrimaCadastros.mubisysMateriaPrimaId,
        set: {
          produtividadeTiposSolda: normalizarTiposSolda(input.produtividadeTiposSolda),
          produtividadeTamanhos: normalizarTamanhosProdutividade(input.produtividadeTamanhos),
          produtividadeMateriais: normalizarMateriaisSolda(input.produtividadeMateriais),
          updatedAt: now,
        },
      });
      return { success: true };
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
      bobinaCustoBase: z.enum(BOBINA_CUSTO_BASES).nullable().default(null),
      bobinaComprimentoRoloMm: z.number().finite().positive().max(10_000_000).nullable().default(null),
      // Política de corte (só chapa): processo, rotação permitida e espaçamento/margem próprios (nulo = padrão do processo/orçamento).
      processoCorte: z.enum(PROCESSOS_CORTE).nullable().default(null),
      rotacaoPermitida: z.enum(ROTACOES_PERMITIDAS).default("livre"),
      espacamentoMm: z.number().finite().min(0).max(50).nullable().default(null),
      margemBordaMm: z.number().finite().min(0).max(50).nullable().default(null),
      // Só matérias-primas "Produtividade …" (exceto "Produtividade Geral …"): até 3 tipos de solda, o tamanho e os materiais. Ignorados nas demais.
      produtividadeTiposSolda: z.array(z.enum(TIPOS_SOLDA)).default([]),
      produtividadeTamanhos: z.array(z.enum(TAMANHOS_PRODUTIVIDADE)).default([]),
      produtividadeMateriais: z.array(z.enum(MATERIAIS_SOLDA)).default([]),
      aparenciaModo: z.enum(["nao_informada", "cor", "textura"]).default("nao_informada"),
      aparenciaCorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
      aparenciaCorDescricao: z.string().trim().max(500).nullable().default(null),
      texturaImagemUrl: z.string().trim().url().max(2048).nullable().default(null).refine(texturaUploadUrlValida, { message: "A imagem precisa estar no armazenamento seguro do sistema." }),
      texturaImagemKey: z.string().trim().min(1).max(255).nullable().default(null),
      texturaDescricao: z.string().trim().max(2000).nullable().default(null),
      renderTransparenciaTipo: z.enum(["opaca", "translucida", "transparente"]).nullable().default(null),
      renderTransmissaoLuzPct: z.number().finite().min(0).max(100).nullable().default(null),
    }).strict().superRefine((input, context) => {
      if ((input.texturaImagemUrl == null) !== (input.texturaImagemKey == null))
        context.addIssue({ code: "custom", message: "A referência da imagem está incompleta.", path: ["texturaImagemUrl"] });
      if (input.aparenciaModo === "textura" && (!input.texturaImagemUrl || !input.texturaImagemKey || !input.texturaDescricao))
        context.addIssue({ code: "custom", message: "Para usar textura, informe imagem e descrição.", path: ["texturaDescricao"] });
      if (input.aparenciaModo === "cor" && !input.aparenciaCorHex && !input.aparenciaCorDescricao)
        context.addIssue({ code: "custom", message: "Para usar cor, informe um código HEX ou uma descrição.", path: ["aparenciaCorHex"] });
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const catalogo = await listarMateriasPrimas();
      const material = catalogo.find(item => item.id === input.mubisysMateriaPrimaId);
      if (!material) throw new Error("A matéria-prima não está no catálogo atual do MubiSys.");
      const erroSolda = erroTiposSolda(input.produtividadeTiposSolda);
      if (erroSolda) throw new Error(erroSolda);
      const erroMateriais = erroMateriaisSolda(input.produtividadeMateriais);
      if (erroMateriais) throw new Error(erroMateriais);
      const erroTamanhos = erroTamanhosProdutividade(input.produtividadeTamanhos);
      if (erroTamanhos) throw new Error(erroTamanhos);
      const ehProdutividade = ehMateriaProdutividade(material.nome);
      const tiposSoldaSalvos = ehProdutividade ? normalizarTiposSolda(input.produtividadeTiposSolda) : [];
      const tamanhosProdutividadeSalvos = ehProdutividade ? normalizarTamanhosProdutividade(input.produtividadeTamanhos) : [];
      const materiaisSoldaSalvos = ehProdutividade ? normalizarMateriaisSolda(input.produtividadeMateriais) : [];

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
      if (usaDadosBobina && !input.bobinaCustoBase)
        throw new Error("Para salvar uma bobina, informe como o custo do MubiSys é cobrado (m², metro linear ou rolo).");
      if (usaDadosBobina && input.bobinaCustoBase === "rolo" && !input.bobinaComprimentoRoloMm)
        throw new Error("Bobina cobrada por rolo precisa do comprimento do rolo (mm).");
      if (usaDadosBobina && !input.espessuraMm)
        throw new Error("Para salvar uma bobina, informe a espessura.");
      if (usaDadosBobina && !input.densidadeKgM3)
        throw new Error("Para salvar uma bobina, informe a densidade (g/cm³): é ela que permite calcular o peso do letreiro.");
      if (usaDadosBobina && formatosAtivos.length === 0)
        throw new Error("Para salvar uma bobina, informe ao menos uma largura ativa.");
      if ((usaDadosChapa || usaDadosBobina) && formatos.filter(formato => formato.ativo && formato.principal).length > 1)
        throw new Error("Marque no máximo um formato principal.");
      const idsInformados = formatos.flatMap(formato => formato.id == null ? [] : [formato.id]);
      if (new Set(idsInformados).size !== idsInformados.length)
        throw new Error("Há formatos repetidos no formulário.");
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
        const bobinaCustoBaseSalva = usaDadosBobina ? input.bobinaCustoBase : null;
        const bobinaComprimentoRoloSalvo = usaDadosBobina && input.bobinaCustoBase === "rolo" && input.bobinaComprimentoRoloMm != null ? String(input.bobinaComprimentoRoloMm) : null;
        // Mão de obra (produtividade de solda) não pesa: o campo nem aparece na tela e o servidor também o ignora.
        const maoDeObra = ehProdutividade || ehCategoriaProdutividade(categoria?.nome);
        const pesoEspecificoSalvo = !maoDeObra && !usaDadosChapa && !usaDadosPerfil && !usaDadosBobina && input.pesoEspecificoKg != null ? String(input.pesoEspecificoKg) : null;
        const perfilSalvo = (valor: number | null) => usaDadosPerfil && valor != null ? String(valor) : null;
        const usaCorte = usaDadosChapa;
        const processoSalvo = usaCorte ? input.processoCorte : null;
        const rotacaoSalva = usaCorte ? input.rotacaoPermitida : "livre";
        const espacamentoSalvo = usaCorte && input.espacamentoMm != null ? String(input.espacamentoMm) : null;
        const margemSalva = usaCorte && input.margemBordaMm != null ? String(input.margemBordaMm) : null;
        const aparenciaModoSalva = input.aparenciaModo;
        const aparenciaCorHexSalva = aparenciaModoSalva === "cor" ? input.aparenciaCorHex : null;
        const aparenciaCorDescricaoSalva = aparenciaModoSalva === "cor" ? input.aparenciaCorDescricao : null;
        const texturaImagemUrlSalva = aparenciaModoSalva === "textura" ? input.texturaImagemUrl : null;
        const texturaImagemKeySalva = aparenciaModoSalva === "textura" ? input.texturaImagemKey : null;
        const texturaDescricaoSalva = aparenciaModoSalva === "textura" ? input.texturaDescricao : null;
        const renderTransmissaoLuzPctSalva = input.renderTransmissaoLuzPct == null ? null : String(input.renderTransmissaoLuzPct);
        const espessuraSalva = input.espessuraMm && (usaDadosChapa || usaDadosBobina || (usaDadosPerfil && perfilUsaEspessura)) ? String(input.espessuraMm) : null;
        await tx.insert(materiaPrimaCadastros).values({
          mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
          categoriaId: input.categoriaId,
          espessuraMm: espessuraSalva,
          densidadeKgM3: usaDadosChapa || usaDadosPerfil || usaDadosBobina ? String(input.densidadeKgM3) : null,
          pesoEspecificoKg: pesoEspecificoSalvo,
          perfilFormato: usaDadosPerfil ? input.perfilFormato : "tubo",
          perfilAlturaMm: perfilSalvo(input.perfilAlturaMm),
          perfilLarguraMm: perfilSalvo(input.perfilLarguraMm),
          perfilComprimentoMm: perfilSalvo(input.perfilComprimentoMm),
          bobinaCustoBase: bobinaCustoBaseSalva,
          bobinaComprimentoRoloMm: bobinaComprimentoRoloSalvo,
          processoCorte: processoSalvo,
          rotacaoPermitida: rotacaoSalva,
          espacamentoMm: espacamentoSalvo,
          margemBordaMm: margemSalva,
          produtividadeTiposSolda: tiposSoldaSalvos,
          produtividadeTamanhos: tamanhosProdutividadeSalvos,
          produtividadeMateriais: materiaisSoldaSalvos,
          aparenciaModo: aparenciaModoSalva,
          aparenciaCorHex: aparenciaCorHexSalva,
          aparenciaCorDescricao: aparenciaCorDescricaoSalva,
          texturaImagemUrl: texturaImagemUrlSalva,
          texturaImagemKey: texturaImagemKeySalva,
          texturaDescricao: texturaDescricaoSalva,
          renderTransparenciaTipo: input.renderTransparenciaTipo,
          renderTransmissaoLuzPct: renderTransmissaoLuzPctSalva,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: materiaPrimaCadastros.mubisysMateriaPrimaId,
          set: {
            categoriaId: input.categoriaId,
            espessuraMm: espessuraSalva,
            densidadeKgM3: usaDadosChapa || usaDadosPerfil || usaDadosBobina ? String(input.densidadeKgM3) : null,
            pesoEspecificoKg: pesoEspecificoSalvo,
            perfilFormato: usaDadosPerfil ? input.perfilFormato : "tubo",
            perfilAlturaMm: perfilSalvo(input.perfilAlturaMm),
            perfilLarguraMm: perfilSalvo(input.perfilLarguraMm),
            perfilComprimentoMm: perfilSalvo(input.perfilComprimentoMm),
            bobinaCustoBase: bobinaCustoBaseSalva,
            bobinaComprimentoRoloMm: bobinaComprimentoRoloSalvo,
            processoCorte: processoSalvo,
            rotacaoPermitida: rotacaoSalva,
            espacamentoMm: espacamentoSalvo,
            margemBordaMm: margemSalva,
            produtividadeTiposSolda: tiposSoldaSalvos,
            produtividadeTamanhos: tamanhosProdutividadeSalvos,
            produtividadeMateriais: materiaisSoldaSalvos,
            aparenciaModo: aparenciaModoSalva,
            aparenciaCorHex: aparenciaCorHexSalva,
            aparenciaCorDescricao: aparenciaCorDescricaoSalva,
            texturaImagemUrl: texturaImagemUrlSalva,
            texturaImagemKey: texturaImagemKeySalva,
            texturaDescricao: texturaDescricaoSalva,
            renderTransparenciaTipo: input.renderTransparenciaTipo,
            renderTransmissaoLuzPct: renderTransmissaoLuzPctSalva,
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
          // Dimensões podem se repetir em variações de cor; cada formato existente é atualizado pelo ID.
          const id = formato.id;
          const cor = "pantoneCode" in formato ? formato : null;
          const values = {
            mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
            nome: formato.nome,
            larguraMm,
            alturaMm,
            bobina: usaDadosBobina,
            temCor: usaDadosChapa ? cor?.temCor ?? true : true,
            pantoneCode: usaDadosChapa && cor?.temCor !== false ? normalizarListaPantone(cor?.pantoneCode) : null,
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
