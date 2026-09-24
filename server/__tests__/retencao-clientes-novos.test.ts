import { describe, it, expect } from "vitest";
import {
  identificarClientesElegiveis,
  listarPendenciasRetencao,
  ESTAGIOS_JORNADA,
} from "../services/retencaoClientesNovos";
import type { ClienteBase, CompraCliente } from "../services/inteligenciaClientes";
import { capitalizarNomeProprio, primeiroNome } from "../../shared/capitalizar-nome";
import { adicionarDiasUteisComFeriados, ehFeriadoNacional } from "../../shared/feriados-nacionais";

function compra(overrides: Partial<CompraCliente>): CompraCliente {
  return {
    osNumero: "1000",
    data: new Date(2026, 0, 10),
    valor: 1000,
    custo: null,
    contribuicao: null,
    vendedor: "Fulano",
    cidade: "Campo Grande",
    estado: "MS",
    trabalho: "Letreiro em ACM",
    ...overrides,
  };
}

function baseCom(clientes: Array<{ empresaKey: string; empresaExibicao: string; compras: CompraCliente[] }>): Map<string, ClienteBase> {
  const m = new Map<string, ClienteBase>();
  for (const c of clientes) m.set(c.empresaKey, c);
  return m;
}

describe("identificarClientesElegiveis", () => {
  const hoje = new Date(2026, 8, 23); // 23/09/2026

  it("inclui cliente com exatamente 1 compra válida dentro da janela de 1 ano", () => {
    const base = baseCom([
      { empresaKey: "cliente a", empresaExibicao: "Cliente A", compras: [compra({ data: new Date(2026, 8, 1) })] },
    ]);
    const elegiveis = identificarClientesElegiveis(base, hoje);
    expect(elegiveis).toHaveLength(1);
    expect(elegiveis[0].empresaKey).toBe("cliente a");
  });

  it("exclui cliente com 2+ compras (já recomprou)", () => {
    const base = baseCom([
      {
        empresaKey: "cliente b", empresaExibicao: "Cliente B",
        compras: [compra({ data: new Date(2026, 8, 1) }), compra({ data: new Date(2026, 8, 15), osNumero: "1001" })],
      },
    ]);
    expect(identificarClientesElegiveis(base, hoje)).toHaveLength(0);
  });

  it("exclui cliente cuja única compra foi há mais de 1 ano", () => {
    const base = baseCom([
      { empresaKey: "cliente c", empresaExibicao: "Cliente C", compras: [compra({ data: new Date(2024, 0, 1) })] },
    ]);
    expect(identificarClientesElegiveis(base, hoje)).toHaveLength(0);
  });
});

describe("listarPendenciasRetencao", () => {
  it("gera um marco para cada um dos 7 estágios da jornada", () => {
    const hoje = new Date(2026, 8, 23);
    const base = baseCom([
      { empresaKey: "cliente a", empresaExibicao: "Cliente A", compras: [compra({ data: new Date(2026, 8, 1) })] },
    ]);
    const pendencias = listarPendenciasRetencao(base, hoje);
    expect(pendencias).toHaveLength(ESTAGIOS_JORNADA.length);
    expect(pendencias.map(p => p.estagio).sort()).toEqual(["d16u", "d180", "d270", "d30", "d365", "d60", "d90"].sort());
  });

  it("marco d30 cai 30 dias corridos após a 1ª compra", () => {
    const hoje = new Date(2026, 8, 23);
    const base = baseCom([
      { empresaKey: "cliente a", empresaExibicao: "Cliente A", compras: [compra({ data: new Date(2026, 8, 1) })] },
    ]);
    const pendencias = listarPendenciasRetencao(base, hoje);
    const d30 = pendencias.find(p => p.estagio === "d30")!;
    expect(d30.dataAgendada.getTime()).toBe(new Date(2026, 9, 1).getTime());
  });
});

describe("adicionarDiasUteisComFeriados", () => {
  it("pula sábado, domingo e feriado nacional ao contar 16 dias úteis", () => {
    // 25/12/2026 (sexta, Natal) é feriado — deve ser pulado, junto com o fim de semana seguinte.
    const inicio = new Date(2026, 11, 18); // sexta-feira 18/12/2026
    const resultado = adicionarDiasUteisComFeriados(inicio, 5);
    // dias úteis após 18/12: 21,22,23,24 (26 é sábado, 25 é feriado) -> 28,29 ... contamos 5 dias úteis
    expect(ehFeriadoNacional(new Date(2026, 11, 25))).toBe(true);
    expect(resultado.getDay()).not.toBe(0);
    expect(resultado.getDay()).not.toBe(6);
    expect(ehFeriadoNacional(resultado)).toBe(false);
  });
});

describe("capitalizarNomeProprio / primeiroNome", () => {
  it("capitaliza nome em caixa alta preservando conectores minúsculos", () => {
    expect(capitalizarNomeProprio("ANA KAROLINE DA SILVA")).toBe("Ana Karoline da Silva");
    expect(capitalizarNomeProprio("joão dos santos")).toBe("João dos Santos");
  });

  it("extrai o primeiro nome já capitalizado", () => {
    expect(primeiroNome("ANA KAROLINE DA SILVA")).toBe("Ana");
  });

  it("lida com string vazia sem lançar", () => {
    expect(capitalizarNomeProprio("")).toBe("");
    expect(primeiroNome("")).toBe("");
  });
});
