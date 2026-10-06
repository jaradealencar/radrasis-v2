import { describe, expect, it } from "vitest";
import {
  alternarAroFrontlight,
  alternarCategoriaProdutividade,
  alternarFormatoProdutividade,
  alternarFundoProdutividade,
  alternarMaterialSolda,
  alternarTamanhoProdutividade,
  alternarTipoSolda,
  ehMateriaProdutividade,
  erroEstiloProdutividade,
  erroMateriaisSolda,
  erroTamanhosProdutividade,
  erroTiposSolda,
  MATERIAIS_SOLDA,
  MAX_TIPOS_SOLDA,
  normalizarEstiloProdutividade,
  normalizarMateriaisSolda,
  normalizarTamanhosProdutividade,
  normalizarTiposSolda,
  rotulosEstiloProdutividade,
  TAMANHOS_PRODUTIVIDADE,
  TIPOS_SOLDA,
  type MaterialSolda,
  type TamanhoProdutividade,
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

describe("materiais em que a solda se aplica", () => {
  it("são cinco, na ordem fixa", () => {
    expect([...MATERIAIS_SOLDA]).toEqual(["inox", "galvanizado", "latao", "acrilico", "aluminio"]);
  });

  it("leitura do banco: descarta desconhecidos e repetidos e usa a ordem fixa", () => {
    expect(normalizarMateriaisSolda(["aluminio", "inox", "cobre", "inox"])).toEqual(["inox", "aluminio"]);
    expect(normalizarMateriaisSolda(null)).toEqual([]);
    expect(normalizarMateriaisSolda("inox")).toEqual([]);
  });

  it("só recusa materiais repetidos (não há limite de quantidade)", () => {
    expect(erroMateriaisSolda([])).toBeNull();
    expect(erroMateriaisSolda([...MATERIAIS_SOLDA])).toBeNull();
    expect(erroMateriaisSolda(["inox", "inox"])).toMatch(/materiais repetidos/);
  });

  it("marca e desmarca na ordem fixa e deixa marcar todos", () => {
    let sel: MaterialSolda[] = [];
    sel = alternarMaterialSolda(sel, "aluminio");
    sel = alternarMaterialSolda(sel, "inox");
    expect(sel).toEqual(["inox", "aluminio"]);
    expect(alternarMaterialSolda(sel, "inox")).toEqual(["aluminio"]);
    for (const material of MATERIAIS_SOLDA) sel = sel.includes(material) ? sel : alternarMaterialSolda(sel, material);
    expect(sel).toEqual([...MATERIAIS_SOLDA]);
  });
});

describe("tamanhos: mais de um por produtividade", () => {
  it("são dois, na ordem fixa", () => {
    expect([...TAMANHOS_PRODUTIVIDADE]).toEqual(["ate_11cm", "acima_11cm"]);
  });

  it("leitura do banco: descarta desconhecidos e repetidos e usa a ordem fixa", () => {
    expect(normalizarTamanhosProdutividade(["acima_11cm", "ate_11cm", "12cm", "ate_11cm"])).toEqual(["ate_11cm", "acima_11cm"]);
    expect(normalizarTamanhosProdutividade(null)).toEqual([]);
    expect(normalizarTamanhosProdutividade("ate_11cm")).toEqual([]);
  });

  it("aceita os dois juntos e só recusa repetidos", () => {
    expect(erroTamanhosProdutividade([])).toBeNull();
    expect(erroTamanhosProdutividade(["ate_11cm", "acima_11cm"])).toBeNull();
    expect(erroTamanhosProdutividade(["ate_11cm", "ate_11cm"])).toMatch(/tamanhos repetidos/);
  });

  it("marca e desmarca na ordem fixa e deixa marcar os dois", () => {
    let sel: TamanhoProdutividade[] = [];
    sel = alternarTamanhoProdutividade(sel, "acima_11cm");
    sel = alternarTamanhoProdutividade(sel, "ate_11cm");
    expect(sel).toEqual(["ate_11cm", "acima_11cm"]);
    expect(alternarTamanhoProdutividade(sel, "ate_11cm")).toEqual(["acima_11cm"]);
  });
});

describe("estilo do letreiro: categoria (+ aro do Frontlight), formato e fundo", () => {
  it("lê do banco descartando desconhecidos e repetidos, na ordem fixa", () => {
    expect(normalizarEstiloProdutividade({ categorias: ["tradicional", "frontlight", "xpto", "frontlight"], aros: ["recuado", "normal"], formatos: ["tradicional", "cursiva"], fundos: ["sem_fundo", "com_fundo"] })).toEqual({
      categorias: ["frontlight", "tradicional"],
      aros: ["normal", "recuado"],
      formatos: ["cursiva", "tradicional"],
      fundos: ["com_fundo", "sem_fundo"],
    });
    expect(normalizarEstiloProdutividade({})).toEqual({ categorias: [], aros: [], formatos: [], fundos: [] });
    expect(normalizarEstiloProdutividade({ categorias: "frontlight", aros: null, formatos: undefined, fundos: 3 })).toEqual({ categorias: [], aros: [], formatos: [], fundos: [] });
  });

  it("o aro só existe dentro do Frontlight: sem ele a leitura devolve aros vazios", () => {
    expect(normalizarEstiloProdutividade({ categorias: ["tradicional"], aros: ["recuado"] }).aros).toEqual([]);
    expect(normalizarEstiloProdutividade({ categorias: [], aros: ["normal"] }).aros).toEqual([]);
    expect(normalizarEstiloProdutividade({ categorias: ["frontlight"], aros: ["recuado"] }).aros).toEqual(["recuado"]);
  });

  it("desmarcar Frontlight leva os aros junto; marcar Tradicionais e Frontlight juntos é permitido", () => {
    let estado = alternarCategoriaProdutividade({ categorias: [], aros: [] }, "frontlight");
    expect(estado).toEqual({ categorias: ["frontlight"], aros: [] });
    estado = { ...estado, aros: alternarAroFrontlight(estado.aros, "recuado") };
    expect(estado.aros).toEqual(["recuado"]);
    estado = { ...estado, ...alternarCategoriaProdutividade(estado, "tradicional") };
    expect(estado).toEqual({ categorias: ["frontlight", "tradicional"], aros: ["recuado"] });
    estado = alternarCategoriaProdutividade(estado, "frontlight");
    expect(estado).toEqual({ categorias: ["tradicional"], aros: [] });
  });

  it("formato e fundo aceitam os dois valores juntos e mantêm a ordem", () => {
    expect(alternarFormatoProdutividade(["tradicional"], "cursiva")).toEqual(["cursiva", "tradicional"]);
    expect(alternarFormatoProdutividade(["cursiva", "tradicional"], "cursiva")).toEqual(["tradicional"]);
    expect(alternarFundoProdutividade([], "sem_fundo")).toEqual(["sem_fundo"]);
    expect(alternarFundoProdutividade(["sem_fundo"], "com_fundo")).toEqual(["com_fundo", "sem_fundo"]);
  });

  it("recusa repetidos e aro sem Frontlight", () => {
    const vazio = { categorias: [], aros: [], formatos: [], fundos: [] };
    expect(erroEstiloProdutividade(vazio)).toBeNull();
    expect(erroEstiloProdutividade({ ...vazio, categorias: ["frontlight"], aros: ["normal", "recuado"] })).toBeNull();
    expect(erroEstiloProdutividade({ ...vazio, categorias: ["frontlight", "frontlight"] })).toMatch(/categorias repetidas/);
    expect(erroEstiloProdutividade({ ...vazio, formatos: ["cursiva", "cursiva"] })).toMatch(/formatos repetidos/);
    expect(erroEstiloProdutividade({ ...vazio, fundos: ["com_fundo", "com_fundo"] })).toMatch(/fundos repetidos/);
    expect(erroEstiloProdutividade({ ...vazio, categorias: ["tradicional"], aros: ["normal"] })).toMatch(/só vale para Frontlight/);
    expect(erroEstiloProdutividade({ ...vazio, aros: ["recuado"] })).toMatch(/só vale para Frontlight/);
  });

  it("rotula o estilo para exibição: um rótulo por aro do Frontlight", () => {
    expect(rotulosEstiloProdutividade({ categorias: [], aros: [], formatos: [], fundos: [] })).toEqual([]);
    expect(rotulosEstiloProdutividade({ categorias: ["frontlight", "tradicional"], aros: ["normal", "recuado"], formatos: ["cursiva"], fundos: ["sem_fundo"] })).toEqual([
      "Frontlight · Aro normal",
      "Frontlight · Aro recuado",
      "Tradicionais",
      "Cursiva",
      "Sem fundo",
    ]);
    expect(rotulosEstiloProdutividade({ categorias: ["frontlight"], aros: [], formatos: ["cursiva", "tradicional"], fundos: ["com_fundo"] })).toEqual(["Frontlight", "Cursiva", "Tradicional", "Com fundo"]);
  });
});
