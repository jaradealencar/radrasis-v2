import { describe, expect, it } from "vitest";
import {
  alternarTipoSolda,
  ehMateriaProdutividade,
  erroTiposSolda,
  MAX_TIPOS_SOLDA,
  normalizarTiposSolda,
  TIPOS_SOLDA,
  type TipoSolda,
} from "../../shared/produtividade-solda";

describe("ehMateriaProdutividade", () => {
  it("pega as linhas de produtividade do MubiSys, com ou sem solda no nome", () => {
    expect(ehMateriaProdutividade("Produtividade Solda 1º [R$7,50] [Galvanizado Padrão]")).toBe(true);
    expect(ehMateriaProdutividade("Produtividade Solda")).toBe(true);
    expect(ehMateriaProdutividade("Produtividade 48º - [R$49,00] [100% Acrílico] [Menor que 15cm]")).toBe(true);
  });

  it("ignora maiúsculas, acentos e posição da palavra", () => {
    expect(ehMateriaProdutividade("PRODUTIVIDADE SOLDA 2º")).toBe(true);
    expect(ehMateriaProdutividade("Mão de obra - Produtividade Solda")).toBe(true);
  });

  it("'Produtividade Geral - Hora' (e as outras 'Geral') ficam de fora", () => {
    expect(ehMateriaProdutividade("Produtividade Geral - Hora")).toBe(false);
    expect(ehMateriaProdutividade("  PRODUTIVIDADE GERAL - Hora")).toBe(false);
    expect(ehMateriaProdutividade("Produtividade Geral - Dia")).toBe(false);
  });

  it("matérias-primas comuns e valores vazios não são produtividade", () => {
    expect(ehMateriaProdutividade("Chapa Galvanizada 0,5 mm")).toBe(false);
    expect(ehMateriaProdutividade("")).toBe(false);
    expect(ehMateriaProdutividade(null)).toBe(false);
    expect(ehMateriaProdutividade(undefined)).toBe(false);
  });
});

describe("normalizarTiposSolda (leitura do banco)", () => {
  it("descarta desconhecidos e repetidos e usa a ordem fixa", () => {
    expect(normalizarTiposSolda(["orelhinha", "barra_roscada", "xpto", "orelhinha"])).toEqual(["barra_roscada", "orelhinha"]);
  });

  it("valor que não é lista vira vazio", () => {
    expect(normalizarTiposSolda(null)).toEqual([]);
    expect(normalizarTiposSolda(undefined)).toEqual([]);
    expect(normalizarTiposSolda("barra_roscada")).toEqual([]);
  });
});

describe("erroTiposSolda", () => {
  it("aceita de nenhum até 3 tipos", () => {
    expect(erroTiposSolda([])).toBeNull();
    expect(erroTiposSolda(["barra_roscada"])).toBeNull();
    expect(erroTiposSolda(["barra_roscada", "patinha_led", "orelhinha"])).toBeNull();
    expect(erroTiposSolda(["sem_fixacao"])).toBeNull();
  });

  it("recusa mais de 3, repetidos e 'sem fixação' junto de outra fixação", () => {
    expect(erroTiposSolda(["barra_roscada", "patinha_led", "chapinha_dupla_face", "orelhinha"])).toMatch(/no máximo 3/);
    expect(erroTiposSolda(["orelhinha", "orelhinha"])).toMatch(/repetidos/);
    expect(erroTiposSolda(["sem_fixacao", "orelhinha"])).toMatch(/Sem fixação/);
  });
});

describe("alternarTipoSolda (marcação na tela)", () => {
  it("marca e desmarca, sempre na ordem fixa", () => {
    let sel: TipoSolda[] = [];
    sel = alternarTipoSolda(sel, "orelhinha");
    sel = alternarTipoSolda(sel, "barra_roscada");
    expect(sel).toEqual(["barra_roscada", "orelhinha"]);
    expect(alternarTipoSolda(sel, "orelhinha")).toEqual(["barra_roscada"]);
  });

  it(`não deixa passar de ${MAX_TIPOS_SOLDA} tipos`, () => {
    const tres: TipoSolda[] = ["barra_roscada", "patinha_led", "chapinha_dupla_face"];
    expect(alternarTipoSolda(tres, "orelhinha")).toEqual(tres);
    // mas ainda dá para desmarcar e trocar
    expect(alternarTipoSolda(alternarTipoSolda(tres, "patinha_led"), "orelhinha")).toEqual(["barra_roscada", "chapinha_dupla_face", "orelhinha"]);
  });

  it("'sem fixação' desmarca as demais e é desmarcado por qualquer outra", () => {
    expect(alternarTipoSolda(["barra_roscada", "orelhinha"], "sem_fixacao")).toEqual(["sem_fixacao"]);
    expect(alternarTipoSolda(["sem_fixacao"], "patinha_led")).toEqual(["patinha_led"]);
  });

  it("qualquer seleção obtida pela tela passa na validação do servidor", () => {
    const sequencia: TipoSolda[] = [...TIPOS_SOLDA, ...TIPOS_SOLDA].reverse();
    let sel: TipoSolda[] = [];
    for (const tipo of sequencia) {
      sel = alternarTipoSolda(sel, tipo);
      expect(erroTiposSolda(sel)).toBeNull();
    }
  });
});
