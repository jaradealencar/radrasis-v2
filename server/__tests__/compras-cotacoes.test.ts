import { describe, expect, it } from "vitest";
import {
  compradorSchema,
  dataCompraSchema,
  menorCotacaoDisponivel,
  ordemCompraSchema,
  precoConsumo,
  type ReferenciaPrecoCompra,
} from "../../shared/compras-cotacoes";

const referencia: ReferenciaPrecoCompra = {
  materiaPrimaId: 1,
  unidade: "M2",
  preco: 100,
  data: "2026-11-01",
  fornecedor: "Fornecedor A",
  cotacaoId: 7,
  validadeDias: 30,
  quantidade: 1,
  fator: 6,
};
const compra = {
  materiaPrimaId: 1,
  unidade: "Metro quadrado",
  data: "2026-11-23",
  quantidade: 6,
};
describe("Compras: consumo, referências e emissão", () => {
  it("compara chapas de medidas diferentes pelo preço por m²", () => {
    expect(precoConsumo(1264.55, 6, "M2")).toBeCloseTo(210.758333, 6);
    expect(precoConsumo(421.52, 2, "M2")).toBe(210.76);
    expect(precoConsumo(631.11, 2.05 * 3.05, "M2")).toBeCloseTo(100.937225, 5);
  });
  it("mantém custo desconhecido e conversão ausente como pendência", () => {
    expect(precoConsumo(100, null, "M2")).toBeNull();
    expect(precoConsumo(100, 0, "M2")).toBeNull();
    expect(precoConsumo(100, 1, null)).toBeNull();
    expect(precoConsumo(Infinity, 1, "M2")).toBeNull();
  });
  it("seleciona somente preço da mesma MP e unidade com validade e volume atendidos", () => {
    const ref = menorCotacaoDisponivel(
      [
        { ...referencia, preco: 1, materiaPrimaId: 2 },
        { ...referencia, preco: 2, unidade: "KG" },
        { ...referencia, preco: 3, data: "2026-11-24" },
        { ...referencia, preco: 4, validadeDias: 1 },
        { ...referencia, preco: 5, quantidade: 10 },
        { ...referencia, preco: 6, validadeDias: null },
        referencia,
        { ...referencia, cotacaoId: 8, preco: 110 },
      ],
      compra
    );
    expect(ref?.cotacaoId).toBe(7);
    expect(
      menorCotacaoDisponivel([referencia], { ...compra, materiaPrimaId: null })
    ).toBeNull();
    expect(
      menorCotacaoDisponivel([referencia], { ...compra, quantidade: 2 })
    ).toBeNull();
  });
  it("aceita o último dia da validade e rejeita o dia seguinte", () => {
    expect(
      menorCotacaoDisponivel([referencia], { ...compra, data: "2026-12-01" })
    ).not.toBeNull();
    expect(
      menorCotacaoDisponivel([referencia], { ...compra, data: "2026-12-02" })
    ).toBeNull();
  });
  it("rejeita datas impossíveis", () => {
    expect(dataCompraSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dataCompraSchema.safeParse("2026-11-23").success).toBe(true);
  });
  const comprador = {
    tipo: "empresa" as const,
    nome: "Radra Indústria LTDA",
    documento: "11.073.532/0001-75",
    inscricaoEstadual: "283557532",
    endereco: "Rua Pedro de Toledo, 306, Campo Grande/MS",
    emailNf: "radrafinanceiro@gmail.com",
  };
  const ordem = {
    chave: "a5f7e8aa-4de1-4237-b3e2-407beca2826c",
    cotacaoId: 1,
    comprador,
    pagamento: "a_vista" as const,
    condicaoPagamento: "",
    transportadora: "",
    numeroColeta: "",
    frete: 0,
    observacoes: "",
    itens: [{ itemId: 1, quantidade: 2 }],
  };
  it("exige CPF/CNPJ compatível com o comprador e e-mail para a NF", () => {
    expect(compradorSchema.safeParse(comprador).success).toBe(true);
    expect(
      compradorSchema.safeParse({ ...comprador, tipo: "pessoa" }).success
    ).toBe(false);
    expect(
      compradorSchema.safeParse({ ...comprador, emailNf: "" }).success
    ).toBe(false);
  });
  it("bloqueia ordem vazia, item duplicado, quantidade inválida e faturado sem prazo", () => {
    expect(ordemCompraSchema.safeParse(ordem).success).toBe(true);
    expect(ordemCompraSchema.safeParse({ ...ordem, itens: [] }).success).toBe(
      false
    );
    expect(
      ordemCompraSchema.safeParse({
        ...ordem,
        itens: [...ordem.itens, ...ordem.itens],
      }).success
    ).toBe(false);
    expect(
      ordemCompraSchema.safeParse({
        ...ordem,
        itens: [{ itemId: 1, quantidade: -1 }],
      }).success
    ).toBe(false);
    expect(
      ordemCompraSchema.safeParse({ ...ordem, pagamento: "faturado" }).success
    ).toBe(false);
  });
});
