import { describe, expect, it } from "vitest";
import { decuparPreco } from "../services/decupadorPreco";

describe("decupador de preço", () => {
  it("reconcilia os componentes com o preço bruto e calcula a margem líquida", () => {
    const resultado = decuparPreco({
      precoVenda: 1000,
      materiaPrima: 250,
      maoDeObra: 100,
      custoFixoPct: 10,
      comissaoPct: 5,
      impostoPct: 12,
      custoFinanceiroPct: 3,
    });

    expect(resultado.materiaPrima).toEqual({ valor: 250, percentual: 25 });
    expect(resultado.maoDeObra).toEqual({ valor: 100, percentual: 10 });
    expect(resultado.custoFixo).toEqual({ valor: 100, percentual: 10 });
    expect(resultado.comissao).toEqual({ valor: 50, percentual: 5 });
    expect(resultado.impostos).toEqual({ valor: 120, percentual: 12 });
    expect(resultado.custoFinanceiro).toEqual({ valor: 30, percentual: 3 });
    expect(resultado.lucroLiquido).toEqual({ valor: 350, percentual: 35 });
    expect([
      resultado.materiaPrima,
      resultado.maoDeObra,
      resultado.custoFixo,
      resultado.comissao,
      resultado.impostos,
      resultado.custoFinanceiro,
      resultado.lucroLiquido,
    ].reduce((total, componente) => total + componente.valor, 0)).toBe(resultado.precoVenda);
  });

  it("mostra prejuízo quando os custos e encargos excedem o preço", () => {
    const resultado = decuparPreco({
      precoVenda: 100,
      materiaPrima: 70,
      maoDeObra: 20,
      custoFixoPct: 15,
      comissaoPct: 10,
      impostoPct: 10,
      custoFinanceiroPct: 5,
    });

    expect(resultado.lucroLiquido).toEqual({ valor: -30, percentual: -30 });
  });

  it("rejeita valores desconhecidos ou taxas fora do intervalo", () => {
    const base = {
      precoVenda: 100,
      materiaPrima: 10,
      maoDeObra: 10,
      custoFixoPct: 0,
      comissaoPct: 0,
      impostoPct: 0,
      custoFinanceiroPct: 0,
    };

    expect(() => decuparPreco({ ...base, maoDeObra: Number.NaN })).toThrow();
    expect(() => decuparPreco({ ...base, impostoPct: 101 })).toThrow();
  });
});
