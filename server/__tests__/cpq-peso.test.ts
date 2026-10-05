import { describe, expect, it } from "vitest";
import {
  espessuraParaMm,
  gCm3ParaKgM3,
  kgM3ParaGCm3,
  kgPorMetroPerfil,
  pesoChapaKg,
  formatoPerfilUsaEspessura,
  secaoPerfilMm2,
  secaoTuboRetangularMm2,
} from "../../shared/peso";
import { calcularPesoLinha, somarPesos, type DadosPesoMateria, type LinhaPesoInput } from "../services/cpqPeso";

const dados = (parcial: Partial<DadosPesoMateria>): DadosPesoMateria => ({
  tipo: "outro",
  espessuraMm: null,
  densidadeGCm3: null,
  perfilAlturaMm: null,
  perfilLarguraMm: null,
  perfilComprimentoMm: null,
  pesoEspecificoKg: null,
  ...parcial,
});

const linha = (parcial: Partial<LinhaPesoInput>): LinhaPesoInput => ({
  nome: "Material",
  quantidade: 1,
  unidade: "Metro quadrado",
  formulaType: "area",
  areaLiquidaM2: null,
  ...parcial,
});

describe("conversão de densidade", () => {
  it("converte g/cm³ para kg/m³ e volta sem perder precisão", () => {
    expect(gCm3ParaKgM3(1.19)).toBe(1190);
    expect(gCm3ParaKgM3(7.85)).toBe(7850);
    expect(gCm3ParaKgM3(2.7)).toBe(2700);
    expect(kgM3ParaGCm3(1190)).toBe(1.19);
    expect(kgM3ParaGCm3(gCm3ParaKgM3(0.9185))).toBe(0.9185);
  });
});

describe("conversão de espessura", () => {
  it("micras viram milímetros", () => {
    expect(espessuraParaMm(80, "µm")).toBe(0.08);
    expect(espessuraParaMm(1000, "µm")).toBe(1);
    expect(espessuraParaMm(0.5, "µm")).toBe(0.0005);
  });
  it("milímetros ficam como estão", () => {
    expect(espessuraParaMm(3, "mm")).toBe(3);
    expect(espessuraParaMm(0.08, "mm")).toBe(0.08);
  });
});

describe("peso da chapa", () => {
  it("1 m² de acrílico 3 mm (1,19 g/cm³) pesa 3,57 kg", () => {
    expect(pesoChapaKg(1, 3, 1.19)).toBeCloseTo(3.57, 6);
  });
  it("1 m² de aço 0,6 mm (7,85 g/cm³) pesa 4,71 kg", () => {
    expect(pesoChapaKg(1, 0.6, 7.85)).toBeCloseTo(4.71, 6);
  });
  it("chapa de 3000 × 1200 mm em ACM 4 mm (1,6 g/cm³) pesa 23,04 kg", () => {
    expect(pesoChapaKg(3 * 1.2, 4, 1.6)).toBeCloseTo(23.04, 6);
  });
});

describe("peso do perfil (tubo retangular oco)", () => {
  it("seção 30×20 mm com parede de 1,5 mm tem 135 mm²", () => {
    expect(secaoTuboRetangularMm2(30, 20, 1.5)).toBeCloseTo(2 * 1.5 * (30 + 20 - 3), 6);
  });
  it("tubo de alumínio 30×20×1,5 (2,7 g/cm³) pesa 0,3807 kg/m", () => {
    expect(kgPorMetroPerfil(30, 20, 1.5, 2.7)).toBeCloseTo(0.38070, 4);
  });
  it("parede que não cabe na seção devolve null em vez de peso negativo", () => {
    expect(secaoTuboRetangularMm2(10, 10, 5)).toBeNull();
    expect(kgPorMetroPerfil(10, 10, 6, 2.7)).toBeNull();
  });
  it("dimensões ausentes ou zeradas devolvem null", () => {
    expect(kgPorMetroPerfil(0, 20, 1.5, 2.7)).toBeNull();
    expect(kgPorMetroPerfil(30, 20, 1.5, 0)).toBeNull();
  });
});

describe("calcularPesoLinha", () => {
  const acrilico = dados({ tipo: "chapa", espessuraMm: 3, densidadeGCm3: 1.19 });
  const perfil = dados({ tipo: "perfil", espessuraMm: 1.5, densidadeGCm3: 2.7, perfilAlturaMm: 30, perfilLarguraMm: 20, perfilComprimentoMm: 6000 });

  it("chapa com fórmula de área líquida usa a quantidade", () => {
    const resultado = calcularPesoLinha(linha({ quantidade: 0.5 }), acrilico);
    expect(resultado.kg).toBeCloseTo(1.785, 6);
  });

  it("chapa com área total usa a área líquida do nesting, sem a sobra", () => {
    const resultado = calcularPesoLinha(linha({ formulaType: "areaTotal", quantidade: 2, areaLiquidaM2: 0.8 }), acrilico);
    expect(resultado.kg).toBeCloseTo(0.8 * 3 * 1.19, 6);
    expect(resultado.como).not.toContain("sobra");
  });

  it("chapa com área total sem nesting usa a quantidade e avisa que pode incluir sobra", () => {
    const resultado = calcularPesoLinha(linha({ formulaType: "areaTotal", quantidade: 2, areaLiquidaM2: null }), acrilico);
    expect(resultado.kg).toBeCloseTo(2 * 3 * 1.19, 6);
    expect(resultado.como).toContain("sobra");
  });

  it("chapa sem espessura ou densidade fica sem peso, nunca zero", () => {
    expect(calcularPesoLinha(linha({}), dados({ tipo: "chapa", espessuraMm: 3 })).kg).toBeNull();
    expect(calcularPesoLinha(linha({}), dados({ tipo: "chapa", densidadeGCm3: 1.19 })).kg).toBeNull();
  });

  it("chapa com fórmula que não é área fica sem peso", () => {
    const resultado = calcularPesoLinha(linha({ formulaType: "perimTotal" }), acrilico);
    expect(resultado.kg).toBeNull();
    expect(resultado.motivo).toContain("área");
  });

  it("perfil em metro linear multiplica pelo kg/m", () => {
    const resultado = calcularPesoLinha(linha({ unidade: "Metro linear", quantidade: 10, formulaType: "perimExt" }), perfil);
    expect(resultado.kg).toBeCloseTo(10 * 0.3807, 4);
  });

  it("perfil em unidade (barra) usa o comprimento cadastrado", () => {
    const resultado = calcularPesoLinha(linha({ unidade: "Unidade", quantidade: 2, formulaType: "fixo" }), perfil);
    expect(resultado.kg).toBeCloseTo(2 * 6 * 0.3807, 4);
  });

  it("perfil em metro quadrado não é tratado como metro linear", () => {
    expect(calcularPesoLinha(linha({ unidade: "Metro quadrado" }), perfil).kg).toBeNull();
  });

  it("perfil com parede maior que a seção fica sem peso, com motivo", () => {
    const resultado = calcularPesoLinha(linha({ unidade: "Metro linear" }), dados({ ...perfil, espessuraMm: 12 }));
    expect(resultado.kg).toBeNull();
    expect(resultado.motivo).toContain("parede");
  });

  it("matéria-prima comum usa quantidade × peso específico", () => {
    const resultado = calcularPesoLinha(linha({ unidade: "Metro linear", quantidade: 4, formulaType: "perimTotal" }), dados({ pesoEspecificoKg: 0.35 }));
    expect(resultado.kg).toBeCloseTo(1.4, 6);
  });

  it("sem cadastro técnico ou sem peso específico fica sem peso", () => {
    expect(calcularPesoLinha(linha({}), null).kg).toBeNull();
    expect(calcularPesoLinha(linha({}), dados({})).kg).toBeNull();
  });

  it("quantidade negativa não gera peso negativo", () => {
    expect(calcularPesoLinha(linha({ quantidade: -3 }), dados({ pesoEspecificoKg: 1 })).kg).toBe(0);
  });
});

describe("somarPesos", () => {
  it("soma só os itens com peso e conta os pendentes", () => {
    const total = somarPesos([
      { kg: 1.5, como: "", motivo: "" },
      { kg: null, como: "", motivo: "x" },
      { kg: 2, como: "", motivo: "" },
    ]);
    expect(total.totalKg).toBe(3.5);
    expect(total.pendentes).toBe(1);
  });
});

describe("peso do perfil (cantoneira e barra maciça)", () => {
  it("cantoneira 30×30 com aba de 3 mm tem 171 mm² (canto contado uma vez)", () => {
    expect(secaoPerfilMm2("cantoneira", 30, 30, 3)).toBeCloseTo(3 * (30 + 30 - 3), 6);
  });
  it("cantoneira de aço 30×30×3 (7,85 g/cm³) pesa 1,34235 kg/m", () => {
    expect(kgPorMetroPerfil(30, 30, 3, 7.85, "cantoneira")).toBeCloseTo(1.34235, 5);
  });
  it("cantoneira com abas desiguais 50×30×4 tem 4·(80−4) = 304 mm²", () => {
    expect(secaoPerfilMm2("cantoneira", 50, 30, 4)).toBe(304);
  });
  it("cantoneira com espessura maior ou igual à menor aba devolve null", () => {
    expect(secaoPerfilMm2("cantoneira", 30, 20, 20)).toBeNull();
  });
  it("barra maciça 20×10 de aço pesa 1,57 kg/m e ignora a espessura", () => {
    expect(secaoPerfilMm2("barra", 20, 10, null)).toBe(200);
    expect(kgPorMetroPerfil(20, 10, null, 7.85, "barra")).toBeCloseTo(1.57, 6);
    expect(kgPorMetroPerfil(20, 10, 99, 7.85, "barra")).toBeCloseTo(1.57, 6);
  });
  it("tubo e cantoneira sem espessura devolvem null; o formato padrão continua sendo tubo", () => {
    expect(secaoPerfilMm2("tubo", 30, 20, null)).toBeNull();
    expect(secaoPerfilMm2("cantoneira", 30, 20, null)).toBeNull();
    expect(kgPorMetroPerfil(30, 20, 1.5, 2.7)).toBeCloseTo(kgPorMetroPerfil(30, 20, 1.5, 2.7, "tubo")!, 10);
  });
  it("formatoPerfilUsaEspessura: só a barra dispensa", () => {
    expect(formatoPerfilUsaEspessura("tubo")).toBe(true);
    expect(formatoPerfilUsaEspessura("cantoneira")).toBe(true);
    expect(formatoPerfilUsaEspessura("barra")).toBe(false);
  });
  it("calcularPesoLinha: cantoneira em metros e barra sem espessura cadastrada", () => {
    const cant = calcularPesoLinha(
      linha({ quantidade: 2, unidade: "Metro" }),
      dados({ tipo: "perfil", perfilFormato: "cantoneira", perfilAlturaMm: 30, perfilLarguraMm: 30, espessuraMm: 3, densidadeGCm3: 7.85 }),
    );
    expect(cant.kg).toBeCloseTo(2 * 1.34235, 5);
    expect(cant.como).toContain("cantoneira");
    const barra = calcularPesoLinha(
      linha({ quantidade: 1, unidade: "Unidade" }),
      dados({ tipo: "perfil", perfilFormato: "barra", perfilAlturaMm: 20, perfilLarguraMm: 10, perfilComprimentoMm: 6000, espessuraMm: null, densidadeGCm3: 7.85 }),
    );
    expect(barra.kg).toBeCloseTo(6 * 1.57, 5);
  });
  it("calcularPesoLinha: tubo sem espessura continua pendente; sem formato = tubo", () => {
    const base = { tipo: "perfil" as const, perfilAlturaMm: 30, perfilLarguraMm: 20, densidadeGCm3: 2.7 };
    expect(calcularPesoLinha(linha({ unidade: "Metro" }), dados({ ...base, espessuraMm: null })).kg).toBeNull();
    expect(calcularPesoLinha(linha({ unidade: "Metro" }), dados({ ...base, espessuraMm: 1.5 })).kg).toBeCloseTo(0.3807, 4);
  });
});
