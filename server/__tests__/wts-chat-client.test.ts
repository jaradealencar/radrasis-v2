import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarEstadoMensagemWts, urlStatusMensagemWts } from "../integrations/wts-chat-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("consultarEstadoMensagemWts", () => {
  it("prioriza a statusUrl do aceite e retorna o status da mensagem", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "DELIVERED" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const statusUrl = urlStatusMensagemWts(JSON.stringify({ statusUrl: "/v1/send/message/mensagem-123" }), "mensagem-123");
    const resultado = await consultarEstadoMensagemWts("mensagem-123", statusUrl);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.wts.chat/v1/send/message/mensagem-123");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        accept: "application/json",
        Authorization: "Bearer token-de-teste",
      },
    });
    expect(resultado).toMatchObject({ estado: "DELIVERED" });
  });

  it("ignora statusUrl de outro host ou de outro ID", () => {
    expect(urlStatusMensagemWts(JSON.stringify({ statusUrl: "https://evil.example/v1/send/message/mensagem-123" }), "mensagem-123")).toBeNull();
    expect(urlStatusMensagemWts(JSON.stringify({ statusUrl: "/v1/send/message/outra-mensagem" }), "mensagem-123")).toBeNull();
  });

  it("usa a rota documentada quando a statusUrl do aceite falha", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Message not found" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: "DELIVERED" }) });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await consultarEstadoMensagemWts("mensagem-123", "https://api.wts.chat/v1/send/message/mensagem-123");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.wts.chat/chat/v1/message/mensagem-123/status");
    expect(resultado).toMatchObject({ estado: "DELIVERED" });
  });

  it("preserva o detalhe HTTP quando a consulta falha", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    }));

    const resultado = await consultarEstadoMensagemWts("id-inexistente");

    expect(resultado).toEqual({ estado: null, detalhe: "/chat/v1/message/id-inexistente/status: HTTP 404: not found" });
  });
});
