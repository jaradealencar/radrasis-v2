import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => null } } }));

const { mapearComposicoes } = await import("../routes/estudio-catalogo-mubisys");

describe("parser da composição interna do MubiSys", () => {
  it("preserva modelo, matéria-prima e consumo recebidos em JSON", () => {
    const resultado = mapearComposicoes({
      dados: [{ modelo_id: 810, materia_prima_id: 1234, quantidade: "1,25", unidade: "kg" }],
    });

    expect(resultado).toEqual({
      reconhecido: true,
      linhas: [{ modeloId: 810, variacaoId: null, materiaPrimaId: 1234, quantidade: 1.25, unidade: "kg" }],
    });
  });

  it("não confunde uma tabela de layout desconhecida com ficha vazia", () => {
    expect(mapearComposicoes("<table><tr><th>Menu</th></tr><tr><td>Produtos</td></tr></table>")).toEqual({
      reconhecido: false,
      linhas: [],
    });
  });

  it("reconhece como vazia somente uma tabela identificável de composição", () => {
    const html = "<table><tr><th>Matéria-prima</th><th>Quantidade</th></tr><tr><td colspan='2'>Nenhum item cadastrado</td></tr></table>";
    expect(mapearComposicoes(html)).toEqual({ reconhecido: true, linhas: [] });
  });
});

describe("cadastro de produto no CPQ", () => {
  const html = readFileSync("client/public/cpq-letreiros-express.html", "utf8");

  it("importa a ficha comum mesmo quando o modelo não possui subvariações", () => {
    expect(html).toContain("function preencherComposicaoMubiSysSeVazia(key)");
    expect(html).toMatch(/Este modelo não tem subvariações ativas\.[\s\S]{0,1200}data-act="admin-kit-importar-mubisys"/);
    expect(html).toMatch(/const compartilhadas=todas\.filter\(item=>!item\.variacaoId&&Number\(item\.modeloId\)===Number\(modelo\.id\)\)/);
  });

  it("preenche e salva automaticamente um cadastro vazio ao abri-lo", () => {
    expect(html).toMatch(/const importacaoAutomatica=preencherComposicaoMubiSysSeVazia\(key\);\s*if\(importacaoAutomatica\?\.status==='importado'\) salvarKit\(importacaoAutomatica\.key\)/);
  });
});
