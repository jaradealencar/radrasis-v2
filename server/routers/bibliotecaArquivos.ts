import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db/db";
import { bibliotecaArquivos, type BibliotecaArquivo } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

// Extrai texto de um arquivo via LLM (PDFs, imagens, TXT, outros)
async function extrairTextoArquivo(
  fileBase64: string,
  mimeType: string,
  fileName: string,
  nome: string,
  descricao?: string
): Promise<string | null> {
  try {
    const { invokeLLM } = await import("../_core/llm");
    const { storagePut } = await import("../db/storage");

    const isPdf = mimeType === "application/pdf";
    const isImage = mimeType.startsWith("image/");
    const isText = mimeType === "text/plain";

    if (isText) {
      return Buffer.from(fileBase64, "base64").toString("utf-8").slice(0, 50000);
    }

    if (isPdf || isImage) {
      // Fazer upload temporário para obter URL acessível pelo LLM
      const buffer = Buffer.from(fileBase64, "base64");
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempKey = `temp-extract/${Date.now()}-${safeFileName}`;
      const { url } = await storagePut(tempKey, buffer, mimeType);

      // Construir URL absoluta para o LLM
      const baseUrl = (process.env.BUILT_IN_FORGE_API_URL ?? "").replace("/api/forge", "");
      const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

      const contentItem = isPdf
        ? { type: "file_url" as const, file_url: { url: absoluteUrl, mime_type: "application/pdf" as const } }
        : { type: "image_url" as const, image_url: { url: absoluteUrl } };

      const response = await invokeLLM({
        messages: [{
          role: "user" as const,
          content: [
            contentItem,
            {
              type: "text" as const,
              text: `Extraia e transcreva TODO o conteúdo textual deste arquivo "${nome}". Inclua títulos, tabelas, listas e parágrafos. Retorne apenas o texto extraído, sem comentários adicionais.`,
            },
          ] as any,
        }],
      });
      return (response?.choices?.[0]?.message?.content as string | null) ?? null;
    }

    // Para outros tipos (Word, Excel, etc.) — gerar resumo baseado no nome/descrição
    const response = await invokeLLM({
      messages: [{
        role: "user",
        content: `Arquivo: "${nome}"\nTipo: ${mimeType}\nDescrição: ${descricao ?? "sem descrição"}\n\nEste arquivo foi adicionado à biblioteca de conhecimento da empresa Letreiros Express. Com base no nome e descrição, gere um resumo do que provavelmente contém este documento para uso como referência em consultas internas.`,
      }],
    });
    return (response?.choices?.[0]?.message?.content as string | null) ?? null;
  } catch (e) {
    console.error("[bibliotecaArquivos] Erro ao extrair texto:", e);
    return null;
  }
}

export const bibliotecaArquivosRouter = router({
  list: publicProcedure
    .input(z.object({
      categoria: z.string().optional(),
      busca: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(bibliotecaArquivos).orderBy(desc(bibliotecaArquivos.createdAt));
      return (rows as BibliotecaArquivo[]).filter((r) => {
        if (input?.categoria && input.categoria !== "Todos" && r.categoria !== input.categoria) return false;
        if (input?.busca) {
          const b = input.busca.toLowerCase();
          const match =
            r.nome.toLowerCase().includes(b) ||
            (r.descricao ?? "").toLowerCase().includes(b) ||
            (r.tags ?? "").toLowerCase().includes(b) ||
            (r.subcategoria ?? "").toLowerCase().includes(b) ||
            r.fileName.toLowerCase().includes(b) ||
            (r.conteudoExtraido ?? "").toLowerCase().includes(b);
          if (!match) return false;
        }
        return true;
      });
    }),

  categorias: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ categoria: bibliotecaArquivos.categoria })
      .from(bibliotecaArquivos)
      .groupBy(bibliotecaArquivos.categoria)
      .orderBy(bibliotecaArquivos.categoria);
    return rows.map((r) => r.categoria);
  }),

  upload: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      categoria: z.string().min(1),
      subcategoria: z.string().optional(),
      tags: z.string().optional(),
      fileName: z.string().min(1),
      fileBase64: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().int().nonnegative(),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("../db/storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `biblioteca-arquivos/${Date.now()}-${safeFileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Extrair texto do arquivo via LLM
      const conteudoExtraido = await extrairTextoArquivo(
        input.fileBase64,
        input.mimeType,
        input.fileName,
        input.nome,
        input.descricao
      );

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(bibliotecaArquivos).values({
        nome: input.nome,
        descricao: input.descricao ?? null,
        categoria: input.categoria,
        subcategoria: input.subcategoria ?? null,
        tags: input.tags ?? null,
        fileKey: key,
        fileUrl: url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedBy: input.uploadedBy ?? null,
        visualizacoes: 0,
        conteudoExtraido: conteudoExtraido ?? null,
      }).returning({ id: bibliotecaArquivos.id });
      return { success: true, id: result.id, conteudoExtraido: !!conteudoExtraido };
    }),

  // Re-extrair texto de um arquivo já existente (para arquivos enviados antes desta feature)
  reextrairTexto: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [arquivo] = await db.select().from(bibliotecaArquivos).where(eq(bibliotecaArquivos.id, input.id));
      if (!arquivo) throw new Error("Arquivo não encontrado");

      const { storageGet } = await import("../db/storage");
      const { url } = await storageGet(arquivo.fileKey);
      const baseUrl = (process.env.BUILT_IN_FORGE_API_URL ?? "").replace("/api/forge", "");
      const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

      const { invokeLLM } = await import("../_core/llm");
      let conteudoExtraido: string | null = null;

      if (arquivo.mimeType === "application/pdf") {
        const response = await invokeLLM({
          messages: [{
            role: "user" as const,
            content: [
              { type: "file_url" as const, file_url: { url: absoluteUrl, mime_type: "application/pdf" as const } },
              { type: "text" as const, text: `Extraia e transcreva TODO o conteúdo textual deste arquivo "${arquivo.nome}". Retorne apenas o texto extraído.` },
            ] as any,
          }],
        });
        conteudoExtraido = (response?.choices?.[0]?.message?.content as string | null) ?? null;
      } else {
        const response = await invokeLLM({
          messages: [{
            role: "user",
            content: `Arquivo: "${arquivo.nome}"\nTipo: ${arquivo.mimeType}\nDescrição: ${arquivo.descricao ?? "sem descrição"}\n\nGere um resumo do conteúdo provável deste documento para uso como referência em consultas internas da empresa Letreiros Express.`,
          }],
        });
        conteudoExtraido = (response?.choices?.[0]?.message?.content as string | null) ?? null;
      }

      await db.update(bibliotecaArquivos).set({ conteudoExtraido }).where(eq(bibliotecaArquivos.id, input.id));
      return { success: true, conteudoExtraido: !!conteudoExtraido };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      nome: z.string().min(1).optional(),
      descricao: z.string().optional(),
      categoria: z.string().optional(),
      subcategoria: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(bibliotecaArquivos).set(data).where(eq(bibliotecaArquivos.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(bibliotecaArquivos).where(eq(bibliotecaArquivos.id, input.id));
      return { success: true };
    }),

  incrementView: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(bibliotecaArquivos)
        .set({ visualizacoes: sql`${bibliotecaArquivos.visualizacoes} + 1` })
        .where(eq(bibliotecaArquivos.id, input.id));
      return { success: true };
    }),

  stats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalArquivos: 0, totalVisualizacoes: 0, totalSize: 0, porCategoria: {} };
    const rows = await db.select().from(bibliotecaArquivos);
    const totalArquivos = rows.length;
    const totalVisualizacoes = rows.reduce((acc: number, r: BibliotecaArquivo) => acc + (r.visualizacoes ?? 0), 0);
    const totalSize = rows.reduce((acc: number, r: BibliotecaArquivo) => acc + (r.fileSize ?? 0), 0);
    const porCategoria = rows.reduce((acc: Record<string, number>, r: BibliotecaArquivo) => {
      acc[r.categoria] = (acc[r.categoria] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalArquivos, totalVisualizacoes, totalSize, porCategoria };
  }),
});
