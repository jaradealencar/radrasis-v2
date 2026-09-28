import { describe, expect, it } from "vitest";
import {
  construirBaseComTelefone, construirHistoricoComprasPorCliente, construirVolumePorJanela,
  resolverClientesAtivos, resolverCompraramUmaVez, resolverCompraramUmaVezESumiram, resolverInativos,
  resolverNovosDoMes, resolverOrcaramNaoCompraram, resolverPrimeiraCompra, resolverReativadosDoMes,
  resolverReducaoDeVolume,
} from "../services/fontesErpCampanhas";
import type { HistoricoOrcamento, HistoricoOs } from "../../drizzle/schema";

const HOJE = "2026-09-26";

/** Linha mínima de historico_os para os testes — só os campos que os resolvedores/isOsNormalDb usam. */
function os(empresa: string, dataAprovacao: string, extra: Partial<HistoricoOs> = {}): HistoricoOs {
  return {
    id: 0, osNumero: `OS-${empresa}-${dataAprovacao}`, tipoOs: "produto", status: "aprovada", empresa,
    dataAprovacao, dataEntrega: null, dataFaturamento: null, vendedor: "Ana",
    valorTotal: "1000", valorOs: "1000", materiaPrima: null, custoFixo: null, maoDeObra: null,
    tarifasFinanceiras: null, comissoesInternas: null, comissoesExternas: null, terceirizados: null,
    tributos: null, custosTotal: null, resultadoReais: null, resultadoPct: null,
    contribuicaoReais: null, contribuicaoPct: null, cidade: null, estado: "MS", telefone: "67999990000",
    mes: 1, ano: 2026, createdAt: new Date(), ...extra,
  } as HistoricoOs;
}

function orc(empresa: string, dataCadastro: string, status: string, extra: Partial<HistoricoOrcamento> = {}): HistoricoOrcamento {
  return {
    id: 0, orcNumero: `ORC-${empresa}-${dataCadastro}`, empresa, trabalho: null, dataCadastro, validade: null,
    vendedor: "Ana", status, motivoCancelamento: null, total: "500", custosTotal: null, margemLiquida: null,
    mes: 1, ano: 2026, createdAt: new Date(), ...extra,
  } as HistoricoOrcamento;
}

describe("fontes ERP — resolução local (sem chamada à API)", () => {
  it("clientes ativos: última compra dentro de 180 dias; ignora quem passou disso", () => {
    const base = construirBaseComTelefone([
      os("TESTE Ativo Recente", "20/08/2026"), // ~37 dias atrás
      os("TESTE Inativo Antigo", "01/01/2026", { telefone: "67988880000" }), // ~268 dias atrás
    ]);
    const ativos = resolverClientesAtivos(base, HOJE);
    expect(ativos.map(c => c.nome)).toEqual(["TESTE Ativo Recente"]);
    expect(ativos[0].telefone).toBe("67999990000");
  });

  it("primeira compra (onboarding): só 1 compra até agora e recente (60 dias); quem já recomprou não conta", () => {
    const base = construirBaseComTelefone([
      os("TESTE Onboarding", "10/09/2026"), // 1 compra, 16 dias atrás
      os("TESTE Ja Recomprou", "01/01/2026"),
      os("TESTE Ja Recomprou", "10/09/2026"), // 2ª compra — não é mais "primeira compra"
      os("TESTE Primeira Mas Antiga", "01/01/2025"), // só 1 compra, mas há mais de 60 dias
    ]);
    const onboarding = resolverPrimeiraCompra(base, HOJE);
    expect(onboarding.map(c => c.nome)).toEqual(["TESTE Onboarding"]);
  });

  it("inativos: já compraram, última compra há 6+ meses (180 dias)", () => {
    const base = construirBaseComTelefone([
      os("TESTE Inativo", "01/01/2026"),
      os("TESTE Ativo", "20/08/2026"),
    ]);
    const inativos = resolverInativos(base, HOJE);
    expect(inativos.map(c => c.nome)).toEqual(["TESTE Inativo"]);
  });

  it("inativos: maxDias opcional (teto de 24 meses da fonte seedada) exclui quem sumiu há tempo demais", () => {
    const base = construirBaseComTelefone([
      os("TESTE Inativo Dentro Do Teto", "01/01/2026"), // ~268 dias — dentro de [180, 730]
      os("TESTE Inativo Alem Do Teto", "01/01/2022"), // muito antigo — fora do teto de ~24 meses
    ]);
    const r = resolverInativos(base, HOJE, 180, 730);
    expect(r.map(c => c.nome)).toEqual(["TESTE Inativo Dentro Do Teto"]);
    // Sem maxDias (comportamento anterior, ainda disponível): os dois entram.
    expect(resolverInativos(base, HOJE).map(c => c.nome)).toHaveLength(2);
  });

  it("orçaram e não compraram: status não-ganho em TODO o histórico (sem limite de janela por padrão), 1 por empresa, telefone vem do histórico de compras se houver", () => {
    // Decisão do usuário 27/09/2026: cogitou separar por ano do orçamento e descartou — "puxa de todo o
    // histórico que é melhor". Por isso "TESTE Orçamento Antigo" (bem além de qualquer janela usual) entra.
    const base = construirBaseComTelefone([os("TESTE Empresa Com Telefone", "01/01/2026", { telefone: "67911112222" })]);
    const orcamentos: HistoricoOrcamento[] = [
      orc("TESTE Em Aberto", "01/09/2026", "em aberto"), // 25 dias atrás
      orc("TESTE Reprovado", "15/08/2026", "reprovado"), // status perdido também conta
      orc("TESTE Aprovado", "01/09/2026", "aprovado"), // ganho — não deve entrar
      orc("TESTE Orçamento Antigo", "10/03/2024", "em aberto"), // bem antigo — sem limite, deve entrar
      orc("TESTE Empresa Com Telefone", "05/09/2026", "em aberto"), // empresa que já é cliente (tem telefone)
      orc("TESTE Duplicado", "01/09/2026", "em aberto"),
      orc("TESTE Duplicado", "10/09/2026", "reprovado"), // 2º orçamento da mesma empresa — só conta 1x
    ];
    const r = resolverOrcaramNaoCompraram(orcamentos, base, HOJE);
    const nomes = r.map(c => c.nome);
    expect(nomes).toContain("TESTE Em Aberto");
    expect(nomes).toContain("TESTE Reprovado");
    expect(nomes).toContain("TESTE Empresa Com Telefone");
    expect(nomes).toContain("TESTE Duplicado");
    expect(nomes).toContain("TESTE Orçamento Antigo");
    expect(nomes).not.toContain("TESTE Aprovado");
    expect(nomes.filter(n => n === "TESTE Duplicado")).toHaveLength(1);
    expect(r.find(c => c.nome === "TESTE Empresa Com Telefone")?.telefone).toBe("67911112222");
    expect(r.find(c => c.nome === "TESTE Em Aberto")?.telefone).toBeNull();
  });

  it("orçaram e não compraram: janelaDias explícito continua disponível para quem quiser restringir", () => {
    const base = construirBaseComTelefone([]);
    const orcamentos: HistoricoOrcamento[] = [
      orc("TESTE Recente", "01/09/2026", "em aberto"), // ~25 dias
      orc("TESTE Antigo", "10/03/2024", "em aberto"), // bem fora de 90 dias
    ];
    const r = resolverOrcaramNaoCompraram(orcamentos, base, HOJE, 90);
    expect(r.map(c => c.nome)).toEqual(["TESTE Recente"]);
  });

  it("compraram 1 vez e sumiram: só 1 compra na vida E ela já esfriou (180+ dias) — diferente de 'inativos', que aceita quem já comprou várias vezes", () => {
    const base = construirBaseComTelefone([
      os("TESTE Comprou 1x Sumiu", "01/01/2026"), // única compra, ~268 dias atrás
      os("TESTE Comprou 1x Recente", "10/09/2026"), // única compra, mas recente (é 'primeira compra', não este)
      os("TESTE Recomprou Depois De Sumir", "01/01/2025"),
      os("TESTE Recomprou Depois De Sumir", "20/08/2026"), // 2ª compra — não conta mais como "1 vez"
    ]);
    const r = resolverCompraramUmaVezESumiram(base, HOJE);
    expect(r.map(c => c.nome)).toEqual(["TESTE Comprou 1x Sumiu"]);
  });

  it("retrabalho/amostra/cortesia/cancelada não contam como compra (mesma regra isOsNormalDb do resto do módulo)", () => {
    const base = construirBaseComTelefone([
      os("TESTE Só Retrabalho", "20/08/2026", { tipoOs: "retrabalho" }),
      os("TESTE Só Cancelada", "20/08/2026", { status: "cancelada" }),
    ]);
    expect(base.size).toBe(0);
  });

  it("compraram apenas 1 vez: sem filtro de tempo, diferente de 'compraram 1x e sumiram'", () => {
    const base = construirBaseComTelefone([
      os("TESTE 1x Antiga", "01/01/2022"),
      os("TESTE 1x Recente", "20/09/2026"),
      os("TESTE Recomprou", "01/01/2026"),
      os("TESTE Recomprou", "20/08/2026"),
    ]);
    const r = resolverCompraramUmaVez(base);
    expect(r.map(c => c.nome).sort()).toEqual(["TESTE 1x Antiga", "TESTE 1x Recente"]);
  });

  it("novos clientes do mês: primeira compra da vida caiu no mês corrente; quem já comprou antes não conta mesmo comprando de novo agora", () => {
    const comprasPorCliente = construirHistoricoComprasPorCliente([
      os("TESTE Novo De Setembro", "10/09/2026", { mes: 9, ano: 2026 }), // única compra, dentro do mês corrente
      os("TESTE Novo Mas Mes Errado", "10/08/2026", { mes: 8, ano: 2026 }), // única compra, mas mês passado — não conta agora
      os("TESTE Ja Cliente Comprou De Novo", "05/01/2026", { mes: 1, ano: 2026 }),
      os("TESTE Ja Cliente Comprou De Novo", "15/09/2026", { mes: 9, ano: 2026 }), // comprou de novo este mês, mas já era cliente
    ]);
    const r = resolverNovosDoMes(comprasPorCliente, HOJE);
    expect(r.map(c => c.nome)).toEqual(["TESTE Novo De Setembro"]);
  });

  it("reativados do mês: compra deste mês veio depois de 6+ meses parados; quem comprou recentemente antes não conta", () => {
    const comprasPorCliente = construirHistoricoComprasPorCliente([
      os("TESTE Reativado Setembro", "05/01/2026", { mes: 1, ano: 2026 }),
      os("TESTE Reativado Setembro", "15/09/2026", { mes: 9, ano: 2026 }), // gap de 8 meses (jan->set) — reativado
      os("TESTE Recorrente Comum", "10/08/2026", { mes: 8, ano: 2026 }),
      os("TESTE Recorrente Comum", "15/09/2026", { mes: 9, ano: 2026 }), // gap de 1 mês — não é reativado, é recorrente normal
      os("TESTE So Comprou Este Mes", "15/09/2026", { mes: 9, ano: 2026 }), // sem compra antes — é "novo", não "reativado"
    ]);
    const r = resolverReativadosDoMes(comprasPorCliente, HOJE);
    expect(r.map(c => c.nome)).toEqual(["TESTE Reativado Setembro"]);
  });

  it("redução de volume: caiu 30%+ nos últimos 90 dias vs. os 90 dias anteriores; sem base de comparação não conta", () => {
    const mapa = construirVolumePorJanela([
      os("TESTE Queda Grande", "15/05/2026", { valorOs: "1000" }), // janela anterior (~90-180 dias atrás)
      os("TESTE Queda Grande", "15/08/2026", { valorOs: "200" }), // janela recente (~últimos 90 dias) — queda de 80%
      os("TESTE Sem Queda", "15/05/2026", { valorOs: "500" }),
      os("TESTE Sem Queda", "15/08/2026", { valorOs: "600" }), // aumentou — não conta
      os("TESTE Sem Base De Comparacao", "15/08/2026", { valorOs: "300" }), // só tem compra recente
    ], HOJE);
    const r = resolverReducaoDeVolume(mapa);
    expect(r.map(c => c.nome)).toEqual(["TESTE Queda Grande"]);
  });
});
