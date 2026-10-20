import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consultarEstadoMensagemWts, criarCampanhaWts, enviarTemplateWts, idMensagemWts, urlStatusMensagemWts,
} from "../integrations/wts-chat-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enviarTemplateWts", () => {
  it("envia payload como objeto PublicReqSendTemplateSingleDTO", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    vi.stubEnv("WTS_CHAT_FROM", "5511999990000");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "msg-001", status: "QUEUED" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await enviarTemplateWts("5567999990001", "template-teste");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.app.ceci.chat/chat/v1/send/template");
    const bodyEnviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Array.isArray(bodyEnviado)).toBe(false);
    expect(bodyEnviado).toMatchObject({
      to: "5567999990001",
      from: "5511999990000",
      templateId: "template-teste",
    });
    expect(bodyEnviado.senderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(bodyEnviado.senderId).not.toBe("b13d2257-af6d-4cbb-a4fd-fa73069ae863");
    expect(resultado.ok).toBe(true);
  });

  it("gera um senderId diferente para cada mensagem", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "msg-unique", status: "QUEUED" }),
    }));

    await enviarTemplateWts("5567999990001", "template-teste");
    await enviarTemplateWts("5567999990001", "template-teste");

    const fetchMock = vi.mocked(fetch);
    const senderIds = fetchMock.mock.calls.map(call => JSON.parse(call[1]!.body as string).senderId);
    expect(senderIds[0]).not.toBe(senderIds[1]);
  });

  it("inclui parameters quando fornecido", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "msg-002", status: "QUEUED" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await enviarTemplateWts("5567999990001", "template-teste", { "1": "Daniel" });

    const bodyEnviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Array.isArray(bodyEnviado)).toBe(false);
    expect(bodyEnviado.parameters).toEqual({ "1": "Daniel" });
  });
});

describe("idMensagemWts", () => {
  it("extrai ID de resposta em formato objeto", () => {
    expect(idMensagemWts(JSON.stringify({ id: "msg-12345678" }))).toBe("msg-12345678");
  });

  it("extrai ID de resposta em formato array", () => {
    expect(idMensagemWts(JSON.stringify([{ id: "msg-12345678", status: "QUEUED" }]))).toBe("msg-12345678");
  });
});

describe("criarCampanhaWts", () => {
  it("chama endpoint de campanhas com nome, template e contatos", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "camp-999" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await criarCampanhaWts("Campanha Teste", "template-123", ["5567999990001"]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.app.ceci.chat/chat/v1/campaigns");
    expect(res.ok).toBe(true);
    expect(res.campanhaId).toBe("camp-999");
  });
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
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.app.ceci.chat/v1/send/message/mensagem-123");
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

  it("consulta GET /chat/v1/send/message/{id} quando não há statusUrl do aceite (endpoint confirmado pelo usuário 19/10/2026)", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "READ" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await consultarEstadoMensagemWts("mensagem-456");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.wts.chat/chat/v1/send/message/mensagem-456");
    expect(resultado).toMatchObject({ estado: "READ" });
  });

  it("desce pela lista de fallback (send/message Ceci, depois a rota documentada) quando a statusUrl e o send/message da WTS falham", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Message not found" }) // statusUrl do aceite
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "not found" }) // GET send/message na WTS
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "not found" }) // GET send/message na Ceci
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: "DELIVERED" }) }); // rota documentada
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await consultarEstadoMensagemWts("mensagem-123", "https://api.app.ceci.chat/v1/send/message/mensagem-123");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.wts.chat/chat/v1/send/message/mensagem-123");
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.app.ceci.chat/chat/v1/send/message/mensagem-123");
    expect(fetchMock.mock.calls[3][0]).toBe("https://api.app.ceci.chat/chat/v1/message/mensagem-123/status");
    expect(resultado).toMatchObject({ estado: "DELIVERED" });
  });

  it("preserva o detalhe HTTP quando a consulta falha em todos os domínios/endpoints", async () => {
    vi.stubEnv("WTS_CHAT_AUTHORIZATION", "token-de-teste");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    }));

    const resultado = await consultarEstadoMensagemWts("id-inexistente");

    // Sem statusUrl, tenta send/message (WTS, Ceci) e depois a rota documentada (Ceci, WTS); as quatro falham
    // igual no mock, então a mensagem concatena as quatro tentativas.
    expect(resultado).toEqual({
      estado: null,
      detalhe: [
        "/chat/v1/send/message/id-inexistente: HTTP 404: not found",
        "/chat/v1/send/message/id-inexistente: HTTP 404: not found",
        "/chat/v1/message/id-inexistente/status: HTTP 404: not found",
        "/chat/v1/message/id-inexistente/status: HTTP 404: not found",
      ].join(" | "),
    });
  });
});
