/**
 * Biblioteca de materiais visuais do 3D. Os presets PBR vivem em `shared/` (o servidor também os usa para o preview ESTIMADO de
 * matéria-prima sem perfil); aqui ficam a ponte para o Three e as regras físicas de cada família.
 */
import * as THREE from "three";
import type { CpqMaterialFamily, CpqPbrParameters, CpqResolvedRenderMaterial, CpqTextureKind } from "@shared/cpq-render3d";
import { mmToWorld } from "./geometry/geometryUtils";

export { PRESETS_PBR, presetPbr, aplicarOverridesPbr, familiaPresetSemVinculo } from "@shared/cpq-render3d-presets";

/** Famílias cuja cor vem da arte aprovada (acrílico, PVC, genérico). Metais e módulos LED mantêm a cor do próprio perfil. */
const FAMILIAS_COM_COR_DA_REGIAO: ReadonlySet<CpqMaterialFamily> = new Set(["acrylic_translucent", "acrylic_solid", "expanded_pvc", "generic_dielectric"]);

export function familiaAceitaCorDaRegiao(familia: CpqMaterialFamily): boolean {
  return FAMILIAS_COM_COR_DA_REGIAO.has(familia);
}

export interface OpcoesMaterial {
  /** Cor aprovada da região (só vale em famílias que aceitam cor da arte). */
  corHex?: string | null;
  /** A construção é iluminada (frontlight/backlight): só então há emissão. */
  iluminada?: boolean;
  /** Papel LED: emite sempre que há iluminação. */
  night: boolean;
}

/**
 * MeshPhysicalMaterial a partir do perfil resolvido. opacity fica 1: acrílico usa transmission/ior/thickness/attenuation.
 * Mapas: baseColor/emissive em sRGB e os de dados sem conversão (ver textureLoader). O valor paramétrico MULTIPLICA o mapa
 * (rugosidade, metalicidade), então perfis calibrados com mapa completo usam 1.
 */
export function createPhysicalMaterial(
  resolved: Pick<CpqResolvedRenderMaterial, "pbr" | "family" | "thicknessMm">,
  textures: Partial<Record<CpqTextureKind, THREE.Texture>>,
  night: boolean,
  opcoes: Omit<OpcoesMaterial, "night"> = {},
): THREE.MeshPhysicalMaterial {
  const p = resolved.pbr;
  const cor = opcoes.corHex && familiaAceitaCorDaRegiao(resolved.family) ? opcoes.corHex : p.colorHex;
  const translucido = p.transmission > 0.05;
  const emissiva = opcoes.iluminada !== false;
  const emissivoHex = translucido && cor !== p.colorHex ? cor : p.emissiveHex;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cor),
    metalness: p.metalness,
    roughness: p.roughness,
    transmission: p.transmission,
    opacity: 1,
    ior: p.ior,
    thickness: mmToWorld(resolved.thicknessMm ?? 0),
    clearcoat: p.clearcoat,
    clearcoatRoughness: p.clearcoatRoughness,
    specularIntensity: p.specularIntensity,
    anisotropy: p.anisotropy,
    anisotropyRotation: p.anisotropyRotationRad,
    attenuationColor: new THREE.Color(translucido && opcoes.corHex && familiaAceitaCorDaRegiao(resolved.family) ? cor : p.attenuationColorHex),
    attenuationDistance: p.attenuationDistanceMm == null ? Infinity : mmToWorld(p.attenuationDistanceMm),
    normalScale: new THREE.Vector2(p.normalScale[0], p.normalScale[1]),
    emissive: new THREE.Color(emissivoHex),
    emissiveIntensity: emissiva ? (night ? p.emissiveIntensityNight : p.emissiveIntensityDay) : 0,
    map: textures.baseColor ?? null,
    normalMap: textures.normal ?? null,
    roughnessMap: textures.roughness ?? null,
    metalnessMap: textures.metalness ?? null,
    anisotropyMap: textures.anisotropy ?? null,
    aoMap: textures.ao ?? null,
    emissiveMap: textures.emissive ?? null,
  });
}

/** Material da borda cortada a laser do acrílico: mais brilhante e com a luz guiada pela espessura (borda acende à noite). */
export function createEdgeMaterial(face: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const borda = face.clone();
  borda.roughness = Math.max(0.04, face.roughness * 0.4);
  borda.clearcoat = 1;
  borda.clearcoatRoughness = 0.04;
  borda.emissiveIntensity = face.emissiveIntensity * 1.35;
  borda.map = null;
  borda.normalMap = null;
  borda.roughnessMap = null;
  return borda;
}

export function descartarMaterial(material: THREE.Material | THREE.Material[] | null | undefined): void {
  if (!material) return;
  for (const item of Array.isArray(material) ? material : [material]) item.dispose();
}

/** Sinaliza materiais sem perfil calibrado para a interface (o 3D só aproxima; a amostra física é a referência final). */
export function algumMaterialEstimado(materiais: ReadonlyArray<{ estimated: boolean }>): boolean {
  return materiais.some(material => material.estimated);
}

export type { CpqPbrParameters };
