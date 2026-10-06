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
  it("a tabela de módulos 24 V continua com os mesmos números, agora derivados de 1,5 W por módulo", () => {
    expect(modulos24V.wattsPerModule).toBe(1.5);
    expect(modulos24V.rows.map(linha => [linha.recommendedModules, linha.maximumModules])).toEqual([
      [136, 160],
      [272, 320],
      [408, 480],
      [680, 800],
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
    expect(resultado.consumoTotalW).toBe(150);
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("ideal");
    expect(resultado.recomendado!.fontes[0].utilizacao).toBeCloseTo(0.625, 5);
    expect(resultado.comFolga).toBeNull();
  });

  it("no limite exato dos 85% (136 módulos na 10 A) ainda é ideal", () => {
    const resultado = dimensionarFontes(modulos(136));
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("ideal");
  });

  it("entre 85% e 93% mantém a mesma fonte e só avisa; a opção com folga vem à parte", () => {
    const resultado = dimensionarFontes(modulos(140)); // 210 W de 240 W = 87,5%
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 10A"]);
    expect(resultado.recomendado!.faixa).toBe("tolerancia");
    expect(resultado.recomendado!.fontes[0].utilizacao).toBeCloseTo(0.875, 5);
    expect(resultado.comFolga).not.toBeNull();
    expect(resumirPlano(resultado.comFolga!).map(grupo => `${grupo.copias}x ${grupo.nome}`)).toEqual(["1x Fonte chaveada 20A"]);
    expect(resultado.comFolga!.faixa).toBe("ideal");
  });

  it("93% ainda cabe; acima disso sobe para a fonte seguinte", () => {
    const noLimite = dimensionarFontes(modulos(148)); // 222 W = 92,5%
    expect(nomes(noLimite)).toEqual(["1x Fonte chaveada 10A"]);
    const acima = dimensionarFontes(modulos(149)); // 223,5 W = 93,1%
    expect(nomes(acima)).toEqual(["1x Fonte chaveada 20A"]);
    expect(acima.recomendado!.faixa).toBe("ideal");
  });

  it("prefere uma fonte grande a duas pequenas quando cabe em 93%", () => {
    const resultado = dimensionarFontes(modulos(700)); // 1.050 W: a 50 A (1.200 W) fica em 87,5%
    expect(nomes(resultado)).toEqual(["1x Fonte chaveada 50A"]);
    expect(resultado.recomendado!.faixa).toBe("tolerancia");
  });

  it("carga maior que a maior fonte divide entre fontes iguais, com a carga repartida por igual", () => {
    const resultado = dimensionarFontes(modulos(800)); // 1.200 W
    expect(nomes(resultado)).toEqual(["2x Fonte chaveada 30A"]);
    expect(resultado.recomendado!.fontes.map(item => item.quantidade)).toEqual([400, 400]);
    expect(resultado.recomendado!.fontes.every(item => item.faixa === "ideal")).toBe(true);
  });

  it("a soma repartida entre as fontes é sempre a quantidade pedida e nenhuma passa de 93%", () => {
    for (const quantidade of [1, 7, 149, 333, 801, 1234, 2500, 3999]) {
      const resultado = dimensionarFontes(modulos(quantidade));
      const plano = resultado.recomendado!;
      expect(plano.fontes.reduce((soma, item) => soma + item.quantidade, 0)).toBe(quantidade);
      for (const item of plano.fontes) expect(item.utilizacao).toBeLessThanOrEqual(0.93 + 1e-9);
    }
  });

  it("fita LED usa 0,1 m de passo e confere a fronteira dos 93%", () => {
    const pequena = dimensionarFontes(fita(10)); // 170 W de 240 W
    expect(pequena.consumoTotalW).toBe(170);
    expect(nomes(pequena)).toEqual(["1x Fonte 10A"]);
    expect(pequena.recomendado!.fontes[0].quantidade).toBe(10);

    // 13,1 m x 17 W/m = 222,7 W = 92,8% (cabe); 13,2 m = 224,4 W = 93,5% (não cabe).
    expect(nomes(dimensionarFontes(fita(13.1)))).toEqual(["1x Fonte 10A"]);
    expect(nomes(dimensionarFontes(fita(13.2)))).toEqual(["1x Fonte 20A"]);
  });

  it("não se perde com ruído de ponto flutuante (0,1 + 0,2)", () => {
    const resultado = dimensionarFontes(fita(0.1 + 0.2, fita12V));
    expect(resultado.recomendado!.fontes[0].quantidade).toBe(0.3);
    expect(nomes(resultado)).toEqual(["1x Fonte 10A"]);
  });

  it("módulo de 12 V usa as fontes de 12 V", () => {
    const resultado = dimensionarFontes({ fontes: fontesDe(modulos7025.rows), wattsPorUnidade: modulos7025.wattsPerModule, passo: 1, quantidade: 80 });
    // 80 x 1,5 W = 120 W: a 10 A de 12 V (120 W) estoura; a 20 A (240 W) fica a 50%.
    expect(nomes(resultado)).toEqual(["1x Fonte 20A"]);
  });

  it("quantidade inválida ou projeto grande demais não gera plano", () => {
    expect(dimensionarFontes(modulos(0)).recomendado).toBeNull();
    expect(dimensionarFontes(modulos(-5)).aviso).toMatch(/maior que zero/);
    expect(dimensionarFontes(modulos(Number.NaN)).recomendado).toBeNull();
    const enorme = dimensionarFontes(modulos(100_000));
    expect(enorme.recomendado).toBeNull();
    expect(enorme.aviso).toMatch(/mais de 10 fontes/);
    expect(enorme.consumoTotalW).toBe(150_000);
  });
});
