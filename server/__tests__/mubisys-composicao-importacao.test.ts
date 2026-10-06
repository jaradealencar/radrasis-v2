import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { traduzirPerfilConsumoMubiSys } from "../../shared/perfil-consumo-mubisys";

vi.mock("../_core/auth", () => ({
  auth: { api: { getSession: async () => null } },
}));

const { mapearComposicoes } =
  await import("../routes/estudio-catalogo-mubisys");

describe("parser da composição interna do MubiSys", () => {
  it("preserva modelo, matéria-prima e consumo recebidos em JSON", () => {
    const resultado = mapearComposicoes({
      dados: [
        {
          modelo_id: 810,
          materia_prima_id: 1234,
          quantidade: "1,25",
          unidade: "kg",
          perfil_consumo: "Quantidade fixa",
        },
      ],
    });

    expect(resultado).toEqual({
      reconhecido: true,
      linhas: [
        {
          modeloId: 810,
          variacaoId: null,
          materiaPrimaId: 1234,
          quantidade: 1.25,
          unidade: "kg",
          perfilConsumo: "Quantidade fixa",
          formulaConsumo: "fixo",
        },
      ],
    });
  });

  it("preserva o perfil aninhado de cada matéria-prima da variação", () => {
    const resultado = mapearComposicoes({
      dados: [
        {
          variacao_id: 3023,
          materia_prima_id: 4321,
          quantidade: 18,
          consumo: { perfil: { nome: "Área líquida da peça" } },
        },
      ],
    });

    expect(resultado.linhas[0]).toMatchObject({
      variacaoId: 3023,
      materiaPrimaId: 4321,
      perfilConsumo: "Área líquida da peça",
      formulaConsumo: "area",
    });
  });

  it("não confunde uma tabela de layout desconhecida com ficha vazia", () => {
    expect(
      mapearComposicoes(
        "<table><tr><th>Menu</th></tr><tr><td>Produtos</td></tr></table>"
      )
    ).toEqual({
      reconhecido: false,
      linhas: [],
    });
  });

  it("reconhece como vazia somente uma tabela identificável de composição", () => {
    const html =
      "<table><tr><th>Matéria-prima</th><th>Quantidade</th></tr><tr><td colspan='2'>Nenhum item cadastrado</td></tr></table>";
    expect(mapearComposicoes(html)).toEqual({ reconhecido: true, linhas: [] });
  });
});

describe("equivalência dos perfis de consumo MubiSys", () => {
  it.each([
    ["Área quadrada", "area"],
    ["Quadrada", "area"],
    ["Área de consumo calculada pelo nesting", "areaTotal"],
    ["Área geral (largura x altura)", "areaGeral"],
    ["Metro linear", "perimExt"],
    ["Linear", "perimExt"],
    ["Perímetro total de corte", "perimTotal"],
    ["Por unidade", "fixo"],
  ])(
    "traduz %s sem depender da unidade da matéria-prima",
    (perfil, esperado) => {
      expect(traduzirPerfilConsumoMubiSys(perfil)).toBe(esperado);
    }
  );

  it("recusa um perfil desconhecido em vez de estimar uma fórmula", () => {
    expect(traduzirPerfilConsumoMubiSys("Percentual sobre o peso")).toBeNull();
  });
});

describe("cadastro de produto no CPQ", () => {
  const html = readFileSync("client/public/cpq-letreiros-express.html", "utf8");

  it("importa a ficha comum mesmo quando o modelo não possui subvariações", () => {
    expect(html).toContain("function preencherComposicaoMubiSysSeVazia(key)");
    expect(html).toMatch(
      /Este modelo não tem subvariações ativas\.[\s\S]{0,1200}data-act="admin-kit-importar-mubisys"/
    );
    expect(html).toMatch(
      /const compartilhadas=todas\.filter\(item=>!item\.variacaoId&&Number\(item\.modeloId\)===Number\(modelo\.id\)\)/
    );
  });

  it("preenche e salva automaticamente um cadastro vazio ao abri-lo", () => {
    expect(html).toMatch(
      /const importacaoAutomatica=preencherComposicaoMubiSysSeVazia\(key\);\s*if\(importacaoAutomatica\?\.status==='importado'\) salvarKit\(importacaoAutomatica\.key\)/
    );
  });

  it("usa o perfil vindo do MubiSys e recusa variações incompletas", () => {
    expect(html).not.toContain("function formulaPorUnidadeModelo(unidade)");
    expect(html).toContain("formulaType:item.formulaConsumo");
    expect(html).toContain("Perfil MubiSys:");
    expect(html).toContain("não devolveu matérias-primas para as variações");
  });

  it("não apresenta cadastro sem insumos como concluído", () => {
    expect(html).toContain("⚠ Incompleto (0 itens — importar ficha)");
    expect(html).toContain("incompleto(s) sem insumos");
  });

  it("refreshes a selected variant after connecting and blocks missing compositions", () => {
    expect(html).toMatch(
      /if\(state\.mode==='real'&&REAL\.produtoId&&REAL\.modeloId\)[\s\S]{0,300}carregarComposicaoModeloReal\(produto,modelo,REAL\.variacaoModeloIds\)/
    );
    expect(html).toMatch(
      /if\(catalog\.mubisysWebConectado&&ids\.size\)[\s\S]{0,300}selecionadas: /
    );
    expect(html).toMatch(/const podeAvancar = [^;]*&& !REAL\.kitWarning &&/);
  });
});
