import type { BaseCobrancaProduto } from "./base-cobranca-produto";

/**
 * Fórmulas do CPQ que possuem equivalente direto nos perfis de consumo do
 * MubiSys. O texto original continua sendo persistido na linha importada para
 * auditoria; esta função só faz a tradução semântica para o motor do Radrasys.
 *
 * Perfis desconhecidos retornam `null`: custo e consumo não podem ser
 * calculados por uma aproximação silenciosa baseada apenas na unidade.
 */
export type FormulaConsumoMubiSys = BaseCobrancaProduto;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/²/g, "2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function contem(texto: string, expressoes: string[]): boolean {
  return expressoes.some(expressao => texto.includes(expressao));
}

export function traduzirPerfilConsumoMubiSys(
  perfil: unknown
): FormulaConsumoMubiSys | null {
  if (typeof perfil !== "string") return null;
  const texto = normalizar(perfil);
  if (!texto) return null;

  // As regras mais específicas vêm primeiro para não reduzir "perímetro
  // total" a perímetro externo nem "área geral" a uma área genérica.
  if (
    contem(texto, [
      "perimetro total",
      "total de corte",
      "linha de corte",
      "comprimento de corte",
      "contorno total",
      "externo e interno",
      "com vazados",
    ])
  )
    return "perimTotal";

  if (
    contem(texto, [
      "area de nesting",
      "area do nesting",
      "area de consumo",
      "area consumida",
      "area total",
      "chapa consumida",
      "aproveitamento de chapa",
    ])
  )
    return "areaTotal";

  if (
    contem(texto, [
      "area geral",
      "retangulo envolvente",
      "caixa envolvente",
      "largura x altura",
      "largura vezes altura",
    ])
  )
    return "areaGeral";

  if (
    contem(texto, [
      "perimetro externo",
      "perimetro da peca",
      "perimetro",
      "metro linear",
      "metros lineares",
      "comprimento linear",
      "por comprimento",
      "contorno externo",
    ]) ||
    ["linear", "comprimento"].includes(texto)
  )
    return "perimExt";

  if (
    contem(texto, [
      "area liquida",
      "area da peca",
      "area das pecas",
      "area do produto",
      "area quadrada",
      "metro quadrado",
      "metros quadrados",
      "por area",
    ]) ||
    ["area", "m2", "quadrada", "quadrado"].includes(texto)
  )
    return "area";

  if (
    contem(texto, [
      "quantidade fixa",
      "por quantidade",
      "por unidade",
      "por peca",
      "por produto",
      "unitario",
      "consumo fixo",
    ]) ||
    [
      "fixo",
      "unidade",
      "unidades",
      "quantidade",
      "qtd",
      "qtde",
      "peca",
    ].includes(texto)
  )
    return "fixo";

  return null;
}
