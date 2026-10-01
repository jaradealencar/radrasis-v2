import express, { type Express, type Request, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "../_core/auth";
import { redesenharLetreiro, type EscopoRedesenho } from "../services/letraCaixaRedesign";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const imageBodyParser = express.raw({
  type: ["image/jpeg", "image/png"],
  limit: MAX_IMAGE_BYTES,
});

const inputSchema = z.object({
  escopo: z.enum(["somente_logo", "letreiro_completo", "elementos_selecionados"]),
  elementosSelecionados: z.string().trim().max(500).optional(),
});

/** Edição de imagem autenticada; a chave da OpenAI nunca sai do servidor. */
export function registrarRotasRedesenhoLetraCaixa(app: Express): void {
  app.post("/api/letra-caixa/redesenho", (req, res) => {
    imageBodyParser(req, res, (parseError) => {
      if (parseError) {
        const status = (parseError as { status?: number }).status ?? 400;
        res.status(status).json({
          error:
            status === 413
              ? "A foto ficou grande demais. Envie uma imagem menor que 4 MB."
              : "Não consegui ler a imagem. Envie JPG ou PNG.",
        });
        return;
      }

      void executarRedesenho(req, res);
    });
  });
}

async function executarRedesenho(req: Request, res: Response): Promise<void> {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        res.status(403).json({ error: "A solicitação precisa vir do próprio sistema." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Origem da solicitação inválida." });
      return;
    }
  }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!session) {
    res.status(401).json({ error: "Entre no sistema para gerar a reconstrução com GPT." });
    return;
  }

  const params = inputSchema.safeParse({
    escopo: req.query.escopo,
    elementosSelecionados: req.query.elementosSelecionados,
  });
  if (!params.success) {
    res.status(400).json({ error: "Selecione um escopo válido para a reconstrução." });
    return;
  }
  if (
    params.data.escopo === "elementos_selecionados" &&
    !params.data.elementosSelecionados
  ) {
    res.status(400).json({ error: "Descreva os elementos que o GPT deve reconstruir." });
    return;
  }

  const mimeType = req.get("content-type")?.split(";")[0].toLowerCase();
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
    res.status(415).json({ error: "Envie uma imagem JPG ou PNG." });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "A imagem enviada está vazia." });
    return;
  }

  try {
    const resultado = await redesenharLetreiro({
      imageBuffer: req.body,
      imageFilename: mimeType === "image/png" ? "referencia.png" : "referencia.jpg",
      imageMimeType: mimeType,
      escopo: params.data.escopo as EscopoRedesenho,
      elementosSelecionados: params.data.elementosSelecionados,
    });

    res
      .status(200)
      .set({
        "Content-Type": resultado.mimeType,
        "Cache-Control": "no-store",
        "X-Redesenho-Storage-Url": resultado.url,
      })
      .send(resultado.imageBuffer);
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    console.error("[letra-caixa] falha ao gerar reconstrução:", detalhe);

    if (/insufficient_quota|429/i.test(detalhe)) {
      res.status(429).json({
        error: "A OpenAI recusou a geração por limite de uso ou falta de crédito. Verifique o faturamento da API e tente novamente.",
      });
      return;
    }
    if (/OPENAI_API_KEY/i.test(detalhe)) {
      res.status(503).json({ error: "A chave da OpenAI não está configurada no servidor." });
      return;
    }

    res.status(502).json({
      error: "O GPT não conseguiu gerar a reconstrução agora. Tente novamente em instantes.",
    });
  }
}
