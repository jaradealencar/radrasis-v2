import { describe, it, expect } from "vitest";
import {
  adicionarDiasUteis,
  formatarData,
  extrairDiasUteis,
  calcularDataEntrega,
} from "./date-utils";

describe("date-utils", () => {
  describe("adicionarDiasUteis", () => {
    it("adiciona 1 dia útil (segunda para terça)", () => {
      // 13/07/2026 é uma segunda-feira
      const data = new Date(2026, 6, 13); // mês 6 = julho
      const resultado = adicionarDiasUteis(data, 1);
      expect(formatarData(resultado)).toBe("14/07/2026"); // terça
    });

    it("adiciona 3 dias úteis (segunda para quinta)", () => {
      const data = new Date(2026, 6, 13); // segunda
      const resultado = adicionarDiasUteis(data, 3);
      expect(formatarData(resultado)).toBe("16/07/2026"); // quinta
    });

    it("pula fim de semana ao adicionar dias úteis", () => {
      const data = new Date(2026, 6, 13); // segunda
      const resultado = adicionarDiasUteis(data, 5); // pula sábado 18 e domingo 19
      expect(formatarData(resultado)).toBe("20/07/2026"); // segunda da semana seguinte
    });

    it("adiciona 10 dias úteis (segunda para segunda da semana seguinte)", () => {
      const data = new Date(2026, 6, 13); // segunda 13/07
      const resultado = adicionarDiasUteis(data, 10);
      expect(formatarData(resultado)).toBe("27/07/2026"); // segunda 27/07
    });
  });

  describe("formatarData", () => {
    it("formata data corretamente", () => {
      const data = new Date(2026, 6, 16);
      expect(formatarData(data)).toBe("16/07/2026");
    });

    it("formata com zero à esquerda", () => {
      const data = new Date(2026, 0, 5); // 5 de janeiro
      expect(formatarData(data)).toBe("05/01/2026");
    });
  });

  describe("extrairDiasUteis", () => {
    it("extrai dias úteis de 'X DIAS ÚTEIS'", () => {
      expect(extrairDiasUteis("10 DIAS ÚTEIS")).toBe(10);
    });

    it("extrai dias úteis de 'X dias úteis' (minúsculo)", () => {
      expect(extrairDiasUteis("10 dias úteis")).toBe(10);
    });

    it("extrai dias úteis sem espaço", () => {
      expect(extrairDiasUteis("10DIAS ÚTEIS")).toBe(10);
    });

    it("retorna null se não for formato 'X DIAS ÚTEIS'", () => {
      expect(extrairDiasUteis("26/07/2026")).toBeNull();
      expect(extrairDiasUteis("10 dias")).toBeNull();
    });
  });

  describe("calcularDataEntrega", () => {
    it("converte '10 DIAS ÚTEIS' em data de calendário", () => {
      // 13/07/2026 (segunda) + 10 dias úteis = 27/07/2026
      const resultado = calcularDataEntrega(new Date(2026, 6, 13), "10 DIAS ÚTEIS");
      expect(resultado).toBe("27/07/2026");
    });

    it("retorna data original se não for 'X DIAS ÚTEIS'", () => {
      const resultado = calcularDataEntrega(new Date(2026, 6, 13), "26/07/2026");
      expect(resultado).toBe("26/07/2026");
    });

    it("funciona com dataAprovacao como string dd/mm/yyyy", () => {
      const resultado = calcularDataEntrega("16/07/2026", "10 DIAS ÚTEIS");
      expect(resultado).toBe("30/07/2026");
    });

    it("funciona com dataAprovacao como timestamp", () => {
      const timestamp = new Date(2026, 6, 16).getTime();
      const resultado = calcularDataEntrega(timestamp, "10 DIAS ÚTEIS");
      expect(resultado).toBe("30/07/2026");
    });
  });
});
