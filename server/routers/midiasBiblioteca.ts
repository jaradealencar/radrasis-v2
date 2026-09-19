import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { midiasBiblioteca } from "../../drizzle/schema";
import { validarPngBase64 } from "./whatsappImagem";

/**
 * Biblioteca de mídias do CRM: o "arsenal" de imagens que a equipe copia (para a área de
 * transferência) e cola nas conversas de WhatsApp. A listagem devolve só metadados e a miniatura;
 * a imagem inteira (PNG em base64) só é buscada na hora de copiar ou ampliar (`getImagem`).
 */

/** Teto de itens e de bytes guardados no banco (imagens ficam em base64 numa coluna de texto). */
export const MAX_ITENS_BIBLIOTECA = 150;
export const MAX_BYTES_BIBLIOTECA = 250_000_000;
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

const titulo = z.string().trim().min(1, "Dê um título à imagem.").max(160);
const categoria = z.string().trim().max(64).optional().nullable().transform(v => (v ? v : null));

export const midiasBibliotecaRouter = router({
  /** Metadados + miniatura de todas as imagens (sem o arquivo inteiro), mais recentes primeiro. */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { itens: [], totalBytes: 0, limiteItens: MAX_ITENS_BIBLIOTECA, limiteBytes: MAX_BYTES_BIBLIOTECA };
    const itens = await db.select({
      id: midiasBiblioteca.id,
      titulo: midiasBiblioteca.titulo,
      categoria: midiasBiblioteca.categoria,
      nomeArquivo: midiasBiblioteca.nomeArquivo,
      miniatura: midiasBiblioteca.miniatura,
      tamanhoBytes: midiasBiblioteca.tamanhoBytes,
      largura: midiasBiblioteca.largura,
      altura: midiasBiblioteca.altura,
      usos: midiasBiblioteca.usos,
      criadoPor: midiasBiblioteca.usuarioNome,
      criadoEm: midiasBiblioteca.createdAt,
    }).from(midiasBiblioteca).orderBy(desc(midiasBiblioteca.createdAt));
    const totalBytes = itens.reduce((soma, i) => soma + i.tamanhoBytes, 0);
    return { itens, totalBytes, limiteItens: MAX_ITENS_BIBLIOTECA, limiteBytes: MAX_BYTES_BIBLIOTECA };
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

  /** Adiciona uma imagem (o navegador manda o PNG já reduzido e a miniatura). */
  add: protectedProcedure
    .input(z.object({
      titulo,
      categoria,
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

      const [criada] = await db.insert(midiasBiblioteca).values({
        titulo: input.titulo,
        categoria: input.categoria,
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

  /** Renomeia / troca a categoria. */
  update: protectedProcedure
    .input(z.object({ id: z.number().int(), titulo, categoria }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(midiasBiblioteca)
        .set({ titulo: input.titulo, categoria: input.categoria, updatedAt: new Date() })
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
});
