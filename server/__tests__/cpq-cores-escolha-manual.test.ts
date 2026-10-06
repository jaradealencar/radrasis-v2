import { describe, expect, it } from "vitest";
import {
  aplicarCoresManuais,
  CpqEscolhaCorInvalida,
  listarPaletaChapas,
  listarOpcoesCor,
  sugerirMaterialParaCor,
  type CpqCorAlvo,
  type CpqCorCatalogo,
  type CpqCorrespondenciaCorInput,
} from "../services/cpqCoresMateriais";

/**
 * Troca manual da sugestão de material por cor (o sistema pode errar a leitura, ex.: letras brancas redesenhadas em preto).
 * O vendedor escolhe a matéria-prima de cada cor no menu do passo Nesting; o servidor valida e grava a decisão.
 */
const precos = {
  vinilBrancoM2: 30, vinilBrancoTransmissaoPct: null, vinilTransparenteM2: 35, vinilTransparenteTransmissaoPct: null,
  impressaoM2: 20, laminacaoM2: 10, larguraBobinaMm: 1000, larguraUtilBobinaMm: 1000, sangriaPerimetralMm: 0, retalhoReutilizavel: true,
};
const dadosPreco = { areaLiquidaM2: 0.06, areaTotalM2: 0.12, larguraMm: 400, alturaMm: 300, boundingBoxesMm: [{ minX: 0, maxX: 400, minY: 0, maxY: 300 }] };

const chapa = (id: number, mubisysMateriaPrimaId: number, nome: string, corHex: string | null, extra: Partial<CpqCorCatalogo> = {}): CpqCorCatalogo =>
  ({ id, mubisysMateriaPrimaId, nome, corHex, ativo: true, ...extra });

const BRANCO_A = chapa(11, 100, "1240×2460", "#FFFFFF");
const BRANCO_B = chapa(12, 100, "2000×1000", "#FFFFFF"); // outro formato do mesmo acrílico branco
const VERMELHO = chapa(21, 200, "1240×2460", "#E4002B");
const LARANJA = chapa(31, 300, "1240×2460", "#FF7F00");
const SEM_COR = chapa(51, 500, "1240×2460", null);
const TRANSPARENTE = chapa(41, 400, "1240×2460", null, { transparenciaTipo: "transparente", principal: true });
const IMPRIMAX_LARANJA: CpqCorCatalogo = { id: 5, codigo: "IMX-LARANJA", linha: "Gold Max", nomeCor: "Laranja", tipoVinil: "polimerico", corHex: "#F57C00", precoM2: 40, ativo: true };

const regiao = (extra: Partial<CpqCorAlvo> = {}): CpqCorAlvo => ({ key: "regiao-1", tipoCor: "solida", corHex: "#FD0000", pathIndexes: [0], dadosPreco, ...extra });

function entrada(extra: Partial<CpqCorrespondenciaCorInput> = {}): CpqCorrespondenciaCorInput {
  return {
    regiao: regiao(), chapas: [BRANCO_A, BRANCO_B, VERMELHO, LARANJA, SEM_COR, TRANSPARENTE], adesivos: [IMPRIMAX_LARANJA],
    iluminacao: "sem_iluminacao", baseImpressao: "branco", laminar: false, precos, construcaoFace: "acrilico_total",
    ...extra,
  };
}

describe("CPQ cores — troca manual da sugestão", () => {
  it("sem escolha, a sugestão automática continua igual e não marca escolha manual", () => {
    const r = sugerirMaterialParaCor(entrada({ regiao: regiao({ corHex: "#E4002B" }) }));
    expect(r.tipoSugestao).toBe("chapa");
    expect(r.chapaMateriaPrimaId).toBe(200);
    expect(r.escolhaManual).toBeUndefined();
  });

  it("o vendedor troca a chapa sugerida pela que quer (laranja no lugar de vermelho) e a decisão fica registrada", () => {
    const r = sugerirMaterialParaCor(entrada({ regiao: regiao({ corHex: "#E4002B" }), escolha: { tipo: "chapa", chapaId: 31 } }));
    expect(r.tipoSugestao).toBe("chapa");
    expect(r.chapaId).toBe(31);
    expect(r.chapaMateriaPrimaId).toBe(300);
    expect(r.escolhaManual).toBe(true);
    expect(r.avisos.some(aviso => aviso.includes("escolhida manualmente pelo vendedor"))).toBe(true);
    expect(r.composicaoFace).toMatchObject({ base: "chapa_colorida", mubisysMateriaPrimaId: 300 });
    expect(r.alternativas.length).toBeLessThanOrEqual(5);
    expect(r.alternativas.some(item => item.id === 31)).toBe(true);
  });

  it("chapa muito diferente da cor da arte avisa o vendedor (ΔE00 acima de 5)", () => {
    const r = sugerirMaterialParaCor(entrada({ regiao: regiao({ corHex: "#000000" }), escolha: { tipo: "chapa", chapaId: 11 } }));
    expect(r.chapaMateriaPrimaId).toBe(100); // branco no lugar do preto lido por engano
    expect(r.deltaE00).toBeGreaterThan(5);
    expect(r.avisos.some(aviso => aviso.startsWith("Atenção vendedor"))).toBe(true);
  });

  it("chapa sem referência de cor cadastrada pode ser escolhida, com aviso e ΔE00 nulo", () => {
    const r = sugerirMaterialParaCor(entrada({ escolha: { tipo: "chapa", chapaId: 51 } }));
    expect(r.chapaMateriaPrimaId).toBe(500);
    expect(r.deltaE00).toBeNull();
    expect(r.avisos.some(aviso => aviso.includes("não tem referência de cor cadastrada"))).toBe(true);
  });

  it("a escolhida entra na lista de alternativas mesmo havendo mais de 5 chapas mais parecidas (limite do snapshot)", () => {
    const muitas = Array.from({ length: 8 }, (_, i) => chapa(100 + i, 600 + i, "f", "#FD0000"));
    const r = sugerirMaterialParaCor(entrada({ chapas: [...muitas, BRANCO_A], escolha: { tipo: "chapa", chapaId: 11 } }));
    expect(r.alternativas).toHaveLength(5);
    expect(r.alternativas.some(item => item.id === 11)).toBe(true);
  });

  it("escolher um adesivo Imprimax usa acrílico transparente como base e registra a escolha", () => {
    const r = sugerirMaterialParaCor(entrada({ escolha: { tipo: "imprimax", adesivoId: 5 } }));
    expect(r.tipoSugestao).toBe("imprimax");
    expect(r.imprimaxAdesivoId).toBe(5);
    expect(r.requerChapaBase).toBe(true);
    expect(r.chapaBaseMateriaPrimaId).toBe(400);
    expect(r.escolhaManual).toBe(true);
    expect(r.avisos.some(aviso => aviso.includes("escolhido manualmente pelo vendedor"))).toBe(true);
    expect(r.avisos.some(aviso => aviso.includes("Não há chapa de acrílico com esta cor"))).toBe(false);
  });

  it("escolher adesivo impresso vale também para cor sólida", () => {
    const r = sugerirMaterialParaCor(entrada({ escolha: { tipo: "impresso" } }));
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.escolhaManual).toBe(true);
  });

  it("escolha inexistente ou inativa é recusada com mensagem clara", () => {
    expect(() => sugerirMaterialParaCor(entrada({ escolha: { tipo: "chapa", chapaId: 9999 } }))).toThrow(CpqEscolhaCorInvalida);
    expect(() => sugerirMaterialParaCor(entrada({ escolha: { tipo: "imprimax", adesivoId: 9999 } }))).toThrow(CpqEscolhaCorInvalida);
    expect(() => sugerirMaterialParaCor(entrada({ chapas: [{ ...VERMELHO, ativo: false }], escolha: { tipo: "chapa", chapaId: 21 } }))).toThrow(/não está ativa/);
  });

  it("região de degradê ou arte complexa só aceita adesivo impresso", () => {
    const gradiente = regiao({ tipoCor: "gradiente", corHex: null });
    expect(() => sugerirMaterialParaCor(entrada({ regiao: gradiente, escolha: { tipo: "chapa", chapaId: 11 } }))).toThrow(/só aceita adesivo impresso/);
    expect(sugerirMaterialParaCor(entrada({ regiao: gradiente, escolha: { tipo: "impresso" } })).tipoSugestao).toBe("impresso");
  });

  describe("face iluminada", () => {
    const iluminada = { iluminacao: "frontlight" as const, transmissaoMinimaPct: 30 };

    it("chapa sem transmissão cadastrada é escolhível, mas avisa a engenharia", () => {
      const r = sugerirMaterialParaCor(entrada({ ...iluminada, escolha: { tipo: "chapa", chapaId: 21 } }));
      expect(r.chapaMateriaPrimaId).toBe(200);
      expect(r.avisos.some(aviso => aviso.includes("Transmissão de luz não cadastrada"))).toBe(true);
    });

    it("chapa com transmissão abaixo do mínimo é recusada", () => {
      const opaca = chapa(61, 700, "opaca", "#FD0000", { transmissaoLuzPct: 5 });
      expect(() => sugerirMaterialParaCor(entrada({ ...iluminada, chapas: [opaca], escolha: { tipo: "chapa", chapaId: 61 } }))).toThrow(/abaixo do mínimo/);
    });

    it("chapa com transmissão suficiente é aceita sem aviso de transmissão", () => {
      const boa = chapa(62, 701, "boa", "#FD0000", { transmissaoLuzPct: 60 });
      const r = sugerirMaterialParaCor(entrada({ ...iluminada, chapas: [boa], escolha: { tipo: "chapa", chapaId: 62 } }));
      expect(r.chapaMateriaPrimaId).toBe(701);
      expect(r.avisos.some(aviso => aviso.includes("Transmissão"))).toBe(false);
    });
  });
});

describe("CPQ cores — menu de materiais por cor", () => {
  it("lista uma entrada por matéria-prima (formatos repetidos não aparecem), da mais parecida à menos parecida, e termina com o adesivo impresso", () => {
    const opcoes = listarOpcoesCor(entrada({ regiao: regiao({ corHex: "#E4002B" }) }));
    const chapas = opcoes.filter(opcao => opcao.tipo === "chapa");
    expect(chapas.map(opcao => opcao.mubisysMateriaPrimaId)).toEqual(expect.arrayContaining([100, 200, 300, 400, 500]));
    expect(new Set(chapas.map(opcao => opcao.mubisysMateriaPrimaId)).size).toBe(chapas.length); // 1 por matéria-prima
    expect(chapas[0].mubisysMateriaPrimaId).toBe(200); // o vermelho é o mais parecido
    expect(chapas.at(-1)!.deltaE00).toBeNull(); // sem referência de cor vai para o fim
    expect(opcoes.filter(opcao => opcao.tipo === "imprimax")).toHaveLength(1);
    expect(opcoes.at(-1)).toMatchObject({ tipo: "impresso", id: null });
  });

  it("traz a cor da amostra de cada material (hex, ou CMYK quando o cadastro só tem CMYK)", () => {
    const soCmyk = chapa(71, 800, "cmyk", null, { cmykC: 0, cmykM: 100, cmykY: 100, cmykK: 0 });
    const opcoes = listarOpcoesCor(entrada({ chapas: [BRANCO_A, soCmyk] }));
    expect(opcoes.find(opcao => opcao.mubisysMateriaPrimaId === 100)!.corHex).toBe("#ffffff");
    expect(opcoes.find(opcao => opcao.mubisysMateriaPrimaId === 800)!.corHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("em face iluminada marca como bloqueada a chapa sabidamente incompatível e mantém escolhível a sem transmissão cadastrada", () => {
    const opaca = chapa(61, 700, "opaca", "#FD0000", { transmissaoLuzPct: 0 });
    const opcoes = listarOpcoesCor(entrada({ iluminacao: "frontlight", transmissaoMinimaPct: 30, chapas: [opaca, VERMELHO] }));
    expect(opcoes.find(opcao => opcao.mubisysMateriaPrimaId === 700)).toMatchObject({ bloqueada: true });
    expect(opcoes.find(opcao => opcao.mubisysMateriaPrimaId === 700)!.motivo).toMatch(/sem transmiss/i);
    expect(opcoes.find(opcao => opcao.mubisysMateriaPrimaId === 200)).toMatchObject({ bloqueada: false, motivo: null });
  });

  it("região de degradê só oferece o adesivo impresso", () => {
    const opcoes = listarOpcoesCor(entrada({ regiao: regiao({ tipoCor: "gradiente", corHex: null }) }));
    expect(opcoes.map(opcao => opcao.tipo)).toEqual(["impresso"]);
  });
});

describe("CPQ cores — cor indicada pelo vendedor no desenho", () => {
  const lidas: CpqCorAlvo[] = [
    { key: "path-1", pathIndex: 0, tipoCor: "solida", corHex: "#000000", pantoneCode: null, cmyk: null }, // letras brancas lidas como pretas
    { key: "path-2", pathIndex: 1, tipoCor: "solida", corHex: "#fd0000", pantoneCode: null, cmyk: null },
    { key: "path-3", pathIndex: 2, tipoCor: "gradiente", corHex: null, coresGradiente: ["#111111", "#222222"], pantoneCode: null, cmyk: null },
  ];

  it("troca a cor lida das peças indicadas e preserva as demais", () => {
    const { regioes, alterados } = aplicarCoresManuais(lidas, [{ pathIndexes: [0], corHex: "#FFFFFF" }]);
    expect(regioes[0]).toMatchObject({ key: "path-1", pathIndex: 0, tipoCor: "solida", corHex: "#ffffff" });
    expect(regioes[1]).toEqual(lidas[1]);
    expect(regioes[2]).toEqual(lidas[2]);
    expect([...alterados]).toEqual([0]);
    expect(lidas[0].corHex).toBe("#000000"); // não altera a leitura original
  });

  it("peça de degradê indicada com uma cor passa a ser sólida, sem Pantone, CMYK nem degradê da arte", () => {
    const { regioes } = aplicarCoresManuais(lidas, [{ pathIndexes: [2], corHex: "#ff7f00" }]);
    expect(regioes[2]).toMatchObject({ tipoCor: "solida", corHex: "#ff7f00", pantoneCode: null, cmyk: null, coresGradiente: [] });
  });

  it("a última cor indicada para a mesma peça vale, e a região indicada casa com a chapa dessa cor", () => {
    const { regioes } = aplicarCoresManuais(lidas, [{ pathIndexes: [0, 1], corHex: "#E4002B" }, { pathIndexes: [0], corHex: "#FFFFFF" }]);
    expect(regioes[0].corHex).toBe("#ffffff");
    expect(regioes[1].corHex).toBe("#e4002b");
    const r = sugerirMaterialParaCor(entrada({ regiao: { ...regioes[0], key: "regiao-1", dadosPreco } }));
    expect(r.tipoSugestao).toBe("chapa");
    expect(r.chapaMateriaPrimaId).toBe(100); // o acrílico branco, e não um adesivo para "preto"
    expect(r.deltaE00).toBeLessThanOrEqual(2);
  });

  it("peça inexistente ou cor inválida são recusadas com mensagem clara", () => {
    expect(() => aplicarCoresManuais(lidas, [{ pathIndexes: [9], corHex: "#ffffff" }])).toThrow(/peça 10.*não existe/);
    expect(() => aplicarCoresManuais(lidas, [{ pathIndexes: [0], corHex: "branco" }])).toThrow(/hexadecimal válido/);
  });

  it("a paleta tem uma cor por matéria-prima, só com cor cadastrada, em ordem estável", () => {
    const soCmyk = chapa(71, 800, "cmyk", null, { cmykC: 0, cmykM: 100, cmykY: 100, cmykK: 0 });
    const paleta = listarPaletaChapas([VERMELHO, BRANCO_B, BRANCO_A, SEM_COR, soCmyk, { ...LARANJA, ativo: false }]);
    expect(paleta.map(item => item.mubisysMateriaPrimaId)).toEqual([100, 200, 800]); // sem cor e inativa ficam de fora
    expect(paleta[0]).toMatchObject({ corHex: "#ffffff", chapaId: 12 }); // primeiro formato lido do material
    expect(paleta.every(item => /^#[0-9a-f]{6}$/.test(item.corHex))).toBe(true);
  });
});
