import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HELENA_CHAT_API_BASE_URL,
  HelenaChatApiError,
  criarHelenaChatClient,
} from "../integrations/helena-chat-client";
import {
  calcularInicioPollingHelena,
  executarPollingHelena,
  importarMensagensHelena,
  sincronizarRespostasHelena,
} from "../services/campanhasWhatsappHelenaPolling";
import type {
  HelenaChatClient,
  HelenaMessage,
  HelenaSession,
} from "../integrations/helena-chat-client";
import type { MensagemInboundEntrada } from "../services/campanhasWhatsappInboundBuffer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function respostaJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sessaoBase = {
  id: "session-1",
  lastInteractionDate: "2026-11-01T12:00:00.000Z",
  lastMessageIn: "2026-11-01T12:00:00.000Z",
  contactDetails: {
    name: "Contato Fictício",
    phonenumber: "5567999990001",
  },
};

describe("cliente de leitura da API Helena", () => {
  it("lista sessões paginadas do canal com Bearer e detalhes de contato", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        respostaJson({ items: [sessaoBase], hasMorePages: true })
      )
      .mockResolvedValueOnce(
        respostaJson({
          items: [{ ...sessaoBase, id: "session-2" }],
          hasMorePages: false,
        })
      );
    const client = criarHelenaChatClient({
      authorization: "token-ficticio",
      fetchFn,
    });

    const sessions = await client.listarSessoes({
      channelId: "canal-ficticio",
      after: new Date("2026-10-31T00:00:00.000Z"),
      before: new Date("2026-11-01T23:59:00.000Z"),
    });

    expect(sessions.map(session => session.id)).toEqual([
      "session-1",
      "session-2",
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchFn.mock.calls[0][0]));
    expect(firstUrl.origin + firstUrl.pathname).toBe(
      `${HELENA_CHAT_API_BASE_URL}/v2/session`
    );
    expect(firstUrl.searchParams.get("ChannelsId")).toBe("canal-ficticio");
    expect(firstUrl.searchParams.get("IncludeDetails")).toBe("ContactDetails");
    expect(firstUrl.searchParams.get("PageNumber")).toBe("1");
    expect(
      new URL(String(fetchFn.mock.calls[1][0])).searchParams.get("PageNumber")
    ).toBe("2");
    expect(fetchFn.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer token-ficticio",
    });
  });

  it("consulta mensagens da sessão e não expõe conteúdo em erro HTTP", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        respostaJson({ items: [], totalPages: 0, hasMorePages: false })
      );
    const client = criarHelenaChatClient({
      authorization: "Bearer token-ficticio",
      fetchFn,
    });
    await client.listarMensagens({
      sessionId: "session/uuid",
      after: new Date("2026-11-01T00:00:00.000Z"),
    });
    const url = new URL(String(fetchFn.mock.calls[0][0]));
    expect(url.pathname).toBe("/chat/v1/session/session%2Fuuid/message");
    expect(url.searchParams.get("CreatedAt.After")).toBe(
      "2026-11-01T00:00:00.000Z"
    );

    const erroClient = criarHelenaChatClient({
      authorization: "token-ficticio",
      fetchFn: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("conteudo sensível do fornecedor", { status: 403 })
        ),
    });
    const requisicaoFalha = erroClient.listarSessoes({
      channelId: "canal-ficticio",
      after: new Date("2026-11-01T00:00:00.000Z"),
      before: new Date("2026-11-01T01:00:00.000Z"),
    });
    const erro = await requisicaoFalha.catch((value: unknown) => value);
    expect(erro).toMatchObject({
      name: HelenaChatApiError.name,
      status: 403,
    });
    expect((erro as Error).message).not.toContain(
      "conteudo sensível do fornecedor"
    );
  });

  it("exige credencial antes de criar o cliente", () => {
    expect(() => criarHelenaChatClient({ authorization: " " })).toThrow(
      "WTS_CHAT_AUTHORIZATION ausente"
    );
  });
});

describe("importação idempotente de respostas", () => {
  it("importa somente mensagens do cliente, preserva identidade e usa o buffer existente", async () => {
    const since = new Date("2026-10-31T00:00:00.000Z");
    const sessoes: HelenaSession[] = [
      sessaoBase,
      {
        ...sessaoBase,
        id: "session-stale",
        lastMessageIn: "2026-10-29T00:00:00.000Z",
      },
      {
        ...sessaoBase,
        id: "session-no-phone",
        contactDetails: { name: "Sem Telefone", phonenumber: null },
      },
    ];
    const client: HelenaChatClient = {
      listarSessoes: vi.fn().mockResolvedValue(sessoes),
      listarMensagens: vi.fn(async ({ sessionId }: { sessionId: string }) => {
        if (sessionId === "session-stale")
          throw new Error("não deve consultar");
        if (sessionId === "session-no-phone") {
          return [
            {
              id: "message-no-phone",
              createdAt: "2026-11-01T12:02:00.000Z",
              timestamp: null,
              type: "TEXT",
              direction: "TO_HUB",
              text: "Resposta sem telefone",
              details: null,
            },
          ] satisfies HelenaMessage[];
        }
        return [
          {
            id: "message-outbound",
            createdAt: "2026-11-01T12:00:00.000Z",
            timestamp: null,
            type: "TEXT",
            direction: "FROM_HUB",
            text: "Mensagem do atendimento",
            details: null,
          },
          {
            id: "message-inbound",
            createdAt: "2026-11-01T12:01:00.000Z",
            timestamp: "2026-11-01T12:00:59.000Z",
            type: "TEXT",
            direction: "TO_HUB",
            text: "Quero um orçamento",
            details: {
              contact: {
                name: "Contato Fictício",
                phoneNumber: "5567999990001",
              },
            },
          },
          {
            id: "message-duplicate",
            createdAt: "2026-11-01T12:02:00.000Z",
            timestamp: "2026-11-01T12:02:00.000Z",
            type: "BUTTONS",
            direction: "TO_HUB",
            text: "Tenho interesse",
            details: null,
          },
        ] satisfies HelenaMessage[];
      }),
    };
    const registrar = vi.fn(async (input: MensagemInboundEntrada) => ({
      ok: true,
      telefone: String(input.telefone),
      ehBot: false,
      motivoBot: null,
      duplicada: input.mensagemIdExterno === "message-duplicate",
      id: 1,
    }));

    const resultado = await importarMensagensHelena({
      client,
      registrar,
      canalId: "canal-ficticio",
      desde: since,
      ate: new Date("2026-11-01T13:00:00.000Z"),
    });

    expect(client.listarSessoes).toHaveBeenCalledWith({
      channelId: "canal-ficticio",
      after: since,
      before: new Date("2026-11-01T13:00:00.000Z"),
    });
    expect(client.listarMensagens).toHaveBeenCalledTimes(2);
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(
      registrar.mock.calls.map(([input]) => input.mensagemIdExterno)
    ).toEqual(["message-inbound", "message-duplicate"]);
    expect(registrar.mock.calls[0][0]).toMatchObject({
      telefone: "5567999990001",
      nome: "Contato Fictício",
      tipoMensagem: "text",
      texto: "Quero um orçamento",
      recebidoEm: new Date("2026-11-01T12:00:59.000Z"),
    });
    expect(registrar.mock.calls[1][0].tipoMensagem).toBe("button_reply");
    expect(resultado).toMatchObject({
      estado: "concluido",
      sessoesConsultadas: 2,
      mensagensConsultadas: 4,
      mensagensRecebidas: 3,
      gravadas: 1,
      duplicadas: 1,
      telefonesInvalidos: 1,
      enviosDoAtendimentoIgnorados: 1,
    });
  });

  it("não grava parcialmente se uma leitura de mensagens falhar", async () => {
    const client: HelenaChatClient = {
      listarSessoes: vi.fn().mockResolvedValue([sessaoBase]),
      listarMensagens: vi.fn().mockRejectedValue(new Error("falha sintética")),
    };
    const registrar = vi.fn(async (_input: MensagemInboundEntrada) => ({
      ok: true,
      telefone: "5567999990001",
      ehBot: false,
      motivoBot: null,
      duplicada: false,
      id: 1,
    }));

    await expect(
      importarMensagensHelena({
        client,
        registrar,
        canalId: "canal-ficticio",
        desde: new Date("2026-11-01T00:00:00.000Z"),
        ate: new Date("2026-11-01T13:00:00.000Z"),
      })
    ).rejects.toThrow("falha sintética");
    expect(registrar).not.toHaveBeenCalled();
  });
});

describe("janela móvel do polling", () => {
  it("limita a busca a sete dias e sobrepõe 48h da última mensagem persistida", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    expect(calcularInicioPollingHelena(null, now)).toEqual(
      new Date("2026-10-25T12:00:00.000Z")
    );
    expect(
      calcularInicioPollingHelena(new Date("2026-11-01T10:00:00.000Z"), now)
    ).toEqual(new Date("2026-10-30T10:00:00.000Z"));
    expect(
      calcularInicioPollingHelena(new Date("2026-10-01T10:00:00.000Z"), now)
    ).toEqual(new Date("2026-10-25T12:00:00.000Z"));
  });

  it("mantém o polling desligado sem consultar banco ou API", async () => {
    vi.stubEnv("CAMPANHAS_CECI_POLLING_ENABLED", "false");
    const resultado = await sincronizarRespostasHelena();
    expect(resultado).toMatchObject({ estado: "desabilitado", gravadas: 0 });
  });

  it("só avança o cursor depois de concluir a leitura e a persistência", async () => {
    const ate = new Date("2026-11-01T12:00:00.000Z");
    const avancarCursor = vi.fn(async () => undefined);
    const client: HelenaChatClient = {
      listarSessoes: vi.fn().mockResolvedValue([]),
      listarMensagens: vi.fn(),
    };

    const resultado = await executarPollingHelena({
      client,
      registrar: vi.fn(),
      canalId: "canal-ficticio",
      cursorAt: null,
      ate,
      avancarCursor,
    });

    expect(resultado.estado).toBe("concluido");
    expect(avancarCursor).toHaveBeenCalledOnce();
    expect(avancarCursor).toHaveBeenCalledWith(ate);

    const falhaCursor = vi.fn(async () => undefined);
    const clientComFalha: HelenaChatClient = {
      listarSessoes: vi.fn().mockResolvedValue([sessaoBase]),
      listarMensagens: vi.fn().mockRejectedValue(new Error("falha de leitura")),
    };
    await expect(
      executarPollingHelena({
        client: clientComFalha,
        registrar: vi.fn(),
        canalId: "canal-ficticio",
        cursorAt: null,
        ate,
        avancarCursor: falhaCursor,
      })
    ).rejects.toThrow("falha de leitura");
    expect(falhaCursor).not.toHaveBeenCalled();
  });
});
