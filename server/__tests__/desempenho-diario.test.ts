import { describe, expect, it } from "vitest";
import { agregarDesempenhoDiario } from "../routers/performanceComercial";

const classificar = (nome: string) =>
  nome === "Cliente Novo" ? ("novo" as const)
  : nome === "Cliente Reativado" ? ("reativado" as const)
  : null;

const orc = (cliente: any, extra: Record<string, unknown> = {}) => ({ cliente, valor_total: "100", status: "Aberto", ...extra });
const os = (cliente: any, extra: Record<string, unknown> = {}) => ({ cliente, valor_total: "1000", valor_desconto: "0", tipo: "Normal", status: "Aprovada", ...extra });

describe("agregarDesempenhoDiario", () => {
  it("separa cotações, vendas e faturamento por família de cliente e fecha o geral", () => {
    const r = agregarDesempenhoDiario(
      [orc("Cliente Novo"), orc("Cliente Novo", { valor_total: "50" }), orc("Cliente Reativado"), orc("Cliente Antigo")],
      [os("Cliente Novo"), os("Cliente Reativado", { valor_total: "500", valor_desconto: "100" }), os("Cliente Antigo"), os("Cliente Antigo")],
      classificar,
    );
    expect(r.novos).toEqual({ cotacoes: 2, valorOrcado: 150, vendas: 1, faturamento: 1000 });
    expect(r.reativados).toEqual({ cotacoes: 1, valorOrcado: 100, vendas: 1, faturamento: 400 }); // valor líquido: 500 - 100
    expect(r.recorrentes).toEqual({ cotacoes: 1, valorOrcado: 100, vendas: 2, faturamento: 2000 });
    expect(r.geral).toEqual({ cotacoes: 4, valorOrcado: 350, vendas: 4, faturamento: 3400 });
  });

  it("usa as mesmas exclusões do mês: orçamento cancelado/excluído, retrabalho, amostra, cortesia e OS cancelada", () => {
    const r = agregarDesempenhoDiario(
      [orc("Cliente Novo"), orc("Cliente Novo", { status: "Cancelada" }), orc("Cliente Novo", { status: "Excluído" })],
      [
        os("Cliente Novo"),
        os("Cliente Novo", { tipo: "Retrabalho Cliente" }),
        os("Cliente Novo", { tipo: "Amostra" }),
        os("Cliente Novo", { tipo: "Cortesia" }),
        os("Cliente Novo", { status: "Cancelada" }),
      ],
      classificar,
    );
    expect(r.novos.cotacoes).toBe(1);
    expect(r.novos.vendas).toBe(1);
    expect(r.geral.vendas).toBe(1);
  });

  it("orçamento em aberto com valor_total zerado usa custo + margem como valor orçado", () => {
    const r = agregarDesempenhoDiario(
      [orc("Cliente Novo", { valor_total: "0", valor_custo: "300", valor_margem: "200" })],
      [],
      classificar,
    );
    expect(r.novos.valorOrcado).toBe(500);
  });

  it("lê o cliente quando a API manda objeto, e cliente sem nome entra só em recorrentes/geral", () => {
    const r = agregarDesempenhoDiario(
      [orc({ nome: "Cliente Novo" }), orc({ razao_social: "Cliente Reativado" }), orc(""), orc(undefined)],
      [os(null)],
      classificar,
    );
    expect(r.novos.cotacoes).toBe(1);
    expect(r.reativados.cotacoes).toBe(1);
    expect(r.recorrentes).toMatchObject({ cotacoes: 2, vendas: 1 });
    expect(r.geral).toMatchObject({ cotacoes: 4, vendas: 1 });
  });

  it("dia sem movimento devolve tudo zerado", () => {
    const zero = { cotacoes: 0, valorOrcado: 0, vendas: 0, faturamento: 0 };
    expect(agregarDesempenhoDiario([], [], classificar)).toEqual({ novos: zero, reativados: zero, recorrentes: zero, geral: zero });
  });
});
