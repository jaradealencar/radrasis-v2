import { describe, expect, it } from "vitest";
import {
  detectarMaterialLetreiro,
  normalizarTexto,
  sugerirProdutividades,
  type CandidataSolda,
  type ContextoSolda,
  type RegraSolda,
} from "../services/cpqSoldaProdutividade";

const candidata = (parcial: Partial<CandidataSolda> & Pick<CandidataSolda, "id" | "nome">): CandidataSolda => ({
  tiposSolda: [],
  tamanhos: [],
  materiais: [],
  ...parcial,
});

const contexto = (parcial: Partial<ContextoSolda> = {}): ContextoSolda => ({
  tiposFixacao: ["barra_roscada"],
  titulo: "Letreiro Letra Caixa Galvanizado",
  tipoProduto: null,
  material: "galvanizado",
  ...parcial,
});

const regra = (parcial: Partial<RegraSolda> & Pick<RegraSolda, "id" | "materiaPrimaId">): RegraSolda => ({
  nome: "Regra de teste",
  ativa: true,
  prioridade: 0,
  material: null,
  tipoProduto: null,
  fixacaoTipos: null,
  palavrasTitulo: [],
  faixa: null,
  ...parcial,
});

const faixaAcima = [{ faixa: "acima_11cm" as const, perimetroM: 12.5, elementos: 8 }];
const faixaAte = [{ faixa: "ate_11cm" as const, perimetroM: 3.2, elementos: 6 }];

// Nomes reais do cadastro (docs/base-conheciento-agente-orçamento/tabela-precos-conteudo.md), com marcações de cadastro.
const GAL_PADRAO = candidata({ id: 1, nome: "Produtividade Solda 1º [R$7,50] [Galvanizado Padrão]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] });
const GAL_CURSIVO = candidata({ id: 2, nome: "Produtividade Solda 2º [R$9,37] [Galvanizado Cursivo]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] });
const GAL_PEQUENA = candidata({ id: 33, nome: "Produtividade Solda 33º [R$18,50] [Menor ou igual a 11cm] [Gal] (Pode ser usado no frontlight)", tiposSolda: ["barra_roscada"], tamanhos: ["ate_11cm"], materiais: ["galvanizado"] });
const GAL_CHAPINHA = candidata({ id: 20, nome: "Produtividade Solda 20º C [R$9,75] [Galvanizado Padrão Chapinha]", tiposSolda: ["chapinha_dupla_face"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] });
const INOX_PADRAO = candidata({ id: 3, nome: "Produtividade Solda 3º [R$11,25] [Inox Padrão]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["inox"] });
const FRONT_FF = candidata({ id: 5, nome: "Produtividade Solda 5º - [R$15,00] Frontlight [Galvanizado] [F/F]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] });
const CATALOGO = [GAL_PADRAO, GAL_CURSIVO, GAL_PEQUENA, GAL_CHAPINHA, INOX_PADRAO, FRONT_FF];

describe("normalizarTexto", () => {
  it("tira acento, pontuação e trata F/F como um termo só", () => {
    expect(normalizarTexto("Latão [F/F] — Polimento")).toBe(" latao f_f polimento ");
    expect(normalizarTexto("Galvanizado/Inox")).toBe(" galvanizado inox ");
    expect(normalizarTexto(null)).toBe("  ");
  });
});

describe("detectarMaterialLetreiro", () => {
  it("a subcategoria do kit manda e divergências só são informadas", () => {
    const r = detectarMaterialLetreiro({ subcategoria: "Inox", titulo: "Letreiro em Latão", nomesComposicao: ["Chapa Galvanizada 0,5"] });
    expect(r.material).toBe("inox");
    expect(r.origem).toBe("subcategoria");
    expect(r.divergencias).toHaveLength(2);
  });

  it("subcategoria 'Outros' cai para o tipo do produto", () => {
    const r = detectarMaterialLetreiro({ subcategoria: "Outros", tipoProduto: "Acrílico montado" });
    expect(r).toMatchObject({ material: "acrilico", origem: "tipo" });
  });

  it("sem subcategoria usa o título e depois a composição mais citada", () => {
    expect(detectarMaterialLetreiro({ titulo: "Letreiro Alumínio Backlight" })).toMatchObject({ material: "aluminio", origem: "titulo" });
    const composicao = detectarMaterialLetreiro({ nomesComposicao: ["Chapa Galvanizada", "Aro Galvanizado", "Fundo em Inox"] });
    expect(composicao).toMatchObject({ material: "galvanizado", origem: "composicao" });
  });

  it("empate na composição ou nada citado deixa o material em aberto", () => {
    expect(detectarMaterialLetreiro({ nomesComposicao: ["Chapa Inox", "Aro Galvanizado"] }).material).toBeNull();
    expect(detectarMaterialLetreiro({ titulo: "Letreiro", nomesComposicao: ["LED"] })).toMatchObject({ material: null, origem: null });
  });
});

describe("sugerirProdutividades — heurística", () => {
  it("galvanizado, barra roscada e letras grandes escolhem a padrão com confiança alta", () => {
    const [r] = sugerirProdutividades(contexto(), faixaAcima, CATALOGO);
    expect(r.origem).toBe("heuristica");
    expect(r.escolhida?.id).toBe(1);
    expect(r.confianca).toBe("alta");
    expect(r.escolhida?.motivos.map(m => m.texto).join(" ")).toContain("Tipo de fixação igual ao escolhido");
    // A produtividade de letras pequenas não é alternativa de uma faixa de letras grandes.
    expect(r.alternativas.map(a => a.id)).not.toContain(33);
  });

  it("a faixa de letras pequenas escolhe a produtividade de até 11 cm", () => {
    const [r] = sugerirProdutividades(contexto(), faixaAte, CATALOGO);
    expect(r.escolhida?.id).toBe(33);
    expect(r.alternativas.map(a => a.id)).not.toContain(1);
  });

  it("a fixação por chapinha escolhe a produtividade de chapinha", () => {
    const [r] = sugerirProdutividades(contexto({ tiposFixacao: ["chapinha_dupla_face"] }), faixaAcima, CATALOGO);
    expect(r.escolhida?.id).toBe(20);
  });

  it("o título pede cursivo e o estilo desempata", () => {
    const [r] = sugerirProdutividades(contexto({ titulo: "Letreiro Cursivo Galvanizado" }), faixaAcima, CATALOGO);
    expect(r.escolhida?.id).toBe(2);
  });

  it("o material do letreiro separa galvanizado de inox", () => {
    const [r] = sugerirProdutividades(contexto({ material: "inox", titulo: "Letreiro Inox" }), faixaAcima, CATALOGO);
    expect(r.escolhida?.id).toBe(3);
  });

  it("sem marcação no cadastro, material e chapinha saem do nome", () => {
    const semMarcas = [
      candidata({ id: 10, nome: "Produtividade Solda 1º [Galvanizado Padrão]" }),
      candidata({ id: 11, nome: "Produtividade Solda 20º C [Galvanizado Padrão Chapinha]" }),
      candidata({ id: 12, nome: "Produtividade Solda 3º [Inox Padrão]" }),
    ];
    expect(sugerirProdutividades(contexto(), faixaAcima, semMarcas)[0].escolhida?.id).toBe(10);
    expect(sugerirProdutividades(contexto({ tiposFixacao: ["chapinha_dupla_face"] }), faixaAcima, semMarcas)[0].escolhida?.id).toBe(11);
  });

  it("nome com 'menor ou igual a 11cm' nunca serve para letras grandes, mesmo sem marcação", () => {
    const so = [candidata({ id: 40, nome: "Produtividade Solda 32º [Menor ou igual a 11cm] [Inox]" })];
    const [r] = sugerirProdutividades(contexto({ material: "inox" }), faixaAcima, so);
    expect(r.escolhida).toBeNull();
    expect(r.confianca).toBe("nenhuma");
    expect(r.avisos.join(" ")).toContain("Nenhuma produtividade");
  });

  it("empate entre duas variantes derruba a confiança e pede conferência", () => {
    const gemeas = [
      candidata({ id: 50, nome: "Produtividade Solda 50º [Galvanizado]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] }),
      candidata({ id: 51, nome: "Produtividade Solda 51º [Galvanizado]", tiposSolda: ["barra_roscada"], tamanhos: ["acima_11cm"], materiais: ["galvanizado"] }),
    ];
    const [r] = sugerirProdutividades(contexto(), faixaAcima, gemeas);
    expect(r.confianca).toBe("baixa");
    expect(r.escolhida?.id).toBe(50);
    expect(r.alternativas[0].id).toBe(51);
    expect(r.avisos.join(" ")).toContain("mais de uma produtividade");
  });

  it("sem fixação ou sem material a confiança nunca passa de média e o aviso aparece", () => {
    const [semFixacao] = sugerirProdutividades(contexto({ tiposFixacao: [] }), faixaAcima, CATALOGO);
    expect(semFixacao.confianca).not.toBe("alta");
    expect(semFixacao.avisos.join(" ")).toContain("fixação não foi informado");
    const [semMaterial] = sugerirProdutividades(contexto({ material: null }), faixaAcima, CATALOGO);
    expect(semMaterial.confianca).not.toBe("alta");
    expect(semMaterial.avisos.join(" ")).toContain("material");
  });

  it("faixa sem perímetro e sem elementos não é necessária", () => {
    const [r] = sugerirProdutividades(contexto(), [{ faixa: "ate_11cm", perimetroM: 0, elementos: 0 }], CATALOGO);
    expect(r).toMatchObject({ necessaria: false, escolhida: null, origem: "nenhuma", avisos: [] });
  });

  it("devolve as duas faixas de uma vez, cada uma com a sua escolha", () => {
    const r = sugerirProdutividades(contexto(), [...faixaAte, ...faixaAcima], CATALOGO);
    expect(r.map(item => item.escolhida?.id)).toEqual([33, 1]);
    expect(r.map(item => item.perimetroM)).toEqual([3.2, 12.5]);
  });
});

describe("sugerirProdutividades — regras treinadas", () => {
  it("a regra vence a heurística e conta como confiança alta", () => {
    const r = sugerirProdutividades(
      contexto({ titulo: "Letreiro Frontlight Galvanizado", tipoProduto: "Frontlight" }),
      faixaAcima,
      CATALOGO,
      [regra({ id: 7, nome: "Frontlight galvanizado", material: "galvanizado", palavrasTitulo: ["frontlight"], materiaPrimaId: 5 })],
    )[0];
    expect(r).toMatchObject({ origem: "regra", regraId: 7, confianca: "alta" });
    expect(r.escolhida?.id).toBe(5);
    expect(r.escolhida?.motivos[0].texto).toContain("Regra treinada");
  });

  it("regra que não se aplica ao contexto é ignorada", () => {
    const [r] = sugerirProdutividades(contexto(), faixaAcima, CATALOGO, [
      regra({ id: 7, material: "inox", materiaPrimaId: 3 }),
      regra({ id: 8, palavrasTitulo: ["frontlight"], materiaPrimaId: 5 }),
      regra({ id: 9, fixacaoTipos: ["orelhinha"], materiaPrimaId: 5 }),
      regra({ id: 10, ativa: false, materiaPrimaId: 5 }),
      regra({ id: 11, faixa: "ate_11cm", materiaPrimaId: 33 }),
    ]);
    expect(r.origem).toBe("heuristica");
    expect(r.escolhida?.id).toBe(1);
  });

  it("a fixação da regra é um conjunto exato", () => {
    const aplica = sugerirProdutividades(contexto({ tiposFixacao: ["patinha_led", "barra_roscada"] }), faixaAcima, CATALOGO, [
      regra({ id: 1, fixacaoTipos: ["barra_roscada", "patinha_led"], materiaPrimaId: 2 }),
    ])[0];
    expect(aplica.origem).toBe("regra");
    const naoAplica = sugerirProdutividades(contexto({ tiposFixacao: ["barra_roscada"] }), faixaAcima, CATALOGO, [
      regra({ id: 1, fixacaoTipos: ["barra_roscada", "patinha_led"], materiaPrimaId: 2 }),
    ])[0];
    expect(naoAplica.origem).toBe("heuristica");
  });

  it("prioridade maior vence; empatando, a regra mais específica vence", () => {
    const porPrioridade = sugerirProdutividades(contexto(), faixaAcima, CATALOGO, [
      regra({ id: 1, prioridade: 1, materiaPrimaId: 2 }),
      regra({ id: 2, prioridade: 5, materiaPrimaId: 5 }),
    ])[0];
    expect(porPrioridade.regraId).toBe(2);
    const porEspecificidade = sugerirProdutividades(contexto(), faixaAcima, CATALOGO, [
      regra({ id: 1, materiaPrimaId: 2 }),
      regra({ id: 2, material: "galvanizado", palavrasTitulo: ["letra caixa"], materiaPrimaId: 5 }),
    ])[0];
    expect(porEspecificidade.regraId).toBe(2);
  });

  it("regra que aponta para produtividade fora do catálogo é ignorada com aviso", () => {
    const [r] = sugerirProdutividades(contexto(), faixaAcima, CATALOGO, [regra({ id: 3, nome: "Antiga", materiaPrimaId: 999 })]);
    expect(r.origem).toBe("heuristica");
    expect(r.avisos.join(" ")).toContain('"Antiga"');
  });
});
