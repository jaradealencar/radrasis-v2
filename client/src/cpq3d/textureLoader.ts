/**
 * Carregamento de mapas de textura dos perfis visuais: cache por URL, espaço de cor correto por tipo de mapa (cor em sRGB; normal,
 * rugosidade, metalicidade, anisotropia e AO como dados, sem conversão), RepeatWrapping e `repeat` calculado pelo tamanho REAL do
 * tile (as UVs da geometria estão em metros). As URLs vêm do spec (assets do nosso storage); nunca de entrada livre.
 */
import * as THREE from "three";
import type { CpqRenderTextureAsset, CpqTextureKind } from "@shared/cpq-render3d";

const cache = new Map<string, Promise<THREE.Texture | null>>();

/** O que o carregador precisa de um asset (o painel admin tem menos campos que o spec). */
export type AssetDeTextura = Pick<CpqRenderTextureAsset, "id" | "kind" | "url" | "colorSpace" | "tileWidthMm" | "tileHeightMm">;

function chaveDoAsset(asset: AssetDeTextura, anisotropia: number): string {
  return `${asset.id}|${asset.url}|${asset.kind}|${asset.tileWidthMm}x${asset.tileHeightMm}|${anisotropia}`;
}

export function configurarTextura(textura: THREE.Texture, asset: Pick<CpqRenderTextureAsset, "colorSpace" | "tileWidthMm" | "tileHeightMm">, anisotropiaMaxima: number): THREE.Texture {
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.colorSpace = asset.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textura.anisotropy = Math.max(1, anisotropiaMaxima);
  // As UVs estão em metros: repeat = 1 / (tamanho real do tile em metros).
  if (asset.tileWidthMm && asset.tileHeightMm) textura.repeat.set(1000 / asset.tileWidthMm, 1000 / asset.tileHeightMm);
  textura.needsUpdate = true;
  return textura;
}

/** Carrega (ou reaproveita) a textura de um asset. Falha de rede/CORS vira `null`: o material cai no valor paramétrico do perfil. */
export function carregarTextura(asset: AssetDeTextura, anisotropiaMaxima: number): Promise<THREE.Texture | null> {
  const chave = chaveDoAsset(asset, anisotropiaMaxima);
  const existente = cache.get(chave);
  if (existente) return existente;
  const promessa = new Promise<THREE.Texture | null>(resolver => {
    const carregador = new THREE.TextureLoader();
    carregador.setCrossOrigin("anonymous");
    carregador.load(
      asset.url,
      textura => resolver(configurarTextura(textura, asset, anisotropiaMaxima)),
      undefined,
      () => resolver(null),
    );
  });
  cache.set(chave, promessa);
  return promessa;
}

export type MapasCarregados = Partial<Record<CpqTextureKind, THREE.Texture>>;

export async function carregarMapasDoMaterial(assets: readonly AssetDeTextura[], anisotropiaMaxima: number): Promise<MapasCarregados> {
  const mapas: MapasCarregados = {};
  await Promise.all(assets.filter(asset => asset.kind !== "reference").map(async asset => {
    const textura = await carregarTextura(asset, anisotropiaMaxima);
    if (textura) mapas[asset.kind] = textura;
  }));
  return mapas;
}

/** Libera as texturas do cache (GPU) — chamar quando o viewer sai de cena de vez. */
export function liberarTexturas(): void {
  const pendentes = [...cache.values()];
  cache.clear();
  for (const promessa of pendentes) void promessa.then(textura => textura?.dispose());
}
