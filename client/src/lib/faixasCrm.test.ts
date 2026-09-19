import { describe, expect, it } from "vitest";
import { chaveDia, faixaSugerida, linkWhatsAppComTexto } from "./faixasCrm";

// Datas úteis D+1..D+10 de um orçamento criado na segunda 14/09/2026 (sem fim de semana)
const uteis = [15, 16, 17, 18, 21, 22, 23, 24, 25, 28].map(dia => new Date(2026, 8, dia)); // D+1 = terça 15/09
const FAIXAS = [
  { faixa: 1 as const, diasInicio: 1, diasFim: 2 },   // 15, 16
  { faixa: 2 as const, diasInicio: 3, diasFim: 5 },   // 17, 18, 21
  { faixa: 3 as const, diasInicio: 6, diasFim: 10 },  // 22..28
];
const em = (dia: number, mes = 8) => new Date(2026, mes, dia, 15, 30);

describe("faixaSugerida", () => {
  it("no dia do orçamento (antes de D+1) sugere Pós-orçamento (0)", () => {
    expect(faixaSugerida(uteis, FAIXAS, em(14))).toBe(0);
  });

  it("sugere a faixa cujo período contém hoje", () => {
    expect(faixaSugerida(uteis, FAIXAS, em(15))).toBe(1);
    expect(faixaSugerida(uteis, FAIXAS, em(16))).toBe(1);
    expect(faixaSugerida(uteis, FAIXAS, em(17))).toBe(2);
    expect(faixaSugerida(uteis, FAIXAS, em(21))).toBe(2);
    expect(faixaSugerida(uteis, FAIXAS, em(22))).toBe(3);
    expect(faixaSugerida(uteis, FAIXAS, em(28))).toBe(3);
  });

  it("no fim de semana entre duas faixas mantém a última que já começou", () => {
    expect(faixaSugerida(uteis, FAIXAS, em(19))).toBe(2); // sábado depois da sexta 18 (faixa 2)
    expect(faixaSugerida(uteis, FAIXAS, em(20))).toBe(2); // domingo
  });

  it("depois do fim de todas as faixas continua na última (3)", () => {
    expect(faixaSugerida(uteis, FAIXAS, em(30))).toBe(3);
    expect(faixaSugerida(uteis, FAIXAS, new Date(2026, 9, 20))).toBe(3);
  });

  it("intervalo sem faixa configurada (gap) mantém a faixa anterior", () => {
    const comGap = [
      { faixa: 1 as const, diasInicio: 1, diasFim: 2 },  // 15, 16
      { faixa: 2 as const, diasInicio: 4, diasFim: 5 },  // 18, 21  (D+3 = 17 fica sem faixa)
      { faixa: 3 as const, diasInicio: 8, diasFim: 10 }, // 24, 25, 28
    ];
    expect(faixaSugerida(uteis, comGap, em(17))).toBe(1);
    expect(faixaSugerida(uteis, comGap, em(22))).toBe(2); // D+6, D+7 sem faixa
    expect(faixaSugerida(uteis, comGap, em(24))).toBe(3);
  });

  it("sem datas úteis (data de criação inválida) sugere 0", () => {
    expect(faixaSugerida([], FAIXAS, em(16))).toBe(0);
  });

  it("aceita faixas fora de ordem", () => {
    expect(faixaSugerida(uteis, [FAIXAS[2], FAIXAS[0], FAIXAS[1]], em(17))).toBe(2);
  });
});

describe("linkWhatsAppComTexto / chaveDia", () => {
  it("acrescenta o texto codificado ao link do WhatsApp (acentos, quebra de linha e emoji)", () => {
    const texto = "Oi Tadeu, tudo bem?\nSobre o pedido #28291 — R$ 6.925,19 😊";
    const url = linkWhatsAppComTexto("https://wa.me/5567999998888", texto);
    expect(url.startsWith("https://wa.me/5567999998888?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(texto);
  });

  it("chaveDia usa o dia local", () => {
    expect(chaveDia(new Date(2026, 8, 5))).toBe("2026-09-05");
  });
});
