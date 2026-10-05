import { describe, expect, it } from "vitest";
import {
  aplicarCustosBobinaAgrupados,
  sugerirMaterialParaCor,
  type CpqCorAlvo,
  type CpqCorCatalogo,
  type CpqCorrespondenciaCorInput,
} from "../services/cpqCoresMateriais";

const precos = {
  vinilBrancoM2: 30, vinilBrancoTransmissaoPct: null, vinilTransparenteM2: 35, vinilTransparenteTransmissaoPct: null,
  impressaoM2: 20, laminacaoM2: 10, larguraBobinaMm: 1000, larguraUtilBobinaMm: 1000, sangriaPerimetralMm: 0, retalhoReutilizavel: true,
};

function dadosPreco(minX: number, maxX: number, minY: number, maxY: number) {
  const areaM2 = ((maxX - minX) * (maxY - minY)) / 1_000_000;
  return { areaLiquidaM2: areaM2 / 2, areaTotalM2: areaM2, larguraMm: maxX - minX, alturaMm: maxY - minY, boundingBoxesMm: [{ minX, maxX, minY, maxY }] };
}

function entrada(extra: Partial<CpqCorrespondenciaCorInput> = {}): CpqCorrespondenciaCorInput {
  return {
    regiao: { key: "r1", tipoCor: "solida", corHex: "#FF0000", dadosPreco: dadosPreco(0, 400, 0, 300) },
    chapas: [],
    adesivos: [],
    iluminacao: "sem_iluminacao",
    baseImpressao: "branco",
    laminar: false,
    precos,
    construcaoFace: "acrilico_total",
    ...extra,
  };
}

const chapaTransparente: CpqCorCatalogo = {
  id: 7, mubisysMateriaPrimaId: 4520, materialNome: "Acrílico transparente 3mm", transparenciaTipo: "transparente", principal: true, ativo: true,
};

const imprimaxLonge: CpqCorCatalogo = {
  id: 1, codigo: "IMX-GOLD-MAX-VERMELHO-VIVO", linha: "Gold Max", nomeCor: "Vermelho Vivo", tipoVinil: "polimerico",
  corHex: "#A72118", precoM2: 40, ativo: true,
};

describe("CPQ cores — adesivo sobre acrílico transparente", () => {
  it("usa o Imprimax mais próximo mesmo distante, exige base transparente e avisa o vendedor", () => {
    const r = sugerirMaterialParaCor(entrada({ adesivos: [imprimaxLonge], chapas: [chapaTransparente] }));
    expect(r.tipoSugestao).toBe("imprimax");
    expect(r.imprimaxAdesivoId).toBe(1);
    expect(r.requerChapaBase).toBe(true);
    expect(r.chapaBaseMateriaPrimaId).toBe(4520);
    expect(r.deltaE00).toBeGreaterThan(5);
    expect(r.avisos.some(a => a.includes("acrílico deve ser transparente"))).toBe(true);
    expect(r.avisos.some(a => a.startsWith("Atenção vendedor"))).toBe(true);
    expect(r.avisos.some(a => a.includes("acrílico TRANSPARENTE + adesivo Imprimax Gold Max Vermelho Vivo"))).toBe(true);
  });

  it("cor sem chapa e sem catálogo Imprimax importado cai para impressão digital e avisa", () => {
    const r = sugerirMaterialParaCor(entrada());
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.avisos.some(a => a.includes("Nenhuma cor Imprimax"))).toBe(true);
  });

  it("gradiente em produto de acrílico vira acrílico transparente + adesivo impresso e pede autorização", () => {
    const r = sugerirMaterialParaCor(entrada({ regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: dadosPreco(0, 400, 0, 300) }, chapas: [chapaTransparente] }));
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.requerChapaBase).toBe(true);
    expect(r.avisos.some(a => a.includes("acrílico TRANSPARENTE + adesivo impresso com a dimensão do letreiro"))).toBe(true);
  });

  it("sem saber a construção da face, pede confirmação em vez de assumir acrílico", () => {
    const r = sugerirMaterialParaCor(entrada({ construcaoFace: "nao_informada", adesivos: [imprimaxLonge] }));
    expect(r.requerChapaBase).toBe(false);
    expect(r.requerConfirmacaoConstrucao).toBe(true);
  });
});

describe("CPQ cores — adesivo impresso com a dimensão do letreiro", () => {
  it("cobra uma única peça do tamanho do letreiro, e não a soma dos contornos", () => {
    const regioes: Array<Pick<CpqCorAlvo, "key" | "dadosPreco">> = [
      { key: "a", dadosPreco: dadosPreco(0, 100, 0, 100) },
      { key: "b", dadosPreco: dadosPreco(900, 1000, 0, 100) },
    ];
    const sugestoes = regioes.map(regiao => sugerirMaterialParaCor(entrada({
      regiao: { key: regiao.key, tipoCor: "gradiente", dadosPreco: regiao.dadosPreco },
    })));
    const letreiro = { minX: 0, maxX: 1000, minY: 0, maxY: 500 };
    const antes = aplicarCustosBobinaAgrupados(sugestoes, regioes, precos);
    const depois = aplicarCustosBobinaAgrupados(sugestoes, regioes, precos, letreiro);
    const soma = (itens: typeof depois) => itens.reduce((total, item) => total + (item.areaConsumoM2 ?? 0), 0);
    expect(soma(antes)).toBeLessThan(0.5);
    expect(soma(depois)).toBeCloseTo(0.5, 5); // 1000 × 500 mm
    expect(depois.every(item => item.dadosPreco?.larguraMm === 1000 && item.dadosPreco?.alturaMm === 500)).toBe(true);
    expect(depois.every(item => item.dadosPreco?.boundingBoxesMm.length === 1)).toBe(true);
  });
});
