/**
 * Unidades de consumo de matéria-prima no cadastro de produto (composição).
 * Compartilhado entre client (formulário/tabela em Produtos.tsx) e server
 * (router produtos) para os dois lados concordarem nos rótulos.
 */
export const UNIDADE_CONSUMO_MATERIA_PRIMA = ["m2", "ml", "perimetro", "unidade"] as const;
export type UnidadeConsumoMateriaPrima = (typeof UNIDADE_CONSUMO_MATERIA_PRIMA)[number];

export const UNIDADE_CONSUMO_LABEL: Record<UnidadeConsumoMateriaPrima, string> = {
  m2: "Metro quadrado",
  ml: "Metro linear",
  perimetro: "Perímetro",
  unidade: "Unidade",
};
