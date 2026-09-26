import { describe, it, expect } from "vitest";
import { calcularPainelMeta, indicesSazonais } from "../services/painelMeta";
import {
  resolverMeta, totaisCenario, idAlavanca, FATOR_MAXIMO,
  type Cenario,
} from "../../shared/meta-faturamento";
import type { ClienteBase } from "../services/inteligenciaClientes";

function cliente(nome: string, compras: Array<[number, number, number, number]>): ClienteBase {
  return {
    empresaKey: nome,
    empresaExibicao: nome,
    compras: compras
      .map(([ano, mes, dia, valor], i) => ({
        osNumero: `${nome}-${i}`,
        data: new Date(ano, mes - 1, dia),
        valor,
        custo: null, contribuicao: null, vendedor: null, cidade: null, estado: null, trabalho: null,
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime()),
  };
}

const HOJE = new Date(2026, 8, 15); // setembro/2026 → janela de 12 meses fechados = set/2025 a ago/2026

function baseSintetica(): Map<string, ClienteBase> {
  const m = new Map<string, ClienteBase>();
  // A: novo em jan/2025, reativado em out/2025 (lacuna de 9 meses), depois recompra
  m.set("A", cliente("A", [[2025, 1, 10, 900], [2025, 10, 5, 1000], [2025, 12, 3, 500]]));
  // B: novo nov/2025 e volta duas vezes (dentro de 12 meses da entrada)
  m.set("B", cliente("B", [[2025, 11, 4, 1200], [2025, 11, 20, 800], [2026, 3, 8, 800], [2026, 8, 9, 600]]));
  // C: cliente antigo com compras espaçadas (sem lacuna de 6 meses); em dez/2025 já é carteira (>12 meses da entrada)
  m.set("C", cliente("C", [[2024, 2, 1, 100], [2024, 6, 1, 100], [2024, 11, 1, 100], [2025, 3, 1, 100], [2025, 8, 1, 100], [2025, 12, 1, 300]]));
  // D: novo em jan/2026 e nunca voltou
  m.set("D", cliente("D", [[2026, 1, 12, 100]]));
  return m;
}

describe("calcularPainelMeta — segmentação do faturamento", () => {
  const painel = calcularPainelMeta(baseSintetica(), HOJE, 6);

  it("a soma dos 4 grupos é exatamente o faturamento da janela (cada pedido cai em um só grupo)", () => {
    const somaHistorico = painel.historico.reduce((s, h) => s + h.faturamento, 0);
    // set/2025..ago/2026 = C(ago... fora) → A 1000+500, B 2000+800+600, C 300, D 100 = 5300
    expect(somaHistorico).toBe(5300);
    expect(painel.media12m.faturamento).toBeCloseTo(5300 / 12, 6);
    expect(totaisCenario(painel.media12m.cenario).faturamento).toBeCloseTo(painel.media12m.faturamento, 6);
  });

  it("classifica novos, reativados, recompra de conquistados e carteira por mês", () => {
    const c = painel.media12m.cenario;
    expect(c.novos.clientes * 12).toBeCloseTo(2, 6); // B (nov/25) e D (jan/26)
    expect(c.reativados.clientes * 12).toBeCloseTo(1, 6); // A (out/25)
    expect(c.recompraConquistados.clientes * 12).toBeCloseTo(3, 6); // A dez/25, B mar/26, B ago/26
    expect(c.carteira.clientes * 12).toBeCloseTo(1, 6); // C dez/25
    // B comprou 2x em nov/2025: pedidos por cliente dos novos = (2 pedidos de B + 1 de D) / 2 clientes
    expect(c.novos.pedidosPorCliente).toBeCloseTo(1.5, 6);
    expect(c.novos.ticket).toBeCloseTo((2000 + 100) / 3, 6);
  });

  it("mede a recompra só em entradas com pelo menos 3 meses para voltar", () => {
    // entradas em jun/25..mai/26: A (reativado out/25), B (novo nov/25), D (novo jan/26) → só A e B voltaram
    expect(painel.recompra.clientesAnalisados).toBe(3);
    expect(painel.recompra.taxaPct).toBeCloseTo((2 / 3) * 100, 6);
  });

  it("avisa quando não há 12 meses fechados de histórico", () => {
    expect(painel.dadosSuficientes).toBe(false);
  });

  it("projeta os 12 meses seguintes ao mês corrente", () => {
    expect(painel.projecao).toHaveLength(12);
    expect(painel.projecao[0].mes).toBe("10/2026");
    expect(painel.projecao[11].mes).toBe("09/2027");
  });
});

describe("indicesSazonais", () => {
  it("recupera o formato sazonal e normaliza para média 1", () => {
    const fat = new Map<number, number>();
    for (let t = 2023 * 12 + 4; t < 2026 * 12 + 8; t++) fat.set(t, 100 * (1 + 0.3 * Math.cos((2 * Math.PI * (t % 12)) / 12)));
    const idx = indicesSazonais(fat, 2026 * 12 + 7)!;
    expect(idx).not.toBeNull();
    expect(idx.reduce((a, b) => a + b, 0) / 12).toBeCloseTo(1, 9);
    expect(idx[0]).toBeCloseTo(1.3, 6); // janeiro (t % 12 === 0) é o pico
    expect(idx[6]).toBeCloseTo(0.7, 6); // julho é o vale
  });

  it("devolve null com histórico curto", () => {
    const fat = new Map<number, number>();
    for (let t = 2026 * 12; t < 2026 * 12 + 10; t++) fat.set(t, 100);
    expect(indicesSazonais(fat, 2026 * 12 + 9)).toBeNull();
  });
});

describe("resolverMeta — ajuste automático dos indicadores livres", () => {
  const base: Cenario = {
    novos: { clientes: 10, pedidosPorCliente: 1, ticket: 1000 },
    reativados: { clientes: 10, pedidosPorCliente: 1, ticket: 1000 },
    recompraConquistados: { clientes: 10, pedidosPorCliente: 1, ticket: 1000 },
    carteira: { clientes: 10, pedidosPorCliente: 1, ticket: 1000 },
  };

  it("sem nada fixado, todos os indicadores sobem pelo mesmo fator até fechar a meta", () => {
    const r = resolverMeta(base, {}, 60_000);
    expect(r.totais.faturamento).toBeCloseTo(60_000, 2);
    expect(r.atingivel).toBe(true);
    // 12 alavancas multiplicativas por segmento → 40k × f³ = 60k
    expect(r.fator).toBeCloseTo(Math.cbrt(1.5), 6);
  });

  it("respeita o indicador fixado e compensa nos demais", () => {
    const fixos = { [idAlavanca("novos", "clientes")]: 5 };
    const r = resolverMeta(base, fixos, 60_000);
    expect(r.cenario.novos.clientes).toBe(5);
    expect(r.totais.faturamento).toBeCloseTo(60_000, 2);
    expect(r.fator).toBeGreaterThan(Math.cbrt(1.5)); // os outros precisam subir mais
    expect(r.livres).toBe(11);
  });

  it("indica quando a meta é inalcançável com o que foi fixado", () => {
    const r = resolverMeta(base, {}, 1e12);
    expect(r.atingivel).toBe(false);
    expect(r.fator).toBe(FATOR_MAXIMO);
  });

  it("com tudo fixado não há o que ajustar", () => {
    const fixos: Record<string, number> = {};
    for (const s of ["novos", "reativados", "recompraConquistados", "carteira"] as const)
      for (const c of ["clientes", "pedidosPorCliente", "ticket"] as const) fixos[idAlavanca(s, c)] = base[s][c];
    const r = resolverMeta(base, fixos, 60_000);
    expect(r.livres).toBe(0);
    expect(r.atingivel).toBe(false);
    expect(r.totais.faturamento).toBe(40_000);
  });
});
