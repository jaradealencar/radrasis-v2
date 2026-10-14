const WTS_CHAT_SEND_TEMPLATE_URL = "https://api.wts.chat/chat/v1/send/template";

/** Número de origem padrão (canal WhatsApp na WTS.Chat); `WTS_CHAT_FROM` sobrescreve. */
export const WTS_CHAT_FROM_PADRAO = "551194266377";

export interface WtsChatResultadoEnvio {
  ok: boolean;
  status: number;
  erro?: string;
  /** Corpo devolvido pela WTS.Chat (cortado em 500 caracteres): é onde aparece o motivo de uma rejeição. */
  resposta?: string;
}

/** Detecta recusa declarada no corpo mesmo com HTTP 2xx (`success:false`, `error`/`errors` preenchidos). */
function motivoRecusaNoCorpo(corpo: string): string | null {
  let json: unknown;
  try { json = JSON.parse(corpo); } catch { return null; }
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.success === false || o.ok === false) return String(o.message ?? o.error ?? "A WTS.Chat recusou o envio.");
  for (const chave of ["error", "errors", "erro"]) {
    const v = o[chave];
    if (v && (typeof v !== "object" || Object.keys(v as object).length > 0)) return typeof v === "string" ? v : JSON.stringify(v);
  }
  return null;
}

export function wtsChatConfigurado(): boolean {
  return !!process.env.WTS_CHAT_AUTHORIZATION?.trim();
}

/**
 * Enfileira um template aprovado pela Meta (cadastrado na WTS.Chat) para um único destinatário.
 * `templateId` é o ID que a WTS.Chat mostra no cadastro do modelo de mensagem.
 */
export async function enviarTemplateWts(telefone: string, templateId: string): Promise<WtsChatResultadoEnvio> {
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) {
    throw new Error("Configure WTS_CHAT_AUTHORIZATION nos segredos do servidor antes de enviar campanhas.");
  }

  const authorizationHeader = /^Bearer\s/i.test(authorization) ? authorization : `Bearer ${authorization}`;

  try {
    const response = await fetch(WTS_CHAT_SEND_TEMPLATE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: authorizationHeader,
      },
      body: JSON.stringify({
        to: telefone,
        from: process.env.WTS_CHAT_FROM?.trim() || WTS_CHAT_FROM_PADRAO,
        templateId,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corpo = (await response.text().catch(() => "")).slice(0, 500);
    if (!response.ok) {
      return { ok: false, status: response.status, erro: `WTS.Chat respondeu HTTP ${response.status}${corpo ? `: ${corpo}` : "."}`, resposta: corpo };
    }
    const recusa = motivoRecusaNoCorpo(corpo);
    if (recusa) return { ok: false, status: response.status, erro: `WTS.Chat recusou: ${recusa}`, resposta: corpo };
    return { ok: true, status: response.status, resposta: corpo };
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Tempo esgotado ao conectar à WTS.Chat."
      : "Falha de conexão com a WTS.Chat.";
    return { ok: false, status: 0, erro: message };
  }
}
