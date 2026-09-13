import { describe, it, expect } from "vitest";
import { ehDiaUtil, adicionarDiasUteis, diasUteisEntre, gerarDatasUteis } from "../../shared/dias-uteis";

describe("dias-uteis", () => {
  describe("ehDiaUtil", () => {
    it("considera segunda a sexta como dia útil", () => {
      // 13/07/2026 é segunda, 17/07/2026 é sexta
      expect(ehDiaUtil(new Date(2026, 6, 13))).toBe(true);
      expect(ehDiaUtil(new Date(2026, 6, 17))).toBe(true);
    });

    it("não considera sábado/domingo dia útil", () => {
      // 18/07/2026 é sábado, 19/07/2026 é domingo
      expect(ehDiaUtil(new Date(2026, 6, 18))).toBe(false);
      expect(ehDiaUtil(new Date(2026, 6, 19))).toBe(false);
    });
  });

  describe("adicionarDiasUteis", () => {
    it("adiciona 1 dia útil (segunda para terça)", () => {
      const resultado = adicionarDiasUteis(new Date(2026, 6, 13), 1);
      expect(resultado.getDate()).toBe(14);
    });

    it("pula fim de semana ao adicionar dias úteis", () => {
      const resultado = adicionarDiasUteis(new Date(2026, 6, 13), 5); // pula sáb 18 e dom 19
      expect(resultado.getDate()).toBe(20); // segunda seguinte
    });

    it("adiciona a partir de uma sexta-feira, pulando o fim de semana logo em seguida", () => {
      const resultado = adicionarDiasUteis(new Date(2026, 6, 17), 1); // sexta -> próximo útil
      expect(resultado.getDate()).toBe(20); // segunda
    });

    it("adiciona a partir de um sábado", () => {
      const resultado = adicionarDiasUteis(new Date(2026, 6, 18), 1); // sábado -> próximo útil
      expect(resultado.getDate()).toBe(20); // segunda
    });

    it("adiciona a partir de um domingo", () => {
      const resultado = adicionarDiasUteis(new Date(2026, 6, 19), 2); // domingo -> seg, ter
      expect(resultado.getDate()).toBe(21); // terça
    });
  });

  describe("diasUteisEntre", () => {
    it("conta dias úteis entre segunda e a sexta da mesma semana", () => {
      const inicio = new Date(2026, 6, 13); // segunda
      const fim = new Date(2026, 6, 17); // sexta
      expect(diasUteisEntre(inicio, fim)).toBe(4);
    });

    it("não conta sábado/domingo no meio do intervalo", () => {
      const inicio = new Date(2026, 6, 17); // sexta
      const fim = new Date(2026, 6, 20); // segunda seguinte
      expect(diasUteisEntre(inicio, fim)).toBe(1);
    });

    it("retorna 0 quando fim é igual ou anterior a início", () => {
      const d = new Date(2026, 6, 13);
      expect(diasUteisEntre(d, d)).toBe(0);
      expect(diasUteisEntre(d, new Date(2026, 6, 10))).toBe(0);
    });
  });

  describe("gerarDatasUteis", () => {
    it("gera N datas úteis a partir de uma segunda-feira", () => {
      const datas = gerarDatasUteis(new Date(2026, 6, 13), 5); // segunda
      expect(datas.map(d => d.getDate())).toEqual([14, 15, 16, 17, 20]); // pula sáb/dom
    });

    it("gera N datas úteis a partir de uma sexta-feira", () => {
      const datas = gerarDatasUteis(new Date(2026, 6, 17), 3); // sexta
      expect(datas.map(d => d.getDate())).toEqual([20, 21, 22]);
    });

    it("gera N datas úteis a partir de um sábado", () => {
      const datas = gerarDatasUteis(new Date(2026, 6, 18), 2); // sábado
      expect(datas.map(d => d.getDate())).toEqual([20, 21]);
    });

    it("gera N datas úteis a partir de um domingo", () => {
      const datas = gerarDatasUteis(new Date(2026, 6, 19), 2); // domingo
      expect(datas.map(d => d.getDate())).toEqual([20, 21]);
    });
  });
});
