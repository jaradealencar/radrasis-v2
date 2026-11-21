import { describe, expect, it } from "vitest";
import { calcularAtrasoRateLimitSegundos, contarLotes, detectarAlertasFila, estimarDuracaoFilaSegundos, estaDentroJanelaEnvio, formatarDuracaoEstimada, gerarDatasProgramadas, MAX_TENTATIVAS_AUTOMATICAS_429, numeroLote, proximoInstantePermitido, resumirFilaProgramada } from "../../shared/campanhas-whatsapp-fila";

describe("calendário e lotes da fila de campanhas", () => {
  it("gera seis envios a cada 30 dias a partir da data inicial", () => {
    expect(gerarDatasProgramadas("2026-11-20", 6, 30)).toEqual([
      "2026-11-20",
      "2026-12-20",
      "2027-01-19",
      "2027-02-18",
      "2027-03-20",
      "2027-04-19",
    ]);
  });

  it("divide 1.700 contatos em 17 lotes de até 100", () => {
    expect(contarLotes(1700)).toBe(17);
    expect(numeroLote(0)).toBe(1);
    expect(numeroLote(99)).toBe(1);
    expect(numeroLote(100)).toBe(2);
    expect(numeroLote(1699)).toBe(17);
  });

  it("retoma após três lotes sem contar contatos aceitos duas vezes", () => {
    const itens = Array.from({ length: 1700 }, (_, indice) => ({
      lote: numeroLote(indice),
      status: indice < 300 ? "aceito" : "pendente",
      statusEntrega: indice < 300 ? "QUEUED" : null,
    }));
    const pausada = resumirFilaProgramada(itens);
    expect(pausada).toMatchObject({ aceitos: 300, entregues: 0, pendentes: 1400, lotesConcluidos: 3 });
    expect(itens.find(item => item.status === "pendente")?.lote).toBe(4);

    for (let indice = 300; indice < 400; indice++) itens[indice].status = "aceito";
    const retomada = resumirFilaProgramada(itens);
    expect(retomada).toMatchObject({ aceitos: 400, pendentes: 1300, lotesConcluidos: 4 });
  });

  it("separa aceite da confirmação de entrega", () => {
    expect(resumirFilaProgramada([{ lote: 1, status: "aceito", statusEntrega: "QUEUED" }]))
      .toMatchObject({ aceitos: 1, entregues: 0, falhas: 0 });
    expect(resumirFilaProgramada([{ lote: 1, status: "aceito", statusEntrega: "DELIVERED" }]))
      .toMatchObject({ aceitos: 1, entregues: 1, falhas: 0 });
  });

  it("conta opt-outs como cancelamentos sem tratá-los como falhas", () => {
    expect(resumirFilaProgramada([
      { lote: 1, status: "aceito", statusEntrega: "QUEUED" },
      { lote: 1, status: "cancelado" },
    ])).toMatchObject({ aceitos: 1, cancelados: 1, falhas: 0, lotesConcluidos: 1 });
  });

  it("valida os limites da programação", () => {
    expect(() => gerarDatasProgramadas("2026-02-30", 6, 30)).toThrow();
    expect(() => gerarDatasProgramadas("2026-11-20", 3, 30)).toThrow();
    expect(() => gerarDatasProgramadas("2026-11-20", 6, 0)).toThrow();
    expect(contarLotes(0)).toBe(0);
  });

  it("gera alertas só na transição para conclusão ou pausa de autorização", () => {
    const anteriores = new Map([[401, "em_andamento"], [402, "em_andamento"], [403, "pausado"]]);
    const alertas = detectarAlertasFila(anteriores, [
      { envioProgramadoId: 401, campanhaNome: "SP 01", status: "concluido" },
      { envioProgramadoId: 402, campanhaNome: "SP 02", status: "pausado", motivoPausa: "Acesso negado pela WTS.Chat (HTTP 403)." },
      { envioProgramadoId: 403, campanhaNome: "SP 03", status: "pausado", motivoPausa: "Pausado pelo usuário." },
    ]);
    expect(alertas.map(a => a.tipo)).toEqual(["concluido", "autorizacao"]);
    expect(detectarAlertasFila(new Map(), [{ envioProgramadoId: 401, campanhaNome: "SP 01", status: "concluido" }])).toEqual([]);
  });

  it("estima os lotes, as pausas e o tempo entre contatos", () => {
    const duracao = estimarDuracaoFilaSegundos(1700, 5, 3);
    expect(duracao).toBe(9_897);
    expect(formatarDuracaoEstimada(duracao)).toBe("2 h 45 min");
    expect(estimarDuracaoFilaSegundos(0, 5)).toBe(0);
    expect(formatarDuracaoEstimada(0)).toBe("0 min");
    expect(() => estimarDuracaoFilaSegundos(10, 0)).toThrow();
  });

  it("respeita os dias e horários escolhidos no fuso de Cuiabá", () => {
    const janela = { ativa: true, horaInicio: "09:00", horaFim: "18:00", diasSemana: [1, 2, 3, 4, 5] };
    expect(estaDentroJanelaEnvio(new Date("2026-11-20T19:00:00.000Z"), janela)).toBe(true);
    expect(estaDentroJanelaEnvio(new Date("2026-11-21T20:00:00.000Z"), janela)).toBe(false);
    expect(proximoInstantePermitido(new Date("2026-11-21T20:00:00.000Z"), janela).toISOString()).toBe("2026-11-23T13:00:00.000Z");
    expect(() => proximoInstantePermitido(new Date(), { ...janela, horaInicio: "18:00", horaFim: "09:00" })).toThrow();
  });

  it("aplica backoff para 429 e limita as tentativas automáticas", () => {
    expect([1, 2, 3, 4, 5].map(tentativa => calcularAtrasoRateLimitSegundos(tentativa))).toEqual([30, 60, 120, 240, 480]);
    expect(calcularAtrasoRateLimitSegundos(1, 3600)).toBe(3600);
    expect(MAX_TENTATIVAS_AUTOMATICAS_429).toBe(5);
  });
});
