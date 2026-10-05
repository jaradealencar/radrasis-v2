// Conversões e fórmulas de peso dos materiais do CPQ. Funções puras, usadas
// pelo servidor (cálculo definitivo) e pelas telas de cadastro (conversão de
// unidades). Dimensões sempre em mm, densidade em g/cm³ na digitação e
// kg/m³ no banco.

export type UnidadeEspessura = "mm" | "µm";

export function gCm3ParaKgM3(gCm3: number): number {
  return Math.round(gCm3 * 1000 * 10000) / 10000;
}

export function kgM3ParaGCm3(kgM3: number): number {
  return Number((kgM3 / 1000).toFixed(4));
}

/** Espessura digitada em mm ou micras (µm) convertida para mm. */
export function espessuraParaMm(valor: number, unidade: UnidadeEspessura): number {
  return unidade === "µm" ? valor / 1000 : valor;
}

/** Peso de uma chapa: m² × mm × g/cm³ = kg (1 m² × 1 mm × 1 g/cm³ = 1 kg). */
export function pesoChapaKg(areaM2: number, espessuraMm: number, densidadeGCm3: number): number {
  return areaM2 * espessuraMm * densidadeGCm3;
}

/**
 * Área da seção de um tubo retangular oco (altura × largura, parede de
 * espessura e). Devolve null quando a parede não cabe na seção.
 */
export function secaoTuboRetangularMm2(alturaMm: number, larguraMm: number, espessuraMm: number): number | null {
  if (!(alturaMm > 0 && larguraMm > 0 && espessuraMm > 0)) return null;
  if (2 * espessuraMm >= Math.min(alturaMm, larguraMm)) return null;
  return 2 * espessuraMm * (alturaMm + larguraMm - 2 * espessuraMm);
}

/** kg por metro linear de perfil: mm² × g/cm³ ÷ 1000. */
export function kgPorMetroPerfil(alturaMm: number, larguraMm: number, espessuraMm: number, densidadeGCm3: number): number | null {
  const secao = secaoTuboRetangularMm2(alturaMm, larguraMm, espessuraMm);
  if (secao == null || !(densidadeGCm3 > 0)) return null;
  return (secao * densidadeGCm3) / 1000;
}
