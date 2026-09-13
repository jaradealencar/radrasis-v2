import { describe, it, expect } from "vitest";
import { calcularNovosDoMesLocal, type CompraMinima } from "../routers/performanceComercial";
import {
  classificarMes, agregarMes, calcularReativacaoAnual,
  type OsBrutaMarketing,
} from "../services/marketingFinanceiroClientes";
import { conciliar } from "../../shared/marketing-financeiro";

// ─── Fixture compartilhada ────────────────────────────────────────────────
// Mês de referência: Março/2026.
// - "Novo Ltda": nunca comprou antes -> novo.
// - "Recorrente Ativo Ltda": última compra Jan/2026 (gap=2, <6) -> recorrenteAtivo
//   (categoria nova — no caminho antigo essas O.S. eram simplesmente ignoradas).
// - "Reativado Ltda": última compra Ago/2025 (gap=7, >=6) -> reativado.
// - Empresa vazia: não classificável -> naoClassificado (no caminho antigo,
//   essas O.S. também eram simplesmente ignoradas).
// - "Cancelada Ltda": status Cancelada -> excluída por isOsNormalDb nos dois caminhos.
const overrideMap = new Map<string, "recorrente" | "novo">();

const todasComprasValidas: CompraMinima[] = [
  { empresa: "recorrente ativo ltda", mes: 1, ano: 2026 },
  { empresa: "reativado ltda", mes: 8, ano: 2025 },
];

const osDoAno: OsBrutaMarketing[] = [
  { osNumero: "1", empresa: "Novo Ltda", tipoOs: "Normal", status: "Entregue", mes: 3, ano: 2026, valorOs: "1000.00", valorTotal: null, contribuicaoReais: "500.00", vendedor: "V1", cidade: "Campo Grande", estado: "MS", dataAprovacao: "01/03/2026" },
  { osNumero: "2", empresa: "Recorrente Ativo Ltda", tipoOs: "Normal", status: "Entregue", mes: 3, ano: 2026, valorOs: "2000.00", valorTotal: null, contribuicaoReais: "800.00", vendedor: "V1", cidade: "Campo Grande", estado: "MS", dataAprovacao: "05/03/2026" },
  { osNumero: "3", empresa: "Reativado Ltda", tipoOs: "Normal", status: "Entregue", mes: 3, ano: 2026, valorOs: "1500.00", valorTotal: null, contribuicaoReais: null, vendedor: "V2", cidade: "Dourados", estado: "MS", dataAprovacao: "10/03/2026" },
  { osNumero: "4", empresa: "", tipoOs: "Normal", status: "Entregue", mes: 3, ano: 2026, valorOs: "300.00", valorTotal: null, contribuicaoReais: null, vendedor: null, cidade: null, estado: null, dataAprovacao: null },
  { osNumero: "5", empresa: "Cancelada Ltda", tipoOs: "Normal", status: "Cancelada", mes: 3, ano: 2026, valorOs: "9999.00", valorTotal: null, contribuicaoReais: null, vendedor: null, cidade: null, estado: null, dataAprovacao: null },
];

describe("marketingFinanceiroClientes: paridade com calcularNovosDoMesLocal (mesesInatividade=6)", () => {
  const antigo = calcularNovosDoMesLocal(3, 2026, osDoAno, todasComprasValidas, overrideMap);
  const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 6);
  const resumo = agregarMes(3, 2026, classificadas, 51);

  it("osNovos do caminho antigo == novo.qtdOs + reativado.qtdOs do caminho novo", () => {
    expect(antigo.osNovos).toBe(resumo.porCategoria.novo.qtdOs + resumo.porCategoria.reativado.qtdOs);
    expect(antigo.osNovos).toBe(2);
  });

  it("faturamentoNovos do caminho antigo == novo.faturamento + reativado.faturamento", () => {
    expect(antigo.faturamentoNovos).toBe(resumo.porCategoria.novo.faturamento + resumo.porCategoria.reativado.faturamento);
    expect(antigo.faturamentoNovos).toBe(2500);
  });

  it("faturamentoReativados do caminho antigo == reativado.faturamento", () => {
    expect(antigo.faturamentoReativados).toBe(resumo.porCategoria.reativado.faturamento);
    expect(antigo.faturamentoReativados).toBe(1500);
  });

  it("faturamentoNovosPuros do caminho antigo == novo.faturamento", () => {
    expect(antigo.faturamentoNovosPuros).toBe(resumo.porCategoria.novo.faturamento);
    expect(antigo.faturamentoNovosPuros).toBe(1000);
  });

  it("clientesNovosUnicos do caminho antigo == novo.qtdClientesUnicos + reativado.qtdClientesUnicos", () => {
    expect(antigo.clientesNovosUnicos).toBe(resumo.porCategoria.novo.qtdClientesUnicos + resumo.porCategoria.reativado.qtdClientesUnicos);
    expect(antigo.clientesNovosUnicos).toBe(2);
  });

  it("clientesReativados do caminho antigo == reativado.qtdClientesUnicos", () => {
    expect(antigo.clientesReativados).toBe(resumo.porCategoria.reativado.qtdClientesUnicos);
    expect(antigo.clientesReativados).toBe(1);
  });

  it("clientesNovosPuros do caminho antigo == novo.qtdClientesUnicos", () => {
    expect(antigo.clientesNovosPuros).toBe(resumo.porCategoria.novo.qtdClientesUnicos);
    expect(antigo.clientesNovosPuros).toBe(1);
  });

  it("a O.S. cancelada não aparece em nenhuma categoria (excluída por isOsNormalDb nos dois caminhos)", () => {
    const totalOsClassificadas = Object.values(resumo.porCategoria).reduce((s, c) => s + c.qtdOs, 0);
    expect(totalOsClassificadas).toBe(4); // 5 O.S. no fixture, 1 cancelada excluída
  });
});

describe("marketingFinanceiroClientes: 3ª categoria 'recorrenteAtivo' (não existia no caminho antigo)", () => {
  const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 6);
  const resumo = agregarMes(3, 2026, classificadas, 51);

  it("cliente que comprou há menos que o período de inatividade cai em recorrenteAtivo, não em novo/reativado", () => {
    expect(resumo.porCategoria.recorrenteAtivo.qtdOs).toBe(1);
    expect(resumo.porCategoria.recorrenteAtivo.faturamento).toBe(2000);
    expect(resumo.porCategoria.recorrenteAtivo.qtdClientesUnicos).toBe(1);
  });

  it("O.S. sem nome de empresa utilizável cai em naoClassificado, não é descartada silenciosamente", () => {
    expect(resumo.porCategoria.naoClassificado.qtdOs).toBe(1);
    expect(resumo.porCategoria.naoClassificado.faturamento).toBe(300);
  });
});

describe("marketingFinanceiroClientes: mesesInatividade configurável muda a classificação", () => {
  it("com mesesInatividade=2, o cliente 'Recorrente Ativo' (gap=2) passa a reativado", () => {
    const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 2);
    const resumo = agregarMes(3, 2026, classificadas, 51);
    expect(resumo.porCategoria.reativado.qtdOs).toBe(2); // Reativado Ltda + Recorrente Ativo Ltda
    expect(resumo.porCategoria.recorrenteAtivo.qtdOs).toBe(0);
  });
});

describe("marketingFinanceiroClientes: margem real vs. estimada agregada", () => {
  it("categoria 'novo' usa margem real (contribuicaoReais preenchido)", () => {
    const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 6);
    const resumo = agregarMes(3, 2026, classificadas, 51);
    expect(resumo.porCategoria.novo.margem.origem).toBe("real");
    expect(resumo.porCategoria.novo.margem.margemTotal).toBe(500);
  });

  it("categoria 'reativado' cai no fallback percentual (contribuicaoReais ausente)", () => {
    const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 6);
    const resumo = agregarMes(3, 2026, classificadas, 51);
    expect(resumo.porCategoria.reativado.margem.origem).toBe("estimada");
    expect(resumo.porCategoria.reativado.margem.margemTotal).toBe(765); // 1500 * 0.51
  });
});

describe("marketingFinanceiroClientes: conciliação interna (soma das 4 categorias == total de O.S. válidas)", () => {
  it("nunca diverge internamente — é o mesmo dado reparticionado", () => {
    const classificadas = classificarMes(3, 2026, osDoAno, todasComprasValidas, overrideMap, 6);
    const resumo = agregarMes(3, 2026, classificadas, 51);
    const somaCategorias = Object.values(resumo.porCategoria).map(c => c.faturamento);
    const r = conciliar(resumo.faturamentoTotalValido, somaCategorias);
    expect(r.conciliado).toBe(true);
    expect(resumo.faturamentoTotalValido).toBe(4800); // 1000+2000+1500+300, exclui a cancelada (9999)
  });
});

describe("marketingFinanceiroClientes: eventos de reativação vs. clientes únicos reativados no ano", () => {
  it("mesmo cliente reativando 2 meses distintos conta 1 único, 2 eventos", () => {
    const comprasAno: CompraMinima[] = [{ empresa: "reativado ltda", mes: 8, ano: 2025 }];
    const osAno: OsBrutaMarketing[] = [
      { osNumero: "10", empresa: "Reativado Ltda", tipoOs: "Normal", status: "Entregue", mes: 3, ano: 2026, valorOs: "1000", valorTotal: null, contribuicaoReais: null, vendedor: null, cidade: null, estado: null, dataAprovacao: null },
      { osNumero: "11", empresa: "Reativado Ltda", tipoOs: "Normal", status: "Entregue", mes: 9, ano: 2026, valorOs: "1000", valorTotal: null, contribuicaoReais: null, vendedor: null, cidade: null, estado: null, dataAprovacao: null },
    ];
    const overrides = new Map<string, "recorrente" | "novo">();
    const classificadasMar = classificarMes(3, 2026, osAno, comprasAno, overrides, 6);
    // Depois de comprar em março, a "última compra válida" pra setembro passa a ser março —
    // então setembro (gap=6) segue classificado reativado (>= 6), não recorrenteAtivo.
    const comprasAtualizadas: CompraMinima[] = [...comprasAno, { empresa: "reativado ltda", mes: 3, ano: 2026 }];
    const classificadasSet = classificarMes(9, 2026, osAno, comprasAtualizadas, overrides, 6);
    const todas = [...classificadasMar, ...classificadasSet];
    const r = calcularReativacaoAnual(todas);
    expect(r.clientesReativadosUnicosAno).toBe(1);
    expect(r.eventosReativacaoAno).toBe(2);
  });
});
