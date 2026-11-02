import { describe, expect, it } from "vitest";
import {
  avaliarRegrasErp,
  detectarPedidoOptOut,
  proximoHorarioEntreDisparos,
  proximoHorarioUtil,
  telefoneParaE164,
} from "../services/campanhaCadenciaRules";

describe("regras da engine de cadências", () => {
  it("normaliza telefone brasileiro para E.164", () => {
    expect(telefoneParaE164("(67) 99999-8888")).toBe("+5567999998888");
  });

  it("detecta opt-out mesmo dentro de uma frase e ignora palavras parecidas", () => {
    expect(detectarPedidoOptOut("Por favor, não quero receber mais mensagens.")).toBe(true);
    expect(detectarPedidoOptOut("Pode me descadastrar? ")).toBe(true);
    expect(detectarPedidoOptOut("Saí da loja ontem.")).toBe(false);
  });

  it("avalia condições ERP como conjunção e não inclui clientes recorrentes antigos", () => {
    const fatos = {
      telefoneE164: "+5567999998888",
      nome: "Cliente",
      cnpj: null,
      clienteId: 1,
      totalOrders: 5,
      ordersLast90Days: 1,
      daysSincePurchase: 59,
      quoteStatus: null,
      daysSinceQuote: null,
      ordersAfterLatestQuote: 0,
      ultimaCompraEm: "2026-09-04",
      ultimoOrcamentoEm: null,
    } as const;
    const regraRecorrentes = [
      { campo: "total_orders", operador: "gte", valor: 5 },
      { campo: "days_since_purchase", operador: "lt", valor: 60 },
    ] as const;

    expect(avaliarRegrasErp(fatos, regraRecorrentes)).toBe(true);
    expect(avaliarRegrasErp({ ...fatos, daysSincePurchase: 60 }, regraRecorrentes)).toBe(false);
    expect(avaliarRegrasErp(fatos, [])).toBe(false);
  });

  it("adia finais de semana e horários fora da janela local", () => {
    const sextaAposExpediente = new Date("2026-11-07T00:00:00.000Z"); // sexta, 20h em Campo Grande
    expect(proximoHorarioUtil(sextaAposExpediente, 0).toISOString()).toBe("2026-11-09T12:30:00.000Z");

    const sabado = new Date("2026-11-07T14:00:00.000Z");
    expect(proximoHorarioUtil(sabado, 0).toISOString()).toBe("2026-11-09T12:30:00.000Z");
  });

  it("mantém o próximo disparo dentro da janela de Campo Grande", () => {
    const sextaNoFimDaJanela = new Date("2026-11-06T21:29:59.000Z"); // 17:29:59 local
    expect(proximoHorarioEntreDisparos(sextaNoFimDaJanela, 3).toISOString()).toBe("2026-11-09T12:30:00.000Z");
  });
});
