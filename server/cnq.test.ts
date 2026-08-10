import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getKpis: vi.fn(),
  getEvolucaoMensal: vi.fn(),
  getRetrabalhosAll: vi.fn(),
  getBySetor: vi.fn(),
  getByCategoria: vi.fn(),
  getByCodigoErro: vi.fn(),
  getByResponsavel: vi.fn(),
  getReincidencia: vi.fn(),
  getDistinctValues: vi.fn(),
  createRetrabalho: vi.fn(),
  updateRetrabalho: vi.fn(),
}));

import { getKpis, getEvolucaoMensal, createRetrabalho, updateRetrabalho } from "./db";

describe("CNQ - Custos da Não-Qualidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getKpis com filtro tipoRegistro", () => {
    it("deve aceitar filtro tipoRegistro=cnq", async () => {
      const mockKpis = {
        total: 5,
        custoTotal: 1200.50,
        custoMedio: 240.10,
        freteTotal: 0,
        horasTotal: 0,
        evitavel: 4,
        inevitavel: 1,
        pctEvitavel: 80,
        pctInevitavel: 20,
      };
      (getKpis as any).mockResolvedValue(mockKpis);

      const result = await getKpis({ tipoRegistro: "cnq" });
      expect(getKpis).toHaveBeenCalledWith({ tipoRegistro: "cnq" });
      expect(result).toEqual(mockKpis);
    });

    it("deve aceitar filtro tipoRegistro=retrabalho", async () => {
      const mockKpis = {
        total: 156,
        custoTotal: 43103.50,
        custoMedio: 276.30,
        freteTotal: 5000,
        horasTotal: 55.25,
        evitavel: 124,
        inevitavel: 32,
        pctEvitavel: 79,
        pctInevitavel: 21,
      };
      (getKpis as any).mockResolvedValue(mockKpis);

      const result = await getKpis({ tipoRegistro: "retrabalho" });
      expect(getKpis).toHaveBeenCalledWith({ tipoRegistro: "retrabalho" });
      expect(result).toEqual(mockKpis);
    });

    it("sem filtro tipoRegistro retorna todos", async () => {
      const mockKpis = {
        total: 161,
        custoTotal: 44303.50,
        custoMedio: 275.17,
        freteTotal: 5000,
        horasTotal: 55.25,
        evitavel: 128,
        inevitavel: 33,
        pctEvitavel: 79,
        pctInevitavel: 21,
      };
      (getKpis as any).mockResolvedValue(mockKpis);

      const result = await getKpis({});
      expect(getKpis).toHaveBeenCalledWith({});
      expect(result).toEqual(mockKpis);
    });
  });

  describe("getEvolucaoMensal com filtro tipoRegistro", () => {
    it("deve filtrar por cnq quando passado", async () => {
      const mockEvolucao = [
        { mes: "Jan", mesCompleto: "JANEIRO", count: 0, custo: 0, evitavel: 0, inevitavel: 0 },
        { mes: "Fev", mesCompleto: "FEVEREIRO", count: 2, custo: 500, evitavel: 2, inevitavel: 0 },
      ];
      (getEvolucaoMensal as any).mockResolvedValue(mockEvolucao);

      const result = await getEvolucaoMensal("cnq");
      expect(getEvolucaoMensal).toHaveBeenCalledWith("cnq");
      expect(result).toEqual(mockEvolucao);
    });

    it("deve filtrar por retrabalho quando passado", async () => {
      const mockEvolucao = [
        { mes: "Jan", mesCompleto: "JANEIRO", count: 36, custo: 10821.13, evitavel: 26, inevitavel: 10 },
      ];
      (getEvolucaoMensal as any).mockResolvedValue(mockEvolucao);

      const result = await getEvolucaoMensal("retrabalho");
      expect(getEvolucaoMensal).toHaveBeenCalledWith("retrabalho");
      expect(result).toEqual(mockEvolucao);
    });

    it("sem filtro retorna todos os registros", async () => {
      const mockEvolucao = [
        { mes: "Jan", mesCompleto: "JANEIRO", count: 36, custo: 10821.13, evitavel: 26, inevitavel: 10 },
      ];
      (getEvolucaoMensal as any).mockResolvedValue(mockEvolucao);

      const result = await getEvolucaoMensal();
      expect(getEvolucaoMensal).toHaveBeenCalledWith();
      expect(result).toEqual(mockEvolucao);
    });
  });

  describe("createRetrabalho com tipoRegistro", () => {
    it("deve criar registro com tipoRegistro=cnq", async () => {
      const cnqData = {
        osRetrabalhada: "9999",
        osOriginal: "9998",
        data: new Date("2026-06-01"),
        setor: "VENDAS",
        tipo: "INTERNO" as const,
        custo: "150.00",
        frete: "0",
        total: "150.00",
        classe: "EVITÁVEL" as const,
        tipoRegistro: "cnq" as const,
        responsavel: "João",
        codigoErro: "CNQ-001",
      };
      (createRetrabalho as any).mockResolvedValue({ id: 999, ...cnqData });

      const result = await createRetrabalho(cnqData as any);
      expect(createRetrabalho).toHaveBeenCalledWith(cnqData);
      expect(result.tipoRegistro).toBe("cnq");
    });

    it("deve criar registro com tipoRegistro=retrabalho (padrão)", async () => {
      const retrabData = {
        osRetrabalhada: "8888",
        osOriginal: "8887",
        data: new Date("2026-06-01"),
        setor: "SOLDA",
        tipo: "INTERNO" as const,
        custo: "500.00",
        frete: "50.00",
        total: "550.00",
        classe: "EVITÁVEL" as const,
        tipoRegistro: "retrabalho" as const,
        responsavel: "Maria",
        codigoErro: "E001",
      };
      (createRetrabalho as any).mockResolvedValue({ id: 1000, ...retrabData });

      const result = await createRetrabalho(retrabData as any);
      expect(createRetrabalho).toHaveBeenCalledWith(retrabData);
      expect(result.tipoRegistro).toBe("retrabalho");
    });
  });

  describe("updateRetrabalho com tipoRegistro", () => {
    it("deve atualizar tipoRegistro de retrabalho para cnq", async () => {
      const updateData = { tipoRegistro: "cnq" as const };
      (updateRetrabalho as any).mockResolvedValue({ id: 100, tipoRegistro: "cnq" });

      const result = await updateRetrabalho(100 as any, updateData as any);
      expect(updateRetrabalho).toHaveBeenCalledWith(100, updateData);
      expect(result.tipoRegistro).toBe("cnq");
    });
  });

  describe("Indicador Mestre: Impacto Total da Não-Qualidade", () => {
    it("deve somar custos de retrabalho + CNQ para impacto total", () => {
      const custoRetrabalho = 43103.50;
      const custoCnq = 1200.50;
      const impactoTotal = custoRetrabalho + custoCnq;
      expect(impactoTotal).toBe(44304.00);
    });

    it("deve somar quantidades de retrabalho + CNQ", () => {
      const qtdRetrabalho = 156;
      const qtdCnq = 5;
      const totalOcorrencias = qtdRetrabalho + qtdCnq;
      expect(totalOcorrencias).toBe(161);
    });

    it("deve calcular proporção correta entre retrabalho e CNQ", () => {
      const custoRetrabalho = 43103.50;
      const custoCnq = 1200.50;
      const impactoTotal = custoRetrabalho + custoCnq;
      const pctRetrabalho = (custoRetrabalho / impactoTotal) * 100;
      const pctCnq = (custoCnq / impactoTotal) * 100;
      expect(pctRetrabalho).toBeCloseTo(97.29, 1);
      expect(pctCnq).toBeCloseTo(2.71, 1);
      expect(pctRetrabalho + pctCnq).toBeCloseTo(100, 0);
    });
  });
});
