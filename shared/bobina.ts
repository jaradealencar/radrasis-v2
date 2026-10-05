/**
 * Bobina (adesivo, papel kraft…): só a largura é fixa. Ela é gravada em `estudio_chapas`
 * com `bobina = true`, `altura_mm` = largura da bobina e `largura_mm` = este comprimento
 * máximo, que só serve de teto para o nesting (o consumo real é medido pelo layout).
 */
export const BOBINA_COMPRIMENTO_MAXIMO_MM = 50_000;
export const BOBINA_LARGURA_MINIMA_MM = 10;

/** Como o custo do MubiSys é cobrado numa bobina: por m², por metro linear de rolo ou pelo rolo inteiro. */
export const BOBINA_CUSTO_BASES = ["m2", "ml", "rolo"] as const;
export type BobinaCustoBase = (typeof BOBINA_CUSTO_BASES)[number];
export type BobinaCustoConfig = { base: BobinaCustoBase; comprimentoRoloMm: number | null };
