import type { CpqMaterialFamily, CpqTextureColorSpace, CpqRender3dApproval, CpqRender3dBlocker, CpqRender3dDraftInputEntrada, CpqRender3dPublicView, CpqRender3dSnapshot, CpqRender3dSpec, CpqTextureKind } from "@shared/cpq-render3d";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly blockers: CpqRender3dBlocker[] = []) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api/letra-caixa/render3d";

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => ({})) as { error?: string; blockers?: CpqRender3dBlocker[] };
  if (!resposta.ok) throw new ApiError(corpo.error ?? "Não foi possível concluir a operação.", resposta.status, corpo.blockers ?? []);
  return corpo as T;
}

const json = (metodo: string, corpo: unknown): RequestInit => ({
  method: metodo,
  credentials: "same-origin",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

export async function obterSpec(sourceId: string, snapshot: CpqRender3dDraftInputEntrada, sinal?: AbortSignal): Promise<CpqRender3dSpec> {
  return ler(await fetch(`${BASE}/spec`, { ...json("POST", { sourceId, snapshot }), signal: sinal }));
}

export async function enviarPreview(entrada: { sourceId: string; specHash: string; ticket: string; tipo: "dia" | "noite" | "explodido" | "animacao"; imagem: Blob }): Promise<{ url: string; key: string }> {
  const consulta = new URLSearchParams({ sourceId: entrada.sourceId, specHash: entrada.specHash });
  return ler(await fetch(`${BASE}/preview/${entrada.tipo}?${consulta}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": entrada.imagem.type || "image/png", "x-render3d-ticket": entrada.ticket },
    body: entrada.imagem,
  }));
}

export interface RespostaAprovacao {
  approval: CpqRender3dApproval;
  render3d: CpqRender3dSnapshot;
}

export async function aprovarRender3d(entrada: { sourceId: string; snapshot: CpqRender3dDraftInputEntrada; specHash: string; previewDayUrl: string; previewNightUrl: string; previewExplodedUrl: string; previewAnimationUrl?: string | null }): Promise<RespostaAprovacao> {
  return ler(await fetch(`${BASE}/aprovar`, json("POST", entrada)));
}

export async function obterVisaoPublica(alvo: { token?: string; grupoId?: string }): Promise<CpqRender3dPublicView | { itens: Array<{ numero: string; modeloNome: string; visao: CpqRender3dPublicView }> }> {
  const caminho = alvo.grupoId
    ? `/api/letra-caixa/cotacoes/grupo/${encodeURIComponent(alvo.grupoId)}/render3d`
    : `/api/letra-caixa/cotacoes/${encodeURIComponent(alvo.token ?? "")}/render3d`;
  return ler(await fetch(caminho, { credentials: "same-origin", cache: "no-store" }));
}

/* ------------------------------------------------------------------ administração */

export interface AssetAdmin {
  id: number;
  profileId: number;
  kind: CpqTextureKind;
  url: string;
  mimeType: string;
  widthPx: number | null;
  heightPx: number | null;
  tileWidthMm: number | null;
  tileHeightMm: number | null;
  colorSpace: CpqTextureColorSpace;
  sourceNote: string | null;
  calibrated: boolean;
}

export interface PerfilAdmin {
  id: number;
  slug: string;
  versao: number;
  nome: string;
  familia: CpqMaterialFamily;
  ativo: boolean;
  acabamento: string | null;
  calibrado: boolean;
  pbr: Record<string, unknown>;
  notas: string | null;
  autorNome: string | null;
  travado: boolean;
  vinculos: number;
  assets: AssetAdmin[];
}

export type StatusMaterial3d = "sem_mapeamento" | "incompleto" | "estimado" | "aprovado";

export interface MateriaAdmin {
  id: number;
  nome: string;
  categoriaMubisys: string;
  categoriaLocal: string | null;
  unidade: string;
  tipoFisico: "chapa" | "perfil" | "outro";
  espessuraMm: number | null;
  perfilAlturaMm: number | null;
  perfilLarguraMm: number | null;
  vinculo: { profileId: number; overrides: { colorHex?: string; anisotropyRotationRad?: number } | null; atualizadoPor: string | null } | null;
  status: StatusMaterial3d;
}

export interface CatalogoAdmin {
  familias: CpqMaterialFamily[];
  tiposMapa: CpqTextureKind[];
  perfis: PerfilAdmin[];
  materias: MateriaAdmin[];
  catalogoErro: string | null;
}

export async function listarAdmin(): Promise<CatalogoAdmin> {
  return ler(await fetch(`${BASE}/material-profiles`, { credentials: "same-origin", cache: "no-store" }));
}

export interface EntradaPerfil {
  nome: string;
  familia: CpqMaterialFamily;
  acabamento: string | null;
  notas: string | null;
  calibrado: boolean;
  pbr: Record<string, unknown>;
}

export async function criarPerfil(entrada: EntradaPerfil & { baseadoEmPerfilId?: number }): Promise<{ id: number; slug: string; versao: number }> {
  return ler(await fetch(`${BASE}/material-profiles`, json("POST", entrada)));
}

export async function atualizarPerfil(id: number, entrada: EntradaPerfil & { repontarVinculos?: boolean }): Promise<{ id: number; versao: number; novaVersao: boolean }> {
  return ler(await fetch(`${BASE}/material-profiles/${id}`, json("PUT", entrada)));
}

export async function excluirPerfil(id: number): Promise<void> {
  await ler(await fetch(`${BASE}/material-profiles/${id}`, { method: "DELETE", credentials: "same-origin" }));
}

export async function enviarMapa(perfilId: number, arquivo: File, meta: { kind: CpqTextureKind; tileWidthMm?: number; tileHeightMm?: number; calibrated: boolean; sourceNote?: string }): Promise<AssetAdmin> {
  const consulta = new URLSearchParams({ kind: meta.kind, calibrated: String(meta.calibrated) });
  if (meta.tileWidthMm) consulta.set("tileWidthMm", String(meta.tileWidthMm));
  if (meta.tileHeightMm) consulta.set("tileHeightMm", String(meta.tileHeightMm));
  if (meta.sourceNote) consulta.set("sourceNote", meta.sourceNote);
  return ler(await fetch(`${BASE}/material-profiles/${perfilId}/assets?${consulta}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": arquivo.type },
    body: arquivo,
  }));
}

export async function removerMapa(perfilId: number, assetId: number): Promise<void> {
  await ler(await fetch(`${BASE}/material-profiles/${perfilId}/assets/${assetId}`, { method: "DELETE", credentials: "same-origin" }));
}

export async function salvarVinculo(materiaPrimaId: number, entrada: { profileId: number | null; overrides?: { colorHex?: string; anisotropyRotationRad?: number } | null }): Promise<void> {
  await ler(await fetch(`${BASE}/material-links/${materiaPrimaId}`, json("PUT", entrada)));
}
