import { describe, it, expect } from "vitest";
import { agregarEvolucaoDiaria } from "../services/evolucaoDiariaComercial";

function os(data: string, vendedor: string, valorTotal: number, valorDesconto = 0) {
  return { data_aprovacao: `${data} 10:00:00`, vendedor, valor_total: String(valorTotal), valor_desconto: String(valorDesconto) };
}

function orc(data: string, vendedor: string, valorTotal: number) {
  return { data_cadastro: `${data} 09:00:00`, vendedor, valor_total: String(valorTotal), valor_custo: "0", valor_margem: "0" };
}

describe("agregarEvolucaoDiaria", () => {
  it("agrupa OS e orçamentos por dia, com total diário e acumulado por vendedor e da empresa", () => {
    const osNormais = [
      os("2026-09-01", "Ana", 1000),
      os("2026-09-01", "Bia", 500),
      os("2026-09-02", "Ana", 2000, 100),
    ];
    const orcVersaoAtual = [
      orc("2026-09-01", "Ana", 3000),
      orc("2026-09-02", "Bia", 1000),
    ];
    const hoje = new Date(2026, 8, 2);
    const { dias, vendedores } = agregarEvolucaoDiaria(osNormais, orcVersaoAtual, 9, 2026, hoje);

    expect(dias).toHaveLength(2);
    const [dia1, dia2] = dias;

    // Dia 1: Ana 1000 + Bia 500 = 1500 de faturamento; 1 cotação de Ana (3000 orçado)
    expect(dia1.totalOs).toBe(2);
    expect(dia1.totalFat).toBe(1500);
    expect(dia1.totalCot).toBe(1);
    expect(dia1.totalOrc).toBe(3000);
    expect(dia1.totalOsAc).toBe(2);
    expect(dia1.totalFatAc).toBe(1500);

    // Dia 2: Ana faturou 2000 - 100 = 1900; acumulado da empresa = 1500 + 1900 = 3400
    expect(dia2.totalFat).toBe(1900);
    expect(dia2.totalFatAc).toBe(3400);
    expect(dia2.totalOsAc).toBe(3);
    expect(dia2.totalCotAc).toBe(2);
    expect(dia2.totalOrcAc).toBe(4000);

    // Por vendedor (chaves achatadas)
    expect(dia2["Ana__os_ac"]).toBe(2);
    expect(dia2["Ana__fat_ac"]).toBe(2900); // 1000 + 1900
    expect(dia2["Bia__os_ac"]).toBe(1);
    expect(dia2["Bia__fat_ac"]).toBe(500);

    expect(vendedores).toEqual(["Ana", "Bia"]);
  });

  it("inclui o balde 'Sem Vendedor' no total da empresa mas não na lista de vendedores", () => {
    const osNormais = [{ data_aprovacao: "2026-09-01 10:00:00", vendedor: null, valor_total: "800", valor_desconto: "0" }];
    const { dias, vendedores } = agregarEvolucaoDiaria(osNormais, [], 9, 2026, new Date(2026, 8, 1));
    expect(dias[0].totalFat).toBe(800);
    expect(dias[0]["Sem Vendedor__fat_ac"]).toBe(800);
    expect(vendedores).not.toContain("Sem Vendedor");
  });

  it("não inclui dias futuros em relação a 'hoje'", () => {
    const osNormais = [os("2026-09-01", "Ana", 100), os("2026-09-20", "Ana", 200)];
    const { dias } = agregarEvolucaoDiaria(osNormais, [], 9, 2026, new Date(2026, 8, 5));
    expect(dias).toHaveLength(5);
    expect(dias.every(d => d.dia <= 5)).toBe(true);
  });

  it("devolve o mês inteiro quando 'hoje' já passou do mês", () => {
    const { dias } = agregarEvolucaoDiaria([], [], 9, 2026, new Date(2026, 9, 15));
    expect(dias).toHaveLength(30);
  });
});
