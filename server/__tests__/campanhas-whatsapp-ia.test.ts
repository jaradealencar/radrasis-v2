import { describe, expect, it } from "vitest";
import {
  BLACKLIST_SEMANTICA_BOT,
  DEBOUNCE_BUFFER_SEGUNDOS,
  LIMITE_RESPOSTA_BOT_SEGUNDOS,
  classificarFaixaIcp,
  classificarFaixaLatencia,
  detectarBot,
  formatarFaixaHeatmap,
} from "../../shared/campanhas-whatsapp-ia";
import {
  extrairMensagensDoPayload,
  whatsappInboundWebhookSchema,
} from "../routes/campanhas-whatsapp-inbound";
import { resolverFonteRetargeting } from "../services/fontesErpCampanhas";
import {
  analisarRespostaComGemini,
  criarFallbackPadrao,
  criarFallbackResumoExecutivo,
  montarPayloadPrompt,
  montarPayloadResumoExecutivo,
  resultadoAnaliseGeminiSchema,
  resumoExecutivoGeminiSchema,
  sanearRespostaGemini,
} from "../services/campanhasWhatsappIa";

describe("detectarBot", () => {
  it("button_reply e list_reply nunca são bot, mesmo respondendo instantaneamente", () => {
    expect(
      detectarBot({
        tipoMensagem: "button_reply",
        texto: "Sim",
        tempoRespostaSegundos: 0,
      })
    ).toEqual({ ehBot: false, motivo: null });
    expect(
      detectarBot({
        tipoMensagem: "list_reply",
        texto: "Opção 1",
        tempoRespostaSegundos: 1,
      })
    ).toEqual({ ehBot: false, motivo: null });
  });

  it("texto respondido em menos de LIMITE_RESPOSTA_BOT_SEGUNDOS é bot", () => {
    expect(
      detectarBot({
        tipoMensagem: "text",
        texto: "oi",
        tempoRespostaSegundos: LIMITE_RESPOSTA_BOT_SEGUNDOS - 1,
      })
    ).toEqual({ ehBot: true, motivo: "resposta_rapida" });
  });

  it("no limite exato (4s) ainda NÃO é bot — só abaixo dele", () => {
    expect(
      detectarBot({
        tipoMensagem: "text",
        texto: "oi",
        tempoRespostaSegundos: LIMITE_RESPOSTA_BOT_SEGUNDOS,
      }).ehBot
    ).toBe(false);
  });

  it("sem tempo de resposta conhecido (null), só a blacklist semântica decide", () => {
    expect(
      detectarBot({
        tipoMensagem: "text",
        texto: "Quero saber o preço",
        tempoRespostaSegundos: null,
      })
    ).toEqual({ ehBot: false, motivo: null });
  });

  it("blacklist semântica pega mesmo com acentos/caixa diferentes, mas não falso-positiva em texto comum", () => {
    expect(
      detectarBot({
        tipoMensagem: "text",
        texto: "Esta é uma MENSAGEM AUTOMÁTICA de confirmação",
        tempoRespostaSegundos: 30,
      })
    ).toEqual({ ehBot: true, motivo: "blacklist_semantica" });
    expect(
      detectarBot({
        tipoMensagem: "text",
        texto: "Quanto custa o letreiro em ACM?",
        tempoRespostaSegundos: 30,
      })
    ).toEqual({ ehBot: false, motivo: null });
  });

  it("toda a blacklist dispara a detecção (sanity check da lista)", () => {
    for (const termo of BLACKLIST_SEMANTICA_BOT) {
      expect(
        detectarBot({
          tipoMensagem: "text",
          texto: termo,
          tempoRespostaSegundos: 100,
        }).ehBot
      ).toBe(true);
    }
  });
});

describe("classificarFaixaIcp", () => {
  it("80-100 é quente, 50-79 é morno, 1-49 é frio", () => {
    expect(classificarFaixaIcp(100)).toBe("quente");
    expect(classificarFaixaIcp(80)).toBe("quente");
    expect(classificarFaixaIcp(79)).toBe("morno");
    expect(classificarFaixaIcp(50)).toBe("morno");
    expect(classificarFaixaIcp(49)).toBe("frio");
    expect(classificarFaixaIcp(1)).toBe("frio");
  });
});

describe("formatarFaixaHeatmap", () => {
  it("formata dia da semana + hora", () => {
    expect(formatarFaixaHeatmap(2, 10)).toBe("Terça, 10h");
    expect(formatarFaixaHeatmap(0, 0)).toBe("Domingo, 00h");
  });
});

describe("DEBOUNCE_BUFFER_SEGUNDOS", () => {
  it("está dentro da janela pedida de 30-60s", () => {
    expect(DEBOUNCE_BUFFER_SEGUNDOS).toBeGreaterThanOrEqual(30);
    expect(DEBOUNCE_BUFFER_SEGUNDOS).toBeLessThanOrEqual(60);
  });
});

describe("criarFallbackPadrao", () => {
  it("sempre cai em DESQUALIFICADO_OUTROS com nível/score mínimos", () => {
    const fallback = criarFallbackPadrao("API indisponível");
    expect(fallback.cluster).toBe("DESQUALIFICADO_OUTROS");
    expect(fallback.nivel_interesse).toBe(1);
    expect(fallback.icp_fit_score).toBe(1);
    expect(fallback.perfil_interlocutor).toBe("DESCONHECIDO");
    expect(fallback.motivo_objecao).toBe("NENHUMA");
    // Passa pelo próprio schema de validação (garante que o fallback nunca quebraria o parse).
    expect(() => resultadoAnaliseGeminiSchema.parse(fallback)).not.toThrow();
  });
});

describe("montarPayloadPrompt", () => {
  it("monta o payload de entrada no formato pedido e filtra mensagens vazias", () => {
    const payload = JSON.parse(
      montarPayloadPrompt("Promoção de letreiros ACM", [
        "Olá",
        "  ",
        "Quanto custa em ACM 3x1m?",
      ])
    );
    expect(payload.mensagem_campanha_enviada).toBe("Promoção de letreiros ACM");
    expect(payload.mensagens_resposta_cliente).toEqual([
      "Olá",
      "Quanto custa em ACM 3x1m?",
    ]);
  });

  it("sem nenhuma mensagem de texto, ainda produz um payload válido (não lança)", () => {
    expect(() => montarPayloadPrompt("", [])).not.toThrow();
  });
});

describe("sanearRespostaGemini", () => {
  // Achado em teste real com a API (17/10/2026): o IntegerSchema do SDK do Gemini não tem minimum/maximum
  // (só ArraySchema tem minItems/maxItems) — a instrução de range é só texto, e um teste real pediu
  // nivel_interesse 1-5 e o Gemini devolveu 9. Sem este saneamento, o Zod rejeitaria e o lead cairia inteiro
  // no fallback DESQUALIFICADO_OUTROS — descartando por engano um lead quente de verdade.
  it("faz clamp de nivel_interesse e icp_fit_score fora do range, em vez de deixar o Zod rejeitar tudo", () => {
    const saneado = sanearRespostaGemini({
      cluster: "ORCAMENTO_DIRETO",
      resumo_intencao: "Cliente de altíssimo interesse",
      nivel_interesse: 9, // bug real observado: fora de 1-5
      palavras_chave: ["ACM"],
      icp_fit_score: 250, // fora de 1-100
      perfil_interlocutor: "DESCONHECIDO",
      parametros_projeto: [],
      motivo_objecao: "NENHUMA",
      resumo_objecao: null,
    }) as any;
    expect(saneado.nivel_interesse).toBe(5);
    expect(saneado.icp_fit_score).toBe(100);
    // E o resultado saneado passa no parse Zod que antes rejeitaria o valor cru.
    expect(() => resultadoAnaliseGeminiSchema.parse(saneado)).not.toThrow();
  });

  it("faz clamp também para valores abaixo do mínimo (0, negativo)", () => {
    const saneado = sanearRespostaGemini({
      cluster: "DESQUALIFICADO_OUTROS",
      resumo_intencao: "x",
      nivel_interesse: 0,
      palavras_chave: [],
      icp_fit_score: -5,
      perfil_interlocutor: "DESCONHECIDO",
      parametros_projeto: [],
      motivo_objecao: "NENHUMA",
      resumo_objecao: null,
    }) as any;
    expect(saneado.nivel_interesse).toBe(1);
    expect(saneado.icp_fit_score).toBe(1);
  });

  it("não mexe em valores já dentro do range", () => {
    const saneado = sanearRespostaGemini({
      cluster: "DUVIDA_TECNICA",
      resumo_intencao: "x",
      nivel_interesse: 3,
      palavras_chave: [],
      icp_fit_score: 65,
      perfil_interlocutor: "DESCONHECIDO",
      parametros_projeto: [],
      motivo_objecao: "NENHUMA",
      resumo_objecao: null,
    }) as any;
    expect(saneado.nivel_interesse).toBe(3);
    expect(saneado.icp_fit_score).toBe(65);
  });

  it("trunca arrays maiores que o pedido em vez de rejeitar", () => {
    const saneado = sanearRespostaGemini({
      cluster: "DUVIDA_TECNICA",
      resumo_intencao: "x",
      nivel_interesse: 3,
      palavras_chave: ["a", "b", "c", "d", "e", "f", "g", "h"], // mais que o limite de 6
      icp_fit_score: 50,
      perfil_interlocutor: "DESCONHECIDO",
      parametros_projeto: Array.from({ length: 15 }, (_, i) => `item${i}`), // mais que o limite de 10
      motivo_objecao: "NENHUMA",
      resumo_objecao: null,
    }) as any;
    expect(saneado.palavras_chave.length).toBeLessThanOrEqual(6);
    expect(saneado.parametros_projeto.length).toBeLessThanOrEqual(10);
  });

  it("entrada que não é objeto (null, string) é devolvida como está, sem lançar", () => {
    expect(sanearRespostaGemini(null)).toBeNull();
    expect(sanearRespostaGemini("texto solto")).toBe("texto solto");
  });
});

describe("extrairMensagensDoPayload (webhook Meta/WhatsApp Cloud API)", () => {
  it("extrai mensagem de texto simples com nome do contato", () => {
    const payload = whatsappInboundWebhookSchema.parse({
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                contacts: [
                  { profile: { name: "Ana Silva" }, wa_id: "5567999990000" },
                ],
                messages: [
                  {
                    id: "wamid.123",
                    from: "5567999990000",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Quanto custa?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const mensagens = extrairMensagensDoPayload(payload);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({
      telefone: "5567999990000",
      nome: "Ana Silva",
      tipoMensagem: "text",
      texto: "Quanto custa?",
      mensagemIdExterno: "wamid.123",
    });
    expect(mensagens[0].recebidoEm).toEqual(new Date(1700000000 * 1000));
  });

  it("extrai button_reply e list_reply com o título como texto", () => {
    const payload = whatsappInboundWebhookSchema.parse({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "m1",
                    from: "5567999990001",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "btn1", title: "Quero orçamento" },
                    },
                  },
                  {
                    id: "m2",
                    from: "5567999990002",
                    type: "interactive",
                    interactive: {
                      type: "list_reply",
                      list_reply: { id: "opt1", title: "Dúvida técnica" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const mensagens = extrairMensagensDoPayload(payload);
    expect(mensagens[0]).toMatchObject({
      tipoMensagem: "button_reply",
      texto: "Quero orçamento",
    });
    expect(mensagens[1]).toMatchObject({
      tipoMensagem: "list_reply",
      texto: "Dúvida técnica",
    });
  });

  it("payload sem mensagens (ex.: webhook só de status de entrega) não lança e devolve lista vazia", () => {
    const payload = whatsappInboundWebhookSchema.parse({
      entry: [{ changes: [{ value: {} }] }],
    });
    expect(extrairMensagensDoPayload(payload)).toEqual([]);
  });

  it("payload totalmente vazio (entry ausente) também é aceito", () => {
    const payload = whatsappInboundWebhookSchema.parse({});
    expect(extrairMensagensDoPayload(payload)).toEqual([]);
  });
});

describe("resolverFonteRetargeting", () => {
  it("devolve lista vazia quando config for nulo ou sem origemCampanhaId", async () => {
    expect(await resolverFonteRetargeting(null)).toEqual([]);
    expect(await resolverFonteRetargeting(undefined)).toEqual([]);
    expect(await resolverFonteRetargeting({})).toEqual([]);
    expect(
      await resolverFonteRetargeting({ cluster: "DUVIDA_TECNICA" })
    ).toEqual([]);
  });
});

describe("classificarFaixaLatencia", () => {
  it("classifica corretamente faixas de resposta humana", () => {
    expect(classificarFaixaLatencia(30)).toBe("ATE_5MIN");
    expect(classificarFaixaLatencia(300)).toBe("ATE_5MIN");
    expect(classificarFaixaLatencia(301)).toBe("DE_5_A_15MIN");
    expect(classificarFaixaLatencia(900)).toBe("DE_5_A_15MIN");
    expect(classificarFaixaLatencia(1800)).toBe("DE_15_A_60MIN");
    expect(classificarFaixaLatencia(7200)).toBe("DE_1_A_4H");
    expect(classificarFaixaLatencia(36000)).toBe("DE_4_A_24H");
    expect(classificarFaixaLatencia(100000)).toBe("ACIMA_24H");
  });
});

describe("resumoExecutivoGeminiSchema e fallback", () => {
  it("valida payload do resumo executivo", () => {
    const payload = montarPayloadResumoExecutivo({
      nomeCampanha: "Reativação Outubro",
      totalDisparado: 100,
      respostasHumanas: 15,
      taxaRespostaPct: 15,
      cliquesCta: 4,
      totalLeadsQualificados: 15,
      clusters: [{ cluster: "ORCAMENTO_DIRETO", total: 10, percentual: 66.7 }],
      objecoes: [{ motivo: "PRECO_ORCAMENTO", total: 3, percentual: 20 }],
      amostraIntencoes: ["Quero cotação para fachada em ACM"],
      amostraObjecoes: [{ motivo: "PRECO_ORCAMENTO", resumo: "Achou valor acima do concorrente" }],
      distribuicaoIcp: { quente: 8, morno: 5, frio: 2 },
      tempoMedioReacaoMinutos: 18,
    });
    expect(payload).toContain("Reativação Outubro");
    expect(payload).toContain("15%");
  });

  it("cria fallback robusto de resumo executivo com indicadores", () => {
    const fallback = criarFallbackResumoExecutivo("API indisponível no momento", {
      nomeCampanha: "Campanha Teste",
      totalDisparado: 50,
      respostasHumanas: 6,
      taxaRespostaPct: 12,
      cliquesCta: 2,
      totalLeadsQualificados: 6,
      clusters: [{ cluster: "ORCAMENTO_DIRETO", total: 4, percentual: 66.7 }],
      objecoes: [{ motivo: "PRAZO_ENTREGA", total: 2, percentual: 33.3 }],
      amostraIntencoes: ["Preciso de orçamento urgente"],
      amostraObjecoes: [{ motivo: "PRAZO_ENTREGA", resumo: "Precisa em 5 dias" }],
      distribuicaoIcp: { quente: 4, morno: 2, frio: 0 },
    });

    expect(fallback.temperaturaAudiencia).toBe("INTERESSE_MODERADO");
    expect(fallback.visaoGeral).toContain("6 respostas humanas");
    expect(fallback.pontosFortesOferta.length).toBeGreaterThanOrEqual(1);
    expect(fallback.principaisDoresObjecoes.length).toBe(1);
    expect(fallback.recomendacoesProximaCampanha.length).toBeGreaterThan(0);
  });
});

// ─── Camada 2: teste de contrato (API real do Gemini, pulado por padrão) ────
// Mesmo padrão de server/__tests__/mubisys.test.ts ("contrato da API MubiSys"): só roda com a env var
// explícita, não pela mera presença de GEMINI_API_KEY (evita custo/instabilidade de rede em CI).
// GEMINI_TESTE_CONTRATO=1 npx vitest run server/__tests__/campanhas-whatsapp-ia.test.ts
//
// Validado manualmente em 17/10/2026 com gemini-2.5-flash: 4/4 casos (orçamento direto, dúvida técnica,
// objeção de fornecedor, desqualificado) classificados corretamente. Achado nessa validação: o
// IntegerSchema do SDK não tem minimum/maximum (só a description do schema pede o range em texto) — um
// teste devolveu nivel_interesse=9 fora do range 1-5, corrigido por sanearRespostaGemini (ver teste acima).
// Achado maior: sem thinkingConfig:{thinkingBudget:0} (ver gemini-client.ts), o gemini-2.5-flash gastava o
// teto de maxOutputTokens inteiro em "pensamento" invisível e cortava o JSON no meio em metade das chamadas
// de um schema de 9 campos (finishReason "MAX_TOKENS", thoughtsTokenCount de até 981/1024 tokens).
const rodarContratoGemini = process.env.GEMINI_TESTE_CONTRATO === "1";

describe.skipIf(!rodarContratoGemini)(
  "contrato da API Gemini (rede real)",
  () => {
    it("classifica uma mensagem de orçamento direto com alto ICP score, dentro dos ranges pedidos", async () => {
      const r = await analisarRespostaComGemini(
        "Promoção de letreiros em ACM",
        [
          "Oi, quanto custa um letreiro de 3x1m em ACM com LED?",
          "Preciso para instalar até sexta-feira",
        ],
        { lancarErro: true }
      );
      expect(r.cluster).toBe("ORCAMENTO_DIRETO");
      expect(r.nivel_interesse).toBeGreaterThanOrEqual(1);
      expect(r.nivel_interesse).toBeLessThanOrEqual(5);
      expect(r.icp_fit_score).toBeGreaterThanOrEqual(1);
      expect(r.icp_fit_score).toBeLessThanOrEqual(100);
      expect(r.icp_fit_score).toBeGreaterThanOrEqual(70); // mensagem com medida + prazo deveria pontuar "quente"
    }, 30_000);

    it("classifica uma objeção de fornecedor fixo", async () => {
      const r = await analisarRespostaComGemini(
        "Promoção de letreiros em ACM",
        ["Já trabalho com outro fornecedor há anos, mas valeu o contato"],
        { lancarErro: true }
      );
      expect(r.cluster).toBe("OBJECAO_FORNECEDOR");
      expect(r.motivo_objecao).toBe("FORNECEDOR_FIXO");
    }, 30_000);
  }
);
