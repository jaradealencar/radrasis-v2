import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Troca do acrílico padrão da composição pelas cores do projeto (pedido de 07/10/2026). A lógica mora no HTML monolítico do CPQ; aqui
 * as funções reais são extraídas do arquivo e executadas contra um kit simulado, sem navegador.
 */
const html = readFileSync("client/cpq-letreiros-express.html", "utf8");

function extrairFuncao(nome: string): string {
  const inicio = html.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`Função ${nome} não encontrada no HTML do CPQ.`);
  // O HTML usa CRLF; o código extraído é normalizado para LF.
  const resto = html.slice(inicio).replace(/\r\n/g, "\n");
  const primeiraLinha = resto.slice(0, resto.indexOf("\n"));
  // Função de uma linha só (ex.: normalizeSearch) termina na própria linha; as demais terminam em "}" na coluna 0.
  if (/\}\s*$/.test(primeiraLinha) && !/\{\s*$/.test(primeiraLinha)) return primeiraLinha;
  const fim = resto.indexOf("\n}\n");
  if (fim < 0) throw new Error(`Fim da função ${nome} não encontrado.`);
  return resto.slice(0, fim + 2);
}

type Linha = Record<string, any>;
type Resultado = Record<string, any>;

const MATERIAS = [
  { id: 1134, nome: "Acrílico Branco 3mm", unidade: "m²", valor: 210, atualizado: "07/10/2026", status: "Ativo" },
  { id: 1135, nome: "Acrílico Transparente 3mm", unidade: "m²", valor: 190, atualizado: "07/10/2026", status: "Ativo" },
  { id: 2001, nome: "Acrílico AM Amarelo 11 2440×1220×3mm", unidade: "m²", valor: 230, atualizado: "07/10/2026", status: "Ativo" },
  { id: 2002, nome: "Acrílico AZ Azul 21 2440×1220×3mm", unidade: "m²", valor: 235, atualizado: "07/10/2026", status: "Ativo" },
  { id: 2003, nome: "Acrílico VD Verde 817 2440×1220×3mm", unidade: "m²", valor: 235, atualizado: "07/10/2026", status: "Ativo" },
  { id: 3001, nome: "PVC Expandido 10mm", unidade: "m²", valor: 120, atualizado: "07/10/2026", status: "Ativo" },
  { id: 3002, nome: "Chapa ACM Preto 3mm", unidade: "m²", valor: 145, atualizado: "07/10/2026", status: "Ativo" },
];

function montar(kit: Linha[], resultados: Resultado[]) {
  const REAL: any = { kit, colorAnalysis: { resultados, composicaoKitOriginal: null } };
  const catalog: any = { materias: MATERIAS };
  const codigo = [
    "normalizeSearch", "materialKitAtivo", "camadaFisicaKit", "linhaFaceSubstituivelPorCor", "faceDoProdutoEhAcrilico",
    "aplicarComposicaoSugeridaCoresReal", "restaurarComposicaoCoresReal",
  ].map(extrairFuncao).join("\n");
  const api = new Function("REAL", "catalog", `${codigo}\nreturn {normalizeSearch, camadaFisicaKit, linhaFaceSubstituivelPorCor, faceDoProdutoEhAcrilico, aplicarComposicaoSugeridaCoresReal, restaurarComposicaoCoresReal};`)(REAL, catalog) as {
    linhaFaceSubstituivelPorCor: (linha: Linha) => boolean;
    faceDoProdutoEhAcrilico: () => boolean;
    aplicarComposicaoSugeridaCoresReal: () => void;
    restaurarComposicaoCoresReal: () => void;
  };
  return { REAL, ...api };
}

const linha = (matId: number, papel: string, extra: Linha = {}): Linha => {
  const m = MATERIAS.find(item => item.id === matId)!;
  return { matId, nome: m.nome, unidade: m.unidade, custo: m.valor, papel, formulaType: "area", mult: 1, variantes: [], ...extra };
};
const chapa = (chapaMateriaPrimaId: number, corHex: string): Resultado => ({ tipoSugestao: "chapa", chapaMateriaPrimaId, corHex });
const adesivoSobreBase = (corHex: string, base = 1135): Resultado => ({
  tipoSugestao: "imprimax", requerChapaBase: true, chapaBaseMateriaPrimaId: base, chapaMateriaPrimaId: null, corHex,
});
const materiaisFace = (kit: Linha[]) => kit.filter(item => item.papel === "Face").map(item => item.matId).sort();

describe("composição do CPQ: o acrílico padrão da Face segue a cor das peças", () => {
  it("com papel Face: o branco do cadastro sai e entra o amarelo escolhido; o fundo continua", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, "Face"), linha(3001, "Fundo")], [chapa(2001, "#ffbf00")],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(REAL.kit.map((item: Linha) => item.matId)).toEqual([3001, 2001]);
    const face = REAL.kit.find((item: Linha) => item.matId === 2001);
    expect(face).toMatchObject({ papel: "Face", formulaType: "areaTotal", origemComposicaoCor: true, coresDaFace: ["#ffbf00"] });
  });

  it("acrílico sem papel informado (kit/ficha com papel vazio) também é trocado, em vez de ficar ao lado das cores", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, ""), linha(3001, "Fundo")], [chapa(2001, "#ffbf00")],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(REAL.kit.map((item: Linha) => item.matId)).toEqual([3001, 2001]);
    expect(REAL.kit.some((item: Linha) => item.matId === 1134)).toBe(false);
  });

  it("duas ou três cores no projeto: acrescenta uma chapa por cor e tira a que o projeto não usa", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, ""), linha(3001, "Fundo")],
      [chapa(2001, "#ffbf00"), chapa(2002, "#1d4ed8"), chapa(2003, "#16a34a")],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(materiaisFace(REAL.kit)).toEqual([2001, 2002, 2003]);
    expect(REAL.kit.some((item: Linha) => item.matId === 1134)).toBe(false);
    expect(REAL.kit.find((item: Linha) => item.matId === 3001)).toBeTruthy();
  });

  it("kit com duas chapas de Face e projeto de uma cor só: as duas saem, fica só a cor do projeto", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, "Face"), linha(2002, "Face"), linha(3001, "Fundo")], [chapa(2001, "#ffbf00")],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(materiaisFace(REAL.kit)).toEqual([2001]);
  });

  it("duas regiões que casam com a mesma chapa viram uma linha só, com as duas cores anotadas", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, "Face")], [chapa(2001, "#ffbf00"), chapa(2001, "#fdc400")],
    );
    aplicarComposicaoSugeridaCoresReal();
    const faces = REAL.kit.filter((item: Linha) => item.papel === "Face");
    expect(faces).toHaveLength(1);
    expect(faces[0].coresDaFace).toEqual(["#ffbf00", "#fdc400"]);
  });

  it("cor sem chapa equivalente: entra o acrílico transparente (base do adesivo) no lugar do branco", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, ""), linha(3001, "Fundo")], [chapa(2001, "#ffbf00"), adesivoSobreBase("#1d4ed8")],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(materiaisFace(REAL.kit)).toEqual([1135, 2001]);
    // a base transparente não tem cor própria: nenhuma cor anotada nela
    expect(REAL.kit.find((item: Linha) => item.matId === 1135).coresDaFace).toBeUndefined();
  });

  it("não mexe no que não é a face em acrílico: fundo, aro, PVC, ACM sem papel, linhas automáticas e a ficha oficial do MubiSys", () => {
    const kit = [
      linha(1134, "Fundo"), // acrílico, mas é o fundo
      linha(3001, ""), // sem papel, mas não é acrílico
      linha(3002, ""), // ACM
      linha(1135, "", { origemPintura: true }),
      linha(1135, "", { origemKitProduto: "127_570" }),
      linha(1135, "", { origemSoldaAuto: true }),
      linha(1135, "", { renderRole: "back" }), // papel 3D de outra peça
      linha(1135, "Pintura"), // papel de outra função
      linha(1135, "", { origemMubiSys: true, composicaoItemId: 77 }), // BOM oficial: o servidor exige a linha na emissão
    ];
    const { REAL, aplicarComposicaoSugeridaCoresReal, linhaFaceSubstituivelPorCor } = montar(kit, [chapa(2001, "#ffbf00")]);
    kit.forEach(item => expect(linhaFaceSubstituivelPorCor(item)).toBe(false));
    aplicarComposicaoSugeridaCoresReal();
    expect(REAL.kit).toHaveLength(kit.length + 1);
    expect(materiaisFace(REAL.kit)).toEqual([2001]);
  });

  it("o papel 3D 'face' confirmado vale como Face para o acrílico sem papel", () => {
    const { linhaFaceSubstituivelPorCor } = montar([], []);
    expect(linhaFaceSubstituivelPorCor(linha(1134, "", { renderRole: "face" }))).toBe(true);
    expect(linhaFaceSubstituivelPorCor(linha(3001, "", { renderRole: "face" }))).toBe(false);
  });

  it("guarda a composição original uma vez só e a devolve intacta ao refazer a análise", () => {
    const original = [linha(1134, ""), linha(3001, "Fundo")];
    const { REAL, aplicarComposicaoSugeridaCoresReal, restaurarComposicaoCoresReal } = montar(original, [chapa(2001, "#ffbf00")]);
    aplicarComposicaoSugeridaCoresReal();
    // segunda aplicação (ex.: nova rodada da análise sem restaurar): a original continua sendo a do cadastro
    REAL.colorAnalysis.resultados = [chapa(2002, "#1d4ed8")];
    aplicarComposicaoSugeridaCoresReal();
    expect(materiaisFace(REAL.kit)).toEqual([2002]);
    expect(REAL.colorAnalysis.composicaoKitOriginal.map((item: Linha) => item.matId)).toEqual([1134, 3001]);
    restaurarComposicaoCoresReal();
    expect(REAL.kit.map((item: Linha) => item.matId)).toEqual([1134, 3001]);
    expect(REAL.colorAnalysis.composicaoKitOriginal).toBeNull();
  });

  it("sem chapa nenhuma na análise (tudo impresso) a composição do cadastro fica como está", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, ""), linha(3001, "Fundo")], [{ tipoSugestao: "impresso", corHex: null }],
    );
    aplicarComposicaoSugeridaCoresReal();
    expect(REAL.kit.map((item: Linha) => item.matId)).toEqual([1134, 3001]);
  });

  it("pergunta de composição sem resposta interrompe a troca sem mexer no kit", () => {
    const { REAL, aplicarComposicaoSugeridaCoresReal } = montar(
      [linha(1134, "")], [{ ...adesivoSobreBase("#1d4ed8", 0), chapaBaseMateriaPrimaId: null }],
    );
    expect(() => aplicarComposicaoSugeridaCoresReal()).toThrow(/perguntas de composição/);
    expect(REAL.kit.map((item: Linha) => item.matId)).toEqual([1134]);
  });

  it("a face do produto conta como acrílico também quando o acrílico está sem papel", () => {
    expect(montar([linha(1134, ""), linha(3001, "Fundo")], []).faceDoProdutoEhAcrilico()).toBe(true);
    expect(montar([linha(1134, "Face")], []).faceDoProdutoEhAcrilico()).toBe(true);
    expect(montar([linha(3002, "Face"), linha(1134, "Fundo")], []).faceDoProdutoEhAcrilico()).toBe(false);
    expect(montar([linha(3001, ""), linha(3002, "")], []).faceDoProdutoEhAcrilico()).toBe(false);
  });

  it("o aviso 'Face do kit: antes → depois' e a tabela da Composição usam a mesma regra", () => {
    expect(html).toContain("composicaoKitOriginal||[]).filter(linhaFaceSubstituivelPorCor)");
    expect(html).toContain("k.origemComposicaoCor?");
    expect(html).not.toMatch(/\.filter\(line=>camadaFisicaKit\(line\)!=='face'&&!line\.origemComposicaoCor\)/);
  });
});
