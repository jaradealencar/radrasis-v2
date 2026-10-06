import { describe, expect, it } from "vitest";
import { areaMultiPoligono, faixaDeBorda, type Anel, type MultiPoligono } from "../services/cpqFaixaAro";
import {
  larguraFaixaAroOuPadrao,
  larguraFaixaAroValida,
  LARGURA_FAIXA_ARO_PADRAO_MM,
  papelEhAro,
} from "../../shared/faixa-aro";

/** Anel fechado (último ponto = primeiro), em mm. */
const retangulo = (x: number, y: number, largura: number, altura: number, horario = false): Anel => {
  const anel: Anel = [[x, y], [x + largura, y], [x + largura, y + altura], [x, y + altura], [x, y]];
  return horario ? anel.slice().reverse() : anel;
};

const L = 6; // largura padrão do aro (mm)

describe("faixa do aro: só as bordas, sem o miolo", () => {
  it("quadrado de 100 mm: uma faixa de 6 mm por dentro (anel com furo)", () => {
    const faixa = faixaDeBorda([[retangulo(0, 0, 100, 100)]], L);
    expect(faixa).toHaveLength(1);
    expect(faixa[0]).toHaveLength(2); // contorno externo + contorno interno
    expect(areaMultiPoligono(faixa)).toBeCloseTo(100 * 100 - 88 * 88, 0); // 2256 mm²
  });

  it("todos os anéis voltam fechados e o primeiro de cada polígono é o externo (maior)", () => {
    const faixa = faixaDeBorda([[retangulo(0, 0, 100, 100), retangulo(35, 35, 30, 30)]], L);
    for (const poligono of faixa) {
      for (const anel of poligono) expect(anel[0]).toEqual(anel[anel.length - 1]);
      const largura = (anel: Anel) => Math.max(...anel.map(p => p[0])) - Math.min(...anel.map(p => p[0]));
      for (const furo of poligono.slice(1)) expect(largura(furo)).toBeLessThan(largura(poligono[0]));
    }
  });

  it("vazado (miolo do P, do O…) ganha faixa própria dentro do metal da letra: peça separada", () => {
    // 100×100 com furo de 30×30: faixa externa + faixa em volta do furo (cantos do furo arredondados: 120·6 + π·6²)
    const faixa = faixaDeBorda([[retangulo(0, 0, 100, 100), retangulo(35, 35, 30, 30)]], L);
    expect(faixa).toHaveLength(2);
    expect(Math.abs(areaMultiPoligono(faixa) - (2256 + 120 * L + Math.PI * L * L))).toBeLessThan(3);
  });

  it("haste mais fina que o dobro da largura não tem miolo: vira peça inteira", () => {
    const faixa = faixaDeBorda([[retangulo(0, 0, 10, 100)]], L);
    expect(faixa).toHaveLength(1);
    expect(faixa[0]).toHaveLength(1); // sem furo
    expect(areaMultiPoligono(faixa)).toBeCloseTo(1000, 0);
  });

  it("formas separadas viram faixas separadas", () => {
    const faixa = faixaDeBorda([[retangulo(0, 0, 100, 100)], [retangulo(200, 0, 100, 100)]], L);
    expect(faixa).toHaveLength(2);
    expect(areaMultiPoligono(faixa)).toBeCloseTo(2 * 2256, 0);
  });

  it("não depende da posição nem do sentido de desenho dos anéis", () => {
    const base = areaMultiPoligono(faixaDeBorda([[retangulo(0, 0, 100, 100)]], L));
    expect(areaMultiPoligono(faixaDeBorda([[retangulo(1234.5, 987.6, 100, 100)]], L))).toBeCloseTo(base, 1);
    expect(areaMultiPoligono(faixaDeBorda([[retangulo(0, 0, 100, 100, true)]], L))).toBeCloseTo(base, 1);
    // furo desenhado no mesmo sentido do externo (par/ímpar) dá o mesmo resultado
    const mesmoSentido = faixaDeBorda([[retangulo(0, 0, 100, 100), retangulo(35, 35, 30, 30)]], L);
    const sentidoOposto = faixaDeBorda([[retangulo(0, 0, 100, 100), retangulo(35, 35, 30, 30, true)]], L);
    expect(areaMultiPoligono(mesmoSentido)).toBeCloseTo(areaMultiPoligono(sentidoOposto), 1);
  });

  it("a largura muda a faixa: 6 mm gasta menos metal que 12 mm", () => {
    const fina = areaMultiPoligono(faixaDeBorda([[retangulo(0, 0, 100, 100)]], 6));
    const larga = areaMultiPoligono(faixaDeBorda([[retangulo(0, 0, 100, 100)]], 12));
    expect(fina).toBeLessThan(larga);
    expect(larga).toBeCloseTo(100 * 100 - 76 * 76, 0);
  });

  it("geometria vazia devolve vazio; largura inválida é recusada", () => {
    expect(faixaDeBorda([], L)).toEqual([]);
    const forma: MultiPoligono = [[retangulo(0, 0, 100, 100)]];
    for (const largura of [0, -3, NaN, Infinity]) expect(() => faixaDeBorda(forma, largura)).toThrow(RangeError);
  });
});

describe("regras compartilhadas do aro", () => {
  it("largura padrão de 6 mm e limites", () => {
    expect(LARGURA_FAIXA_ARO_PADRAO_MM).toBe(6);
    expect(larguraFaixaAroValida(6)).toBe(true);
    expect(larguraFaixaAroValida(0.5)).toBe(false);
    expect(larguraFaixaAroValida(51)).toBe(false);
    expect(larguraFaixaAroValida("6")).toBe(false);
    expect(larguraFaixaAroOuPadrao(8)).toBe(8);
    expect(larguraFaixaAroOuPadrao(undefined)).toBe(6);
    expect(larguraFaixaAroOuPadrao(NaN)).toBe(6);
  });

  it("só o papel 'Aro' ativa a faixa; Lateral, Perfil e Contorno não", () => {
    for (const papel of ["Aro", "aro", " ARO ", "Aro metálico", "Aro/Face"]) expect(papelEhAro(papel)).toBe(true);
    for (const papel of ["Lateral", "Perfil", "Contorno", "Face", "Fundo", "Faro", "Arosa", "", null, undefined]) expect(papelEhAro(papel)).toBe(false);
  });
});
