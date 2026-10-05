import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { calcularNestingMultiMaterial, type CpqMaterial } from "../services/cpqNesting";

type EntradaMotor = { larguraMm: number; alturaMm: number };

function mockDeepnest(responder: (input: EntradaMotor) => unknown) {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill: () => boolean;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => true;
    const chunks: Buffer[] = [];
    child.stdin.on("data", chunk => chunks.push(Buffer.from(chunk)));
    child.stdin.on("finish", () => {
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as EntradaMotor;
      child.stderr.end();
      child.stdout.end(JSON.stringify(responder(input)), () => child.emit("close", 0));
    });
    return child;
  });
}

const layoutCompleto = {
  completo: true,
  quantidadePecas: 1,
  quantidadePosicionada: 1,
  areaLiquidaMm2: 20_000,
  perimetroTotalMm: 600,
  placements: [{ id: 1, source: 0, xMm: 50, yMm: 20, larguraMm: 200, alturaMm: 100, rotacaoGraus: 0 }],
  // O worker já translada o layout para minX = 0.
  bounds: { minX: 0, maxX: 250.4, minY: 20, maxY: 120 },
};

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 L0 10 Z"/></svg>';
const pecas = [{ id: "logo", svg, larguraMm: 200, alturaMm: 100 }];

function bobina(unidadeCusto: string, larguras = [1_200]): CpqMaterial {
  return {
    id: 30,
    nome: "Adesivo comum",
    custoUnitario: 10,
    unidadeCusto,
    chapas: larguras.map((largura, index) => ({
      id: 300 + index,
      mubisysMateriaPrimaId: 30,
      nome: `Bobina ${largura} mm`,
      larguraMm: 50_000,
      alturaMm: largura,
      bobina: true,
    })),
  };
}

describe("CPQ nesting em bobina (largura fixa, comprimento medido)", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.stubEnv("DEEPNEST_NODE_BIN", "node-falso");
    vi.stubEnv("DEEPNEST_NODE_ENTRY", "deepnest-falso.mjs");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("cobra largura da bobina × comprimento consumido, sem girar o rolo e sem usar o teto como comprimento", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2")] });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(resultado.formato).toBe("bobina");
    expect(resultado.largura_bobina_mm).toBe(1_200);
    expect(resultado.comprimento_consumido_mm).toBe(251);
    expect(resultado.chapa).toEqual({ largura_mm: 251, altura_mm: 1_200 });
    expect(resultado.area_chapa_utilizada_m2).toBeCloseTo((251 * 1_200) / 1e6);
    expect(resultado.custo_material_estimado).toBeCloseTo(((251 * 1_200) / 1e6) * 10);
    expect(resultado.area_sobra_m2).toBeCloseTo((251 * 1_200) / 1e6 - 0.02);
    expect(resultado.porcentagem_aproveitamento).toBeCloseTo((0.02 / ((251 * 1_200) / 1e6)) * 100);
  });

  it("oferece ao motor a largura do rolo na altura e um comprimento finito menor que o teto", async () => {
    const entradas: EntradaMotor[] = [];
    mockDeepnest(input => { entradas.push(input); return layoutCompleto; });
    await calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2")] });

    expect(entradas[0].alturaMm).toBe(1_200);
    expect(entradas[0].larguraMm).toBeLessThan(50_000);
    expect(entradas[0].larguraMm).toBeGreaterThanOrEqual(200);
  });

  it("repete com o comprimento máximo quando o primeiro layout não fecha", async () => {
    const entradas: EntradaMotor[] = [];
    mockDeepnest(input => {
      entradas.push(input);
      return input.larguraMm < 50_000
        ? { ...layoutCompleto, completo: false, quantidadePosicionada: 0, placements: [], bounds: null }
        : layoutCompleto;
    });
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2")] });

    expect(entradas.map(item => item.larguraMm).at(-1)).toBe(50_000);
    expect(resultado.formato).toBe("bobina");
  });

  it("o worker real falha com erro (não devolve layout incompleto): repete com o teto em vez de abortar", async () => {
    const entradas: EntradaMotor[] = [];
    mockDeepnest(input => {
      entradas.push(input);
      return input.larguraMm < 50_000 ? { error: "O Deepnest excedeu o tempo sem concluir um layout válido." } : layoutCompleto;
    });
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2")] });

    expect(entradas.length).toBe(2);
    expect(resultado.formato).toBe("bobina");
  });

  it("se nem o teto fecha o layout, a falha do motor sobe como erro de motor", async () => {
    mockDeepnest(() => ({ error: "O Deepnest excedeu o tempo sem concluir um layout válido." }));
    await expect(calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2")] }))
      .rejects.toMatchObject({ name: "CpqNestingError", code: "engine" });
  });

  it("peça mais larga que o rolo não vira layout: avisa que não coube", async () => {
    mockDeepnest(() => ({ ...layoutCompleto, completo: false, quantidadePosicionada: 0, placements: [], bounds: null }));
    await expect(calcularNestingMultiMaterial({
      pecas: [{ id: "larga", svg, larguraMm: 1_500, alturaMm: 1_400 }],
      materiais: [bobina("m2")],
    })).rejects.toMatchObject({ code: "no_fit" });
  });

  it("cobra metro linear pelo comprimento consumido, e não pelo perímetro", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("ml")] });

    expect(resultado.custo_material_estimado).toBeCloseTo(0.251 * 10);
    expect(resultado.custo_sobra_estimado).toBeNull();
  });

  it("base de cobrança do cadastro destrava a unidade 'Unidade/Gl/Lt/Kg' do MubiSys (caso do kraft)", async () => {
    mockDeepnest(() => layoutCompleto);
    const areaCobradaM2 = (251 * 1_200) / 1e6;
    const porM2 = await calcularNestingMultiMaterial({
      pecas, materiais: [{ ...bobina("Unidade/Gl/Lt/Kg"), bobinaCusto: { base: "m2", comprimentoRoloMm: null } }],
    });
    expect(porM2[0].alerta_custo).toBeNull();
    expect(porM2[0].custo_material_estimado).toBeCloseTo(areaCobradaM2 * 10);

    const porMl = await calcularNestingMultiMaterial({
      pecas, materiais: [{ ...bobina("Unidade/Gl/Lt/Kg"), bobinaCusto: { base: "ml", comprimentoRoloMm: null } }],
    });
    expect(porMl[0].custo_material_estimado).toBeCloseTo(0.251 * 10);
  });

  it("bobina cobrada por rolo: custo = fração consumida do rolo × custo do rolo", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({
      pecas, materiais: [{ ...bobina("Unidade/Gl/Lt/Kg"), bobinaCusto: { base: "rolo", comprimentoRoloMm: 200_000 } }],
    });

    expect(resultado.custo_material_estimado).toBeCloseTo((251 / 200_000) * 10);
    expect(resultado.custo_sobra_estimado).toBeCloseTo((251 / 200_000) * 10 * (1 - 0.02 / ((251 * 1_200) / 1e6)));
    expect(resultado.alerta_custo).toBeNull();
  });

  it("bobina por rolo sem o comprimento do rolo bloqueia o custo com alerta", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({
      pecas, materiais: [{ ...bobina("m2"), bobinaCusto: { base: "rolo", comprimentoRoloMm: null } }],
    });

    expect(resultado.custo_material_estimado).toBeNull();
    expect(resultado.alerta_custo).toMatch(/comprimento do rolo/i);
  });

  it("a base escolhida no cadastro vale mais que a unidade do MubiSys", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({
      pecas, materiais: [{ ...bobina("ml"), bobinaCusto: { base: "m2", comprimentoRoloMm: null } }],
    });

    expect(resultado.custo_material_estimado).toBeCloseTo(((251 * 1_200) / 1e6) * 10);
  });

  it("bloqueia custo em unidade sem conversão para bobina", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("un")] });

    expect(resultado.custo_material_estimado).toBeNull();
    expect(resultado.alerta_custo).toMatch(/bobina/i);
  });

  it("entre duas larguras escolhe a que cobra menos material", async () => {
    mockDeepnest(input => input.alturaMm === 1_200
      ? { ...layoutCompleto, bounds: { minX: 0, maxX: 500, minY: 0, maxY: 100 } }
      : { ...layoutCompleto, bounds: { minX: 0, maxX: 300, minY: 0, maxY: 100 } });
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("m2", [1_200, 1_000])] });

    // 1000 × 300 = 300.000 mm² contra 1200 × 500 = 600.000 mm²
    expect(resultado.largura_bobina_mm).toBe(1_000);
    expect(resultado.id_chapa_utilizada).toBe(301);
  });
});

describe("CPQ factibilidade com bobina (geometria real, sem Deepnest)", () => {
  const rolo = (larguraRoloMm: number) => ({
    id: 30,
    nome: "Adesivo comum",
    chapas: [{ id: 300, nome: `Bobina ${larguraRoloMm} mm`, larguraMm: 50_000, alturaMm: larguraRoloMm }],
  });
  const retangulo = (larguraMm: number, alturaMm: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${larguraMm}mm" height="${alturaMm}mm" viewBox="0 0 ${larguraMm} ${alturaMm}"><path id="peca-principal" d="M 0 0 H ${larguraMm} V ${alturaMm} H 0 Z"/></svg>`;

  it("letreiro comprido cabe no rolo de 1200 mm sem emenda: o comprimento do rolo não limita", async () => {
    const { calcularFactibilidadeFabricacao } = await import("../services/cpqFactibilidadeFabricacao");
    const resultado = calcularFactibilidadeFabricacao({
      svg: retangulo(6_000, 500), larguraSvgMm: 6_000, alturaSvgMm: 500, materiais: [rolo(1_200)],
    });

    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    expect(resultado.detalhes_corte.quantidade_emendas).toBe(0);
    expect(resultado.materiais[0].pecas_para_nesting).toHaveLength(1);
  });

  it("peça mais alta que a largura útil do rolo exige emenda ou redução, nunca passa em silêncio", async () => {
    const { calcularFactibilidadeFabricacao } = await import("../services/cpqFactibilidadeFabricacao");
    const resultado = calcularFactibilidadeFabricacao({
      svg: retangulo(1_800, 1_500), larguraSvgMm: 1_800, alturaSvgMm: 1_500, materiais: [rolo(1_200)],
    });

    expect(resultado.status_factibilidade).toBe("REQUER_APROVACAO_EMENDA");
    expect(resultado.detalhes_corte.quantidade_emendas).toBeGreaterThan(0);
  });
});
