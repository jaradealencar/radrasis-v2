import { describe, expect, it } from "vitest";
import {
  aplicarCustosBobinaAgrupados,
  BOBINA_ADESIVO_PADRAO,
  desconsiderarAdesivoDaSugestao,
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

describe("CPQ cores — rolo padrão do adesivo sem bobina cadastrada", () => {
  const semBobina = { ...precos, larguraBobinaMm: null, larguraUtilBobinaMm: null, retalhoReutilizavel: false };

  it("calcula o consumo no rolo de 1200 mm, avisa que é o padrão e fecha o custo quando há preço", () => {
    expect(BOBINA_ADESIVO_PADRAO).toEqual({ larguraMm: 1200, comprimentoMm: 5000 });
    const r = sugerirMaterialParaCor(entrada({ precos: semBobina, regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: dadosPreco(0, 400, 0, 300) } }));
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.areaConsumoM2).toBeCloseTo(0.36, 5); // 1200 mm de rolo × 300 mm de comprimento
    expect(r.custoEstimado).toBeCloseTo(0.36 * 50, 3); // vinil 30 + impressão 20 por m²
    expect(r.avisos.some(a => a.includes("rolo padrão de 1200 × 5000 mm"))).toBe(true);
  });

  it("mantém o custo pendente (e não assume zero) quando falta o preço do vinil", () => {
    const r = sugerirMaterialParaCor(entrada({
      precos: { ...semBobina, vinilBrancoM2: null, impressaoM2: null },
      regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: dadosPreco(0, 400, 0, 300) },
    }));
    expect(r.areaConsumoM2).toBeCloseTo(0.36, 5);
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos.some(a => a.includes("Custo por m² do vinil"))).toBe(true);
  });

  it("recusa o consumo quando o layout passa dos 5000 mm do rolo padrão", () => {
    const r = sugerirMaterialParaCor(entrada({
      precos: semBobina,
      regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: dadosPreco(0, 6000, 0, 1100) },
    }));
    expect(r.areaConsumoM2).toBeNull();
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos.some(a => a.includes("acima dos 5000 mm do rolo padrão"))).toBe(true);
  });

  it("bobina cadastrada continua mandando: não usa o rolo padrão", () => {
    const r = sugerirMaterialParaCor(entrada({ regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: dadosPreco(0, 400, 0, 300) } }));
    expect(r.avisos.some(a => a.includes("rolo padrão"))).toBe(false);
  });
});

describe("CPQ cores — vendedor desconsidera o adesivo", () => {
  it("região de adesivo vira pendente, sem chapa-base, custo nem consumo, e a face segue o kit", () => {
    const sugestao = sugerirMaterialParaCor(entrada({ adesivos: [imprimaxLonge], chapas: [chapaTransparente] }));
    expect(sugestao.requerChapaBase).toBe(true);
    const r = desconsiderarAdesivoDaSugestao(sugestao);
    expect(r.tipoSugestao).toBe("pendente");
    expect(r.requerChapaBase).toBe(false);
    expect(r.requerConfirmacaoConstrucao).toBe(false);
    expect(r.chapaBaseMateriaPrimaId).toBeNull();
    expect(r.imprimaxAdesivoId).toBeNull();
    expect(r.composicaoFace).toBeNull();
    expect(r.areaConsumoM2).toBeNull();
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos).toHaveLength(1);
    expect(r.regionKey).toBe(sugestao.regionKey);
  });

  it("não mexe em região que casou com chapa de acrílico", () => {
    const chapaVermelha: CpqCorCatalogo = {
      id: 9, mubisysMateriaPrimaId: 4600, materialNome: "Acrílico vermelho 3mm", corHex: "#FF0000", principal: false, ativo: true,
    };
    const sugestao = sugerirMaterialParaCor(entrada({ chapas: [chapaVermelha] }));
    expect(sugestao.tipoSugestao).toBe("chapa");
    expect(desconsiderarAdesivoDaSugestao(sugestao)).toBe(sugestao);
  });

  it("depois de desconsiderar, o agrupamento de bobina não cobra nada", () => {
    const regioes = [{ key: "g1", dadosPreco: dadosPreco(0, 400, 0, 300) }];
    const sugestoes = [desconsiderarAdesivoDaSugestao(sugerirMaterialParaCor(entrada({
      regiao: { key: "g1", tipoCor: "gradiente", dadosPreco: regioes[0].dadosPreco },
    })))];
    const [resultado] = aplicarCustosBobinaAgrupados(sugestoes, regioes, precos);
    expect(resultado.tipoSugestao).toBe("pendente");
    expect(resultado.areaConsumoM2).toBeNull();
    expect(resultado.custoEstimado).toBeNull();
  });
});
