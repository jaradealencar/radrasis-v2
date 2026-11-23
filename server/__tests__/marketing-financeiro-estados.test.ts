import { describe, expect, it } from "vitest";
import { resumirEstadosNovos } from "../services/marketingFinanceiroEstados";

const data = (value: string) => new Date(`${value}T12:00:00.000Z`);

describe("marketingFinanceiroEstados", () => {
  it("cruza primeira compra e propostas anteriores por cliente sem contar proposta posterior ou no mesmo instante", () => {
    const resumo = resumirEstadosNovos([
      {
        clienteKey: "cliente um",
        estado: "MT",
        dataPrimeiraCompra: data("2026-10-20"),
        ordens: [
          { chave: "os:1", valor: 1500 },
          { chave: "os:2", valor: 500 },
        ],
      },
      {
        clienteKey: "cliente dois",
        estado: "mt",
        dataPrimeiraCompra: data("2026-10-23"),
        ordens: [{ chave: "os:3", valor: 1000 }],
      },
      {
        clienteKey: "cliente sem uf",
        estado: null,
        dataPrimeiraCompra: data("2026-10-24"),
        ordens: [{ chave: "os:4", valor: 300 }],
      },
    ], [
      { id: 1, orcNumero: "P-1", clienteKey: "cliente um", estado: "MT", dataProposta: data("2026-10-05"), valor: 4000 },
      // Mesmo número: deve contar uma vez mesmo se o cache repetir ou divergir a UF.
      { id: 2, orcNumero: "P-1", clienteKey: "cliente um", estado: "SP", dataProposta: data("2026-10-05"), valor: 90000 },
      { id: 3, orcNumero: "P-2", clienteKey: "cliente um", estado: "SP", dataProposta: data("2026-10-21"), valor: 7000 },
      // No mesmo dia sem horário confiável não prova que a proposta veio antes da compra.
      { id: 4, orcNumero: "P-3", clienteKey: "cliente dois", estado: "MT", dataProposta: data("2026-10-23"), valor: 2000 },
      { id: 5, orcNumero: "P-4", clienteKey: "cliente sem uf", estado: null, dataProposta: data("2026-10-10"), valor: 500 },
      { id: 6, orcNumero: "P-5", clienteKey: "prospect sem compra", estado: "PR", dataProposta: data("2026-10-12"), valor: 800 },
      { id: 7, orcNumero: "P-6", clienteKey: "prospect sem uf", estado: null, dataProposta: data("2026-10-12"), valor: 1000 },
    ]);

    expect(resumo.clientesPrimeiraCompra).toEqual([{
      uf: "MT",
      clientes: 2,
      os: 3,
      faturamento: 3000,
      ticketMedioPorCliente: 1500,
      clientesComPropostaAntesDaCompra: 1,
      propostasAntesDaCompra: 1,
      valorPropostasAntesDaCompra: 4000,
    }]);
    expect(resumo.totalClientesPrimeiraCompra).toBe(3);
    expect(resumo.totalOsPrimeiraCompra).toBe(4);
    expect(resumo.faturamentoPrimeiraCompra).toBe(3300);
    expect(resumo.clientesPrimeiraCompraSemUf).toBe(1);
    expect(resumo.osPrimeiraCompraSemUf).toBe(1);
    expect(resumo.faturamentoPrimeiraCompraSemUf).toBe(300);
    expect(resumo.clientesComPropostaAntesDaCompraSemUf).toBe(1);
    expect(resumo.propostasAntesDaCompraSemUf).toBe(1);
    expect(resumo.valorPropostasAntesDaCompraSemUf).toBe(500);
    expect(resumo.clientesComPropostaAntesDaCompra).toBe(2);
    expect(resumo.totalPropostasAntesDaCompra).toBe(2);
    expect(resumo.valorPropostasAntesDaCompra).toBe(4500);

    expect(resumo.propostasNovosClientes).toEqual([
      { uf: "MT", propostas: 1, clientes: 1, valorPropostas: 4000, propostasSemValor: 0 },
      { uf: "PR", propostas: 1, clientes: 1, valorPropostas: 800, propostasSemValor: 0 },
    ]);
    expect(resumo.totalPropostasNovosClientes).toBe(4);
    expect(resumo.valorPropostasNovosClientes).toBe(6300);
    expect(resumo.propostasNovosClientesSemUf).toBe(2);
    expect(resumo.valorPropostasNovosClientesSemUf).toBe(1500);
  });
});
