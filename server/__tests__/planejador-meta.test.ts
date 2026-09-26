import { describe, it, expect } from "vitest";
import {
  mesApos, prazoValido, horizonteDaLinhaDoTempo, interpolarCenario, linhaDoTempo, primeiroMesNaMeta,
  PRAZO_PADRAO_MESES, PRAZO_MAXIMO_MESES, HORIZONTE_MINIMO_MESES,
} from "../../shared/planejador-meta";
import { resolverMeta, totaisCenario, aplicarFator, type Cenario } from "../../shared/meta-faturamento";

// Números no formato do painel real (~R$ 349 mil por mês).
const BASE: Cenario = {
  novos: { clientes: 20.1, pedidosPorCliente: 1.18, ticket: 2677 },
  reativados: { clientes: 18.3, pedidosPorCliente: 1.23, ticket: 2527 },
  recompraConquistados: { clientes: 38.4, pedidosPorCliente: 1.44, ticket: 2108 },
  carteira: { clientes: 32.6, pedidosPorCliente: 1.4, ticket: 2455 },
};
const FAT_BASE = totaisCenario(BASE).faturamento;
const META = 430_000;

describe("mesApos", () => {
  it("conta meses de calendário a partir da data de referência, virando o ano", () => {
    const ref = "2026-09-26T21:11:57.465Z";
    expect(mesApos(ref, 0)).toEqual({ ano: 2026, mes: 9, rotulo: "set/2026" });
    expect(mesApos(ref, 1).rotulo).toBe("out/2026");
    expect(mesApos(ref, 4).rotulo).toBe("jan/2027");
    expect(mesApos(ref, 16).rotulo).toBe("jan/2028");
    expect(mesApos("2026-12-31T23:59:59.000Z", 1).rotulo).toBe("jan/2027");
  });
});

describe("prazo e horizonte", () => {
  it("aceita só inteiros de 1 ao máximo e cai no padrão quando a entrada não é número", () => {
    expect(prazoValido(6)).toBe(6);
    expect(prazoValido(0)).toBe(1);
    expect(prazoValido(-3)).toBe(1);
    expect(prazoValido(7.6)).toBe(8);
    expect(prazoValido(999)).toBe(PRAZO_MAXIMO_MESES);
    expect(prazoValido(Number.NaN)).toBe(PRAZO_PADRAO_MESES);
  });

  it("mostra pelo menos 12 meses e o prazo mais uma folga, sem passar do máximo", () => {
    expect(horizonteDaLinhaDoTempo(3)).toBe(HORIZONTE_MINIMO_MESES);
    expect(horizonteDaLinhaDoTempo(12)).toBe(15);
    expect(horizonteDaLinhaDoTempo(24)).toBe(PRAZO_MAXIMO_MESES);
  });
});

describe("interpolarCenario", () => {
  const REGIME = aplicarFator(BASE, {}, 1.2);

  it("0 é o cenário de hoje, 1 é o cenário final e o meio fica a meio caminho, indicador por indicador", () => {
    expect(interpolarCenario(BASE, REGIME, 0)).toEqual(BASE);
    expect(interpolarCenario(BASE, REGIME, 1)).toEqual(REGIME);
    const meio = interpolarCenario(BASE, REGIME, 0.5);
    expect(meio.novos.clientes).toBeCloseTo((BASE.novos.clientes + REGIME.novos.clientes) / 2, 9);
    expect(meio.carteira.ticket).toBeCloseTo((BASE.carteira.ticket + REGIME.carteira.ticket) / 2, 9);
  });

  it("não passa dos extremos", () => {
    expect(interpolarCenario(BASE, REGIME, -1)).toEqual(BASE);
    expect(interpolarCenario(BASE, REGIME, 3)).toEqual(REGIME);
  });
});

describe("linhaDoTempo", () => {
  const REGIME = resolverMeta(BASE, {}, META).cenario;

  it("começa nos números de hoje, chega no cenário no prazo e depois fica estável", () => {
    const pontos = linhaDoTempo(BASE, REGIME, 6);
    expect(pontos).toHaveLength(horizonteDaLinhaDoTempo(6) + 1);
    expect(pontos[0].mes).toBe(0);
    expect(pontos[0].totais.faturamento).toBeCloseTo(FAT_BASE, 6);
    expect(pontos[6].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[7].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[pontos.length - 1].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[6].progresso).toBe(1);
    expect(pontos[3].progresso).toBeCloseTo(0.5, 9);
  });

  it("quando todos os indicadores sobem, o faturamento só cresce até o prazo", () => {
    const fat = linhaDoTempo(BASE, REGIME, 9).map(p => p.totais.faturamento);
    for (let k = 1; k <= 9; k++) expect(fat[k]).toBeGreaterThan(fat[k - 1]);
  });

  it("prazo curto sobe mais rápido: no mesmo mês o faturamento é maior", () => {
    const curto = linhaDoTempo(BASE, REGIME, 3)[2].totais.faturamento;
    const longo = linhaDoTempo(BASE, REGIME, 12)[2].totais.faturamento;
    expect(curto).toBeGreaterThan(longo);
  });
});

describe("primeiroMesNaMeta", () => {
  const REGIME = resolverMeta(BASE, {}, META).cenario;

  it("no modo automático (cenário que fecha a meta na conta) a meta é alcançada exatamente no prazo", () => {
    for (const prazo of [1, 3, 6, 12, 18]) {
      expect(primeiroMesNaMeta(linhaDoTempo(BASE, REGIME, prazo), META)).toBe(prazo);
    }
  });

  it("um cenário que passa da meta cruza antes do fim do caminho", () => {
    const acima = resolverMeta(BASE, {}, 500_000).cenario;
    const mes = primeiroMesNaMeta(linhaDoTempo(BASE, acima, 12), META);
    expect(mes).not.toBeNull();
    expect(mes!).toBeGreaterThan(0);
    expect(mes!).toBeLessThan(12);
    const pontos = linhaDoTempo(BASE, acima, 12);
    expect(pontos[mes!].totais.faturamento).toBeGreaterThanOrEqual(META * 0.9995);
    expect(pontos[mes! - 1].totais.faturamento).toBeLessThan(META * 0.9995);
  });

  it("devolve 0 quando hoje já está na meta e null quando o cenário nunca chega lá", () => {
    expect(primeiroMesNaMeta(linhaDoTempo(BASE, BASE, 6), FAT_BASE * 0.9)).toBe(0);
    const abaixo = aplicarFator(BASE, {}, 1.05);
    expect(primeiroMesNaMeta(linhaDoTempo(BASE, abaixo, 6), META)).toBeNull();
  });
});
