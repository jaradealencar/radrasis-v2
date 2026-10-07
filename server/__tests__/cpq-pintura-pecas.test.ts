import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { erroPinturaPecas, MAX_NOME_TINTA, type ResumoPinturaPecas } from "../../shared/pintura-pecas";

/**
 * Pintura só em parte do letreiro (pedido de 06/10/2026): as peças marcadas na Ficha técnica definem a área cobrada nas linhas de
 * pintura, que vão ao snapshot como quantidade fixa junto de um resumo. O servidor confere se o resumo fecha com as medidas.
 */
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => null } } }));
const { pinturaPecasSchema } = await import("../routes/estudio-cotacoes");

const resumo = (sobrescritas: Partial<ResumoPinturaPecas> = {}): ResumoPinturaPecas => ({
  areaPintadaM2: 0.6,
  areaLiquidaTotalM2: 1,
  pecasPintadas: 3,
  pecasTotal: 5,
  cores: [
    { corHex: "#1d4ed8", pecas: 2, areaM2: 0.4 },
    { corHex: "#ffffff", pecas: 1, areaM2: 0.2 },
  ],
  ...sobrescritas,
});

describe("erroPinturaPecas (coerência do resumo com as medidas)", () => {
  it("aceita um resumo que fecha com a área líquida do letreiro", () => {
    expect(erroPinturaPecas(resumo(), 1)).toBeNull();
    expect(erroPinturaPecas(resumo(), 1.004)).toBeNull(); // arredondamento da medida
  });

  it("aceita pintar o letreiro inteiro (todas as peças)", () => {
    expect(erroPinturaPecas(resumo({ areaPintadaM2: 1, pecasPintadas: 5, cores: [{ corHex: "#000000", pecas: 5, areaM2: 1 }] }), 1)).toBeNull();
  });

  it("recusa pintar mais área ou mais peças do que o letreiro tem", () => {
    expect(erroPinturaPecas(resumo({ areaPintadaM2: 1.2, cores: [{ corHex: "#000000", pecas: 3, areaM2: 1.2 }] }), 1)).toMatch(/maior que a área líquida/);
    expect(erroPinturaPecas(resumo({ pecasPintadas: 6, cores: [{ corHex: "#000000", pecas: 6, areaM2: 0.6 }] }), 1)).toMatch(/mais peças/);
  });

  it("recusa área líquida total diferente da medida atual do letreiro (resumo velho ou adulterado)", () => {
    expect(erroPinturaPecas(resumo(), 2)).toMatch(/não corresponde à medida/);
    expect(erroPinturaPecas(resumo(), null)).toMatch(/não corresponde à medida/);
  });

  it("recusa somas por cor que não fecham com a área e as peças pintadas", () => {
    expect(erroPinturaPecas(resumo({ cores: [{ corHex: "#1d4ed8", pecas: 3, areaM2: 0.1 }] }), 1)).toMatch(/áreas por cor/);
    expect(erroPinturaPecas(resumo({ cores: [{ corHex: "#1d4ed8", pecas: 2, areaM2: 0.4 }, { corHex: "#ffffff", pecas: 2, areaM2: 0.2 }] }), 1)).toMatch(/peças por cor/);
  });
});

describe("pinturaPecasSchema (snapshot da cotação)", () => {
  it("aceita o resumo montado pelo CPQ", () => {
    expect(pinturaPecasSchema.safeParse(resumo()).success).toBe(true);
  });

  it("recusa campo extra, cor inválida, lista de cores vazia e área negativa", () => {
    expect(pinturaPecasSchema.safeParse({ ...resumo(), extra: 1 }).success).toBe(false);
    expect(pinturaPecasSchema.safeParse(resumo({ cores: [{ corHex: "azul", pecas: 3, areaM2: 0.6 }] })).success).toBe(false);
    expect(pinturaPecasSchema.safeParse(resumo({ cores: [] })).success).toBe(false);
    expect(pinturaPecasSchema.safeParse(resumo({ areaPintadaM2: -1 })).success).toBe(false);
    expect(pinturaPecasSchema.safeParse(resumo({ pecasPintadas: 0 })).success).toBe(false);
  });

  it("aceita o nome/código da tinta por cor (opcional) e recusa nome vazio ou longo demais", () => {
    const comNome = (nome: string) => resumo({ cores: [{ corHex: "#1d4ed8", pecas: 2, areaM2: 0.4, nome }, { corHex: "#ffffff", pecas: 1, areaM2: 0.2 }] });
    expect(pinturaPecasSchema.safeParse(comNome("RAL 9010")).success).toBe(true);
    expect(pinturaPecasSchema.safeParse(comNome("Azul Bic")).success).toBe(true);
    expect(pinturaPecasSchema.safeParse(comNome("   ")).success).toBe(false);
    expect(pinturaPecasSchema.safeParse(comNome("x".repeat(MAX_NOME_TINTA + 1))).success).toBe(false);
  });
});

describe("HTML do CPQ: linhas de pintura por área das peças marcadas", () => {
  const html = readFileSync("client/public/cpq-letreiros-express.html", "utf8");

  it("a fórmula areaPintada existe e as linhas de pintura do assistente a usam (menos o adicional de PVC, que é fixo)", () => {
    expect(html).toMatch(/\n  areaPintada: \{label:/);
    const assistente = /function resolverItensPintura\(p\)\{([\s\S]*?)\n\}/.exec(html)?.[1] ?? "";
    expect(assistente).toContain("formulaType:'areaPintada'");
    expect(assistente).not.toContain("formulaType:'area'");
    expect(assistente).toMatch(/adicional pvc[^\n]*formulaType:'fixo'/);
  });

  it("no snapshot a fórmula nova nunca vai como areaPintada: vira fixo (com peças marcadas) ou area (sem marcação)", () => {
    const funcao = /function formulaParaServidor\(linha, quantidade\)\{([\s\S]*?)\n\}/.exec(html)?.[1] ?? "";
    expect(funcao).toContain("linha.formulaType==='areaPintada'");
    expect(funcao).toMatch(/return \{formulaType:'fixo'/);
    expect(funcao).toMatch(/return \{formulaType:'area'/);
    expect(html).toContain("pinturaPecas:pinturaPecasSnapshot()");
    // linha de uma tinta específica (cada metal) nunca vale o letreiro inteiro, nem sem medida
    expect(funcao).toContain("Array.isArray(linha.coresPintura)");
  });

  it("os metais da cor da tinta são os do assistente (menos 'outro'), com hex válidos e diferentes, e itens do catálogo existentes", () => {
    const metais = /const PINTURAS_METALICAS = \{([\s\S]*?)\n\};/.exec(html)?.[1] ?? "";
    const chaves = [...metais.matchAll(/(\w+):\{nome:/g)].map(item => item[1]);
    const hexes = [...metais.matchAll(/hex:'(#[0-9a-f]{6})'/g)].map(item => item[1]);
    const doAssistente = [...html.matchAll(/data-act="pintura-cormetal" data-val="(\w+)"/g)].map(item => item[1]).filter(chave => chave !== "outro");
    expect(chaves.sort()).toEqual(doAssistente.sort());
    expect(hexes).toHaveLength(chaves.length);
    expect(new Set(hexes).size).toBe(hexes.length);
    const termos = /const TERMO_TINTA_METALICA = \{([^}]*)\}/.exec(html)?.[1] ?? "";
    for (const chave of [...termos.matchAll(/(\w+):'/g)].map(item => item[1])) expect(chaves, chave).toContain(chave);
  });

  it("o teto de cores da tinta PU do assistente (4) é o mesmo nos dois caminhos: sem marcação e com peças marcadas", () => {
    expect(html).toContain("const MAX_CORES_TINTA_PU = 4;");
    expect(html).toMatch(/function totalCoresPintura\(p\)\{\s*return Math\.min\(4,/);
    expect(html).toContain("Math.min(MAX_CORES_TINTA_PU, marcadas.length)");
  });

  it("com peças marcadas o assistente não pergunta nº de cores nem cor do metal", () => {
    const pode = /function podeConfirmarPintura\(p\)\{([\s\S]*?)\n\}/.exec(html)?.[1] ?? "";
    expect(pode).toContain("coresMarcadasPintura().length>0");
    expect(pode).toMatch(/if\(!porPecas\)\{[\s\S]*?p\.cores/);
    expect(pode).toMatch(/p\.tipo==='metalizada' && !porPecas && !p\.corMetal/);
  });
});
