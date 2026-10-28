import { describe, expect, it } from "vitest";
import {
  contarComprasPorCliente,
  calcularTaxaConversaoCliente,
  type OsParaContagem,
  type OrcGanhoParaContagem,
} from "../services/probabilidadeCompra";

const os = (empresa: string, mes: number, ano: number, extra: Partial<OsParaContagem> = {}): OsParaContagem => ({
  empresa, tipoOs: "Normal", status: "Entregue", mes, ano, ...extra,
});
const ganho = (empresa: string, mes: number, ano: number): OrcGanhoParaContagem => ({ empresa, mes, ano });

describe("contarComprasPorCliente", () => {
  it("compra que aparece como OS e como orçamento ganho no mesmo mês conta uma vez só", () => {
    const compras = contarComprasPorCliente(
      [os("ACME Ltda", 3, 2026), os("ACME Ltda", 4, 2026)],
      [ganho("ACME Ltda", 3, 2026), ganho("ACME Ltda", 4, 2026)],
    );
    expect(compras.get("acme ltda")).toBe(2);
  });

  it("mês sem nenhuma OS sincronizada: o orçamento ganho é a compra (buraco nov/dez 2025)", () => {
    const compras = contarComprasPorCliente(
      [os("ACME Ltda", 10, 2025)],
      [ganho("ACME Ltda", 11, 2025), ganho("ACME Ltda", 12, 2025)],
    );
    expect(compras.get("acme ltda")).toBe(3);
  });

  it("mês com OS de outros clientes já está coberto: orçamento ganho não vira compra extra", () => {
    const compras = contarComprasPorCliente(
      [os("Outro Cliente", 5, 2026)],
      [ganho("ACME Ltda", 5, 2026)],
    );
    expect(compras.get("acme ltda")).toBeUndefined();
    expect(compras.get("outro cliente")).toBe(1);
  });

  it("retrabalho, amostra, cortesia, cancelada e tipo ausente não contam como compra", () => {
    const compras = contarComprasPorCliente(
      [
        os("ACME Ltda", 1, 2026),
        os("ACME Ltda", 1, 2026, { tipoOs: "Retrabalho Cliente" }),
        os("ACME Ltda", 1, 2026, { tipoOs: "Amostra" }),
        os("ACME Ltda", 1, 2026, { tipoOs: "Cortesia" }),
        os("ACME Ltda", 1, 2026, { status: "Cancelada" }),
        os("ACME Ltda", 1, 2026, { tipoOs: null }),
      ],
      [],
    );
    expect(compras.get("acme ltda")).toBe(1);
  });

  it("OS que não vale como compra ainda marca o mês como coberto (evita contar o orçamento por cima)", () => {
    const compras = contarComprasPorCliente(
      [os("ACME Ltda", 7, 2026, { tipoOs: "Retrabalho" })],
      [ganho("ACME Ltda", 7, 2026)],
    );
    expect(compras.get("acme ltda")).toBeUndefined();
  });

  it("agrupa grafias do mesmo cliente (acento, pontuação, caixa) pela chave normalizada", () => {
    const compras = contarComprasPorCliente(
      [os("Comércio Visual LTDA.", 2, 2026), os("COMERCIO VISUAL LTDA", 3, 2026)],
      [],
    );
    expect(compras.get("comercio visual ltda")).toBe(2);
  });

  it("ignora linhas sem nome de cliente", () => {
    const compras = contarComprasPorCliente([os("", 2, 2026), os("   ", 2, 2026)], [ganho("", 2, 2026)]);
    expect(compras.size).toBe(0);
  });
});

describe("calcularTaxaConversaoCliente", () => {
  it("orçamentos fechados ÷ cotações (1 de 3 = 33%)", () => {
    expect(calcularTaxaConversaoCliente(3, 1, 3)).toBe(33);
  });

  it("nunca passa de 100%, mesmo com contagem inconsistente", () => {
    expect(calcularTaxaConversaoCliente(2, 5, 2)).toBe(100);
  });

  it("sem orçamento no histórico não há base: null, em vez de 0% enganoso", () => {
    expect(calcularTaxaConversaoCliente(1, 0, 0)).toBeNull();
  });

  it("cliente com orçamentos mas nenhum fechado tem 0%", () => {
    expect(calcularTaxaConversaoCliente(4, 0, 4)).toBe(0);
  });
});
