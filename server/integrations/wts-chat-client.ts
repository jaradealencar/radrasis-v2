const CECI_API_BASE_URL = "https://api.app.ceci.chat";
const WTS_API_BASE_URL = "https://api.wts.chat";

/** Número de origem padrão oficial da Letreiros Express (11 94266-6377); `WTS_CHAT_FROM` sobrescreve. */
export const WTS_CHAT_FROM_PADRAO = "5511942666377";

/** ID único do canal WhatsApp da Letreiros Express na Ceci.Chat. */
export const CECI_CANAL_ID_PADRAO = "b13d2257-af6d-4cbb-a4fd-fa73069ae863";

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
 * Retorna o ID único do canal na Ceci.Chat (UUID do canal físico do WhatsApp).
 * Pode ser configurado via `CECI_CHANNEL_ID` ou `WTS_CHAT_CHANNEL_ID`.
 * Se `WTS_CHAT_FROM` contiver um UUID, é utilizado diretamente.
 * Caso contrário, utiliza o canal padrão oficial da Letreiros Express (b13d2257-af6d-4cbb-a4fd-fa73069ae863).
 */
export function obterCanalId(): string {
  const directId = (process.env.CECI_CHANNEL_ID ?? process.env.WTS_CHAT_CHANNEL_ID ?? "").trim();
  if (directId) return directId;

  const fromVal = (process.env.WTS_CHAT_FROM ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fromVal)) {
    return fromVal;
  }
  return CECI_CANAL_ID_PADRAO;
}

/**
 * Retorna o número de telefone do canal remetente com DDI 55.
 * Se `WTS_CHAT_FROM` for um UUID, cai com segurança no telefone padrão (5511942666377).
 * Se contiver o número antigo com 1 dígito '6' a menos (551194266377), corrige automaticamente para o canal real.
 */
export function obterCanalTelefone(): string {
  const fromVal = (process.env.WTS_CHAT_FROM ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fromVal)) {
    return WTS_CHAT_FROM_PADRAO;
  }
  let digits = fromVal.replace(/\D/g, "");
  // Corrige o erro de digitação histórico que faltava o terceiro '6'
  if (digits === "551194266377" || digits === "1194266377" || digits === "94266377") {
    return WTS_CHAT_FROM_PADRAO;
  }
  if (!digits || digits.length < 10) return WTS_CHAT_FROM_PADRAO;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

/** Retorna o canal remetente higienizado com DDI 55, caindo com segurança no canal padrão (551194266377). */
export function obterCanalRemetente(): string {
  return obterCanalTelefone();
}

/**
 * Enfileira um template aprovado pela Meta (cadastrado na Ceci.Chat) para um único destinatário.
 * `templateId` é o ID que a Ceci.Chat mostra no cadastro do modelo de mensagem.
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
  const canalId = obterCanalId();
  const canalTelefone = obterCanalTelefone();

  const payloadItem: Record<string, unknown> = {
    to: telefone,
    from: canalTelefone,
    senderId: canalId,
    channelId: canalId,
    templateId,
  };
  if (parameters && parameters.length > 0) {
    payloadItem.parameters = parameters;
  }

  const endpoints = [
    `${CECI_API_BASE_URL}/chat/v1/send/template`,
    `${WTS_API_BASE_URL}/chat/v1/send/template`,
  ];

  let ultimoErro = "Falha de conexão com a Ceci.Chat.";
  let ultimoStatus = 0;
  let ultimaResposta = "";

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: authorizationHeader,
        },
        body: JSON.stringify(payloadItem),
        signal: AbortSignal.timeout(15_000),
      });

      const corpo = (await response.text().catch(() => "")).slice(0, 500);
      ultimoStatus = response.status;
      ultimaResposta = corpo;

      if (!response.ok) {
        ultimoErro = `Ceci.Chat respondeu HTTP ${response.status}${corpo ? `: ${corpo}` : "."}`;
        // Se deu 404 de rota não encontrada na Ceci, tenta a URL da WTS
        if (response.status === 404) continue;
        return { ok: false, status: response.status, erro: ultimoErro, resposta: corpo };
      }
      const recusa = motivoRecusaNoCorpo(corpo);
      if (recusa) return { ok: false, status: response.status, erro: `Ceci.Chat recusou: ${recusa}`, resposta: corpo };
      return { ok: true, status: response.status, resposta: corpo };
    } catch (error) {
      ultimoErro = error instanceof Error && error.name === "TimeoutError"
        ? "Tempo esgotado ao conectar à Ceci.Chat."
        : "Falha de conexão com a Ceci.Chat.";
    }
  }

  return { ok: false, status: ultimoStatus, erro: ultimoErro, resposta: ultimaResposta };
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
  const canalId = obterCanalId();
  const canalTelefone = obterCanalTelefone();

  const endpoints = [
    `${CECI_API_BASE_URL}/chat/v1/campaigns`,
    `${WTS_API_BASE_URL}/chat/v1/campaigns`,
    `${CECI_API_BASE_URL}/chat/v1/campaign`,
    `${WTS_API_BASE_URL}/chat/v1/campaign`,
  ];

  const payload = {
    name: nomeCampanha,
    templateId,
    from: canalTelefone,
    senderId: canalId,
    channelId: canalId,
    contacts: telefones.map(t => ({ phone: t, to: t })),
    phones: telefones,
  };

  let ultimoErro = "Não foi possível registrar a campanha no menu da Ceci.Chat.";

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
      } else {
        ultimoErro = `${new URL(url).pathname}: HTTP ${response.status} - ${corpo}`;
        // Se 404 em rota de um domínio, tenta a do próximo endpoint
        if (response.status === 404) continue;
      }
    } catch (e) {
      ultimoErro = `${new URL(url).pathname}: ${e instanceof Error ? e.message : "falha de conexão"}`;
    }
  }

  return { ok: false, erro: ultimoErro };
}

export interface InfoCeciDiagnostico {
  canais: Array<Record<string, unknown>>;
  erroCanais?: string;
  campanhas: unknown;
  erroCampanhas?: string;
  canalConfiguradoEnv: string;
  canalIdConfigurado: string;
}

/**
 * Consulta canais e campanhas conectados na Ceci.Chat para diagnóstico de canal remetente e permissões.
 */
export async function consultarDiagnosticoCeci(): Promise<InfoCeciDiagnostico> {
  const canalConfiguradoEnv = obterCanalTelefone();
  const canalIdConfigurado = obterCanalId();
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) {
    return {
      canais: [],
      erroCanais: "WTS_CHAT_AUTHORIZATION não configurado.",
      campanhas: [],
      canalConfiguradoEnv,
      canalIdConfigurado,
    };
  }

  const authorizationHeader = /^Bearer\s/i.test(authorization) ? authorization : `Bearer ${authorization}`;

  let canais: Array<Record<string, unknown>> = [];
  let erroCanais: string | undefined;
  const endpointsCanais = [
    `${CECI_API_BASE_URL}/chat/v1/channels`,
    `${WTS_API_BASE_URL}/chat/v1/channels`,
  ];
  for (const url of endpointsCanais) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", Authorization: authorizationHeader },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          canais = Array.isArray(json) ? json : ((json.items || json.data || [json]) as Array<Record<string, unknown>>);
          erroCanais = undefined;
          break;
        } catch {
          erroCanais = text.slice(0, 300);
        }
      } else {
        erroCanais = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      }
    } catch (e) {
      erroCanais = e instanceof Error ? e.message : "Erro ao consultar canais";
    }
  }

  let campanhas: unknown = [];
  let erroCampanhas: string | undefined;
  const endpointsCampanhas = [
    `${CECI_API_BASE_URL}/chat/v1/campaigns`,
    `${WTS_API_BASE_URL}/chat/v1/campaigns`,
  ];
  for (const url of endpointsCampanhas) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", Authorization: authorizationHeader },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (res.ok) {
        try {
          campanhas = JSON.parse(text);
          erroCampanhas = undefined;
          break;
        } catch {
          erroCampanhas = text.slice(0, 300);
        }
      } else {
        erroCampanhas = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      }
    } catch (e) {
      erroCampanhas = e instanceof Error ? e.message : "Erro ao consultar campanhas";
    }
  }

  return { canais, erroCanais, campanhas, erroCampanhas, canalConfiguradoEnv, canalIdConfigurado };
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
    const url = new URL(statusUrl, CECI_API_BASE_URL);
    if (
      (url.origin !== "https://api.app.ceci.chat" && url.origin !== "https://api.wts.chat") ||
      url.pathname !== `/v1/send/message/${encodeURIComponent(id)}`
    ) return null;
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
    `${CECI_API_BASE_URL}/chat/v1/message/${encodeURIComponent(id)}/status`,
    `${WTS_API_BASE_URL}/chat/v1/message/${encodeURIComponent(id)}/status`,
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
