const WTS_CHAT_SEND_TEMPLATE_URL = "https://api.wts.chat/chat/v1/send/template";

/** Número de origem padrão (canal WhatsApp na WTS.Chat); `WTS_CHAT_FROM` sobrescreve. */
export const WTS_CHAT_FROM_PADRAO = "551194266377";

export interface WtsChatResultadoEnvio {
  ok: boolean;
  status: number;
  erro?: string;
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

    if (!response.ok) return { ok: false, status: response.status, erro: `WTS.Chat respondeu HTTP ${response.status}.` };
    return { ok: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Tempo esgotado ao conectar à WTS.Chat."
      : "Falha de conexão com a WTS.Chat.";
    return { ok: false, status: 0, erro: message };
  }
}
