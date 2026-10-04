import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { calcularFactibilidadeFabricacao } from "../services/cpqFactibilidadeFabricacao";
import { calcularNestingMultiMaterial } from "../services/cpqNesting";

type EntradaMotor = {
  larguraMm: number;
  alturaMm: number;
  espacamentoMm: number;
  timeoutMs: number;
};

type RespostaMotor = {
  completo: boolean;
  quantidadePecas: number;
  quantidadePosicionada: number;
  areaLiquidaMm2: number;
  perimetroTotalMm: number;
  placements: Array<{
    id: number;
    source: number;
    xMm: number;
    yMm: number;
    larguraMm: number;
    alturaMm: number;
    rotacaoGraus: number;
  }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
};

function mockDeepnest(responder: (input: EntradaMotor) => RespostaMotor) {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
      stderr: PassThrough;
      kill: () => boolean;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      child.emit("close", 1);
      return true;
    };

    const chunks: Buffer[] = [];
    child.stdin.on("data", chunk => chunks.push(Buffer.from(chunk)));
    child.stdin.on("finish", () => {
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as EntradaMotor;
      const response = responder(input);
      child.stderr.end();
      child.stdout.end(JSON.stringify(response), () => child.emit("close", 0));
    });
    return child;
  });
}

function respostaCompleta(): RespostaMotor {
  return {
    completo: true,
    quantidadePecas: 1,
    quantidadePosicionada: 1,
    areaLiquidaMm2: 8_000,
    perimetroTotalMm: 400,
    placements: [{
      id: 1,
      source: 0,
      xMm: 50,
      yMm: 20,
      larguraMm: 200,
      alturaMm: 100,
      rotacaoGraus: 0,
    }],
    bounds: { minX: 50, maxX: 250, minY: 20, maxY: 120 },
  };
}

const svgNesting = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 L0 10 Z"/></svg>';

describe("CPQ nesting e factibilidade geométrica", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.stubEnv("DEEPNEST_NODE_BIN", "node-falso");
    vi.stubEnv("DEEPNEST_NODE_ENTRY", "deepnest-falso.mjs");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("escolhe a chapa viável de menor área e calcula ocupação pelo bounding box", async () => {
    mockDeepnest(() => respostaCompleta());
    const [resultado] = await calcularNestingMultiMaterial({
      pecas: [{ id: "logo", svg: svgNesting, larguraMm: 200, alturaMm: 100 }],
      materiais: [{
        id: 7,
        nome: "Acrílico",
        custoUnitario: 100,
        unidadeCusto: "m2",
        chapas: [
          { id: 72, mubisysMateriaPrimaId: 7, nome: "Maior", larguraMm: 2_000, alturaMm: 1_000 },
          { id: 71, mubisysMateriaPrimaId: 7, nome: "Menor", larguraMm: 1_000, alturaMm: 500 },
        ],
      }],
    });

    expect(resultado.id_chapa_utilizada).toBe(71);
    expect(resultado.criterio_escolha).toBe("menor_chapa_que_comporta");
    expect(resultado.area_chapa_utilizada_m2).toBeCloseTo(0.02);
    expect(resultado.porcentagem_aproveitamento).toBeCloseTo((0.02 / 0.5) * 100);
    expect(resultado.porcentagem_aproveitamento).not.toBeCloseTo((0.008 / 0.5) * 100);
    expect(resultado.posicionamentos[0].xMm).toBe(0);
  });

  it("ignora chapas menores sem layout completo e seleciona a menor que comporta as peças", async () => {
    mockDeepnest(input => input.larguraMm < 1_500
      ? { ...respostaCompleta(), completo: false, quantidadePosicionada: 0, placements: [], bounds: null }
      : respostaCompleta());
    const [resultado] = await calcularNestingMultiMaterial({
      pecas: [{ id: "logo", svg: svgNesting, larguraMm: 200, alturaMm: 100 }],
      materiais: [{
        id: 9,
        nome: "PVC",
        custoUnitario: 0,
        unidadeCusto: "m2",
        chapas: [
          { id: 91, mubisysMateriaPrimaId: 9, nome: "Não comporta", larguraMm: 1_000, alturaMm: 500 },
          { id: 92, mubisysMateriaPrimaId: 9, nome: "Comporta", larguraMm: 2_000, alturaMm: 1_000 },
          { id: 93, mubisysMateriaPrimaId: 9, nome: "Alternativa maior", larguraMm: 3_000, alturaMm: 1_500 },
        ],
      }],
    });

    expect(resultado.id_chapa_utilizada).toBe(92);
  });

  it("mantém peça que cabe sem escala nem emenda", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: svgRetangulo(900, 500),
      larguraSvgMm: 900,
      alturaSvgMm: 500,
      materiais: [materialComChapa(3_000, 1_500)],
    });

    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    expect(resultado.projeto_redimensionado).toBe(false);
    expect(resultado.detalhes_corte.quantidade_emendas).toBe(0);
    expect(resultado.materiais[0].pecas_para_nesting).toHaveLength(1);
  });

  it("reduz automaticamente um excesso de exatamente 3%", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: svgRetangulo(1_030, 500),
      larguraSvgMm: 1_030,
      alturaSvgMm: 500,
      materiais: [materialComChapa(1_000, 1_000)],
    });

    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    expect(resultado.projeto_redimensionado).toBe(true);
    expect(resultado.fator_escala_aplicado).toBeCloseTo(1 / 1.03);
    expect(resultado.svg_ajustado).toContain('width="1000mm"');
  });

  it("fatia contorno fechado dentro da área útil da chapa e marca a emenda", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: svgRetangulo(3_100, 1_000),
      larguraSvgMm: 3_100,
      alturaSvgMm: 1_000,
      materiais: [materialComChapa(3_000, 1_500)],
    });
    const material = resultado.materiais[0];

    expect(resultado.status_factibilidade).toBe("REQUER_APROVACAO_EMENDA");
    expect(resultado.projeto_fatiado).toBe(true);
    expect(resultado.detalhes_corte.quantidade_emendas).toBe(1);
    expect(resultado.detalhes_corte.coordenadas_linha_corte[0]).toMatchObject({
      x1: 2_960,
      x2: 2_960,
      y1: 0,
      y2: 1_000,
    });
    expect(material.fragmentos).toHaveLength(2);
    expect(Math.max(...material.fragmentos.map(fragmento => fragmento.larguraMm))).toBe(2_960);
    expect(material.pecas_para_nesting.every(peca => /<path[^>]*d="[^"]+ Z"/.test(peca.svg))).toBe(true);
    expect(material.svg_visualizacao).toContain('id="linha_emenda_tecnica"');
  });
});

function materialComChapa(larguraMm: number, alturaMm: number) {
  return {
    id: 4,
    nome: "ACM",
    chapas: [{ id: 41, nome: `${larguraMm}x${alturaMm}`, larguraMm, alturaMm }],
  };
}

function svgRetangulo(larguraMm: number, alturaMm: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${larguraMm}mm" height="${alturaMm}mm" viewBox="0 0 ${larguraMm} ${alturaMm}"><path id="peca-principal" d="M 0 0 H ${larguraMm} V ${alturaMm} H 0 Z"/></svg>`;
}
