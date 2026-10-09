const WTS_CHAT_SEND_TEMPLATE_URL = "https://api.wts.chat/chat/v1/send/template";

export const WTS_CHAT_PRIMEIRA_COMPRA = {
  from: "551194266377",
  templateId: "e87c7_primeiracompra",
} as const;

export interface WtsChatResultadoEnvio {
  ok: boolean;
  status: number;
  erro?: string;
}

/** Enfileira um template aprovado da WTS.Chat para um único destinatário. */
export async function enviarTemplatePrimeiraCompra(telefone: string): Promise<WtsChatResultadoEnvio> {
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) {
    throw new Error("Configure WTS_CHAT_AUTHORIZATION nos segredos do servidor antes de enviar campanhas.");
  }

  try {
    const response = await fetch(WTS_CHAT_SEND_TEMPLATE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        to: telefone,
        from: process.env.WTS_CHAT_FROM?.trim() || WTS_CHAT_PRIMEIRA_COMPRA.from,
        templateId: process.env.WTS_CHAT_TEMPLATE_ID?.trim() || WTS_CHAT_PRIMEIRA_COMPRA.templateId,
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
