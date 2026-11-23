import { describe, expect, it } from "vitest";
import {
  calcularFreteCompra,
  logisticaCompraSchema,
  resumoFreteCompra,
  validarFreteNf,
} from "../../shared/compras-frete";
import { medidasChapaMm, precoChapaM2 } from "../../shared/compras-chapas";
import { fornecedorDaOrdemConfere, snapshotFreteNf } from "../services/comprasFrete";
import { calcularNfCompra } from "../services/nfCalculo";

describe("Ciclo da ordem para NF com frete", () => {
  it("usa a tarifa do servidor em vez de um total adulterado enviado pela tela", () => {
    const ordem = { ordem: { frete: "250", freteModo: "por_kg", freteValorInformado: "2.5000", freteConfirmado: true, logisticaRevisao: 2, transportadora: "Transportadora A", numeroColeta: "COL-1" }, utilizado: 0 } as Parameters<typeof snapshotFreteNf>[0];
    const snapshot = snapshotFreteNf(ordem, 1, 150);
    expect(snapshot.freteAplicado).toBe(375);
    expect(snapshot.valorPorKg).toBe(2.5);
    expect(snapshot.revisao).toBe(2);
    expect(snapshot.numeroColeta).toBe("COL-1");
    expect(() => snapshotFreteNf(ordem, 0, null)).toThrow(/peso/);
  });
  it("fixa zero no snapshot do frete grátis mesmo com valor enviado pela tela", () => {
    const ordem = { ordem: { frete: "0", freteModo: "gratis", freteValorInformado: "0", freteConfirmado: true, logisticaRevisao: 1, transportadora: "", numeroColeta: "" }, utilizado: 0 } as Parameters<typeof snapshotFreteNf>[0];
    expect(snapshotFreteNf(ordem, 300, null).freteAplicado).toBe(0);
  });
  it("distingue frete fixo, por kg e grátis sem tratar tarifa como valor total", () => {
    expect(calcularFreteCompra("valor_total", 300, 120).total).toBe(300);
    expect(calcularFreteCompra("por_kg", 2.5, 120).total).toBe(300);
    expect(calcularFreteCompra("por_kg", 2.5, null).total).toBeNull();
    expect(calcularFreteCompra("gratis", 300, 120).total).toBe(0);
    expect(
      validarFreteNf({
        totalOrdem: 200,
        utilizado: 200,
        aplicado: 300,
        pesoKg: 120,
        confirmado: true,
        modo: "por_kg",
      }).valorPorKg
    ).toBe(2.5);
  });
  it("converte os exemplos da Bold e Central com a área de cada chapa", () => {
    const bold = medidasChapaMm("ACRILICO BRANCO 2050X3050X3MM BR4044");
    const central = medidasChapaMm("ACRILICO BRANCO 1220X2440X3MM");
    expect(bold?.area).toBe(6.2525);
    expect(central?.area).toBe(2.9768);
    expect(precoChapaM2(692.64, bold!.area)).toBeCloseTo(110.778, 2);
    expect(precoChapaM2(294.69, central!.area)).toBeCloseTo(98.995, 2);
    expect(medidasChapaMm("Chapa 3mm sem outras medidas")).toBeNull();
    expect(precoChapaM2(294.69, null)).toBeNull();
  });
  it("calcula R$/kg a partir do total e do peso, sem inventar peso ausente", () => {
    expect(resumoFreteCompra(300, 0, 150).valorPorKg).toBe(2);
    expect(resumoFreteCompra(300, 0, null).valorPorKg).toBeNull();
    expect(resumoFreteCompra(300, 0, 0).valorPorKg).toBeNull();
  });
  it("controla parcelas de entregas parciais sem aplicar o total duas vezes", () => {
    const primeira = validarFreteNf({
      totalOrdem: 300,
      utilizado: 0,
      aplicado: 180,
      pesoKg: 90,
      confirmado: true,
    });
    expect(primeira.valorPorKg).toBe(2);
    const segunda = validarFreteNf({
      totalOrdem: 300,
      utilizado: primeira.aplicado,
      aplicado: 120,
      pesoKg: 40,
      confirmado: true,
    });
    expect(segunda.valorPorKg).toBe(3);
    expect(
      resumoFreteCompra(300, primeira.aplicado + segunda.aplicado, 130).saldo
    ).toBe(0);
    expect(() =>
      validarFreteNf({
        totalOrdem: 300,
        utilizado: 180,
        aplicado: 300,
        pesoKg: 40,
        confirmado: true,
      })
    ).toThrow(/saldo/);
  });
  it("exige confirmação do frete e peso para parcela positiva", () => {
    expect(() =>
      validarFreteNf({
        totalOrdem: 300,
        utilizado: 0,
        aplicado: 300,
        pesoKg: 0,
        confirmado: true,
      })
    ).toThrow(/peso/);
    expect(() =>
      validarFreteNf({
        totalOrdem: 0,
        utilizado: 0,
        aplicado: 0,
        pesoKg: null,
        confirmado: false,
      })
    ).toThrow(/Confirme/);
    expect(
      validarFreteNf({
        totalOrdem: 0,
        utilizado: 0,
        aplicado: 0,
        pesoKg: null,
        confirmado: true,
      }).aplicado
    ).toBe(0);
  });
  it("rejeita frete, revisão e peso inválidos", () => {
    const dados = {
      ordemId: 1,
      revisao: 0,
      frete: 300,
      freteConfirmado: true,
      pesoPrevistoKg: 150,
      transportadora: "Manual",
      numeroColeta: "COL123",
    };
    expect(logisticaCompraSchema.safeParse(dados).success).toBe(true);
    expect(
      logisticaCompraSchema.safeParse({ ...dados, frete: -1 }).success
    ).toBe(false);
    expect(
      logisticaCompraSchema.safeParse({ ...dados, pesoPrevistoKg: 0 }).success
    ).toBe(false);
    expect(
      logisticaCompraSchema.safeParse({ ...dados, revisao: -1 }).success
    ).toBe(false);
  });
  it("confere o fornecedor por CNPJ, usando nome só na ausência do documento", () => {
    expect(
      fornecedorDaOrdemConfere(
        { fornecedor: "Nome antigo", cnpjFornecedor: "00.000.000/0001-91" },
        { cnpjFornecedor: "00000000000191" }
      )
    ).toBe(true);
    expect(
      fornecedorDaOrdemConfere(
        { fornecedor: "Mesmo nome", cnpjFornecedor: "00000000000191" },
        { cnpjFornecedor: "11111111000111", nomeFornecedor: "Mesmo nome" }
      )
    ).toBe(false);
    expect(
      fornecedorDaOrdemConfere(
        { fornecedor: "Bold S.A.", cnpjFornecedor: null },
        { cnpjFornecedor: "", nomeFornecedor: "BOLD SA" }
      )
    ).toBe(true);
  });
  it("rateia uma única vez o frete herdado da ordem mesmo para materiais vendidos em UN", () => {
    const frete = validarFreteNf({
      totalOrdem: 300,
      utilizado: 0,
      aplicado: 300,
      pesoKg: 150,
      confirmado: true,
    });
    const resultado = calcularNfCompra({
      valorMercadoria: 1000,
      valorFrete: frete.aplicado,
      modoFrete: "valor_total",
      percentualIcms: 0,
      itens: [
        {
          descricao: "Chapa A",
          quantidade: 1,
          unidadeCompra: "UN",
          valorUnitario: 600,
          valorTotalItem: 600,
          unidadeErp: "M2",
          fatorConversao: 6,
        },
        {
          descricao: "Chapa B",
          quantidade: 2,
          unidadeCompra: "UN",
          valorUnitario: 200,
          valorTotalItem: 400,
          unidadeErp: "M2",
          fatorConversao: 2,
        },
      ],
    });
    expect(resultado.itens.map(i => i.rateioFrete)).toEqual([180, 120]);
    expect(resultado.custoTotalNf).toBe(1300);
    expect(resultado.itens[0].custoRealErp).toBe(130);
  });
});
