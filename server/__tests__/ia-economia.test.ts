import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extrairTextoClaude, limitarHistorico, mensagemLimiteAtingido, NOTA_RESPOSTA_CORTADA, MAX_MENSAGENS_HISTORICO,
} from "../services/iaEconomia";
import { perguntarSobreClientes, perguntarSobreFinanceiro } from "../integrations/anthropic-client";
import {
  resumirRfmParaAssistente, montarContextoAssistenteClientes, type RfmCliente, type VisaoGeralClientes,
} from "../services/inteligenciaClientes";
import { ENV } from "../_core/env";

// O SDK da Anthropic é trocado por um falso: os testes conferem o que seria enviado, sem gastar nada.
const { criarMensagem } = vi.hoisted(() => ({ criarMensagem: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: criarMensagem }; },
}));

describe("extrairTextoClaude", () => {
  it("junta os blocos de texto e deixa o raciocínio de fora", () => {
    expect(extrairTextoClaude({
      content: [{ type: "thinking" }, { type: "text", text: " a " }, { type: "text", text: "b" }],
      stop_reason: "end_turn",
    })).toBe("a \nb");
  });

  it("sem texto nenhum lança erro dizendo o motivo", () => {
    expect(() => extrairTextoClaude({ content: [{ type: "thinking" }], stop_reason: "max_tokens" })).toThrow("Claude não retornou texto (stop_reason=max_tokens)");
    expect(() => extrairTextoClaude({ content: [], stop_reason: null })).toThrow(/stop_reason=null/);
  });

  it("avisa que a resposta foi cortada quando bateu no teto de tokens", () => {
    expect(extrairTextoClaude({ content: [{ type: "text", text: "meio" }], stop_reason: "max_tokens" })).toBe(`meio${NOTA_RESPOSTA_CORTADA}`);
    expect(extrairTextoClaude({ content: [{ type: "text", text: "inteiro" }], stop_reason: "end_turn" })).toBe("inteiro");
  });
});

describe("mensagemLimiteAtingido", () => {
  it("arredonda para minutos, nunca abaixo de 1", () => {
    expect(mensagemLimiteAtingido(20)).toContain("em 1 min");
    expect(mensagemLimiteAtingido(600)).toContain("em 10 min");
  });
});

describe("chats analíticos (Assistente de Clientes e Painel Financeiro)", () => {
  const original = { chave: ENV.anthropicApiKey, modelo: ENV.assistentesModeloAnthropic, esforco: ENV.assistentesEsforcoAnthropic };
  beforeEach(() => {
    ENV.anthropicApiKey = "chave-de-teste";
    ENV.assistentesModeloAnthropic = "modelo-teste";
    ENV.assistentesEsforcoAnthropic = "";
    criarMensagem.mockReset();
    criarMensagem.mockResolvedValue({ content: [{ type: "text", text: "resposta" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    ENV.anthropicApiKey = original.chave; ENV.assistentesModeloAnthropic = original.modelo; ENV.assistentesEsforcoAnthropic = original.esforco;
    vi.restoreAllMocks();
  });

  it("economia: o ponto de cache fica no bloco de DADOS (o grande), não no prompt curto", async () => {
    expect(await perguntarSobreClientes("PROMPT", "DADOS GRANDES", "pergunta?")).toBe("resposta");
    const envio = criarMensagem.mock.calls[0][0];
    expect(envio.model).toBe("modelo-teste");
    expect(envio.system).toEqual([
      { type: "text", text: "PROMPT" },
      { type: "text", text: "DADOS GRANDES", cache_control: { type: "ephemeral" } },
    ]);
    expect(envio.messages).toEqual([{ role: "user", content: "pergunta?" }]);
  });

  it("economia: só as últimas mensagens da conversa seguem junto com a pergunta", async () => {
    const conversa = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", texto: `m${i}` }));
    await perguntarSobreFinanceiro("DADOS", conversa, "nova pergunta");
    const { messages } = criarMensagem.mock.calls[0][0];
    expect(messages.length).toBeLessThanOrEqual(MAX_MENSAGENS_HISTORICO + 1);
    expect(messages[0].role).toBe("user");
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "nova pergunta" });
    expect(messages[messages.length - 2].content).toBe("m19");
  });

  it("economia: o esforço de raciocínio padrão é médio; a configuração muda e valor inválido volta ao padrão", async () => {
    await perguntarSobreClientes("P", "D", "q");
    expect(criarMensagem.mock.calls[0][0].output_config).toEqual({ effort: "medium" });

    ENV.assistentesEsforcoAnthropic = "high";
    await perguntarSobreClientes("P", "D", "q");
    expect(criarMensagem.mock.calls[1][0].output_config).toEqual({ effort: "high" });

    ENV.assistentesEsforcoAnthropic = "qualquer-coisa";
    await perguntarSobreClientes("P", "D", "q");
    expect(criarMensagem.mock.calls[2][0].output_config).toEqual({ effort: "medium" });
  });

  it("registra o uso no log e falha com o motivo quando a resposta vem vazia", async () => {
    await perguntarSobreClientes("P", "D", "q");
    expect(String((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0])).toMatch(/\[ia:clientes\] modelo=modelo-teste esforco=medium uso=\{.*\} stop=end_turn ms=\d+/);

    criarMensagem.mockResolvedValue({ content: [{ type: "thinking" }], stop_reason: "max_tokens", usage: {} });
    await expect(perguntarSobreFinanceiro("D", [], "q")).rejects.toThrow(/stop_reason=max_tokens/);
  });

  it("sem chave configurada avisa em vez de chamar a API", async () => {
    ENV.anthropicApiKey = "";
    await expect(perguntarSobreClientes("P", "D", "q")).rejects.toThrow(/ANTHROPIC_API_KEY não configurada/);
    expect(criarMensagem).not.toHaveBeenCalled();
  });
});

describe("contexto do Assistente de Clientes: RFM resumido em vez da tabela inteira", () => {
  const rfmSintetico = (n: number): RfmCliente[] => Array.from({ length: n }, (_, i) => ({
    empresaKey: `chave-interna-longa-${i}`, empresaExibicao: `Gráfica ${i}`,
    recenciaDias: i * 3, frequencia: 1 + (i % 7), valorMonetario: 1000 + i * 250,
    scoreRecencia: 1 + (i % 5), scoreFrequencia: 1 + ((i * 3) % 5), scoreValor: 1 + ((i * 7) % 5),
  }));
  const somaDasNotas = (notas: string) => (notas.match(/\d/g) ?? []).reduce((s, d) => s + Number(d), 0);

  it("traz a distribuição das notas, os melhores e os de alto valor sumindo (sem a chave interna)", () => {
    const rfm = rfmSintetico(100);
    const r = resumirRfmParaAssistente(rfm);

    expect(r.clientes).toBe(100);
    for (const dist of Object.values(r.distribuicaoNotas)) {
      expect(dist).toHaveLength(5);
      expect(dist.reduce((a, b) => a + b, 0)).toBe(100);
    }

    expect(r.melhoresClientes).toHaveLength(25);
    const maiorSoma = Math.max(...rfm.map(c => c.scoreRecencia + c.scoreFrequencia + c.scoreValor));
    expect(somaDasNotas(r.melhoresClientes[0].notas)).toBe(maiorSoma);
    const somas = r.melhoresClientes.map(l => somaDasNotas(l.notas));
    expect(somas).toEqual([...somas].sort((a, b) => b - a));

    const esperadosSumindo = rfm.filter(c => c.scoreValor >= 4 && c.scoreRecencia <= 2);
    expect(r.altoValorSumindoTotal).toBe(esperadosSumindo.length);
    expect(r.altoValorSumindo.length).toBe(Math.min(25, esperadosSumindo.length));
    for (const l of r.altoValorSumindo) {
      expect(Number(l.notas.match(/V(\d)/)![1])).toBeGreaterThanOrEqual(4);
      expect(Number(l.notas.match(/R(\d)/)![1])).toBeLessThanOrEqual(2);
    }
    const valores = r.altoValorSumindo.map(l => l.valor);
    expect(valores).toEqual([...valores].sort((a, b) => b - a));

    expect(JSON.stringify(r)).not.toContain("chave-interna-longa");
    expect(r.observacao).toContain("Não conclua nada sobre clientes que não aparecem aqui");
  });

  it("o contexto do Assistente não leva mais a tabela inteira e fica uma fração do tamanho", () => {
    const rfm = rfmSintetico(439);
    const visaoGeral = { dataReferencia: "2026-09-26T21:11:57.465Z", clientesCompradoresPeriodo: 439, classificacoes: {}, topClientesPorValor: [], rfm } as unknown as VisaoGeralClientes;
    const contexto = montarContextoAssistenteClientes(visaoGeral, {} as any, { dataReferencia: "2026-09-26T21:11:57.465Z" } as any, [], { dataInicial: "2026-01-01", dataFinal: "2026-09-26" });

    expect(contexto.visaoGeral).not.toHaveProperty("rfm");
    expect(contexto.rfmResumo.clientes).toBe(439);
    expect(contexto.visaoGeral.clientesCompradoresPeriodo).toBe(439); // o resto da visão geral segue intacto
    expect(JSON.stringify(contexto).length).toBeLessThan(JSON.stringify(rfm).length * 0.25);
  });

  it("o contexto não muda de uma pergunta para outra no mesmo dia (senão o cache do prompt nunca vale)", () => {
    const montar = (hora: string) => montarContextoAssistenteClientes(
      { dataReferencia: `2026-09-26T${hora}Z`, rfm: rfmSintetico(30), topClientesPorValor: [] } as unknown as VisaoGeralClientes,
      {} as any,
      { dataReferencia: `2026-09-26T${hora}Z` } as any,
      [], { dataInicial: "2026-01-01", dataFinal: "2026-09-26" },
    );
    const a = montar("21:11:57.465");
    const b = montar("21:11:58.929");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.visaoGeral.dataReferencia).toBe("2026-09-26");
    expect(a.previsao.dataReferencia).toBe("2026-09-26");
  });
});

describe("limitarHistorico (usado pelos três chats)", () => {
  it("é o mesmo limite do Consultor: começa por 'user' e mantém só as últimas", () => {
    const r = limitarHistorico(Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", texto: `m${i}` })));
    expect(r.length).toBeLessThanOrEqual(MAX_MENSAGENS_HISTORICO);
    expect(r[0].role).toBe("user");
  });
});
