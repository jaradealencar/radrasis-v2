import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarEstadoMensagemWts } from "../integrations/wts-chat-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("consultarEstadoMensagemWts", () => {
  it("consulta a rota oficial e retorna o status da mensagem", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "DELIVERED" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await consultarEstadoMensagemWts("mensagem-123");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.wts.chat/chat/v1/message/mensagem-123/status");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        accept: "application/json",
        Authorization: "Bearer token-de-teste",
      },
    });
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

    expect(resultado).toEqual({ estado: null, detalhe: "HTTP 404: not found" });
  });
});
