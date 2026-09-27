import { describe, it, expect } from "vitest";
import { diasUteisDoMes, metaEsperadaAteHoje, ehMesCorrente, filtrarAteData } from "../../shared/ritmo-meta";

describe("ritmo-meta", () => {
  describe("diasUteisDoMes", () => {
    // Setembro/2026: 30 dias, dia 7 (segunda) é feriado nacional (Independência) — 21 dias úteis no total.
    it("desconta o feriado nacional do total de dias úteis do mês", () => {
      const { totalDiasUteis } = diasUteisDoMes(2026, 9, new Date(2026, 8, 15));
      expect(totalDiasUteis).toBe(21);
    });

    it("conta o próprio dia 1 quando hoje é o primeiro dia útil do mês", () => {
      const { diasUteisDecorridos } = diasUteisDoMes(2026, 9, new Date(2026, 8, 1)); // terça
      expect(diasUteisDecorridos).toBe(1);
    });

    it("chega ao total quando hoje é o último dia do mês", () => {
      const r = diasUteisDoMes(2026, 9, new Date(2026, 8, 30)); // quarta, dia útil
      expect(r.diasUteisDecorridos).toBe(r.totalDiasUteis);
    });

    it("não conta o próprio dia quando hoje cai num fim de semana, mas conta os dias úteis anteriores", () => {
      // 5/set/2026 é sábado; dias úteis até ali: 1,2,3,4 (dia 7, feriado, ainda não chegou)
      const { diasUteisDecorridos } = diasUteisDoMes(2026, 9, new Date(2026, 8, 5));
      expect(diasUteisDecorridos).toBe(4);
    });

    it("não conta o feriado nacional como dia decorrido mesmo caindo em dia de semana", () => {
      // 7/set/2026 é segunda, mas feriado — dias úteis até ali continuam sendo só 1,2,3,4
      const { diasUteisDecorridos } = diasUteisDoMes(2026, 9, new Date(2026, 8, 7));
      expect(diasUteisDecorridos).toBe(4);
    });

    it("considera o mês inteiro decorrido quando hoje é depois do mês", () => {
      const r = diasUteisDoMes(2026, 9, new Date(2026, 9, 15)); // outubro
      expect(r.diasUteisDecorridos).toBe(r.totalDiasUteis);
    });

    it("considera nada decorrido quando hoje é antes do mês", () => {
      const r = diasUteisDoMes(2026, 9, new Date(2026, 7, 15)); // agosto
      expect(r.diasUteisDecorridos).toBe(0);
    });
  });

  describe("metaEsperadaAteHoje", () => {
    it("rateia linearmente pelos dias úteis para indicadores acumulativos", () => {
      // Dia 1/set/2026: 1 de 21 dias úteis decorridos.
      const esperado = metaEsperadaAteHoje(210000, "acumulativo", 2026, 9, new Date(2026, 8, 1));
      expect(esperado).toBeCloseTo(210000 * (1 / 21), 6);
    });

    it("não rateia indicadores de taxa: esperado é sempre a meta cheia", () => {
      const esperado = metaEsperadaAteHoje(25, "taxa", 2026, 9, new Date(2026, 8, 1));
      expect(esperado).toBe(25);
      const esperadoNoFim = metaEsperadaAteHoje(25, "taxa", 2026, 9, new Date(2026, 8, 30));
      expect(esperadoNoFim).toBe(25);
    });

    it("retorna null quando não há meta definida", () => {
      expect(metaEsperadaAteHoje(null, "acumulativo", 2026, 9)).toBeNull();
      expect(metaEsperadaAteHoje(undefined, "taxa", 2026, 9)).toBeNull();
    });
  });

  describe("ehMesCorrente", () => {
    it("é true quando mês/ano coincidem com hoje", () => {
      expect(ehMesCorrente(9, 2026, new Date(2026, 8, 15))).toBe(true);
    });

    it("é false para mês passado ou futuro", () => {
      expect(ehMesCorrente(8, 2026, new Date(2026, 8, 15))).toBe(false);
      expect(ehMesCorrente(10, 2026, new Date(2026, 8, 15))).toBe(false);
    });
  });

  describe("filtrarAteData", () => {
    const itens = [
      { id: 1, data: "2026-09-01" },
      { id: 2, data: "2026-09-15" },
      { id: 3, data: "2026-09-16" },
      { id: 4, data: null },
    ];

    it("inclui itens exatamente na data de corte e exclui os posteriores", () => {
      const r = filtrarAteData(itens, "2026-09-15");
      expect(r.map(i => i.id)).toEqual([1, 2]);
    });

    it("ignora itens sem data", () => {
      const r = filtrarAteData(itens, "2026-09-30");
      expect(r.map(i => i.id)).toEqual([1, 2, 3]);
    });
  });
});
