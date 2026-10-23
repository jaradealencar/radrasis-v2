import { describe, expect, it } from "vitest";
import { dimensionarFontes, resumirPlano, type EntradaDimensionamento } from "@shared/led-fontes-calculo";
import { getLedPowerSourceTables } from "../services/ledPowerSources";

const tabelas = getLedPowerSourceTables();
const modulos24V = tabelas.modules.find(tabela => tabela.key === "modules-24v")!;
const fita24V = tabelas.tapes.find(tabela => tabela.key === "tape-24v")!;
const fita12V = tabelas.tapes.find(tabela => tabela.key === "tape-12v")!;
const modulos7025 = tabelas.modules.find(tabela => tabela.key === "modules-7025-12v")!;

const fontesDe = (linhas: { source: string; powerW: number }[]) => linhas.map(linha => ({ nome: linha.source, potenciaW: linha.powerW }));

const modulos = (quantidade: number): EntradaDimensionamento => ({ fontes: fontesDe(modulos24V.rows), wattsPorUnidade: modulos24V.wattsPerModule, passo: 1, quantidade });
const fita = (quantidade: number, tabela = fita24V): EntradaDimensionamento => ({ fontes: fontesDe(tabela.rows), wattsPorUnidade: tabela.wattsPerMeter, passo: 0.1, quantidade });
const nomes = (resultado: ReturnType<typeof dimensionarFontes>) => (resultado.recomendado ? resumirPlano(resultado.recomendado).map(grupo => `${grupo.copias}x ${grupo.nome}`) : []);

describe("tabelas de fontes (base da calculadora)", () => {
  it("a tabela de m\u00f3dulos 24 V deriva limites de capacidade de 1,7 W por m\u00f3dulo", () => {
    expect(modulos24V.wattsPerModule).toBe(1.7);
    expect(modulos24V.rows.map(linha => [linha.recommendedModules, linha.maximumModules])).toEqual([
      [120, 141],
      [240, 282],
      [360, 423],
      [600, 705],
    ]);
  });

  it("cada tabela de módulos informa o consumo que gerou suas capacidades", () => {
    for (const tabela of tabelas.modules) {
      for (const linha of tabela.rows) {
        expect(linha.maximumModules).toBe(Math.floor(linha.powerW / tabela.wattsPerModule + 1e-9));
        expect(linha.recommendedModules).toBe(Math.floor((linha.powerW * 0.85) / tabela.wattsPerModule + 1e-9));
      }
    }
  });
});

describe("dimensionarFontes", () => {
  it("carga pequena fica na menor fonte, dentro dos 85%", () => {
    const resultado = dimensionarFontes(modulos(100));
    expect(resultado.consumoTotalW).toBe(170);
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("ideal");
    expect(resultado.recomendado!.fontes[0].utilizacao).toBeCloseTo(170 / 240, 5);
    expect(resultado.comFolga).toBeNull();
  });

  it("no limite exato dos 85% (120 módulos na 10 A) ainda é ideal", () => {
    const resultado = dimensionarFontes(modulos(120));
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("ideal");
  });

  it("entre 85% e 92% mantém a mesma fonte da sobra e apresenta um único plano", () => {
    const resultado = dimensionarFontes(modulos(129)); // 219,3 W de 240 W = 91,375%
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("tolerancia");
    expect(resultado.recomendado!.fontes[0].utilizacao).toBeCloseTo(0.91375, 5);
    expect(resultado.comFolga).toBeNull();
  });

  it("92% ainda cabe; acima disso sobe para a fonte seguinte", () => {
    const noLimite = dimensionarFontes(modulos(129)); // 219,3 W = 91,375%
    expect(nomes(noLimite)).toEqual(["1x Fonte chaveada 10A"]);
    const acima = dimensionarFontes(modulos(130)); // 221 W = 92,08%
    expect(nomes(acima)).toEqual(["1x Fonte chaveada 20A"]);
    expect(acima.recomendado!.faixa).toBe("ideal");
  });

  it("prefere duas fontes menores quando a maior ultrapassa 92%", () => {
    const resultado = dimensionarFontes(modulos(700)); // 1.190 W: a 50 A (1.200 W) passa de 92%
    expect(nomes(resultado)).toEqual(["2x Fonte chaveada 30A"]);
    expect(resultado.recomendado!.faixa).toBe("ideal");
  });

  it("repete a maior fonte a 85% e usa a menor fonte possível para a sobra", () => {
    const resultado = dimensionarFontes(modulos(3000));
    expect(nomes(resultado)).toEqual(["5x Fonte chaveada 50A"]);
    expect(resultado.recomendado!.fontes.map(item => item.quantidade)).toEqual([600, 600, 600, 600, 600]);
    expect(resultado.recomendado!.fontes.slice(0, 4).every(item => item.faixa === "ideal")).toBe(true);
    expect(resultado.recomendado!.fontes[4].faixa).toBe("ideal");
  });

  it("a soma entre as fontes é sempre a quantidade pedida e nenhuma passa de 92%", () => {
    for (const quantidade of [1, 7, 149, 333, 801, 1234, 2500, 3999]) {
      const resultado = dimensionarFontes(modulos(quantidade));
      const plano = resultado.recomendado!;
      expect(plano.fontes.reduce((soma, item) => soma + item.quantidade, 0)).toBe(quantidade);
      for (const item of plano.fontes) expect(item.utilizacao).toBeLessThanOrEqual(0.92 + 1e-9);
    }
  });

  it("fita LED usa 0,1 m de passo e confere a fronteira dos 92%", () => {
    const pequena = dimensionarFontes(fita(10)); // 170 W de 240 W
    expect(pequena.consumoTotalW).toBe(170);
    expect(nomes(pequena)).toEqual(["1x Fonte 10A"]);
    expect(pequena.recomendado!.fontes[0].quantidade).toBe(10);

    // 12,9 m x 17 W/m = 219,3 W = 91,4% (cabe); 13 m = 221 W = 92,1% (não cabe).
    expect(nomes(dimensionarFontes(fita(12.9)))).toEqual(["1x Fonte 10A"]);
    expect(nomes(dimensionarFontes(fita(13)))).toEqual(["1x Fonte 20A"]);
  });

  it("não se perde com ruído de ponto flutuante (0,1 + 0,2)", () => {
    const resultado = dimensionarFontes(fita(0.1 + 0.2, fita12V));
    expect(resultado.recomendado!.fontes[0].quantidade).toBe(0.3);
    expect(nomes(resultado)).toEqual(["1x Fonte 10A"]);
  });

  it("módulo de 12 V usa as fontes de 12 V", () => {
    const resultado = dimensionarFontes({ fontes: fontesDe(modulos7025.rows), wattsPorUnidade: modulos7025.wattsPerModule, passo: 1, quantidade: 80 });
    // 80 x 1,7 W = 136 W: a fonte 10 A (120 W) excede 92%; a de 20 A (240 W) fica a 56,7%.
    expect(nomes(resultado)).toEqual(["1x Fonte 20A"]);
  });

  it("quantidade inválida ou projeto grande demais não gera plano", () => {
    expect(dimensionarFontes(modulos(0)).recomendado).toBeNull();
    expect(dimensionarFontes(modulos(-5)).aviso).toMatch(/maior que zero/);
    expect(dimensionarFontes(modulos(Number.NaN)).recomendado).toBeNull();
    const enorme = dimensionarFontes(modulos(100_000));
    expect(enorme.recomendado).toBeNull();
    expect(enorme.aviso).toMatch(/mais de 10 fontes/);
    expect(enorme.consumoTotalW).toBe(170_000);
  });
});
