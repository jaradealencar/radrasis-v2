import { describe, expect, it } from "vitest";
import {
  construirBaseComTelefone, resolverClientesAtivos, resolverInativos, resolverOrcaramNaoCompraram, resolverPrimeiraCompra,
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

  it("orçaram e não compraram: status não-ganho dentro de 90 dias, 1 por empresa, telefone vem do histórico de compras se houver", () => {
    const base = construirBaseComTelefone([os("TESTE Empresa Com Telefone", "01/01/2026", { telefone: "67911112222" })]);
    const orcamentos: HistoricoOrcamento[] = [
      orc("TESTE Em Aberto", "01/09/2026", "em aberto"), // 25 dias atrás, dentro da janela
      orc("TESTE Reprovado", "15/08/2026", "reprovado"), // dentro da janela, status perdido também conta
      orc("TESTE Aprovado", "01/09/2026", "aprovado"), // ganho — não deve entrar
      orc("TESTE Fora Da Janela", "01/01/2026", "em aberto"), // fora dos 90 dias
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
    expect(nomes).not.toContain("TESTE Aprovado");
    expect(nomes).not.toContain("TESTE Fora Da Janela");
    expect(nomes.filter(n => n === "TESTE Duplicado")).toHaveLength(1);
    expect(r.find(c => c.nome === "TESTE Empresa Com Telefone")?.telefone).toBe("67911112222");
    expect(r.find(c => c.nome === "TESTE Em Aberto")?.telefone).toBeNull();
  });

  it("retrabalho/amostra/cortesia/cancelada não contam como compra (mesma regra isOsNormalDb do resto do módulo)", () => {
    const base = construirBaseComTelefone([
      os("TESTE Só Retrabalho", "20/08/2026", { tipoOs: "retrabalho" }),
      os("TESTE Só Cancelada", "20/08/2026", { status: "cancelada" }),
    ]);
    expect(base.size).toBe(0);
  });
});
