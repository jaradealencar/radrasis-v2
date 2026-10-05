import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "../_core/auth";
import { storagePut } from "../db/storage";
import { redesenharLetreiro, type EscopoRedesenho } from "../services/letraCaixaRedesign";
import {
  emitirTicketEdicaoVetor,
  emitirTicketRedesenho,
  validarTicketRedesenho,
} from "../services/redesenhoTicket";
import { vectorizeImage, VectorizerAiError } from "../services/vectorizerAi";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PREPROCESSED_IMAGE_BYTES = 12 * 1024 * 1024;
const imageBodyParser = express.raw({
  type: ["image/jpeg", "image/png"],
  limit: MAX_IMAGE_BYTES,
});
const preprocessedImageBodyParser = express.raw({
  type: ["image/jpeg", "image/png"],
  limit: MAX_PREPROCESSED_IMAGE_BYTES,
});
const proposalImageBodyParser = express.raw({
  type: ["image/jpeg", "image/png"],
  limit: 3 * 1024 * 1024,
});

const inputSchema = z.object({
  escopo: z.enum(["somente_logo", "letreiro_completo", "elementos_selecionados"]),
  elementosSelecionados: z.string().trim().max(500).optional(),
});

/** Edição de imagem autenticada; a chave da OpenAI nunca sai do servidor. */
export function registrarRotasRedesenhoLetraCaixa(app: Express): void {
  app.post("/api/letra-caixa/cotacoes/imagem/:tipo", (req, res) => {
    proposalImageBodyParser(req, res, parseError => {
      if (parseError) {
        const status = (parseError as { status?: number }).status ?? 400;
        res.status(status).json({ error: status === 413 ? "A miniatura precisa ter até 3 MB." : "Envie uma imagem JPG ou PNG." });
        return;
      }
      void armazenarImagemCotacao(req, res);
    });
  });

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

  app.post("/api/letra-caixa/vetorizacao", (req, res) => {
    preprocessedImageBodyParser(req, res, (parseError) => {
      if (parseError) {
        const status = (parseError as { status?: number }).status ?? 400;
        res.status(status).json({
          error:
            status === 413
              ? "A imagem preparada ficou grande demais. Envie um arquivo menor que 12 MB."
              : "Não consegui ler a imagem. Envie JPG ou PNG.",
        });
        return;
      }

      void executarVetorizacao(req, res);
    });
  });
}

async function armazenarImagemCotacao(req: Request, res: Response): Promise<void> {
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
    res.status(401).json({ error: "Entre no sistema para salvar imagens na proposta." });
    return;
  }
  const tipo = req.params.tipo;
  if (tipo !== "referencia" && tipo !== "redesenhada") {
    res.status(400).json({ error: "Tipo de imagem inválido." });
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
    const ext = mimeType === "image/png" ? "png" : "jpg";
    const stored = await storagePut(`cpq-propostas/${session.user.id}/${tipo}-${randomUUID()}.${ext}`, req.body, mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ url: stored.url });
  } catch (error) {
    console.error("[letra-caixa] falha ao armazenar imagem da cotação:", error);
    res.status(502).json({ error: "Não foi possível armazenar a imagem para a proposta." });
  }
}

async function executarVetorizacao(req: Request, res: Response): Promise<void> {
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
    res.status(401).json({ error: "Entre no sistema para vetorizar a arte." });
    return;
  }
  const mimeType = req.get("content-type")?.split(";")[0].toLowerCase();
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
    res.status(415).json({ error: "Envie uma imagem JPG ou PNG para vetorizar." });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "A imagem enviada está vazia." });
    return;
  }
  const ticketKind = validarTicketRedesenho(req.get("x-redesenho-token"), session.user.id, req.body);
  if (!ticketKind) {
    res.status(409).json({ error: "Use o PNG exato retornado pela reconstrução por IA nesta sessão para vetorizar." });
    return;
  }

  try {
    // ?modo=corte gera só a silhueta de corte CNC (uma cor), em chamada separada e com crédito próprio.
    const modo = req.query.modo === "corte" ? "corte" : "completo";
    const resultado = await vectorizeImage({
      imageBuffer: req.body,
      imageFilename: mimeType === "image/png" ? "arte-aprovada.png" : "arte-aprovada.jpg",
      imageMimeType: mimeType,
      modo,
    });
    res
      .status(200)
      .set({
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Redesenho-Token": emitirTicketEdicaoVetor(session.user.id),
        ...(resultado.creditsCharged ? { "X-Vectorizer-Credits-Charged": resultado.creditsCharged } : {}),
      })
      .send(resultado.svgBuffer);
  } catch (error) {
    if (error instanceof VectorizerAiError) {
      console.error(`[letra-caixa] Vectorizer.AI ${error.code}:`, error.message);
      if (error.code === "configuration") {
        res.status(503).json({
          error: "Configure VECTORIZER_API_ID e VECTORIZER_API_SECRET no servidor para habilitar a vetorização.",
        });
        return;
      }
      if (error.code === "credentials") {
        res.status(503).json({ error: "O Vectorizer.AI recusou as credenciais configuradas no servidor." });
        return;
      }
      if (error.code === "credits") {
        res.status(429).json({ error: "O Vectorizer.AI atingiu o limite de uso ou está sem créditos." });
        return;
      }
      if (error.code === "timeout") {
        res.status(504).json({ error: "A vetorização demorou mais de 3 minutos. Tente novamente." });
        return;
      }
    } else {
      console.error("[letra-caixa] falha ao vetorizar arte:", error);
    }
    res.status(502).json({ error: "O Vectorizer.AI não conseguiu vetorizar a imagem agora. Tente novamente." });
  }
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
  if ((process.env.JWT_SECRET?.trim().length ?? 0) < 32) {
    res.status(503).json({
      error: "Configure JWT_SECRET com pelo menos 32 caracteres para aprovar e vetorizar a reconstrução.",
    });
    return;
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    res.status(503).json({ error: "A chave da OpenAI não está configurada no servidor." });
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
        "X-Redesenho-Token": emitirTicketRedesenho(session.user.id, resultado.imageBuffer),
      })
      .send(resultado.imageBuffer);
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    console.error("[letra-caixa] falha ao gerar reconstrução:", detalhe);

    if (
      /insufficient_quota|billing_hard_limit_reached|billing_not_active|rate_limit_exceeded|\b429\b/i.test(
        detalhe,
      )
    ) {
      res.status(429).json({
        error: "A OpenAI recusou a geração por limite de uso ou falta de crédito. Verifique o faturamento da API e tente novamente.",
      });
      return;
    }
    if (
      /OPENAI_API_KEY|invalid_api_key|incorrect api key|\b401\b/i.test(detalhe)
    ) {
      res.status(503).json({ error: "A chave da OpenAI não está configurada ou não é aceita pela API." });
      return;
    }
    if (
      /organization_verification_required|organization.{0,40}verif|verif.{0,40}organization/i.test(
        detalhe,
      )
    ) {
      res.status(503).json({
        error: "A organização da OpenAI precisa concluir a verificação da API antes de gerar imagens.",
      });
      return;
    }
    if (/moderation_blocked|content_policy_violation|safety system/i.test(detalhe)) {
      res.status(422).json({
        error: "A OpenAI bloqueou esta imagem ou instrução. Revise a foto e tente novamente.",
      });
      return;
    }
    if (/AbortError|TimeoutError|timed out/i.test(detalhe)) {
      res.status(504).json({
        error: "A reconstrução demorou mais de 2 minutos. Tente novamente.",
      });
      return;
    }

    res.status(502).json({
      error: "O GPT não conseguiu gerar a reconstrução agora. Tente novamente em instantes.",
    });
  }
}
