import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularNestingMultiMaterial } from "../services/cpqNesting";
import { executarMotorInterno, GeometriaInvalidaMotorInterno } from "../services/cpqNestingInterno";

const retangulo = (id: string, largura: number, altura: number) => ({
  id,
  svg: `<svg viewBox="0 0 ${largura} ${altura}"><path d="M0 0 L${largura} 0 L${largura} ${altura} L0 ${altura} Z"/></svg>`,
  larguraMm: largura,
  alturaMm: altura,
});

/** Quadrado 100×100 com furo 50×50 no centro: área líquida 7500 mm², perímetro 400 + 200. */
const quadradoVazado = {
  id: "vazado",
  svg: '<svg viewBox="0 0 100 100"><path d="M0 0 L100 0 L100 100 L0 100 Z M25 25 L75 25 L75 75 L25 75 Z"/></svg>',
  larguraMm: 100,
  alturaMm: 100,
};

function semSobreposicao(placements: Array<{ xMm: number; yMm: number; larguraMm: number; alturaMm: number }>, folga = 0) {
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const separadosX = a.xMm + a.larguraMm + folga <= b.xMm + 1e-6 || b.xMm + b.larguraMm + folga <= a.xMm + 1e-6;
      const separadosY = a.yMm + a.alturaMm + folga <= b.yMm + 1e-6 || b.yMm + b.alturaMm + folga <= a.yMm + 1e-6;
      if (!separadosX && !separadosY) return false;
    }
  }
  return true;
}

describe("motor de nesting interno", () => {
  it("posiciona todas as peças dentro da chapa, sem sobreposição e respeitando o espaçamento", () => {
    const pecas = Array.from({ length: 4 }, (_, i) => retangulo(`r${i}`, 100, 50));
    const r = executarMotorInterno(pecas, 210, 105, 5);
    expect(r.completo).toBe(true);
    expect(r.quantidadePosicionada).toBe(4);
    expect(semSobreposicao(r.placements, 5)).toBe(true);
    for (const p of r.placements) {
      expect(p.xMm).toBeGreaterThanOrEqual(-1e-6);
      expect(p.yMm).toBeGreaterThanOrEqual(-1e-6);
      expect(p.xMm + p.larguraMm).toBeLessThanOrEqual(210 + 1e-6);
      expect(p.yMm + p.alturaMm).toBeLessThanOrEqual(105 + 1e-6);
    }
    expect(r.areaLiquidaMm2).toBeCloseTo(4 * 5000, 3);
    expect(r.bounds?.minX).toBe(0);
  });

  it("calcula área líquida e perímetro descontando o furo", () => {
    const r = executarMotorInterno([quadradoVazado], 500, 500, 0);
    expect(r.areaLiquidaMm2).toBeCloseTo(7500, 3);
    expect(r.perimetroTotalMm).toBeCloseTo(600, 3);
  });

  it("gira a peça para caber quando só cabe deitada", () => {
    const r = executarMotorInterno([retangulo("longa", 300, 40)], 60, 320, 0);
    expect(r.completo).toBe(true);
    expect(r.placements[0].rotacaoGraus % 180).toBe(90);
    expect(r.placements[0].larguraMm).toBeCloseTo(40, 3);
    expect(r.placements[0].alturaMm).toBeCloseTo(300, 3);
  });

  it("marca como incompleto quando uma peça não cabe em nenhuma rotação", () => {
    const r = executarMotorInterno([retangulo("a", 100, 50), retangulo("enorme", 400, 400)], 200, 200, 0);
    expect(r.completo).toBe(false);
    expect(r.quantidadePosicionada).toBe(1);
    expect(r.quantidadePecas).toBe(2);
  });

  it("em bobina, mantém o comprimento consumido curto usando a largura do rolo", () => {
    // Rolo de 100 mm de largura: cinco peças 80×40 cabem em duas por coluna → 3 colunas de 80 mm.
    const pecas = Array.from({ length: 5 }, (_, i) => retangulo(`b${i}`, 80, 40));
    const r = executarMotorInterno(pecas, 50_000, 100, 0, { bobina: true });
    expect(r.completo).toBe(true);
    expect(semSobreposicao(r.placements)).toBe(true);
    expect(r.bounds!.maxX).toBeLessThanOrEqual(240 + 1e-6);
    for (const p of r.placements) expect(p.yMm + p.alturaMm).toBeLessThanOrEqual(100 + 1e-6);
  });

  it("rejeita SVG sem contorno válido", () => {
    expect(() => executarMotorInterno([{ id: "x", svg: '<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>', larguraMm: 10, alturaMm: 10 }], 100, 100, 0))
      .toThrow(GeometriaInvalidaMotorInterno);
  });
});

describe("calcularNestingMultiMaterial sem Deepnest configurado", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPNEST_NODE_BIN", "");
    vi.stubEnv("DEEPNEST_NODE_ENTRY", "");
    vi.stubEnv("DEEPNEST_REMOTE_URL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const material = (chapas: Array<{ id: number; larguraMm: number; alturaMm: number; bobina?: boolean }>) => ({
    id: 10,
    nome: "Acrílico teste",
    custoUnitario: 100,
    unidadeCusto: "m2",
    chapas: chapas.map(c => ({ ...c, mubisysMateriaPrimaId: 10, nome: `Formato ${c.id}` })),
  });
  const pecas = [retangulo("p1", 200, 100), retangulo("p2", 200, 100), quadradoVazado];

  it("calcula o nesting da chapa menor que comporta e marca o motor interno", async () => {
    const [resultado] = await calcularNestingMultiMaterial({
      pecas, espacamentoMm: 3, margemBordaMm: 5,
      materiais: [material([{ id: 1, larguraMm: 300, alturaMm: 200 }, { id: 2, larguraMm: 2000, alturaMm: 1000 }])],
    });
    expect(resultado.motor).toBe("interno");
    expect(resultado.id_chapa_utilizada).toBe(2); // a de 300×200 não comporta as três peças
    expect(resultado.posicionamentos).toHaveLength(3);
    expect(resultado.area_liquida_m2).toBeCloseTo((20_000 * 2 + 7_500) / 1_000_000, 6);
    expect(resultado.area_chapa_utilizada_m2).toBeGreaterThan(resultado.area_liquida_m2);
    expect(resultado.custo_material_estimado).toBeGreaterThan(0);
    expect(resultado.perimetro_total_m).toBeGreaterThan(0);
  });

  it("calcula bobina: cobra largura do rolo × comprimento consumido", async () => {
    const [resultado] = await calcularNestingMultiMaterial({
      pecas: [retangulo("p1", 300, 100), retangulo("p2", 300, 100)], espacamentoMm: 0, margemBordaMm: 0,
      materiais: [material([{ id: 3, larguraMm: 50_000, alturaMm: 1200, bobina: true }])],
    });
    expect(resultado.formato).toBe("bobina");
    expect(resultado.largura_bobina_mm).toBe(1200);
    // Em pé (girando 90°), as duas peças de 300×100 ficam lado a lado no eixo Y do rolo de 1200 mm: 100 mm de comprimento.
    expect(resultado.comprimento_consumido_mm).toBe(100);
    expect(resultado.area_chapa_utilizada_m2).toBeCloseTo((100 * 1200) / 1_000_000, 6);
  });
});
