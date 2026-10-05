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

  it("cobra metro linear pelo comprimento consumido, e não pelo perímetro", async () => {
    mockDeepnest(() => layoutCompleto);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [bobina("ml")] });

    expect(resultado.custo_material_estimado).toBeCloseTo(0.251 * 10);
    expect(resultado.custo_sobra_estimado).toBeNull();
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
