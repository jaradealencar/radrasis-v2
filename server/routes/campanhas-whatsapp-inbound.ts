/**
 * Webhook de mensagens RECEBIDAS das Campanhas WhatsApp (gatilho da qualificação por IA).
 *
 *   POST /api/v1/campaigns/whatsapp-inbound
 *   POST /api/v1/campaigns/process-buffers   (consolidação do debounce — chamada por cron)
 *
 * Diferente de server/routes/campanhas-whatsapp-api.ts (log-send / check-quarantine: o disparador reportando
 * ENVIO), este endpoint recebe mensagens que o CLIENTE mandou de volta. Hoje nada aponta para ele de verdade:
 * o atendimento das respostas continua na caixa de entrada da Ceci.Chat (ver docs/campanhas-whatsapp.md,
 * seção "Disparo via WTS.Chat / Ceci.Chat") — a Ceci precisaria ser configurada, no painel deles, para
 * replicar o webhook de mensagem recebida para esta URL. Até isso ser configurado, o endpoint existe e pode
 * ser testado manualmente, mas não recebe tráfego real. Ver docs/campanhas-whatsapp-ia.md.
 *
 * Contrato de entrada: payload oficial da Meta/WhatsApp Business Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples), que é o formato mais
 * provável de qualquer provedor (Ceci/WTS.Chat incluído) replicar — `entry[].changes[].value.messages[]`.
 * Se o payload real da Ceci vier em outro formato, ajustar só `extrairMensagensDoPayload` abaixo.
 *
 * Autenticação: mesma chave dos outros webhooks REST deste módulo (`CAMPANHAS_API_KEY`), reexportada de
 * campanhas-whatsapp-api.ts para não duplicar a checagem em tempo constante.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { exigirChaveApi } from "./campanhas-whatsapp-api";
import {
  consolidarBuffersVencidos,
  registrarMensagemInbound,
} from "../services/campanhasWhatsappInboundBuffer";
import type { TipoMensagemInbound } from "../../shared/campanhas-whatsapp-ia";

function responderErro(res: Response, erro: unknown, rota: string) {
  if (erro instanceof z.ZodError) {
    res
      .status(400)
      .json({
        erro: erro.issues
          .map(i => `${i.path.join(".") || "corpo"}: ${i.message}`)
          .join("; "),
      });
    return;
  }
  console.error(`[campanhas-whatsapp-inbound] ${rota}:`, erro);
  res.status(500).json({ erro: "Erro interno ao processar a requisição." });
}

// ─── Payload oficial Meta/WhatsApp Cloud API (apenas os campos usados) ──────

const metaButtonOrListReplySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
});

const metaMessageSchema = z.object({
  id: z.string().optional(),
  from: z.union([z.string(), z.number()]),
  timestamp: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  text: z.object({ body: z.string().optional() }).optional(),
  button: z
    .object({ text: z.string().optional(), payload: z.string().optional() })
    .optional(),
  interactive: z
    .object({
      type: z.string().optional(),
      button_reply: metaButtonOrListReplySchema.optional(),
      list_reply: metaButtonOrListReplySchema.optional(),
    })
    .optional(),
});

const metaContactSchema = z.object({
  profile: z.object({ name: z.string().optional() }).optional(),
  wa_id: z.union([z.string(), z.number()]).optional(),
});

const metaValueSchema = z.object({
  messages: z.array(metaMessageSchema).optional(),
  contacts: z.array(metaContactSchema).optional(),
});

export const whatsappInboundWebhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string().optional(),
              value: metaValueSchema,
            })
          )
          .default([]),
      })
    )
    .default([]),
});

interface MensagemExtraida {
  telefone: string | number;
  nome: string | null;
  tipoMensagem: TipoMensagemInbound;
  texto: string | null;
  mensagemIdExterno: string | null;
  recebidoEm: Date | null;
  payloadRaw: unknown;
}

/** Converte o payload Meta em mensagens no formato interno. Isola o parsing do formato específico do
 * provedor — se a Ceci mandar algo diferente, só esta função precisa mudar. */
export function extrairMensagensDoPayload(
  payload: z.infer<typeof whatsappInboundWebhookSchema>
): MensagemExtraida[] {
  const resultado: MensagemExtraida[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const nomesPorTelefone = new Map<string, string>();
      for (const contato of change.value.contacts ?? []) {
        if (contato.wa_id && contato.profile?.name)
          nomesPorTelefone.set(String(contato.wa_id), contato.profile.name);
      }
      for (const msg of change.value.messages ?? []) {
        const telefone = msg.from;
        let tipoMensagem: TipoMensagemInbound = "text";
        let texto: string | null = null;

        if (msg.interactive?.type === "button_reply") {
          tipoMensagem = "button_reply";
          texto = msg.interactive.button_reply?.title ?? null;
        } else if (msg.interactive?.type === "list_reply") {
          tipoMensagem = "list_reply";
          texto = msg.interactive.list_reply?.title ?? null;
        } else if (msg.button) {
          // Quick-reply de template (type="button"): também é clique real, não digitação.
          tipoMensagem = "button_reply";
          texto = msg.button.text ?? null;
        } else if (msg.text?.body !== undefined) {
          tipoMensagem = "text";
          texto = msg.text.body;
        }

        const timestampSegundos =
          msg.timestamp !== undefined ? Number(msg.timestamp) : NaN;
        resultado.push({
          telefone,
          nome: nomesPorTelefone.get(String(telefone)) ?? null,
          tipoMensagem,
          texto,
          mensagemIdExterno: msg.id ?? null,
          recebidoEm: Number.isFinite(timestampSegundos)
            ? new Date(timestampSegundos * 1000)
            : null,
          payloadRaw: msg,
        });
      }
    }
  }
  return resultado;
}

export function registrarRotasCampanhasWhatsappInbound(app: Express) {
  /** Recebe o webhook de mensagens entrantes e grava cada uma no buffer (sem chamar IA aqui — a
   * consolidação roda em separado, depois do debounce). Sempre 200 com o resumo processado: um provedor de
   * webhook costuma reenviar em loop se não receber 2xx, e um erro de uma mensagem não deve impedir que as
   * outras do mesmo payload sejam gravadas. */
  app.post(
    "/api/v1/campaigns/whatsapp-inbound",
    exigirChaveApi,
    async (req: Request, res: Response) => {
      try {
        const payload = whatsappInboundWebhookSchema.parse(req.body);
        const mensagens = extrairMensagensDoPayload(payload);
        const resultados = await Promise.all(
          mensagens.map(m =>
            registrarMensagemInbound({
              telefone: m.telefone,
              nome: m.nome,
              tipoMensagem: m.tipoMensagem,
              texto: m.texto,
              mensagemIdExterno: m.mensagemIdExterno,
              recebidoEm: m.recebidoEm,
              payloadRaw: JSON.stringify(m.payloadRaw),
            })
          )
        );
        res.status(200).json({
          recebidas: mensagens.length,
          gravadas: resultados.filter(r => r.ok && !r.duplicada).length,
          duplicadas: resultados.filter(r => r.duplicada).length,
          telefonesInvalidos: resultados.filter(r => !r.ok).length,
          bots: resultados.filter(r => r.ehBot).length,
        });
      } catch (erro) {
        responderErro(res, erro, "whatsapp-inbound");
      }
    }
  );

  /**
   * Consolida buffers vencidos (debounce) e qualifica cada contato pronto com o Gemini — pensado para ser
   * chamado por um cron (QStash, mesmo padrão de /api/scheduled/*, ver docs/cron-qstash.md), não pela Ceci.
   * Protegido pela mesma CAMPANHAS_API_KEY (não é um endpoint /api/scheduled/* porque toca telefone de
   * cliente, mesma régua dos demais endpoints deste módulo).
   */
  app.post(
    "/api/v1/campaigns/process-buffers",
    exigirChaveApi,
    async (req: Request, res: Response) => {
      try {
        const limite = Math.min(
          Math.max(Number(req.query.limite) || 25, 1),
          100
        );
        const resultados = await consolidarBuffersVencidos(limite);
        res.status(200).json({ processados: resultados.length, resultados });
      } catch (erro) {
        responderErro(res, erro, "process-buffers");
      }
    }
  );
}
