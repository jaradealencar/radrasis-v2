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

export interface WtsChatResultadoCampanha {
  ok: boolean;
  campanhaId?: string;
  status?: number;
  erro?: string;
  resposta?: string;
}

/** Detecta recusa declarada no corpo mesmo com HTTP 2xx (`success:false`, `error`/`errors` preenchidos). */
function motivoRecusaNoCorpo(corpo: string): string | null {
  let json: unknown;
  try { json = JSON.parse(corpo); } catch { return null; }
  if (!json || typeof json !== "object") return null;
  const o = Array.isArray(json) ? (json[0] as Record<string, unknown>) : (json as Record<string, unknown>);
  if (!o || typeof o !== "object") return null;
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
 * A API da WTS.Chat (Helena) espera um array de DTOs: List<RequestMessageQuickSendDTO>.
 * `templateId` é o ID que a WTS.Chat mostra no cadastro do modelo de mensagem.
 */
export async function enviarTemplateWts(
  telefone: string,
  templateId: string,
  parameters?: string[],
): Promise<WtsChatResultadoEnvio> {
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) {
    throw new Error("Configure WTS_CHAT_AUTHORIZATION nos segredos do servidor antes de enviar campanhas.");
  }

  const authorizationHeader = /^Bearer\s/i.test(authorization) ? authorization : `Bearer ${authorization}`;

  const payloadItem: Record<string, unknown> = {
    to: telefone,
    from: process.env.WTS_CHAT_FROM?.trim() || WTS_CHAT_FROM_PADRAO,
    templateId,
  };
  if (parameters && parameters.length > 0) {
    payloadItem.parameters = parameters;
  }

  try {
    const response = await fetch(WTS_CHAT_SEND_TEMPLATE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: authorizationHeader,
      },
      // O endpoint /chat/v1/send/template espera o objeto PublicReqSendTemplateSingleDTO
      body: JSON.stringify(payloadItem),
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

/**
 * Cria ou registra uma campanha no painel da Ceci.Chat / WTS.Chat (/chat/v1/campaigns).
 * Permite que a equipe de atendimento acompanhe o lote de disparos diretamente pelo menu Campanhas da Ceci.
 */
export async function criarCampanhaWts(
  nomeCampanha: string,
  templateId: string,
  telefones: string[],
): Promise<WtsChatResultadoCampanha> {
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) {
    return { ok: false, erro: "WTS_CHAT_AUTHORIZATION não configurado." };
  }

  const authorizationHeader = /^Bearer\s/i.test(authorization) ? authorization : `Bearer ${authorization}`;
  const from = process.env.WTS_CHAT_FROM?.trim() || WTS_CHAT_FROM_PADRAO;

  const endpoints = [
    "https://api.wts.chat/chat/v1/campaigns",
    "https://api.wts.chat/chat/v1/campaign",
  ];

  const payload = {
    name: nomeCampanha,
    templateId,
    from,
    contacts: telefones.map(t => ({ phone: t, to: t })),
    phones: telefones,
  };

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: authorizationHeader,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      const corpo = (await response.text().catch(() => "")).slice(0, 500);
      if (response.ok) {
        let id: string | undefined;
        try {
          const json = JSON.parse(corpo);
          id = json.id || json.campaignId || json.value;
        } catch { /* corpo não JSON */ }
        return { ok: true, campanhaId: id ? String(id) : undefined, status: response.status, resposta: corpo };
      }
    } catch {
      // Tenta próximo endpoint
    }
  }

  return { ok: false, erro: "Não foi possível registrar a campanha no menu da Ceci.Chat." };
}

/** Extrai o ID da mensagem enfileirada da resposta do envio (`{"id": "...", "status": "QUEUED"}` ou `[{"id": "..."}]`). */
export function idMensagemWts(resposta: string | undefined): string | null {
  try {
    const json = JSON.parse(resposta ?? "");
    const obj = Array.isArray(json) ? json[0] : json;
    const id = (obj as { id?: unknown })?.id;
    return typeof id === "string" && /^[\w-]{8,64}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Usa a URL de status que veio no próprio aceite, se pertencer ao host e ao ID esperados. */
export function urlStatusMensagemWts(resposta: string | undefined, id: string): string | null {
  try {
    const json = JSON.parse(resposta ?? "");
    const obj = Array.isArray(json) ? json[0] : json;
    const statusUrl = (obj as { statusUrl?: unknown })?.statusUrl;
    if (typeof statusUrl !== "string" || !statusUrl.trim()) return null;
    const url = new URL(statusUrl, "https://api.wts.chat");
    if (url.origin !== "https://api.wts.chat" || url.pathname !== `/v1/send/message/${encodeURIComponent(id)}`) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export interface WtsChatEstadoMensagem {
  /** Valor do campo `status` devolvido pela WTS.Chat (ex.: QUEUED, SENT, DELIVERED, FAILED); `null` se não veio. */
  estado: string | null;
  /** Corpo cru (500 caracteres) ou o motivo de a consulta não ter funcionado. */
  detalhe: string;
}

/** Consulta primeiro a URL devolvida no aceite; mantém a rota documentada como alternativa. */
export async function consultarEstadoMensagemWts(id: string, statusUrl?: string | null): Promise<WtsChatEstadoMensagem> {
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) return { estado: null, detalhe: "WTS_CHAT_AUTHORIZATION não configurado." };
  const header = /^Bearer\s/i.test(authorization) ? authorization : `Bearer ${authorization}`;
  const urlAceita = statusUrl ? urlStatusMensagemWts(JSON.stringify({ statusUrl }), id) : null;
  const endpoints = [
    ...(urlAceita ? [urlAceita] : []),
    `https://api.wts.chat/chat/v1/message/${encodeURIComponent(id)}/status`,
  ];
  const falhas: string[] = [];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { accept: "application/json", Authorization: header },
        signal: AbortSignal.timeout(8_000),
      });
      const corpo = (await r.text().catch(() => "")).slice(0, 500);
      if (!r.ok) {
        falhas.push(`${new URL(url).pathname}: HTTP ${r.status}${corpo ? `: ${corpo}` : ""}`);
        continue;
      }
      let estado: string | null = null;
      try {
        const s = (JSON.parse(corpo) as { status?: unknown }).status;
        if (typeof s === "string") estado = s;
      } catch { /* corpo não-JSON: devolve cru */ }
      return { estado, detalhe: corpo };
    } catch {
      falhas.push(`${new URL(url).pathname}: falha de conexão ou tempo esgotado`);
    }
  }
  return { estado: null, detalhe: falhas.join(" | ").slice(0, 500) || "Sem resposta da WTS.Chat." };
}
