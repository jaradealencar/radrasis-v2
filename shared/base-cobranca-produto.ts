/**
 * Base de cobrança do produto no CPQ (pedido de 06/10/2026): como o consumo da composição de um produto escala com o
 * letreiro em que ele entra como item do kit — por área líquida, área geral, perímetro ou unidade, a mesma lógica das
 * matérias-primas. Com a base definida, cada linha da composição é a quantidade POR unidade da base (ex.: 12 módulos de LED
 * por m² de área líquida). Sem base, cada linha define a sua fórmula, como antes.
 *
 * Os valores são chaves de `FORMULA_TYPES` do HTML do CPQ (`client/cpq-letreiros-express.html`); o HTML repete esta
 * lista em `BASES_COBRANCA_PRODUTO` — mantenha as duas iguais. Ficam de fora as fórmulas específicas (solda, gabarito).
 */
export const BASES_COBRANCA_PRODUTO = ["area", "areaTotal", "areaGeral", "perimExt", "perimTotal", "fixo"] as const;

export type BaseCobrancaProduto = (typeof BASES_COBRANCA_PRODUTO)[number];

export function baseCobrancaValida(valor: unknown): BaseCobrancaProduto | null {
  return BASES_COBRANCA_PRODUTO.find(base => base === valor) ?? null;
}
