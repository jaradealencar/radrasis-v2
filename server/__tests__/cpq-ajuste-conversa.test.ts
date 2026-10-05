import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLM = vi.fn();
vi.mock("../_core/llm", () => ({ invokeLLM: (...args: unknown[]) => invokeLLM(...args) }));

import { conversarSobreVetor, entradaConversaSchema, sanearAcoes, type RespostaConversa } from "../services/cpqAjusteConversa";

const acao = (extra: Partial<RespostaConversa["acoes"][number]> = {}): RespostaConversa["acoes"][number] => ({
  tipo: "apagar", indices: [], dxPct: null, dyPct: null, fator: null, fatorY: null, graus: null, eixo: null,
  maxCores: null, minAreaPx: null, tolerancia: null, motivo: "pedido do vendedor", ...extra,
});
const bruto = (acoes: RespostaConversa["acoes"], resposta = "Ok.") => ({ resposta, acoes });

describe("plano de ações da conversa sobre o vetor", () => {
  it("só aceita elementos que existem e remove repetidos", () => {
    const r = sanearAcoes(bruto([acao({ tipo: "apagar", indices: [2, 2, 5, 99, 4000] })]), 6);
    expect(r.acoes).toHaveLength(1);
    expect(r.acoes[0]).toMatchObject({ tipo: "apagar", indices: [2, 5] });
    expect(r.acoes[0].descricao).toBe("Apagar o(s) elemento(s) 2, 5.");
  });

  it("limita deslocamento, fator e giro a faixas seguras", () => {
    const r = sanearAcoes(bruto([
      acao({ tipo: "mover", indices: [1], dxPct: 900, dyPct: -3 }),
      acao({ tipo: "escalar", indices: [1], fator: 50 }),
      acao({ tipo: "girar", indices: [1], graus: 1000 }),
    ]), 3);
    expect(r.acoes[0]).toMatchObject({ tipo: "mover", dxPct: 100, dyPct: -3 });
    expect(r.acoes[1]).toMatchObject({ tipo: "escalar", fator: 8, fatorY: 8 });
    expect(r.acoes[2]).toMatchObject({ tipo: "girar", graus: 360 });
  });

  it("descarta ações sem efeito ou sem elementos", () => {
    const r = sanearAcoes(bruto([
      acao({ tipo: "mover", indices: [1], dxPct: 0, dyPct: 0 }),
      acao({ tipo: "escalar", indices: [1], fator: 1 }),
      acao({ tipo: "girar", indices: [1], graus: 0 }),
      acao({ tipo: "espelhar", indices: [1], eixo: null }),
      acao({ tipo: "apagar", indices: [] }),
      acao({ tipo: "nenhuma" }),
    ]), 3);
    expect(r.acoes).toEqual([]);
  });

  it("vetorizar de novo usa só os três ajustes permitidos, limitados", () => {
    const r = sanearAcoes(bruto([acao({ tipo: "revetorizar", maxCores: 500, minAreaPx: 1.5 })]), 3);
    expect(r.acoes[0]).toMatchObject({ tipo: "revetorizar", ajustes: { maxCores: 48, minAreaPx: 1.5 } });
    expect(sanearAcoes(bruto([acao({ tipo: "revetorizar" })]), 3).acoes).toEqual([]);
  });

  it("não mistura vetorização nova com edições, que dependem da numeração antiga", () => {
    const r = sanearAcoes(bruto([acao({ tipo: "revetorizar", maxCores: 5 }), acao({ tipo: "apagar", indices: [1] })], "Vou refazer."), 3);
    expect(r.acoes.map(a => a.tipo)).toEqual(["revetorizar"]);
    expect(r.resposta).toContain("depois da nova vetorização");
  });
});

describe("pedido enviado ao assistente", () => {
  const base = {
    mensagem: "apague o círculo de baixo", imagem: "data:image/png;base64,AAAA", totalElementos: 4,
    elementos: [{ i: 0, x: 0, y: 0, w: 50, h: 50, cor: "#ffc700", areaPct: 20 }],
    qualidade: { status: "fail", iou: 80, iouTolerante: 82, proporcao: 0.4, deslocamento: 1.2, falhas: ["x"] },
  };

  it("aceita um pedido completo e recusa o que foge do formato", () => {
    expect(entradaConversaSchema.safeParse(base).success).toBe(true);
    expect(entradaConversaSchema.safeParse({ ...base, imagem: "http://exemplo.com/a.png" }).success).toBe(false);
    expect(entradaConversaSchema.safeParse({ ...base, mensagem: "a" }).success).toBe(false);
    expect(entradaConversaSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  beforeEach(() => invokeLLM.mockReset());

  it("manda a imagem e as regras do administrador ao modelo e devolve o plano limpo", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(bruto([acao({ tipo: "apagar", indices: [0, 9] })], "Apagando o círculo.")) } }] });
    const r = await conversarSobreVetor(entradaConversaSchema.parse(base), "- No máximo 6 cores.");
    expect(r.resposta).toBe("Apagando o círculo.");
    expect(r.acoes).toEqual([expect.objectContaining({ tipo: "apagar", indices: [0] })]);
    const chamada = invokeLLM.mock.calls[0][0];
    expect(chamada.messages[0].content).toContain("No máximo 6 cores.");
    expect(chamada.messages[1].content[1].image_url.url).toBe(base.imagem);
    expect(chamada.responseFormat.type).toBe("json_schema");
  });

  it("resposta fora do formato vira erro", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ resposta: 1 }) } }] });
    await expect(conversarSobreVetor(entradaConversaSchema.parse(base), "")).rejects.toThrow();
  });
});
