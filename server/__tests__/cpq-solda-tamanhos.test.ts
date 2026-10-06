import { describe, expect, it } from "vitest";
import { sugerirProdutividades, type CandidataSolda, type ContextoSolda } from "../services/cpqSoldaProdutividade";

/**
 * Cada produtividade pode ser cadastrada para mais de um tamanho (≤ 11 cm e/ou > 11 cm): serve às duas faixas, mas a
 * marcação exata de uma faixa pontua mais que a marcada para as duas, e a marcada só para a outra faixa nunca serve.
 */
const candidata = (parcial: Partial<CandidataSolda> & Pick<CandidataSolda, "id" | "nome">): CandidataSolda => ({
  tiposSolda: ["barra_roscada"],
  tamanhos: [],
  materiais: ["galvanizado"],
  ...parcial,
});

const contexto: ContextoSolda = { tiposFixacao: ["barra_roscada"], titulo: "Letreiro Letra Caixa Galvanizado", tipoProduto: null, material: "galvanizado" };
const faixaAte = { faixa: "ate_11cm" as const, perimetroM: 3.2, elementos: 6 };
const faixaAcima = { faixa: "acima_11cm" as const, perimetroM: 12.5, elementos: 8 };

describe("produtividade cadastrada para os dois tamanhos", () => {
  const AMBOS = candidata({ id: 1, nome: "Produtividade Solda 61º [Galvanizado]", tamanhos: ["ate_11cm", "acima_11cm"] });

  it("serve às duas faixas e explica o motivo", () => {
    const [ate, acima] = sugerirProdutividades(contexto, [faixaAte, faixaAcima], [AMBOS]);
    expect(ate.escolhida?.id).toBe(1);
    expect(acima.escolhida?.id).toBe(1);
    expect(ate.escolhida?.motivos.map(m => m.texto)).toContain("Cadastrada para os dois tamanhos (≤ 11 cm e > 11 cm).");
  });

  it("a marcação exata da faixa vence a marcada para os dois", () => {
    const exata = candidata({ id: 2, nome: "Produtividade Solda 62º [Galvanizado]", tamanhos: ["acima_11cm"] });
    const [acima] = sugerirProdutividades(contexto, [faixaAcima], [AMBOS, exata]);
    expect(acima.escolhida?.id).toBe(2);
    expect(acima.alternativas.map(a => a.id)).toContain(1);
    const exataPequena = candidata({ id: 3, nome: "Produtividade Solda 63º [Galvanizado]", tamanhos: ["ate_11cm"] });
    const [ate] = sugerirProdutividades(contexto, [faixaAte], [AMBOS, exata, exataPequena]);
    expect(ate.escolhida?.id).toBe(3);
  });

  it("sem a marcação exata, a marcada para os dois é escolhida e a da outra faixa é descartada", () => {
    const soAcima = candidata({ id: 2, nome: "Produtividade Solda 62º [Galvanizado]", tamanhos: ["acima_11cm"] });
    const [ate] = sugerirProdutividades(contexto, [faixaAte], [soAcima, AMBOS]);
    expect(ate.escolhida?.id).toBe(1);
    expect([ate.escolhida, ...ate.alternativas].some(o => o?.id === 2)).toBe(false);
  });

  it("marcada só para ≤ 11 cm não serve para letras maiores", () => {
    const soPequena = candidata({ id: 3, nome: "Produtividade Solda 63º [Galvanizado]", tamanhos: ["ate_11cm"] });
    const [acima] = sugerirProdutividades(contexto, [faixaAcima], [soPequena]);
    expect(acima.escolhida).toBeNull();
    expect(acima.confianca).toBe("nenhuma");
  });
});
