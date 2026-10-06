import { describe, expect, it } from "vitest";
import { calcularFactibilidadeFabricacao } from "../services/cpqFactibilidadeFabricacao";
import { agruparCaminhosFacePorMateriaPrima } from "../services/cpqCoresMateriais";

/**
 * Logo de duas cores (ex.: letras brancas + detalhe laranja): cada cor de acrílico é uma matéria-prima e tem o seu próprio lote de peças
 * (o seu nesting), enquanto o fundo de PVC cobre o letreiro inteiro, não importa a cor da frente.
 */
const chapas = [{ id: 1, nome: "1000 x 2000", larguraMm: 1000, alturaMm: 2000 }];
const BRANCO = 4520;
const LARANJA = 4521;
const PVC = 4530;

// caminho 0 = "O" branco (com vazado); caminho 1 = retângulo laranja; caminho 2 = outra letra branca
const O = "M100 20H220V220H100Z M130 50V190H190V50Z";
const BARRA = "M300 20H400V120H300Z";
const I = "M500 20H540V220H500Z";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 250" width="1000" height="250"><g id="Face">`
  + `<path d="${O}" fill="#000" fill-rule="evenodd"/><path d="${BARRA}" fill="#000"/><path d="${I}" fill="#000"/></g></svg>`;

describe("duas cores de acrílico + fundo de PVC", () => {
  // As regiões aprovadas da análise de cores: branco = caminhos 0 e 2; laranja = caminho 1.
  const faceCaminhos = agruparCaminhosFacePorMateriaPrima([
    { materiaPrimaId: BRANCO, pathIndexes: [0] },
    { materiaPrimaId: LARANJA, pathIndexes: [1] },
    { materiaPrimaId: BRANCO, pathIndexes: [2] },
  ]);
  const caminhosDe = (id: number) => faceCaminhos.find(item => item.materiaPrimaId === id)!.pathIndexes;

  const resultado = calcularFactibilidadeFabricacao({
    svg, larguraSvgMm: 1000, alturaSvgMm: 250,
    materiais: [
      { id: BRANCO, nome: "Acrílico Branco 3mm", chapas, lotes: [{ camada: "face", pathIndexes: caminhosDe(BRANCO) }] },
      { id: LARANJA, nome: "Acrílico Laranja 3mm", chapas, lotes: [{ camada: "face", pathIndexes: caminhosDe(LARANJA) }] },
      { id: PVC, nome: "PVC Expandido 10mm", chapas, lotes: [{ camada: "fundo" }] },
    ],
  });
  const porId = new Map(resultado.materiais.map(item => [item.id_materia_prima, item]));

  it("agrupa os caminhos da face por matéria-prima: uma cor por material", () => {
    expect(caminhosDe(BRANCO)).toEqual([0, 2]);
    expect(caminhosDe(LARANJA)).toEqual([1]);
  });

  it("cada cor de acrílico recebe só as peças da sua cor, para um nesting próprio", () => {
    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    expect(porId.get(BRANCO)!.pecas_para_nesting).toHaveLength(2); // o "O" e o "I"
    expect(porId.get(LARANJA)!.pecas_para_nesting).toHaveLength(1); // a barra
    const ids = [...porId.get(BRANCO)!.pecas_para_nesting, ...porId.get(LARANJA)!.pecas_para_nesting].map(peca => peca.id);
    expect(new Set(ids).size).toBe(3); // nenhuma peça repetida entre as cores
  });

  it("o fundo de PVC contempla todo o letreiro, de todas as cores da frente", () => {
    const fundo = porId.get(PVC)!.pecas_para_nesting;
    expect(fundo).toHaveLength(3);
    expect(fundo.every(peca => peca.id.startsWith("fundo-"))).toBe(true);
    expect(resultado.avisos.some(aviso => /fundo de PVC Expandido 10mm usa a mesma silhueta da face/.test(aviso))).toBe(true);
  });

  it("peça fora da cor do material não entra no lote (a pathIndex errada é recusada)", () => {
    expect(() => calcularFactibilidadeFabricacao({
      svg, larguraSvgMm: 1000, alturaSvgMm: 250,
      materiais: [{ id: BRANCO, nome: "Acrílico Branco 3mm", chapas, lotes: [{ camada: "fundo", pathIndexes: [0] }] }],
    })).toThrow(/não pertence à camada fundo/);
  });
});
