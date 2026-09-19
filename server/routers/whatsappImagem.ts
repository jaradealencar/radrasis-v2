import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { whatsappImagem } from "../../drizzle/schema";

/**
 * Imagem que acompanha a mensagem padrão do botão de WhatsApp do relatório de propostas de
 * alto valor. O navegador copia a imagem para a área de transferência no clique e o usuário
 * cola (Ctrl+V) na conversa — o WhatsApp não aceita anexo por link.
 *
 * Sem linha no banco, o front usa a imagem padrão empacotada (client/public/whatsapp); a
 * linha só existe depois que alguém troca a imagem pelo painel.
 */

/** Chave da imagem do relatório de propostas (a tabela comporta outras imagens no futuro). */
export const CHAVE_IMAGEM_PROPOSTAS = "propostas_alto_valor";

/** O corpo da requisição na Vercel é limitado a 4,5 MB e o base64 infla ~33%. O front já
 * reduz a imagem para ~2,4 MB; este teto (≈3 MB de PNG) é a segunda barreira. */
export const LIMITE_BASE64_CHARS = 4_000_000;

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type ResultadoValidacaoPng =
  | { ok: true; tamanhoBytes: number; largura: number; altura: number }
  | { ok: false; motivo: string };

/** Confere que o base64 é mesmo um PNG e lê largura/altura do cabeçalho (IHDR) — não confia
 * no que o navegador diz. A área de transferência só aceita PNG, por isso nada além disso. */
export function validarPngBase64(base64: string): ResultadoValidacaoPng {
  if (base64.length > LIMITE_BASE64_CHARS) {
    return { ok: false, motivo: "Imagem grande demais (máximo ~3 MB depois de reduzida)." };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { ok: false, motivo: "Conteúdo da imagem inválido." };
  }
  const cabecalho = Buffer.from(base64.slice(0, 44), "base64"); // 33 bytes: assinatura + IHDR
  if (cabecalho.length < 24 || !cabecalho.subarray(0, 8).equals(ASSINATURA_PNG)) {
    return { ok: false, motivo: "O arquivo não é um PNG válido." };
  }
  if (cabecalho.subarray(12, 16).toString("ascii") !== "IHDR") {
    return { ok: false, motivo: "O arquivo não é um PNG válido." };
  }
  const largura = cabecalho.readUInt32BE(16);
  const altura = cabecalho.readUInt32BE(20);
  if (largura < 1 || altura < 1 || largura > 8000 || altura > 8000) {
    return { ok: false, motivo: "Dimensões da imagem fora do permitido." };
  }
  const preenchimento = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const tamanhoBytes = Math.floor((base64.length * 3) / 4) - preenchimento;
  return { ok: true, tamanhoBytes, largura, altura };
}

export const whatsappImagemRouter = router({
  /** Imagem em uso pelo relatório de propostas. `personalizada: false` = usar a padrão empacotada. */
  get: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { personalizada: false as const };
    const [linha] = await db.select().from(whatsappImagem)
      .where(eq(whatsappImagem.chave, CHAVE_IMAGEM_PROPOSTAS)).limit(1);
    if (!linha) return { personalizada: false as const };
    return {
      personalizada: true as const,
      nomeArquivo: linha.nomeArquivo,
      dataUrl: `data:image/png;base64,${linha.base64}`,
      largura: linha.largura,
      altura: linha.altura,
      tamanhoBytes: linha.tamanhoBytes,
      atualizadoEm: linha.updatedAt,
      atualizadoPor: linha.usuarioNome,
    };
  }),

  /** Troca a imagem (o front manda um PNG já reduzido). */
  set: protectedProcedure
    .input(z.object({
      nomeArquivo: z.string().trim().min(1).max(200),
      base64: z.string().min(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const validacao = validarPngBase64(input.base64);
      if (!validacao.ok) throw new Error(validacao.motivo);
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const agora = new Date();
      const dados = {
        nomeArquivo: input.nomeArquivo,
        base64: input.base64,
        tamanhoBytes: validacao.tamanhoBytes,
        largura: validacao.largura,
        altura: validacao.altura,
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? "Desconhecido",
        updatedAt: agora,
      };
      await db.insert(whatsappImagem)
        .values({ chave: CHAVE_IMAGEM_PROPOSTAS, ...dados })
        .onConflictDoUpdate({ target: whatsappImagem.chave, set: dados });
      return { ok: true, tamanhoBytes: validacao.tamanhoBytes, largura: validacao.largura, altura: validacao.altura };
    }),

  /** Volta para a imagem padrão empacotada (apaga a personalizada). */
  restaurarPadrao: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    await db.delete(whatsappImagem).where(eq(whatsappImagem.chave, CHAVE_IMAGEM_PROPOSTAS));
    return { ok: true };
  }),
});
