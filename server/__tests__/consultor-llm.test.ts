import { describe, it, expect, afterEach, vi } from "vitest";
import {
  conversarComFallback, motivoAmigavel, provedoresDisponiveis, chamadasReais, ErroIA,
  type ChamadaIA, type PedidoIA, type Provedor, type RespostaIA,
} from "../services/consultorLlm";
import { ENV } from "../_core/env";

const PEDIDO: PedidoIA = { system: "SISTEMA + CONTEXTO", historico: [{ role: "user", texto: "oi" }, { role: "assistant", texto: "olá" }], pergunta: "e agora?" };

const resposta = (provedor: Provedor): RespostaIA => ({ texto: `ok ${provedor}`, provedor, modelo: "m" });

describe("conversarComFallback", () => {
  it("usa o primeiro provedor que responder e cai para o próximo quando um falha", async () => {
    const falhas: string[] = [];
    const chamadas: Record<Provedor, ChamadaIA> = {
      gemini: async () => { throw new Error("Gemini 429: RESOURCE_EXHAUSTED"); },
      anthropic: async () => resposta("anthropic"),
      openai: async () => { throw new Error("não deveria chegar aqui"); },
    };
    const r = await conversarComFallback(PEDIDO, ["gemini", "anthropic", "openai"], chamadas, p => falhas.push(p));
    expect(r.provedor).toBe("anthropic");
    expect(falhas).toEqual(["gemini"]);
  });

  it("avisa quando nenhum provedor está configurado", async () => {
    const vazio = {} as Record<Provedor, ChamadaIA>;
    await expect(conversarComFallback(PEDIDO, [], vazio)).rejects.toMatchObject({ codigo: "SEM_PROVEDOR" });
    await expect(conversarComFallback(PEDIDO, [], vazio)).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("junta os motivos em português quando todos falham, sem vazar detalhes técnicos", async () => {
    const chamadas: Record<Provedor, ChamadaIA> = {
      gemini: async () => { throw new Error("Gemini 400: model not found"); },
      anthropic: async () => { throw new Error("401 invalid x-api-key sk-ant-SEGREDO"); },
      openai: async () => { throw new Error('LLM invoke failed: 429 – {"code":"credit_balance_exhausted"}'); },
    };
    const erro = await conversarComFallback(PEDIDO, ["gemini", "anthropic", "openai"], chamadas).catch(e => e);
    expect(erro).toBeInstanceOf(ErroIA);
    expect(erro.codigo).toBe("TODOS_FALHARAM");
    expect(erro.message).toContain("Gemini: modelo indisponível");
    expect(erro.message).toContain("Claude: chave inválida ou sem permissão");
    expect(erro.message).toContain("OpenAI: sem créditos");
    expect(erro.message).not.toContain("SEGREDO");
  });
});

describe("motivoAmigavel", () => {
  it("classifica os erros mais comuns", () => {
    expect(motivoAmigavel("openai", new Error("insufficient_quota"))).toBe("OpenAI: sem créditos");
    expect(motivoAmigavel("gemini", new Error("Gemini 429: RESOURCE_EXHAUSTED"))).toBe("Gemini: limite de uso atingido");
    expect(motivoAmigavel("anthropic", new Error("403 permission denied"))).toBe("Claude: chave inválida ou sem permissão");
    expect(motivoAmigavel("anthropic", new Error("algo estranho"))).toBe("Claude: erro na chamada");
  });
});

describe("provedoresDisponiveis", () => {
  const original = { g: ENV.geminiApiKey, a: ENV.anthropicApiKey, o: ENV.openaiApiKey, f: ENV.consultorProvedor };
  afterEach(() => {
    ENV.geminiApiKey = original.g; ENV.anthropicApiKey = original.a; ENV.openaiApiKey = original.o; ENV.consultorProvedor = original.f;
  });

  it("segue a ordem Gemini → Claude → OpenAI e pula os sem chave", () => {
    ENV.geminiApiKey = ""; ENV.anthropicApiKey = "x"; ENV.openaiApiKey = "y"; ENV.consultorProvedor = "";
    expect(provedoresDisponiveis()).toEqual(["anthropic", "openai"]);
    ENV.geminiApiKey = "g";
    expect(provedoresDisponiveis()).toEqual(["gemini", "anthropic", "openai"]);
  });

  it("CONSULTOR_IA_PROVEDOR força um só provedor (se tiver chave)", () => {
    ENV.geminiApiKey = "g"; ENV.anthropicApiKey = "x"; ENV.openaiApiKey = "y"; ENV.consultorProvedor = "openai";
    expect(provedoresDisponiveis()).toEqual(["openai"]);
    ENV.openaiApiKey = "";
    expect(provedoresDisponiveis()).toEqual([]);
  });
});

describe("chamada ao Gemini", () => {
  const original = { g: ENV.geminiApiKey, m: ENV.geminiModel };
  afterEach(() => { ENV.geminiApiKey = original.g; ENV.geminiModel = original.m; vi.unstubAllGlobals(); });

  it("monta a requisição REST com o contexto como instrução do sistema e converte os papéis", async () => {
    ENV.geminiApiKey = "chave-de-teste"; ENV.geminiModel = "gemini-teste";
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "resposta " }, { text: "do gemini" }] } }], usageMetadata: { totalTokenCount: 10 } }),
    });
    vi.stubGlobal("fetch", fetchFalso);

    const r = await chamadasReais.gemini(PEDIDO);
    expect(r).toMatchObject({ texto: "resposta do gemini", provedor: "gemini", modelo: "gemini-teste" });

    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-teste:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("chave-de-teste");
    const corpo = JSON.parse(init.body);
    expect(corpo.systemInstruction.parts[0].text).toBe("SISTEMA + CONTEXTO");
    expect(corpo.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(corpo.contents[2].parts[0].text).toBe("e agora?");
  });

  it("propaga erro HTTP e resposta vazia para o fallback tratar", async () => {
    ENV.geminiApiKey = "k";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "RESOURCE_EXHAUSTED" }));
    await expect(chamadasReais.gemini(PEDIDO)).rejects.toThrow(/Gemini 429/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }));
    await expect(chamadasReais.gemini(PEDIDO)).rejects.toThrow(/não retornou texto/);
  });
});
