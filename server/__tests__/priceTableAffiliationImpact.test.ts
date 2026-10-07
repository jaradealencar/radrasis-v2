import { describe, expect, it } from "vitest";
import { filtrarVendasPorProdutosAfiliados } from "../services/priceTableAffiliationImpact";

describe("vendas da Tabela de Pre?os por afilia??o expl?cita", () => {
  const produtos = new Set([101, 202]);
  const porVariacao = new Map([[9001, 202]]);
  const porModelo = new Map([[8001, 101]]);

  it("usa produto, varia??o e modelo por IDs do MubiSys; descri??o n?o inclui itens", () => {
    const vendas = [
      { osId: 1, produtoId: 101, modeloId: null, variacaoId: null, nome: "Produto afiliado" },
      { osId: 2, produtoId: null, modeloId: null, variacaoId: 9001, nome: "Varia??o afiliada" },
      { osId: 3, produtoId: null, modeloId: 8001, variacaoId: null, nome: "Modelo afiliado" },
      { osId: 4, produtoId: 303, modeloId: null, variacaoId: null, nome: "Produto afiliado pelo nome" },
      { osId: 5, produtoId: null, modeloId: null, variacaoId: null, nome: "Outro" },
    ];
    expect(filtrarVendasPorProdutosAfiliados(vendas, produtos, porVariacao, porModelo).map(v => v.osId)).toEqual([1, 2, 3]);
  });

  it("retorna zero correspond?ncias quando nenhum produto foi vinculado", () => {
    expect(filtrarVendasPorProdutosAfiliados(
      [{ produtoId: 101, modeloId: null, variacaoId: null }],
      new Set(), porVariacao, porModelo,
    )).toEqual([]);
  });
});
