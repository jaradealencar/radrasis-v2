import { z } from "zod";

/** API de leitura documentada pela HelenaCRM; separada da API de envio WTS/Ceci. */
export const HELENA_CHAT_API_BASE_URL = "https://api.helena.run/chat";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const TIMEOUT_MS = 8_000;

const contactSchema = z
  .object({
    name: z.string().nullish(),
    phonenumber: z.string().nullish(),
    phonenumberFormatted: z.string().nullish(),
    phoneNumber: z.string().nullish(),
    phoneNumberFormatted: z.string().nullish(),
  })
  .passthrough();

const sessionSchema = z
  .object({
    id: z.string().min(1),
    lastInteractionDate: z.string().nullish(),
    lastMessageIn: z.string().nullish(),
    contactDetails: contactSchema.nullish(),
  })
  .passthrough();

const messageSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().min(1),
    timestamp: z.string().nullish(),
    type: z.enum([
      "TEXT",
      "STICKER",
      "IMAGE",
      "AUDIO",
      "VIDEO",
      "DOCUMENT",
      "CONTACT",
      "LOCATION",
      "LIST",
      "BUTTONS",
      "TRANSITION",
      "TRACK",
      "NOTE",
    ]),
    direction: z.enum(["FROM_HUB", "TO_HUB"]),
    text: z.string().nullish(),
    details: z
      .object({ contact: contactSchema.nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const pageSchema = z
  .object({
    items: z.array(z.unknown()).nullish(),
    totalPages: z.number().int().nonnegative().optional(),
    hasMorePages: z.boolean().optional(),
  })
  .passthrough();

export type HelenaSession = z.infer<typeof sessionSchema>;
export type HelenaMessage = z.infer<typeof messageSchema>;

export class HelenaChatApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    reason: "http" | "invalid_json" | "invalid_response"
  ) {
    super(
      `Helena Chat API ${reason} (${status || "sem status"}) em ${endpoint}`
    );
    this.name = "HelenaChatApiError";
  }
}

export interface HelenaChatClient {
  listarSessoes(input: {
    channelId: string;
    after: Date;
    before: Date;
  }): Promise<HelenaSession[]>;
  listarMensagens(input: {
    sessionId: string;
    after: Date;
  }): Promise<HelenaMessage[]>;
}

export interface CriarHelenaChatClientOptions {
  authorization?: string;
  fetchFn?: typeof fetch;
}

/** Cliente somente de leitura para a API oficial da Helena. Não envia mensagens nem altera conversas. */
export function criarHelenaChatClient(
  options: CriarHelenaChatClientOptions = {}
): HelenaChatClient {
  const authorization = (
    options.authorization ??
    process.env.WTS_CHAT_AUTHORIZATION ??
    ""
  ).trim();
  if (!authorization) throw new Error("WTS_CHAT_AUTHORIZATION ausente");

  const authorizationHeader = /^Bearer\s/i.test(authorization)
    ? authorization
    : `Bearer ${authorization}`;
  const fetchFn = options.fetchFn ?? fetch;

  async function requisitarPagina<T>(
    endpoint: string,
    params: URLSearchParams,
    schema: z.ZodType<T>
  ): Promise<{ items: T[]; hasMore: boolean }> {
    const url = new URL(
      `${HELENA_CHAT_API_BASE_URL}/${endpoint.replace(/^\/+/, "")}`
    );
    url.search = params.toString();
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: authorizationHeader,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new HelenaChatApiError(0, endpoint, "http");
    }
    if (!response.ok)
      throw new HelenaChatApiError(response.status, endpoint, "http");

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new HelenaChatApiError(response.status, endpoint, "invalid_json");
    }
    const pagina = pageSchema.safeParse(body);
    if (!pagina.success) {
      throw new HelenaChatApiError(
        response.status,
        endpoint,
        "invalid_response"
      );
    }
    const items: T[] = [];
    for (const item of pagina.data.items ?? []) {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        throw new HelenaChatApiError(
          response.status,
          endpoint,
          "invalid_response"
        );
      }
      items.push(parsed.data);
    }
    const hasMore =
      pagina.data.hasMorePages ??
      (pagina.data.totalPages !== undefined
        ? params.get("PageNumber") !== null &&
          Number(params.get("PageNumber")) < pagina.data.totalPages
        : items.length === PAGE_SIZE);
    return { items, hasMore };
  }

  async function listarPaginas<T>(
    endpoint: string,
    criarParams: (page: number) => URLSearchParams,
    schema: z.ZodType<T>
  ): Promise<T[]> {
    const todos: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await requisitarPagina(
        endpoint,
        criarParams(page),
        schema
      );
      todos.push(...result.items);
      if (!result.hasMore) return todos;
    }
    throw new HelenaChatApiError(0, endpoint, "invalid_response");
  }

  return {
    listarSessoes({ channelId, after, before }) {
      return listarPaginas(
        "/v2/session",
        page => {
          const params = new URLSearchParams({
            "LastInteractionAt.After": after.toISOString(),
            "LastInteractionAt.Before": before.toISOString(),
            PageNumber: String(page),
            PageSize: String(PAGE_SIZE),
          });
          params.append("ChannelsId", channelId);
          params.append("IncludeDetails", "ContactDetails");
          return params;
        },
        sessionSchema
      );
    },
    listarMensagens({ sessionId, after }) {
      return listarPaginas(
        `/v1/session/${encodeURIComponent(sessionId)}/message`,
        page =>
          new URLSearchParams({
            "CreatedAt.After": after.toISOString(),
            PageNumber: String(page),
            PageSize: String(PAGE_SIZE),
            OrderBy: "createdAt",
            OrderDirection: "ASCENDING",
          }),
        messageSchema
      );
    },
  };
}
