import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extrairPecasNestingArte } from "../services/cpqFactibilidadeFabricacao";
import {
  calcularNestingArte,
  calcularNestingArteInput,
} from "../services/cpqNestingArte";
import { somarMetricasNestingArte } from "../../shared/arte-nesting";

const peca = (id: string, larguraMm: number, alturaMm: number) => ({
  id,
  larguraMm,
  alturaMm,
  cor: "#ff0000",
  svg: `<svg viewBox="0 0 ${larguraMm} ${alturaMm}"><path d="M0 0H${larguraMm}V${alturaMm}H0Z"/></svg>`,
});
const entrada = (pecas = [peca("a", 20, 10)]) => ({
  grupoId: "grupo-1",
  nome: "Nesting vermelho",
  larguraChapaMm: 100,
  alturaChapaMm: 100,
  espacamentoMm: 3,
  margemBordaMm: 5,
  rotacao: "livre" as const,
  pecas,
});

describe("nesting de arte independente", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPNEST_REMOTE_URL", "");
    vi.stubEnv("DEEPNEST_NODE_BIN", "");
    vi.stubEnv("DEEPNEST_NODE_ENTRY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("separa ilhas da mesma cor, preserva vazados e calcula as medidas de cada peça", () => {
    const arte = extrairPecasNestingArte(
      '<svg viewBox="0 0 200 100"><path fill="#ff0000" fill-rule="evenodd" d="M0 0H100V100H0Z M25 25H75V75H25Z M150 0H200V50H150Z"/></svg>',
      200,
      100
    );
    expect(arte.pecas).toHaveLength(2);
    expect(arte.pecas[0].areaLiquidaM2).toBeCloseTo(0.0075);
    expect(arte.pecas[0].perimetroM).toBeCloseTo(0.6);
    expect(arte.pecas[1].areaLiquidaM2).toBeCloseTo(0.0025);
    expect(new Set(arte.pecas.map(p => p.id)).size).toBe(2);
  });

  it("respeita nonzero: anéis internos do mesmo sentido continuam preenchidos", () => {
    const arte = extrairPecasNestingArte(
      '<svg viewBox="0 0 100 100"><path fill="#000000" fill-rule="nonzero" d="M0 0H100V100H0Z M25 25H75V75H25Z"/></svg>',
      100,
      100
    );
    expect(arte.pecas).toHaveLength(1);
    expect(arte.pecas[0].areaLiquidaM2).toBeCloseTo(0.01);
    expect(arte.pecas[0].perimetroM).toBeCloseTo(0.4);
  });

  it("desconta a sobreposição de cores e mantém o contorno de corte visível", () => {
    const arte = extrairPecasNestingArte(
      '<svg viewBox="0 0 100 100"><path fill="#ffffff" d="M0 0H100V100H0Z"/><path fill="#ff0000" d="M40 40H60V60H40Z"/></svg>',
      100,
      100
    );
    expect(arte.pecas).toHaveLength(2);
    expect(
      arte.pecas.find(p => p.cor === "#ffffff")?.areaLiquidaM2
    ).toBeCloseTo(0.0096);
    expect(arte.pecas.reduce((sum, p) => sum + p.areaLiquidaM2, 0)).toBeCloseTo(
      0.01
    );
  });

  it("calcula chapa, bloco ocupado, área líquida e perímetro sem usar métricas do client", async () => {
    const r = await calcularNestingArte({
      ...entrada([peca("a", 20, 10), peca("b", 20, 10)]),
      alturaChapaMm: 80,
    });
    expect(r.chapas).toHaveLength(1);
    expect(r.total.areaChapaM2).toBeCloseTo(0.008);
    expect(r.total.areaLiquidaM2).toBeCloseTo(0.0004);
    expect(r.total.perimetroM).toBeCloseTo(0.12);
    expect(r.total.areaUtilizadaM2).toBeGreaterThan(r.total.areaLiquidaM2);
    expect(r.total.areaUtilizadaM2).toBeLessThanOrEqual(r.total.areaChapaM2);
    expect(r.chapas[0].svg).toContain('width="');
    expect(r.chapas[0].svg).toContain('mm"');
    expect(r.chapas[0].svg).toContain('id="a"');
    expect(r.chapas[0].svg).not.toMatch(/<rect|<text|<image/);
    expect(r).not.toHaveProperty("custo_material_estimado");
  });

  it("mede individualmente três chapas e soma sem duplicar peças", async () => {
    const r = await calcularNestingArte({
      ...entrada([peca("a", 80, 80), peca("b", 80, 80), peca("c", 80, 80)]),
      margemBordaMm: 0,
      espacamentoMm: 0,
    });
    expect(r.chapas).toHaveLength(3);
    for (const folha of r.chapas) {
      expect(folha.metricas.quantidadePecas).toBe(1);
      expect(folha.metricas.areaChapaM2).toBeCloseTo(0.01);
      expect(folha.metricas.areaLiquidaM2).toBeCloseTo(0.0064);
      expect(folha.metricas.perimetroM).toBeCloseTo(0.32);
    }
    expect(r.total.quantidadePecas).toBe(3);
    expect(r.total.areaChapaM2).toBeCloseTo(0.03);
    expect(r.total.areaLiquidaM2).toBeCloseTo(0.0192);
    expect(r.total.perimetroM).toBeCloseTo(0.96);
  }, 30_000);

  it("soma grupos com formatos diferentes sem misturar suas áreas", async () => {
    const a = await calcularNestingArte(entrada());
    const b = await calcularNestingArte({
      ...entrada(),
      grupoId: "grupo-2",
      larguraChapaMm: 300,
      alturaChapaMm: 200,
    });
    const total = somarMetricasNestingArte([a.total, b.total]);
    expect(total.areaChapaM2).toBeCloseTo(0.07);
    expect(total.quantidadeChapas).toBe(2);
    expect(total.perimetroM).toBeCloseTo(
      a.total.perimetroM + b.total.perimetroM
    );
  });

  it("recusa peça que não cabe e IDs duplicados", async () => {
    await expect(
      calcularNestingArte(entrada([peca("grande", 200, 200)]))
    ).rejects.toThrow(/não cabe|nao cabe|maior/i);
    expect(
      calcularNestingArteInput.safeParse(
        entrada([peca("a", 10, 10), peca("a", 20, 20)])
      ).success
    ).toBe(false);
    expect(
      calcularNestingArteInput.safeParse({ ...entrada(), margemBordaMm: 50 })
        .success
    ).toBe(false);
  });
});
