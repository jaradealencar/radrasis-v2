import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { traduzirPerfilConsumoMubiSys } from "../../shared/perfil-consumo-mubisys";

const html = readFileSync("client/public/cpq-letreiros-express.html", "utf8");
const produtosPage = readFileSync("client/src/pages/comercial/Produtos.tsx", "utf8");
const catalogRoute = readFileSync("server/routes/estudio-catalogo-mubisys.ts", "utf8");
const uploadRoute = readFileSync("server/routes/estudio-mubisys-espelho.ts", "utf8");
const espelho = readFileSync("server/services/mubisysEspelho.ts", "utf8");
const sessionRoute = readFileSync("server/routes/estudio-mubisys-session.ts", "utf8");
const parserBOM = readFileSync("server/services/mubisysBOMAutenticada.ts", "utf8");

describe("equivalência dos perfis de consumo MubiSys", () => {
  it.each([
    ["Área quadrada", "area"],
    ["Área de consumo calculada pelo nesting", "areaTotal"],
    ["Área geral (largura x altura)", "areaGeral"],
    ["Metro linear", "perimExt"],
    ["Perímetro total de corte", "perimTotal"],
    ["Por unidade", "fixo"],
  ])("traduz %s para %s", (perfil, formula) => {
    expect(traduzirPerfilConsumoMubiSys(perfil)).toBe(formula);
  });

  it("recusa perfis sem equivalência em vez de aproximar pelo nome da unidade", () => {
    expect(traduzirPerfilConsumoMubiSys("Percentual sobre o peso")).toBeNull();
  });
});

describe("espelho BOM do MubiSys", () => {
  it("serve catálogo, custos e composições a partir do banco local", () => {
    expect(catalogRoute).toContain("carregarCatalogoEspelhado");
    expect(catalogRoute).toContain("sincronizarCatalogoMubiSys");
    expect(catalogRoute).not.toContain("listarProdutos()");
    expect(catalogRoute).not.toContain("listarMateriasPrimas()");
    expect(espelho).toContain("export async function importarComposicaoArquivo");
    expect(espelho).toContain("Importação cancelada sem gravar alterações");
    expect(espelho).toContain("perfilConsumoMubiSys: linha.perfil");
    expect(espelho).toContain("formulaConsumo: linha.formula");
  });

  it("restringe upload em lote e rejeita arquivo parcialmente inválido", () => {
    expect(uploadRoute).toContain("admin");
    expect(uploadRoute).toContain("master");
    expect(uploadRoute).toContain("gestor");
    expect(uploadRoute).toContain("express.raw");
    expect(espelho).toContain("traduzirPerfilConsumoMubiSys(perfilInformado)");
  });

  it("mantém importação manual e oferece conector opcional com sessão cifrada", () => {
    expect(html).toContain("mubisys/composicoes/template.csv");
    expect(html).toContain("mubisys-importar-arquivo");
    expect(html).toContain("/api/letra-caixa/mubisys/composicoes");
    expect(html).toContain("mubisys/composicoes/sincronizar");
    expect(html).toContain("mubisys/sessao");
    expect(sessionRoute).toContain("aes-256-gcm");
    expect(sessionRoute).toContain("HttpOnly");
    expect(sessionRoute).toContain("ROLES_GESTAO");
    expect(parserBOM).toContain("parsearComposicoesMubiSys");
    expect(produtosPage).toContain("Importar ficha local");
    expect(produtosPage).not.toContain("mubisys/sessao");
    expect(produtosPage).not.toContain('name="senha"');
  });
});
