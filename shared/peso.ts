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

export type FormatoPerfil = "tubo" | "cantoneira" | "barra";

export const FORMATOS_PERFIL: Record<FormatoPerfil, string> = {
  tubo: "Tubo retangular oco",
  cantoneira: "Cantoneira (L)",
  barra: "Barra maciça",
};

/** Só a barra maciça dispensa a espessura de parede: a seção é altura × largura. */
export const formatoPerfilUsaEspessura = (formato: FormatoPerfil): boolean => formato !== "barra";

/**
 * Área da seção do perfil em mm². Devolve null quando as medidas não formam
 * uma seção válida (parede que não cabe, aba menor que a espessura).
 *  - tubo: retângulo oco de parede e → 2·e·(h + w − 2e)
 *  - cantoneira: duas abas h e w de espessura e, canto contado uma vez → e·(h + w − e)
 *  - barra: maciça → h·w (espessura não entra)
 */
export function secaoPerfilMm2(
  formato: FormatoPerfil,
  alturaMm: number,
  larguraMm: number,
  espessuraMm: number | null,
): number | null {
  if (!(alturaMm > 0 && larguraMm > 0)) return null;
  if (formato === "barra") return alturaMm * larguraMm;
  if (espessuraMm == null || !(espessuraMm > 0)) return null;
  if (formato === "cantoneira") {
    if (espessuraMm >= Math.min(alturaMm, larguraMm)) return null;
    return espessuraMm * (alturaMm + larguraMm - espessuraMm);
  }
  if (2 * espessuraMm >= Math.min(alturaMm, larguraMm)) return null;
  return 2 * espessuraMm * (alturaMm + larguraMm - 2 * espessuraMm);
}

/** Seção de tubo retangular oco (atalho de `secaoPerfilMm2("tubo", ...)`). */
export function secaoTuboRetangularMm2(alturaMm: number, larguraMm: number, espessuraMm: number): number | null {
  return secaoPerfilMm2("tubo", alturaMm, larguraMm, espessuraMm);
}

/** kg por metro linear de perfil: mm² × g/cm³ ÷ 1000. */
export function kgPorMetroPerfil(
  alturaMm: number,
  larguraMm: number,
  espessuraMm: number | null,
  densidadeGCm3: number,
  formato: FormatoPerfil = "tubo",
): number | null {
  const secao = secaoPerfilMm2(formato, alturaMm, larguraMm, espessuraMm);
  if (secao == null || !(densidadeGCm3 > 0)) return null;
  return (secao * densidadeGCm3) / 1000;
}
