import { describe, expect, it } from "vitest";
import { sugerirProdutividades, type CandidataSolda, type ContextoSolda } from "../services/cpqSoldaProdutividade";

/** A faixa legada `ate_11cm` representa as duas novas faixas inferiores. */
const candidata = (parcial: Partial<CandidataSolda> & Pick<CandidataSolda, "id" | "nome">): CandidataSolda => ({
  tiposSolda: ["barra_roscada"],
  tamanhos: [],
  materiais: ["galvanizado"],
  ...parcial,
});

const contexto: ContextoSolda = { tiposFixacao: ["barra_roscada"], titulo: "Letreiro Letra Caixa Galvanizado", tipoProduto: null, material: "galvanizado" };
const faixaAbaixo8 = { faixa: "abaixo_8cm" as const, perimetroM: 1.2, elementos: 2 };
const faixaEntre8e11 = { faixa: "entre_8_11cm" as const, perimetroM: 3.2, elementos: 6 };
const faixaAcima11 = { faixa: "acima_11cm" as const, perimetroM: 12.5, elementos: 8 };
const FAIXA_LEGADA = candidata({ id: 1, nome: "Produtividade Solda 61º [Galvanizado]", tamanhos: ["ate_11cm"] });

describe("faixas de tamanho da produtividade de solda", () => {
  it("a classificação legada vale para menor que 8 cm e entre 8-11cm, mas não acima de 11 cm", () => {
    const resultado = sugerirProdutividades(contexto, [faixaAbaixo8, faixaEntre8e11, faixaAcima11], [FAIXA_LEGADA]);
    expect(resultado[0].escolhida?.id).toBe(1);
    expect(resultado[1].escolhida?.id).toBe(1);
    expect(resultado[2].escolhida).toBeNull();
  });

  it("uma marcação exata vence uma produtividade legada que cobre as duas faixas inferiores", () => {
    const exataAbaixo8 = candidata({ id: 2, nome: "Produtividade Solda 62º [Galvanizado]", tamanhos: ["abaixo_8cm"] });
    const [abaixo8] = sugerirProdutividades(contexto, [faixaAbaixo8], [FAIXA_LEGADA, exataAbaixo8]);
    expect(abaixo8.escolhida?.id).toBe(2);
    expect(abaixo8.alternativas.map(opcao => opcao.id)).toContain(1);
  });

  it("uma produtividade marcada só acima de 11 cm não serve às duas faixas inferiores", () => {
    const soAcima11 = candidata({ id: 3, nome: "Produtividade Solda 63º [Galvanizado]", tamanhos: ["acima_11cm"] });
    const resultado = sugerirProdutividades(contexto, [faixaAbaixo8, faixaEntre8e11], [soAcima11]);
    expect(resultado.map(faixa => faixa.escolhida)).toEqual([null, null]);
  });

  it("um cliente antigo que envia a faixa agregada continua recebendo produtividade menor ou igual a 11 cm", () => {
    const faixaLegada = { faixa: "ate_11cm" as const, perimetroM: 3.2, elementos: 6 };
    const [resultado] = sugerirProdutividades(contexto, [faixaLegada], [FAIXA_LEGADA]);
    expect(resultado).toMatchObject({ faixa: "ate_11cm", necessaria: true, escolhida: { id: 1 } });
  });
});
