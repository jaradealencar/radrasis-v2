/**
 * Presets PBR do 3D do CPQ — pontos de partida de calibração, NUNCA dados certificados do fabricante.
 *
 * Quando uma matéria-prima ainda não tem perfil visual cadastrado (Administração > Materiais 3D), o servidor usa um destes presets
 * e marca o material como `estimated`: serve só para pré-visualizar, e a aprovação do 3D fica bloqueada até haver vínculo.
 * Vivem em `shared/` porque o servidor também precisa deles (o spec leva os parâmetros já resolvidos).
 */
import type { CpqMaterialFamily, CpqPbrParameters, CpqRenderRole } from "./cpq-render3d";

const pbr = (overrides: Partial<CpqPbrParameters>): CpqPbrParameters => ({
  colorHex: "#ffffff",
  metalness: 0,
  roughness: 0.45,
  transmission: 0,
  ior: 1.5,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  specularIntensity: 1,
  anisotropy: 0,
  anisotropyRotationRad: 0,
  attenuationColorHex: "#ffffff",
  attenuationDistanceMm: null,
  normalScale: [1, 1],
  emissiveHex: "#000000",
  emissiveIntensityDay: 0,
  emissiveIntensityNight: 0,
  ...overrides,
});

export const PRESETS_PBR: Record<CpqMaterialFamily, CpqPbrParameters> = {
  // Acrílico translúcido: opacity fica 1; a luz atravessa por transmission/ior/espessura. Emissão noturna é calibrável e só
  // vale em construção iluminada.
  acrylic_translucent: pbr({
    colorHex: "#f4f4f4",
    roughness: 0.22,
    transmission: 0.68,
    ior: 1.49,
    clearcoat: 0.5,
    clearcoatRoughness: 0.08,
    attenuationColorHex: "#f4f4f4",
    attenuationDistanceMm: 40,
    emissiveHex: "#ffffff",
    emissiveIntensityDay: 0.02,
    emissiveIntensityNight: 0.55,
  }),
  acrylic_solid: pbr({
    colorHex: "#d9d9d9",
    roughness: 0.2,
    transmission: 0.02,
    ior: 1.49,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
  }),
  stainless_brushed: pbr({
    colorHex: "#c9ccd1",
    metalness: 1,
    roughness: 0.34,
    anisotropy: 0.9,
    normalScale: [0.6, 0.6],
  }),
  stainless_polished: pbr({
    colorHex: "#d6d9de",
    metalness: 1,
    roughness: 0.08,
  }),
  // Pintura PU é camada dielétrica sobre o substrato: não use metalness 1 só porque o substrato é metal.
  galvanized_pu: pbr({
    colorHex: "#8f949a",
    metalness: 0.05,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
  }),
  aluminum_profile: pbr({
    colorHex: "#c4c7cc",
    metalness: 1,
    roughness: 0.28,
    anisotropy: 0.35,
  }),
  expanded_pvc: pbr({
    colorHex: "#f1f1ee",
    roughness: 0.78,
    normalScale: [0.3, 0.3],
  }),
  led_module: pbr({
    colorHex: "#f2efe6",
    roughness: 0.5,
    emissiveHex: "#fff3d6",
    emissiveIntensityDay: 0.5,
    emissiveIntensityNight: 4,
  }),
  generic_dielectric: pbr({
    colorHex: "#9a9a9a",
    roughness: 0.55,
  }),
};

/** Família de preset usada quando a matéria-prima não tem perfil visual: nunca adivinha material pelo nome. */
export function familiaPresetSemVinculo(role: CpqRenderRole): CpqMaterialFamily {
  return role === "led" ? "led_module" : "generic_dielectric";
}

export function presetPbr(familia: CpqMaterialFamily): CpqPbrParameters {
  const base = PRESETS_PBR[familia];
  return { ...base, normalScale: [...base.normalScale] as [number, number] };
}

/** Overrides limitados que um vínculo matéria-prima → perfil pode aplicar (cor e rotação do veio da escovação). */
export interface CpqRenderLinkOverrides {
  colorHex?: string;
  anisotropyRotationRad?: number;
}

export function aplicarOverridesPbr(base: CpqPbrParameters, overrides: CpqRenderLinkOverrides | null | undefined): CpqPbrParameters {
  if (!overrides) return base;
  return {
    ...base,
    ...(overrides.colorHex && /^#[\da-f]{6}$/i.test(overrides.colorHex) ? { colorHex: overrides.colorHex.toLowerCase() } : {}),
    ...(typeof overrides.anisotropyRotationRad === "number" && Number.isFinite(overrides.anisotropyRotationRad)
      ? { anisotropyRotationRad: overrides.anisotropyRotationRad }
      : {}),
  };
}
