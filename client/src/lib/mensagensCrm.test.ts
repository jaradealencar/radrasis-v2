import { describe, expect, it } from "vitest";
import { primeiroNome, substituirVariaveis } from "./mensagensCrm";

const vars = { nomeCliente: "Tadeu", produto: "OS #28291", valor: "R$ 6.925,19", vendedor: "Letícia Carozzo" };

describe("substituirVariaveis", () => {
  it("troca o marcador [Nome] do script real do CRM pelo nome", () => {
    const texto = "[Nome], para fecharmos o projeto, o que ainda precisa ser resolvido? Se a compra ficou para depois ou você decidiu não seguir, pode me dizer também.";
    expect(substituirVariaveis(texto, vars)).toBe(
      "Tadeu, para fecharmos o projeto, o que ainda precisa ser resolvido? Se a compra ficou para depois ou você decidiu não seguir, pode me dizer também.");
  });

  it("aceita [nome], [NOME], [Nome do cliente] e [Cliente], em qualquer caixa", () => {
    for (const marcador of ["[nome]", "[NOME]", "[Nome]", "[Nome do cliente]", "[nome_cliente]", "[Cliente]"]) {
      expect(substituirVariaveis(`Oi ${marcador}!`, vars)).toBe("Oi Tadeu!");
    }
  });

  it("continua aceitando o formato com chaves e troca todas as ocorrências", () => {
    expect(substituirVariaveis("{nome_cliente}, sobre {produto} ({valor}) — {vendedor}. Tchau {NOME_CLIENTE}", vars))
      .toBe("Tadeu, sobre OS #28291 (R$ 6.925,19) — Letícia Carozzo. Tchau Tadeu");
  });

  it("aceita [Vendedor], [Vendedora], [Valor] e [Produto]", () => {
    expect(substituirVariaveis("[Vendedora] · [Produto] · [Valor]", vars)).toBe("Letícia Carozzo · OS #28291 · R$ 6.925,19");
    expect(substituirVariaveis("[Vendedor]", vars)).toBe("Letícia Carozzo");
  });

  it("sem valor para o marcador, deixa o texto como está (o vendedor vê e completa)", () => {
    expect(substituirVariaveis("[Nome], oi {valor}", { nomeCliente: "" })).toBe("[Nome], oi {valor}");
  });

  it("não mexe em colchetes que não são marcadores conhecidos", () => {
    expect(substituirVariaveis("[Nome], veja [anexo] e [Opção 1]", vars)).toBe("Tadeu, veja [anexo] e [Opção 1]");
  });

  it("um valor com '$' não é interpretado como padrão de substituição", () => {
    expect(substituirVariaveis("Valor: [Valor]", { valor: "R$ 1.000,00 $& $1" })).toBe("Valor: R$ 1.000,00 $& $1");
  });
});

describe("primeiroNome", () => {
  it("pega só o primeiro nome com a inicial maiúscula", () => {
    expect(primeiroNome("JOSE")).toBe("Jose");
    expect(primeiroNome("Tadeu Mota")).toBe("Tadeu");
    expect(primeiroNome("Jorge / Alexandre")).toBe("Jorge");
    expect(primeiroNome("  edson  ")).toBe("Edson");
    expect(primeiroNome("Maria, financeiro")).toBe("Maria");
  });

  it("vazio quando não há nome", () => {
    expect(primeiroNome("")).toBe("");
    expect(primeiroNome(null)).toBe("");
    expect(primeiroNome(undefined)).toBe("");
    expect(primeiroNome("   ")).toBe("");
  });
});
