/**
 * Monta, a partir do spec resolvido pelo servidor, tudo o que a cena 3D precisa desenhar — em dados puros (regiões, geometrias do
 * Three, posições). Nenhuma decisão de material, papel ou profundidade é tomada aqui: vem do spec. Valores ausentes viram avisos
 * visíveis e um valor VISUAL mínimo (nunca um valor de fabricação); profundidade ausente interrompe (`ProfundidadeAusenteError`).
 */
import type * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CpqRender3dSpec, CpqRenderRegion, CpqResolvedRenderMaterial } from "@shared/cpq-render3d";
import { construirFundo, type FundoConstruido } from "./geometry/buildBackGeometry";
import { construirLayoutFixadores, construirLayoutLeds, type LayoutLeds, type PontoFixador } from "./geometry/buildLedLayout";
import { construirParedeOca } from "./geometry/buildReturnShellGeometry";
import { deslocarRegioes, uniaoDeRegioes } from "./geometry/clipper";
import { areaDaRegiao, mmToWorld, type Regiao } from "./geometry/geometryUtils";
import { svgParaFormas } from "./svgToShapes";

/** Subconjunto do spec que a cena lê: o spec interno e a visão pública satisfazem este formato. */
export interface DesenhoSpec {
  specHash: string;
  svg: string;
  widthMm: number;
  heightMm: number;
  construction: CpqRender3dSpec["construction"];
  regions: CpqRenderRegion[];
  defaultFaceMaterialId: number | null;
  materials: Array<Pick<CpqResolvedRenderMaterial, "mubisysMateriaPrimaId" | "role" | "family" | "thicknessMm" | "pbr" | "assets" | "estimated">>;
}

export type MaterialDoSpec = DesenhoSpec["materials"][number];

export type Qualidade = "baixa" | "alta";

export class ProfundidadeAusenteError extends Error {
  constructor() {
    super("A profundidade da caixa não está cadastrada no kit: o 3D não pode ser desenhado.");
    this.name = "ProfundidadeAusenteError";
  }
}

/** Espessuras VISUAIS usadas só para desenhar quando a medida real não está cadastrada (sempre acompanhadas de aviso). */
const ESPESSURA_VISUAL_FACE_MM = 3;
const ESPESSURA_VISUAL_LATERAL_MM = 1.5;
const ESPESSURA_VISUAL_FUNDO_MM = 5;
const ALTURA_MODULO_LED_MM = 3;
const MODULO_LED_PADRAO_MM: [number, number] = [20, 10];

export interface GrupoFace {
  chave: string;
  materialId: number | null;
  colorHex: string | null;
  regioes: Regiao[];
  espessuraM: number;
  areaM2: number;
}

export interface CenaDados {
  larguraM: number;
  alturaM: number;
  profundidadeM: number;
  standoffM: number;
  faceEspessuraM: number;
  fundoEspessuraM: number;
  laterEspessuraM: number;
  silhueta: Regiao[];
  grupos: GrupoFace[];
  /** Lateral oca (retorno/perfil), de z = 0 a z = profundidade − face. `null` = a composição não tem lateral. */
  parede: THREE.BufferGeometry | null;
  fundo: FundoConstruido | null;
  leds: LayoutLeds | null;
  moduloLedM: [number, number, number];
  fixadores: PontoFixador[];
  /** Camadas do halo do backlight, da mais próxima da silhueta para a mais distante. */
  halo: Regiao[][];
  materiais: {
    face: MaterialDoSpec[];
    parede: MaterialDoSpec | null;
    fundo: MaterialDoSpec | null;
    led: MaterialDoSpec | null;
    fixacao: MaterialDoSpec | null;
  };
  avisos: string[];
}

export function materialDoPapel(spec: Pick<DesenhoSpec, "materials">, role: MaterialDoSpec["role"]): MaterialDoSpec | null {
  return spec.materials.find(material => material.role === role) ?? null;
}

/** Tamanho real (m) de uma repetição da textura da parede: o tile do primeiro mapa de textura cadastrado, ou 0,2 m. */
export function tileDoMaterial(material: MaterialDoSpec | null): [number, number] {
  const mapa = material?.assets.find(asset => asset.kind !== "reference" && asset.tileWidthMm && asset.tileHeightMm);
  return mapa ? [mmToWorld(mapa.tileWidthMm!), mmToWorld(mapa.tileHeightMm!)] : [0.2, 0.2];
}

function espessuraOuVisual(material: MaterialDoSpec | null, medidaDoSpecMm: number, visualMm: number, rotulo: string, avisos: string[]): number {
  const mm = medidaDoSpecMm > 0 ? medidaDoSpecMm : material?.thicknessMm && material.thicknessMm > 0 ? material.thicknessMm : 0;
  if (mm > 0) return mmToWorld(mm);
  avisos.push(`Espessura de ${rotulo} não cadastrada: o 3D usa ${visualMm} mm só para desenhar (valor visual, não de fabricação).`);
  return mmToWorld(visualMm);
}

export function construirCena(spec: DesenhoSpec, qualidade: Qualidade = "alta"): CenaDados {
  const avisos: string[] = [];
  const { construction } = spec;
  if (!(construction.boxDepthMm > 0)) throw new ProfundidadeAusenteError();

  const resultado = svgParaFormas(spec.svg, { larguraMm: spec.widthMm, alturaMm: spec.heightMm, divisoes: qualidade === "alta" ? 12 : 5 });
  avisos.push(...resultado.avisos);

  const faceMateriais = spec.materials.filter(material => material.role === "face");
  const materialParede = materialDoPapel(spec, "profile") ?? materialDoPapel(spec, "return");
  const materialFundo = materialDoPapel(spec, "back");
  const materialLed = materialDoPapel(spec, "led");
  const materialFixacao = materialDoPapel(spec, "fixing");

  const profundidadeM = mmToWorld(construction.boxDepthMm);
  const faceEspessuraM = espessuraOuVisual(faceMateriais[0] ?? null, construction.faceThicknessMm, ESPESSURA_VISUAL_FACE_MM, "face", avisos);
  const laterEspessuraM = materialParede ? espessuraOuVisual(materialParede, construction.returnSheetThicknessMm, ESPESSURA_VISUAL_LATERAL_MM, "lateral", avisos) : 0;
  const fundoEspessuraM = materialFundo ? espessuraOuVisual(materialFundo, construction.backThicknessMm, ESPESSURA_VISUAL_FUNDO_MM, "fundo", avisos) : 0;

  /* --- face: uma região por forma, agrupadas por (material, cor) --- */
  const regiaoPorPath = new Map<number, CpqRenderRegion>();
  for (const regiao of spec.regions) for (const indice of regiao.pathIndexes) regiaoPorPath.set(indice, regiao);
  const corPadrao = spec.regions.find(regiao => regiao.pathIndexes.length === 0)?.colorHex ?? null;
  const gruposPorChave = new Map<string, GrupoFace>();
  for (const forma of resultado.formas) {
    const regiaoCor = regiaoPorPath.get(forma.pathIndex);
    const materialId = regiaoCor?.materialId ?? spec.defaultFaceMaterialId;
    const colorHex = regiaoCor ? regiaoCor.colorHex : corPadrao;
    const chave = `${materialId ?? "x"}|${colorHex ?? "-"}`;
    const material = faceMateriais.find(item => item.mubisysMateriaPrimaId === materialId) ?? faceMateriais[0] ?? null;
    const grupo = gruposPorChave.get(chave) ?? {
      chave,
      materialId,
      colorHex,
      regioes: [],
      espessuraM: material?.thicknessMm && material.thicknessMm > 0 ? mmToWorld(material.thicknessMm) : faceEspessuraM,
      areaM2: 0,
    };
    grupo.regioes.push(forma.regiao);
    grupo.areaM2 += areaDaRegiao(forma.regiao);
    gruposPorChave.set(chave, grupo);
  }
  const grupos = [...gruposPorChave.values()];

  /* --- silhueta (união das formas) e peças derivadas --- */
  const silhueta = uniaoDeRegioes(resultado.formas.map(forma => forma.regiao));
  const tile = tileDoMaterial(materialParede);
  let parede: THREE.BufferGeometry | null = null;
  if (materialParede) {
    const alturaParedeM = Math.max(profundidadeM - faceEspessuraM, 0.001);
    const partes = silhueta.flatMap(regiao => {
      const oca = construirParedeOca(regiao, alturaParedeM, laterEspessuraM, tile);
      return oca ? [oca.geometria] : [];
    });
    parede = partes.length > 1 ? mergeGeometries(partes, false) : partes[0] ?? null;
  }
  const fundo = materialFundo ? construirFundo(silhueta, fundoEspessuraM, laterEspessuraM) : null;
  if (fundo?.semRecuo) avisos.push(`${fundo.semRecuo} região(ões) do fundo são finas demais para o recuo da lateral e usam o contorno sem recuo.`);

  /* --- LEDs, fixadores e halo --- */
  const iluminada = construction.kind !== "non_illuminated";
  const [moduloLarguraMm, moduloAlturaMm] = [construction.ledModuleWidthMm ?? MODULO_LED_PADRAO_MM[0], construction.ledModuleHeightMm ?? MODULO_LED_PADRAO_MM[1]];
  const base = fundo?.regioes ?? silhueta;
  const leds = iluminada && materialLed
    ? construirLayoutLeds({
      silhueta: base,
      passoM: construction.ledPitchMm != null ? mmToWorld(construction.ledPitchMm) : null,
      folgaBordaM: mmToWorld(construction.ledEdgeClearanceMm),
      moduloLarguraM: mmToWorld(moduloLarguraMm),
      moduloAlturaM: mmToWorld(moduloAlturaMm),
      quantidade: construction.ledCount,
    })
    : null;
  if (leds) avisos.push(...leds.avisos);
  const fixadores = construction.fixingTypes.length ? construirLayoutFixadores(base, mmToWorld(10)) : [];

  const standoffM = mmToWorld(construction.wallStandoffMm);
  const alcance = Math.max(standoffM, 0.02) * 1.6;
  const halo = construction.kind === "backlight"
    ? [0.12, 0.3, 0.55, 0.8, 1, 1.2].map(fator => deslocarRegioes(silhueta, alcance * fator)).filter(camada => camada.length)
    : [];

  return {
    larguraM: mmToWorld(spec.widthMm),
    alturaM: mmToWorld(spec.heightMm),
    profundidadeM,
    standoffM,
    faceEspessuraM,
    fundoEspessuraM,
    laterEspessuraM,
    silhueta,
    grupos,
    parede,
    fundo,
    leds,
    moduloLedM: [mmToWorld(moduloLarguraMm), mmToWorld(moduloAlturaMm), mmToWorld(ALTURA_MODULO_LED_MM)],
    fixadores,
    halo,
    materiais: { face: faceMateriais, parede: materialParede, fundo: materialFundo, led: materialLed, fixacao: materialFixacao },
    avisos: [...new Set(avisos)],
  };
}
