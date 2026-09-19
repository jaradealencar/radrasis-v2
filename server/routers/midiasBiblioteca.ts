import { z } from "zod";
import { asc, desc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { midiasBiblioteca, midiasGalerias } from "../../drizzle/schema";
import { validarPngBase64 } from "./whatsappImagem";

/**
 * Biblioteca de mídias do CRM: o "arsenal" de imagens que a equipe copia (para a área de
 * transferência) e cola nas conversas de WhatsApp, organizado em galerias. A listagem devolve só
 * metadados e a miniatura; a imagem inteira (PNG em base64) só é buscada na hora de copiar ou
 * ampliar (`getImagem`).
 */

/** Teto de itens e de bytes guardados no banco (imagens ficam em base64 numa coluna de texto). */
export const MAX_ITENS_BIBLIOTECA = 150;
export const MAX_BYTES_BIBLIOTECA = 250_000_000;
export const MAX_GALERIAS = 30;
/** A miniatura tem ~240px; este teto (≈110 KB) barra qualquer coisa fora do previsto. */
export const LIMITE_MINIATURA_CHARS = 150_000;

const REGEX_MINIATURA = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

export type ResultadoValidacaoMiniatura = { ok: true } | { ok: false; motivo: string };

/** Confere que a miniatura é um data URL de JPEG/PNG de verdade e pequeno. */
export function validarMiniatura(dataUrl: string): ResultadoValidacaoMiniatura {
  if (dataUrl.length > LIMITE_MINIATURA_CHARS) return { ok: false, motivo: "Miniatura grande demais." };
  const m = REGEX_MINIATURA.exec(dataUrl);
  if (!m) return { ok: false, motivo: "Miniatura inválida." };
  const inicio = Buffer.from(m[2].slice(0, 16), "base64");
  const ehJpeg = m[1] === "jpeg" && inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff;
  const ehPng = m[1] === "png" && inicio.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (!ehJpeg && !ehPng) return { ok: false, motivo: "Miniatura inválida." };
  return { ok: true };
}

/** "Promoções" e "promocoes " contam como o mesmo nome de galeria. */
export function chaveNomeGaleria(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

const titulo = z.string().trim().min(1, "Dê um título à imagem.").max(160);
const nomeGaleria = z.string().trim().min(1, "Dê um nome à galeria.").max(60, "Nome de galeria muito longo (máximo 60 letras).");
const galeriaIdOpcional = z.number().int().nullable().optional();

export const midiasBibliotecaRouter = router({
  /** Metadados + miniatura de todas as imagens (sem o arquivo inteiro) e as galerias. */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    const vazio = { itens: [], galerias: [], totalBytes: 0, limiteItens: MAX_ITENS_BIBLIOTECA, limiteBytes: MAX_BYTES_BIBLIOTECA, limiteGalerias: MAX_GALERIAS };
    if (!db) return vazio;
    const itens = await db.select({
      id: midiasBiblioteca.id,
      titulo: midiasBiblioteca.titulo,
      galeriaId: midiasBiblioteca.galeriaId,
      nomeArquivo: midiasBiblioteca.nomeArquivo,
      miniatura: midiasBiblioteca.miniatura,
      tamanhoBytes: midiasBiblioteca.tamanhoBytes,
      largura: midiasBiblioteca.largura,
      altura: midiasBiblioteca.altura,
      usos: midiasBiblioteca.usos,
      criadoPor: midiasBiblioteca.usuarioNome,
      criadoEm: midiasBiblioteca.createdAt,
    }).from(midiasBiblioteca).orderBy(desc(midiasBiblioteca.createdAt));
    const galerias = await db.select({ id: midiasGalerias.id, nome: midiasGalerias.nome })
      .from(midiasGalerias).orderBy(asc(midiasGalerias.ordem), asc(midiasGalerias.nome));
    const totalBytes = itens.reduce((soma, i) => soma + i.tamanhoBytes, 0);
    return { ...vazio, itens, galerias, totalBytes };
  }),

  /** Imagem inteira (PNG) para copiar ou ampliar. */
  getImagem: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [linha] = await db.select({ base64: midiasBiblioteca.base64, titulo: midiasBiblioteca.titulo })
        .from(midiasBiblioteca).where(eq(midiasBiblioteca.id, input.id)).limit(1);
      if (!linha) throw new Error("Imagem não encontrada (talvez tenha sido excluída).");
      return { dataUrl: `data:image/png;base64,${linha.base64}`, titulo: linha.titulo };
    }),

  /** Adiciona uma imagem (o navegador manda o PNG já reduzido e a miniatura) a uma galeria. */
  add: protectedProcedure
    .input(z.object({
      titulo,
      galeriaId: galeriaIdOpcional,
      nomeArquivo: z.string().trim().min(1).max(200),
      base64: z.string().min(100),
      miniatura: z.string().min(50),
    }))
    .mutation(async ({ input, ctx }) => {
      const png = validarPngBase64(input.base64);
      if (!png.ok) throw new Error(png.motivo);
      const mini = validarMiniatura(input.miniatura);
      if (!mini.ok) throw new Error(mini.motivo);

      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [uso] = await db.select({
        n: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${midiasBiblioteca.tamanhoBytes}), 0)::float8`,
      }).from(midiasBiblioteca);
      if ((uso?.n ?? 0) >= MAX_ITENS_BIBLIOTECA) {
        throw new Error(`A biblioteca chegou ao limite de ${MAX_ITENS_BIBLIOTECA} imagens. Exclua alguma para adicionar outra.`);
      }
      if ((uso?.total ?? 0) + png.tamanhoBytes > MAX_BYTES_BIBLIOTECA) {
        throw new Error("A biblioteca está cheia (limite de espaço). Exclua imagens que não usa mais.");
      }
      if (input.galeriaId != null) {
        const [g] = await db.select({ id: midiasGalerias.id }).from(midiasGalerias)
          .where(eq(midiasGalerias.id, input.galeriaId)).limit(1);
        if (!g) throw new Error("Essa galeria não existe mais. Atualize a página e escolha outra.");
      }

      const [criada] = await db.insert(midiasBiblioteca).values({
        titulo: input.titulo,
        galeriaId: input.galeriaId ?? null,
        nomeArquivo: input.nomeArquivo,
        base64: input.base64,
        miniatura: input.miniatura,
        tamanhoBytes: png.tamanhoBytes,
        largura: png.largura,
        altura: png.altura,
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? "Desconhecido",
      }).returning({ id: midiasBiblioteca.id });
      return { ok: true, id: criada.id };
    }),

  /** Renomeia e/ou move para outra galeria (`galeriaId: null` = sem galeria; omitido = não muda). */
  update: protectedProcedure
    .input(z.object({ id: z.number().int(), titulo, galeriaId: galeriaIdOpcional }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(midiasBiblioteca)
        .set({
          titulo: input.titulo,
          ...(input.galeriaId !== undefined ? { galeriaId: input.galeriaId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(midiasBiblioteca.id, input.id));
      return { ok: true };
    }),

  /** Conta uma cópia (para saber quais imagens a equipe mais usa). */
  registrarUso: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.update(midiasBiblioteca)
        .set({ usos: sql`${midiasBiblioteca.usos} + 1` })
        .where(eq(midiasBiblioteca.id, input.id));
      return { ok: true };
    }),

  remover: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(midiasBiblioteca).where(eq(midiasBiblioteca.id, input.id));
      return { ok: true };
    }),

  // ─── Galerias ──────────────────────────────────────────────────────────────

  criarGaleria: protectedProcedure
    .input(z.object({ nome: nomeGaleria }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const existentes = await db.select({ id: midiasGalerias.id, nome: midiasGalerias.nome }).from(midiasGalerias);
      if (existentes.length >= MAX_GALERIAS) throw new Error(`Limite de ${MAX_GALERIAS} galerias atingido.`);
      if (existentes.some(g => chaveNomeGaleria(g.nome) === chaveNomeGaleria(input.nome))) {
        throw new Error(`Já existe uma galeria chamada "${input.nome}".`);
      }
      const [criada] = await db.insert(midiasGalerias)
        .values({ nome: input.nome, ordem: existentes.length })
        .returning({ id: midiasGalerias.id });
      return { ok: true, id: criada.id };
    }),

  renomearGaleria: protectedProcedure
    .input(z.object({ id: z.number().int(), nome: nomeGaleria }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const existentes = await db.select({ id: midiasGalerias.id, nome: midiasGalerias.nome }).from(midiasGalerias);
      if (existentes.some(g => g.id !== input.id && chaveNomeGaleria(g.nome) === chaveNomeGaleria(input.nome))) {
        throw new Error(`Já existe uma galeria chamada "${input.nome}".`);
      }
      await db.update(midiasGalerias).set({ nome: input.nome }).where(eq(midiasGalerias.id, input.id));
      return { ok: true };
    }),

  /** Apaga a galeria; as imagens NÃO são apagadas — voltam para "Sem galeria". */
  excluirGaleria: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(midiasBiblioteca).set({ galeriaId: null }).where(eq(midiasBiblioteca.galeriaId, input.id));
      await db.delete(midiasGalerias).where(eq(midiasGalerias.id, input.id));
      return { ok: true };
    }),
});
