import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  filtrarPorDiaDeCadastro, intervaloDaFatia, mesclarFatia, ordemDasFatias, numFatias,
} from "../sync/crm-abertos-cache";

// Mock do módulo de banco de dados
vi.mock("../db/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock do módulo LLM
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Boa sorte hoje, vendedor!" } }],
  }),
}));

describe("CRM — Lógica de negócio", () => {
  describe("Cálculo de janela de tempo", () => {
    function calcularJanela(diasAberto: number): string {
      if (diasAberto <= 3) return "urgente";
      if (diasAberto <= 7) return "atencao";
      if (diasAberto <= 15) return "risco";
      if (diasAberto <= 30) return "critico";
      return "perdido";
    }

    it("deve classificar 0 dias como urgente", () => {
      expect(calcularJanela(0)).toBe("urgente");
    });

    it("deve classificar 3 dias como urgente", () => {
      expect(calcularJanela(3)).toBe("urgente");
    });

    it("deve classificar 4 dias como atencao", () => {
      expect(calcularJanela(4)).toBe("atencao");
    });

    it("deve classificar 7 dias como atencao", () => {
      expect(calcularJanela(7)).toBe("atencao");
    });

    it("deve classificar 8 dias como risco", () => {
      expect(calcularJanela(8)).toBe("risco");
    });

    it("deve classificar 15 dias como risco", () => {
      expect(calcularJanela(15)).toBe("risco");
    });

    it("deve classificar 16 dias como critico", () => {
      expect(calcularJanela(16)).toBe("critico");
    });

    it("deve classificar 30 dias como critico", () => {
      expect(calcularJanela(30)).toBe("critico");
    });

    it("deve classificar 31 dias como perdido", () => {
      expect(calcularJanela(31)).toBe("perdido");
    });

    it("deve classificar 100 dias como perdido", () => {
      expect(calcularJanela(100)).toBe("perdido");
    });
  });

  describe("Verificação de contato no prazo (3 dias)", () => {
    function verificarContatoNoPrazo(dataCriacao: Date, dataContato: Date): boolean {
      const diff = Math.floor((dataContato.getTime() - dataCriacao.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 3;
    }

    it("contato no mesmo dia deve ser considerado no prazo", () => {
      const hoje = new Date("2026-01-10");
      expect(verificarContatoNoPrazo(hoje, hoje)).toBe(true);
    });

    it("contato em 3 dias deve ser considerado no prazo", () => {
      const criacao = new Date("2026-01-10");
      const contato = new Date("2026-01-13");
      expect(verificarContatoNoPrazo(criacao, contato)).toBe(true);
    });

    it("contato em 4 dias deve ser considerado fora do prazo", () => {
      const criacao = new Date("2026-01-10");
      const contato = new Date("2026-01-14");
      expect(verificarContatoNoPrazo(criacao, contato)).toBe(false);
    });
  });

  describe("Cálculo de meta", () => {
    function calcularPctMeta(valorFechado: number, metaValor: number): number {
      if (metaValor <= 0) return 0;
      return Math.min(Math.round((valorFechado / metaValor) * 100), 100);
    }

    it("deve retornar 0 quando meta é 0", () => {
      expect(calcularPctMeta(5000, 0)).toBe(0);
    });

    it("deve calcular 50% corretamente", () => {
      expect(calcularPctMeta(5000, 10000)).toBe(50);
    });

    it("deve limitar em 100% quando supera a meta", () => {
      expect(calcularPctMeta(15000, 10000)).toBe(100);
    });

    it("deve calcular 100% exato", () => {
      expect(calcularPctMeta(10000, 10000)).toBe(100);
    });
  });

  describe("Contagem de estatísticas de follow-up", () => {
    function calcularStats(propostas: Array<{ contato1: any; contato2: any }>) {
      const semContato = propostas.filter(p => !p.contato1).length;
      const com1Contato = propostas.filter(p => p.contato1 && !p.contato2).length;
      const com2Contatos = propostas.filter(p => p.contato1 && p.contato2).length;
      return { semContato, com1Contato, com2Contatos, total: propostas.length };
    }

    it("deve contar corretamente propostas sem contato", () => {
      const propostas = [
        { contato1: null, contato2: null },
        { contato1: { canal: "whatsapp" }, contato2: null },
        { contato1: { canal: "telefone" }, contato2: { canal: "email" } },
      ];
      const stats = calcularStats(propostas);
      expect(stats.semContato).toBe(1);
      expect(stats.com1Contato).toBe(1);
      expect(stats.com2Contatos).toBe(1);
      expect(stats.total).toBe(3);
    });

    it("deve retornar zeros para lista vazia", () => {
      const stats = calcularStats([]);
      expect(stats.semContato).toBe(0);
      expect(stats.com1Contato).toBe(0);
      expect(stats.com2Contatos).toBe(0);
    });
  });

  describe("Atualização do cache de abertos por fatias", () => {
    const agora = new Date("2026-09-21T12:00:00Z");

    it("divide a janela de 21 dias em 11 fatias de 2 dias (a última só com 1)", () => {
      expect(numFatias(21)).toBe(11);
      expect(intervaloDaFatia(21, 0, agora)).toEqual({ di: "2026-09-20", df: "2026-09-21" });
      expect(intervaloDaFatia(21, 1, agora)).toEqual({ di: "2026-09-18", df: "2026-09-19" });
      expect(intervaloDaFatia(21, 10, agora)).toEqual({ di: "2026-08-31", df: "2026-09-01" });
    });

    it("as fatias são contíguas e cobrem hoje até 21 dias atrás, sem buraco nem sobreposição", () => {
      const fatias = Array.from({ length: numFatias(21) }, (_, k) => intervaloDaFatia(21, k, agora));
      expect(fatias[0].df).toBe("2026-09-21");
      expect(fatias[fatias.length - 1].di).toBe("2026-08-31");
      for (let k = 1; k < fatias.length; k++) {
        const diaAntesDaAnterior = new Date(new Date(`${fatias[k - 1].di}T12:00:00Z`).getTime() - 24 * 60 * 60 * 1000)
          .toISOString().slice(0, 10);
        expect(fatias[k].df).toBe(diaAntesDaAnterior);
      }
    });

    it("rejeita fatia fora do intervalo", () => {
      expect(() => intervaloDaFatia(21, 11, agora)).toThrow();
      expect(() => intervaloDaFatia(21, -1, agora)).toThrow();
      expect(() => intervaloDaFatia(21, 1.5, agora)).toThrow();
    });

    it("a ordem das fatias começa sempre pela mais recente e inclui cada fatia uma única vez", () => {
      const dezMin = 10 * 60 * 1000;
      for (let k = 0; k < 25; k++) {
        const ordem = ordemDasFatias(21, new Date(k * dezMin));
        expect(ordem[0]).toBe(0);
        expect([...ordem].sort((a, b) => a - b)).toEqual(Array.from({ length: numFatias(21) }, (_, i) => i));
      }
    });

    it("as fatias antigas giram pelo relógio a cada 10 min", () => {
      const dezMin = 10 * 60 * 1000;
      expect(ordemDasFatias(21, new Date(0 * dezMin)).slice(0, 3)).toEqual([0, 1, 2]);
      expect(ordemDasFatias(21, new Date(1 * dezMin)).slice(0, 3)).toEqual([0, 2, 3]);
      expect(ordemDasFatias(21, new Date(10 * dezMin)).slice(0, 3)).toEqual([0, 1, 2]); // 10 antigas → volta ao início
    });

    it("mesclarFatia troca só o trecho da fatia e descarta o que saiu da janela", () => {
      const existentes = [
        { id: "velho", data_cadastro: "2026-08-30 10:00:00" },   // antes da janela → sai
        { id: "meio", data_cadastro: "2026-09-03 10:00:00" },    // fora da fatia → fica
        { id: "trocado", data_cadastro: "2026-09-15 10:00:00" }, // dentro da fatia → substituído
        { id: "sem-data", data_cadastro: null },                 // sem data → sai
      ];
      const novos = [{ id: "novo", data_cadastro: "2026-09-16 09:00:00" }];
      const ids = mesclarFatia(existentes, novos, "2026-09-14", "2026-09-21", "2026-08-31").map(o => o.id);
      expect(ids).toEqual(["meio", "novo"]);
    });
  });

  describe("Filtro do período De/Até por data de cadastro", () => {
    const orcs = [
      { id: 1, data_cadastro: "2026-09-16 23:59:59" },
      { id: 2, data_cadastro: "2026-09-17 00:00:01" },
      { id: 3, data_cadastro: "2026-09-18 23:59:59" },
      { id: 4, data_cadastro: "2026-09-19 00:00:00" },
      { id: 5, data_cadastro: null },
      { id: 6 },
    ];

    it("mantém só os cadastrados de 17 a 18, incluindo as duas pontas do intervalo", () => {
      const ids = filtrarPorDiaDeCadastro(orcs, "2026-09-17", "2026-09-18").map(o => o.id);
      expect(ids).toEqual([2, 3]);
    });

    it("um único dia (Hoje) pega só as propostas daquele dia, qualquer que seja a hora", () => {
      const ids = filtrarPorDiaDeCadastro(orcs, "2026-09-18", "2026-09-18").map(o => o.id);
      expect(ids).toEqual([3]);
    });

    it("descarta orçamento sem data de cadastro", () => {
      expect(filtrarPorDiaDeCadastro(orcs, "2000-01-01", "2100-01-01").map(o => o.id)).toEqual([1, 2, 3, 4]);
    });

    it("retorna vazio para lista vazia", () => {
      expect(filtrarPorDiaDeCadastro([], "2026-09-17", "2026-09-18")).toEqual([]);
    });
  });
});
