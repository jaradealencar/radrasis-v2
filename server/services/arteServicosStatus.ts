const VECTOR_SERVICE_URL = "https://api.vectorizer.ai/api/v1/account";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const PROBE_TIMEOUT_MS = 8_000;

type EstadoServico =
  | "not_configured"
  | "active"
  | "no_credits"
  | "past_due"
  | "ended"
  | "invalid_credentials"
  | "access_denied"
  | "rate_limited"
  | "unavailable"
  | "provider_error"
  | "unknown";

export async function consultarVectorizer(): Promise<{
  configured: boolean;
  status: EstadoServico;
  plan: string | null;
  credits: number | null;
}> {
  const apiId = process.env.VECTORIZER_API_ID?.trim();
  const apiSecret = process.env.VECTORIZER_API_SECRET?.trim();
  if (!apiId || !apiSecret) {
    return {
      configured: false,
      status: "not_configured",
      plan: null,
      credits: null,
    };
  }

  try {
    const response = await fetch(VECTOR_SERVICE_URL, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiId}:${apiSecret}`, "utf8").toString("base64")}`,
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        configured: true,
        status: mapHttpStatus(response.status),
        plan: null,
        credits: null,
      };
    }

    const account = (await response.json()) as {
      subscriptionPlan?: unknown;
      subscriptionState?: unknown;
      credits?: unknown;
    };
    const plan =
      typeof account.subscriptionPlan === "string"
        ? account.subscriptionPlan.slice(0, 80)
        : null;
    const rawCredits =
      typeof account.credits === "string"
        ? Number(account.credits)
        : account.credits;
    const credits =
      typeof rawCredits === "number" && Number.isFinite(rawCredits)
        ? rawCredits
        : null;
    const subscriptionState = account.subscriptionState;
    let status: EstadoServico = "unknown";
    if (subscriptionState === "active")
      status = credits != null && credits <= 0 ? "no_credits" : "active";
    else if (subscriptionState === "pastDue") status = "past_due";
    else if (subscriptionState === "ended") status = "ended";

    return { configured: true, status, plan, credits };
  } catch {
    return {
      configured: true,
      status: "unavailable",
      plan: null,
      credits: null,
    };
  }
}

export async function consultarOpenAi(): Promise<{
  configured: boolean;
  status: EstadoServico;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { configured: false, status: "not_configured" };

  try {
    // GET /models confirma autenticação sem gerar conteúdo nem consumir tokens de modelo.
    const response = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok) return { configured: true, status: "active" };
    return { configured: true, status: mapHttpStatus(response.status) };
  } catch {
    return { configured: true, status: "unavailable" };
  }
}

function mapHttpStatus(status: number): EstadoServico {
  if (status === 401) return "invalid_credentials";
  if (status === 403) return "access_denied";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "provider_error";
}
