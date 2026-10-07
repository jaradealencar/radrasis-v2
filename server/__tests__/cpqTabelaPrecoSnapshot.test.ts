import { describe, expect, it } from "vitest";
import { selecionarCelulaTabelaPreco } from "../services/cpqTabelaPrecoSnapshot";

const faixasTicket = ["Até R$330", "R$335~750", "R$760~1.300", "R$1.301~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"];

describe("selecionarCelulaTabelaPreco", () => {
  it("resolve a faixa e a margem da linha padrão pelo custo direto", () => {
    const conteudo = JSON.stringify({
      type: "margin_table",
      columns: faixasTicket,
      faixaIds: [11, 12, 13, 14, 15, 16, 17],
      rows: [{ id: 5, label: "Frente" , values: ["35%", "29%", "27%", "25%", "14,3%", "6%", "2%"] }],
    });
    expect(selecionarCelulaTabelaPreco(conteudo, 5, 2000)).toEqual({
      linhaId: 5, linhaLabel: "Frente", faixaId: 14, faixaIndex: 3,
      faixaLabel: "R$1.301~5.490", margemPct: 25,
    });
  });

  it("ignora a coluna descritiva em tabelas multi", () => {
    const conteudo = JSON.stringify({
      type: "margin_table_multi",
      columns: ["Tipo", ...faixasTicket],
      faixaIds: [21, 22, 23, 24, 25, 26, 27],
      rows: [{ id: 8, label: "PVC", values: ["35%", "29%", "27%", "25%", "14,3%", "6%", "2%"] }],
    });
    expect(selecionarCelulaTabelaPreco(conteudo, 8, 2000)).toMatchObject({
      faixaId: 24, faixaIndex: 3, faixaLabel: "R$1.301~5.490", margemPct: 25,
    });
  });

  it("usa a primeira opção em tabelas multi sem faixas de ticket", () => {
    const conteudo = JSON.stringify({
      type: "margin_table_multi", columns: ["Área", "1 cor", "2 cores"], faixaIds: [31, 32],
      rows: [{ id: 9, label: "Pintura", values: ["18%", "22%"] }],
    });
    expect(selecionarCelulaTabelaPreco(conteudo, 9, 2000)).toMatchObject({
      faixaId: 31, faixaIndex: 0, faixaLabel: "1 cor", margemPct: 18,
    });
  });

  it("recusa faixa sem ID estável", () => {
    const conteudo = JSON.stringify({
      type: "margin_table", columns: ["Até R$330"], faixaIds: [],
      rows: [{ id: 5, label: "Frente", values: ["35%"] }],
    });
    expect(selecionarCelulaTabelaPreco(conteudo, 5, 100)).toBeNull();
  });
});
