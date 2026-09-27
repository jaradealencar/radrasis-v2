import { describe, it, expect } from "vitest";
import { calcularPainelMeta, compararMesVigenteAnoAnterior } from "../services/painelMeta";
import type { ClienteBase } from "../services/inteligenciaClientes";

function cliente(nome: string, compras: Array<[number, number, number, number]>): ClienteBase {
  return {
    empresaKey: nome,
    empresaExibicao: nome,
    compras: compras
      .map(([ano, mes, dia, valor], i) => ({
        osNumero: `${nome}-${i}`, data: new Date(ano, mes - 1, dia), valor,
        custo: null, contribuicao: valor * 0.5, vendedor: "Ana", cidade: null, estado: "MS", trabalho: null,
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime()),
  };
}

const HOJE = new Date(2026, 8, 26); // 26/09/2026

describe("compararMesVigenteAnoAnterior", () => {
  it("compara só até o mesmo dia nos dois anos (mês em andamento vs. mesmo corte no ano passado)", () => {
    const base = new Map<string, ClienteBase>();
    // Este ano (set/2026): dia 5 e dia 20 (20 é depois do corte de hoje? não, HOJE é dia 26 — os dois entram)
    base.set("a", cliente("a", [[2026, 9, 5, 1000], [2026, 9, 20, 500]]));
    // Ano passado (set/2025): um pedido até o dia 26 (entra) e um depois do dia 26 (fica de fora do corte)
    base.set("b", cliente("b", [[2025, 9, 10, 800], [2025, 9, 28, 300]]));

    const r = compararMesVigenteAnoAnterior(base, HOJE);
    expect(r).not.toBeNull();
    expect(r!.mes).toBe("09/2026");
    expect(r!.diaCorte).toBe(26);
    expect(r!.diasNoMes).toBe(30);
    expect(r!.realEsteAnoAteCorte).toBe(1500);
    expect(r!.realAnoPassadoAteCorte).toBe(800); // só o pedido do dia 10, o do dia 28 fica de fora
    expect(r!.realAnoPassadoMesInteiro).toBe(1100); // os dois pedidos do ano passado, mês inteiro
    expect(r!.variacaoPct).toBeCloseTo((1500 / 800 - 1) * 100, 6);
  });

  it("sem nenhum pedido no mesmo corte do ano passado: não dá pra comparar (null)", () => {
    const base = new Map<string, ClienteBase>();
    base.set("a", cliente("a", [[2026, 9, 5, 1000]]));
    expect(compararMesVigenteAnoAnterior(base, HOJE)).toBeNull();
  });

  it("ignora pedidos de outros meses e do próprio mês em anos mais antigos", () => {
    const base = new Map<string, ClienteBase>();
    base.set("a", cliente("a", [[2026, 8, 10, 5000], [2024, 9, 10, 5000], [2025, 9, 10, 700]]));
    const r = compararMesVigenteAnoAnterior(base, HOJE)!;
    expect(r.realEsteAnoAteCorte).toBe(0);
    expect(r.realAnoPassadoAteCorte).toBe(700);
  });
});

describe("calcularPainelMeta — sazonalidade por mês e comparativo com o ano anterior (integração)", () => {
  it("dezembro consistentemente fraco (3 anos) fica confiável; um mês só com 1 ano não fica", () => {
    const base = new Map<string, ClienteBase>();
    let seq = 0;
    // 40 meses de faturamento "normal" (~300 mil), com dezembro sempre a ~75% da média nos 3 dezembros observados.
    for (let ch = 2023 * 12 + 4; ch <= 2026 * 12 + 7; ch++) {
      const ano = Math.floor(ch / 12), mesIdx = ch % 12; // 11 = dezembro
      const fatorMes = mesIdx === 11 ? 0.75 : 1;
      const valorAlvo = 300_000 * fatorMes;
      const qtd = 30;
      for (let i = 0; i < qtd; i++) {
        base.set(`c${seq++}`, cliente(`c${seq}`, [[ano, mesIdx + 1, 10, valorAlvo / qtd]]));
      }
    }
    const painel = calcularPainelMeta(base, HOJE, 6);
    const dez = painel.sazonalidade.porMes[11];
    expect(dez.mes).toBe(12);
    expect(dez.observacoes).toBeGreaterThanOrEqual(3);
    expect(dez.confiavel).toBe(true);
    expect(dez.fatorAjustado).toBeLessThan(1);
    expect(dez.fatorAjustado).toBeGreaterThan(0.75); // encolhido, não o valor cru

    // Os 12 fatores normalizados têm média 1 (a meta anual não muda, só a distribuição pelos meses).
    const media = painel.sazonalidade.fatoresNormalizados.reduce((a, b) => a + b, 0) / 12;
    expect(media).toBeCloseTo(1, 6);
    expect(painel.sazonalidade.fatoresNormalizados[11]).toBeLessThan(1);

    expect(painel.comparativoAnoAnterior).not.toBeNull();
  });

  it("sem dados suficientes de nenhum mês, todos os 12 ficam neutros (fator 1)", () => {
    const base = new Map<string, ClienteBase>();
    for (let ch = 2025 * 12 + 8; ch <= 2026 * 12 + 7; ch++) {
      const ano = Math.floor(ch / 12), mes = (ch % 12) + 1;
      base.set(`c${ch}`, cliente(`c${ch}`, [[ano, mes, 10, 300_000]]));
    }
    const painel = calcularPainelMeta(base, HOJE, 6);
    expect(painel.sazonalidade.porMes.every(m => !m.confiavel)).toBe(true);
    expect(painel.sazonalidade.fatoresNormalizados).toEqual(Array(12).fill(1));
  });
});
