/**
 * Webhooks REST das Campanhas WhatsApp (contrato externo — nomes e campos em inglês/snake_case, como na
 * especificação), para um disparador/API oficial do WhatsApp registrar envios e consultar a quarentena:
 *
 *   POST /api/v1/campaigns/:id/log-send
 *   POST /api/v1/contacts/check-quarantine
 *
 * Diferente dos /api/scheduled/* (sem segredo), estes leem e gravam telefones de clientes, então exigem
 * `Authorization: Bearer <CAMPANHAS_API_KEY>`. Sem a variável configurada, respondem 503 (API desligada) —
 * nunca ficam abertos por esquecimento. A regra de negócio é a mesma da tela (funções exportadas do router).
 * Ver docs/campanhas-whatsapp.md.
 */

import { timingSafeEqual } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { z } from "zod";
import { hojeCampoGrande } from "../../shared/campanhas-whatsapp";
import {
  checarQuarentenaNoBanco, contatosSchema, dataIsoSchema, registrarDisparoNoBanco,
} from "../routers/campanhasWhatsapp";
import { getDb } from "../db/db";
import { campanhasWhatsapp } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function chaveConfere(recebida: string, esperada: string): boolean {
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function exigirChaveApi(req: Request, res: Response, next: NextFunction) {
  const esperada = process.env.CAMPANHAS_API_KEY;
  if (!esperada) {
    res.status(503).json({ erro: "API desativada: configure CAMPANHAS_API_KEY no servidor." });
    return;
  }
  const cabecalho = String(req.headers.authorization ?? "");
  const recebida = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : String(req.headers["x-api-key"] ?? "");
  if (!recebida || !chaveConfere(recebida, esperada)) {
    res.status(401).json({ erro: "Chave de API inválida ou ausente." });
    return;
  }
  next();
}

function responderErro(res: Response, erro: unknown, rota: string) {
  if (erro instanceof z.ZodError) {
    res.status(400).json({ erro: erro.issues.map(i => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; ") });
    return;
  }
  if (erro instanceof TRPCError) {
    res.status(getHTTPStatusCodeFromError(erro)).json({ erro: erro.message });
    return;
  }
  console.error(`[campanhas-whatsapp-api] ${rota}:`, erro);
  res.status(500).json({ erro: "Erro interno ao processar a requisição." });
}

export const logSendBodySchema = z.object({
  sent_at: dataIsoSchema.optional(),
  contacts: z.array(z.object({
    phone: z.union([z.string().max(40), z.number()]),
    name: z.string().max(200).nullish(),
  })).min(1, "contacts vazio").max(20_000),
  notes: z.string().max(2000).nullish(),
  file_url: z.string().url().max(512).nullish(),
  /** Padrão false: a lista já foi enviada, então tudo que é válido é registrado (ver `aplicarQuarentena`). */
  apply_quarantine: z.boolean().default(false),
});

export const checkQuarantineBodySchema = z.object({
  phones: z.array(z.union([z.string().max(40), z.number()])).min(1, "phones vazio").max(5000),
  campaign_id: z.number().int().optional(),
  quarantine_days: z.number().int().min(0).max(365).optional(),
  reference_date: dataIsoSchema.optional(),
});

export function registrarRotasCampanhasWhatsappApi(app: Express) {
  app.post("/api/v1/campaigns/:id/log-send", exigirChaveApi, async (req, res) => {
    try {
      const campanhaId = z.coerce.number().int().positive().parse(req.params.id);
      const body = logSendBodySchema.parse(req.body);
      const r = await registrarDisparoNoBanco({
        campanhaId,
        dataEnvio: body.sent_at ?? hojeCampoGrande(),
        contatos: contatosSchema.parse(body.contacts.map(c => ({ telefone: c.phone, nome: c.name }))),
        observacoes: body.notes,
        arquivoUrl: body.file_url,
        origem: "api",
        registradoPor: "api",
        aplicarQuarentena: body.apply_quarantine,
      });
      res.status(r.registrado ? 201 : 200).json({
        logged: r.registrado,
        log_id: r.disparoId,
        next_due_date: r.proximaData,
        processed: r.recebidos,
        sent: r.enviados,
        ignored_quarantine: r.ignorados,
        quarantine_violations: r.violacoesQuarentena,
        invalid: r.invalidos,
        ignored_phones: r.ignoradosQuarentena.map(i => ({
          phone: i.telefone, last_contacted_at: i.ultimoContatoEm, available_at: i.disponivelEm,
        })),
      });
    } catch (erro) {
      responderErro(res, erro, "log-send");
    }
  });

  app.post("/api/v1/contacts/check-quarantine", exigirChaveApi, async (req, res) => {
    try {
      const body = checkQuarantineBodySchema.parse(req.body);
      let dias = body.quarantine_days;
      if (dias === undefined) {
        if (body.campaign_id === undefined) {
          res.status(400).json({ erro: "Informe campaign_id ou quarantine_days." });
          return;
        }
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");
        const [c] = await db.select({ q: campanhasWhatsapp.quarentenaDias }).from(campanhasWhatsapp)
          .where(eq(campanhasWhatsapp.id, body.campaign_id)).limit(1);
        if (!c) {
          res.status(404).json({ erro: "Campanha não encontrada" });
          return;
        }
        dias = c.q;
      }

      const r = await checarQuarentenaNoBanco(body.phones, dias, body.reference_date);
      res.json({
        quarantine_days: r.quarentenaDias,
        results: r.resultados.map(x => ({
          phone: x.original,
          normalized_phone: x.telefone,
          valid: !!x.telefone,
          in_quarantine: x.emQuarentena,
          last_contacted_at: x.ultimoContatoEm,
          available_at: x.disponivelEm,
        })),
        summary: {
          total: r.resumo.total,
          in_quarantine: r.resumo.emQuarentena,
          available: r.resumo.disponiveis,
          invalid: r.resumo.invalidos,
        },
      });
    } catch (erro) {
      responderErro(res, erro, "check-quarantine");
    }
  });
}
