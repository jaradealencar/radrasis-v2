/**
 * Contratos da renderização 3D paramétrica do CPQ Letreiros Express (cliente + servidor).
 *
 * Tudo aqui é serializável: o servidor nunca envia instâncias do Three.js. O servidor resolve uma `CpqRender3dSpec` imutável,
 * versionada e assinada por hash; o navegador só a desenha. A aparência não altera preço: o 3D consome o snapshot e nunca
 * recalcula custo, nesting ou margem.
 */
import { z } from "zod";
import { TIPOS_SOLDA } from "./produtividade-solda";

export const CPQ_RENDER3D_SPEC_VERSION = 1 as const;

/** O que cada matéria-prima da composição faz na montagem 3D. */
export const RENDER_ROLES = ["face", "return", "back", "profile", "led", "fixing", "finish", "ignored"] as const;
export type CpqRenderRole = (typeof RENDER_ROLES)[number];

export const ROTULO_RENDER_ROLE: Record<CpqRenderRole, string> = {
  face: "Face",
  return: "Retorno / lateral (chapa)",
  back: "Fundo",
  profile: "Perfil",
  led: "LED",
  fixing: "Fixação",
  finish: "Acabamento / pintura",
  ignored: "Não aparece no 3D",
};

export const MATERIAL_FAMILIES = [
  "acrylic_translucent",
  "acrylic_solid",
  "stainless_brushed",
  "stainless_polished",
  "galvanized_pu",
  "aluminum_profile",
  "expanded_pvc",
  "led_module",
  "generic_dielectric",
] as const;
export type CpqMaterialFamily = (typeof MATERIAL_FAMILIES)[number];

export const ROTULO_MATERIAL_FAMILY: Record<CpqMaterialFamily, string> = {
  acrylic_translucent: "Acrílico translúcido",
  acrylic_solid: "Acrílico sólido",
  stainless_brushed: "Inox escovado",
  stainless_polished: "Inox polido",
  galvanized_pu: "Galvanizado com pintura PU",
  aluminum_profile: "Perfil de alumínio",
  expanded_pvc: "PVC expandido",
  led_module: "Módulo LED",
  generic_dielectric: "Dielétrico genérico (estimado)",
};

/** `reference` é foto para comparação humana; os demais são mapas de dados/cor. Nunca derive um do outro automaticamente. */
export const TEXTURE_KINDS = ["baseColor", "normal", "roughness", "metalness", "anisotropy", "ao", "emissive", "reference"] as const;
export type CpqTextureKind = (typeof TEXTURE_KINDS)[number];

export const TEXTURE_COLOR_SPACES = ["srgb", "linear", "none"] as const;
export type CpqTextureColorSpace = (typeof TEXTURE_COLOR_SPACES)[number];

/** Espaço de cor correto de cada tipo de mapa: cor em sRGB; dados (normal, rugosidade...) sem conversão. */
export const COLOR_SPACE_PADRAO_POR_TIPO: Record<CpqTextureKind, CpqTextureColorSpace> = {
  baseColor: "srgb",
  emissive: "srgb",
  reference: "srgb",
  normal: "none",
  roughness: "none",
  metalness: "none",
  anisotropy: "none",
  ao: "none",
};

export const CONSTRUCTION_KINDS = ["frontlight", "backlight", "non_illuminated"] as const;
export type CpqConstructionKind = (typeof CONSTRUCTION_KINDS)[number];

export const ROTULO_CONSTRUCTION_KIND: Record<CpqConstructionKind, string> = {
  frontlight: "Frontlight (face iluminada)",
  backlight: "Backlight (halo na parede)",
  non_illuminated: "Sem iluminação",
};

export interface CpqRenderTextureAsset {
  id: number;
  kind: CpqTextureKind;
  url: string;
  storageKey: string | null;
  mimeType: string;
  sha256: string;
  widthPx: number | null;
  heightPx: number | null;
  tileWidthMm: number | null;
  tileHeightMm: number | null;
  colorSpace: CpqTextureColorSpace;
  sourceNote: string | null;
  calibrated: boolean;
}

export interface CpqPbrParameters {
  colorHex: string;
  metalness: number;
  roughness: number;
  transmission: number;
  ior: number;
  clearcoat: number;
  clearcoatRoughness: number;
  specularIntensity: number;
  anisotropy: number;
  anisotropyRotationRad: number;
  attenuationColorHex: string;
  attenuationDistanceMm: number | null;
  normalScale: [number, number];
  emissiveHex: string;
  emissiveIntensityDay: number;
  emissiveIntensityNight: number;
}

export interface CpqResolvedRenderMaterial {
  mubisysMateriaPrimaId: number;
  materialName: string;
  role: CpqRenderRole;
  /** 0 = sem perfil visual cadastrado (preset genérico, sempre `estimated`). */
  profileId: number;
  profileVersion: number;
  profileName: string;
  family: CpqMaterialFamily;
  thicknessMm: number | null;
  pbr: CpqPbrParameters;
  assets: CpqRenderTextureAsset[];
  estimated: boolean;
  warnings: string[];
  /** Overrides do vínculo (cor, direção do veio) já aplicados em `pbr`; ficam no snapshot para a cotação emitida não mudar. */
  overrides?: { colorHex?: string; anisotropyRotationRad?: number } | null;
}

export interface CpqRenderConstruction {
  kind: CpqConstructionKind;
  boxDepthMm: number;
  wallStandoffMm: number;
  faceLipMm: number;
  returnSheetThicknessMm: number;
  backThicknessMm: number;
  faceThicknessMm: number;
  ledPitchMm: number | null;
  ledModuleWidthMm: number | null;
  ledModuleHeightMm: number | null;
  ledEdgeClearanceMm: number;
  /** Quantidade física de módulos da composição (só quando a unidade é contável); nulo = distribuir pelo passo. */
  ledCount: number | null;
  /** Tipos de fixação do orçamento (vazio ou só `sem_fixacao` = nada é desenhado). */
  fixingTypes: Array<(typeof TIPOS_SOLDA)[number]>;
}

export interface CpqRenderRegion {
  regionKey: string;
  pathIndexes: number[];
  colorHex: string | null;
  /** Matéria-prima da chapa/base desta região da face. */
  materialId: number | null;
  profileId: number | null;
}

export interface CpqRender3dSpec {
  version: typeof CPQ_RENDER3D_SPEC_VERSION;
  sourceId: string;
  specHash: string;
  vectorHash: string;
  svg: string;
  widthMm: number;
  heightMm: number;
  construction: CpqRenderConstruction;
  regions: CpqRenderRegion[];
  materials: CpqResolvedRenderMaterial[];
  /** Matéria-prima da face sem região de cor (arte sem análise de cor ou paths não cobertos). */
  defaultFaceMaterialId: number | null;
  warnings: string[];
  blockers: CpqRender3dBlocker[];
  ticket: string;
}

/** Pendência estruturada, ligada ao campo ou ao material que a causou. */
export interface CpqRender3dBlocker {
  code: string;
  message: string;
  field: string | null;
  mubisysMateriaPrimaId: number | null;
  /** Papel 3D sugerido (só nas pendências de papel): o vendedor confirma com um clique. */
  suggestion?: CpqRenderRole;
}

export interface CpqRender3dApproval {
  specHash: string;
  ticket: string;
  approvedAt: string;
  approvedBy: { id: string; name: string; role: string };
  previewDayUrl: string | null;
  previewNightUrl: string | null;
  previewExplodedUrl: string | null;
  /** GIF da animação de montagem (opcional: aprovações antigas ou geração que falhou não têm). */
  previewAnimationUrl?: string | null;
}

/** Visão pública (link do cliente): sem custos, margem, fórmulas, recibos nem nomes internos de matéria-prima. */
export interface CpqRender3dPublicView {
  specHash: string;
  svg: string;
  widthMm: number;
  heightMm: number;
  construction: CpqRenderConstruction;
  regions: CpqRenderRegion[];
  materials: Array<Omit<CpqResolvedRenderMaterial, "materialName" | "profileName" | "warnings"> & { materialName: string }>;
  defaultFaceMaterialId: number | null;
  previewDayUrl: string | null;
  previewNightUrl: string | null;
  previewExplodedUrl: string | null;
  previewAnimationUrl?: string | null;
}

/** Ponte entre o HTML legado do CPQ e a ilha React. */
export interface Cpq3dLegacyBridge {
  getDraftInput(): CpqRender3dDraftInput | null;
  getApproval(): CpqRender3dApproval | null;
  setApproval(approval: CpqRender3dApproval | null): void;
  invalidate(reason: string): void;
  goToStep(step: number): void;
  getSourceId(): string;
  /** Papel 3D escolhido para uma linha da composição (índice de `REAL.kit`). */
  setLineRole?(lineIndex: number, role: CpqRenderRole | null): void;
}

/* ------------------------------------------------------------------ schemas */

const hexSchema = z.string().regex(/^#[\da-f]{6}$/i);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const renderRoleSchema = z.enum(RENDER_ROLES);
export const materialFamilySchema = z.enum(MATERIAL_FAMILIES);
export const textureKindSchema = z.enum(TEXTURE_KINDS);
export const textureColorSpaceSchema = z.enum(TEXTURE_COLOR_SPACES);

/** Construção paramétrica cadastrada no kit do produto. Nada de profundidade padrão: ausência é pendência. */
export const render3dConstructionSchema = z.object({
  kind: z.enum(CONSTRUCTION_KINDS),
  boxDepthMm: z.number().finite().min(5).max(1000),
  wallStandoffMm: z.number().finite().min(0).max(500),
  faceLipMm: z.number().finite().min(0).max(100),
  ledPitchMm: z.number().finite().min(5).max(500).nullable(),
  ledEdgeClearanceMm: z.number().finite().min(0).max(500),
  ledModuleWidthMm: z.number().finite().min(1).max(500).nullable().optional(),
  ledModuleHeightMm: z.number().finite().min(0.5).max(200).nullable().optional(),
}).strict();
export type CpqRender3dKitConstruction = z.infer<typeof render3dConstructionSchema>;

/** PBR editável (perfil visual): limites físicos para nada absurdo chegar ao shader. */
export const pbrParametersSchema = z.object({
  colorHex: hexSchema,
  metalness: z.number().min(0).max(1),
  roughness: z.number().min(0).max(1),
  transmission: z.number().min(0).max(1),
  ior: z.number().min(1).max(2.5),
  clearcoat: z.number().min(0).max(1),
  clearcoatRoughness: z.number().min(0).max(1),
  specularIntensity: z.number().min(0).max(1),
  anisotropy: z.number().min(0).max(1),
  anisotropyRotationRad: z.number().min(-Math.PI * 2).max(Math.PI * 2),
  attenuationColorHex: hexSchema,
  attenuationDistanceMm: z.number().positive().max(100_000).nullable(),
  normalScale: z.tuple([z.number().min(0).max(5), z.number().min(0).max(5)]),
  emissiveHex: hexSchema,
  emissiveIntensityDay: z.number().min(0).max(20),
  emissiveIntensityNight: z.number().min(0).max(20),
}).strict();

const draftMaterialSchema = z.object({
  mubisysMateriaPrimaId: z.number().int().positive().nullable(),
  nome: z.string().max(256),
  unidade: z.string().max(80).optional().default(""),
  quantidade: z.number().finite().nonnegative().optional().default(0),
  papel: z.string().max(80).nullish(),
  renderRole: renderRoleSchema.nullish(),
});

const draftRegiaoSchema = z.object({
  regionKey: z.string().min(1).max(80),
  tipoCor: z.string().max(24).optional(),
  corHex: hexSchema.nullable(),
  coresGradiente: z.array(hexSchema).max(20).optional().default([]),
  pathIndexes: z.array(z.number().int().nonnegative().max(499)).max(500),
  tipoSugestao: z.enum(["chapa", "imprimax", "impresso", "pendente"]),
  chapaMateriaPrimaId: z.number().int().positive().nullable().optional().default(null),
  chapaBaseMateriaPrimaId: z.number().int().positive().nullable().optional().default(null),
  requerChapaBase: z.boolean().optional().default(false),
});

/**
 * O que o resolver lê de um orçamento. O snapshot completo da cotação satisfaz este formato (chaves extras são descartadas),
 * então a mesma função serve ao rascunho do passo 3D e à verificação na emissão.
 */
export const render3dDraftSchema = z.object({
  mubisysProdutoId: z.number().int().positive().nullable().optional().default(null),
  mubisysModeloId: z.number().int().positive().nullable().optional().default(null),
  nestingSvg: z.string().min(20).max(1_500_000).nullable(),
  larguraNestingMm: z.number().finite().positive().max(50_000).nullable(),
  alturaNestingMm: z.number().finite().positive().max(50_000).nullable(),
  factibilidade: z.object({
    resultadoHash: sha256Schema,
    ticketAnalise: z.string().min(20).max(2000),
  }).nullable().optional().default(null),
  tiposFixacao: z.array(z.enum(TIPOS_SOLDA)).max(5).optional().default([]),
  materiais: z.array(draftMaterialSchema).max(300).optional().default([]),
  mapeamentoCores: z.object({
    aprovado: z.boolean(),
    regioes: z.array(draftRegiaoSchema).max(500),
  }).nullable().optional().default(null),
});
export type CpqRender3dDraftInput = z.infer<typeof render3dDraftSchema>;
export type CpqRender3dDraftInputEntrada = z.input<typeof render3dDraftSchema>;

/** Bloco `render3d` do snapshot da cotação (opcional, sem default: cotações antigas continuam com a mesma assinatura). */
export const render3dSnapshotSchema = z.object({
  version: z.literal(CPQ_RENDER3D_SPEC_VERSION),
  specHash: sha256Schema,
  vectorHash: sha256Schema,
  construction: render3dConstructionSchema,
  materials: z.array(z.object({
    mubisysMateriaPrimaId: z.number().int().positive(),
    role: renderRoleSchema,
    profileId: z.number().int().nonnegative(),
    profileVersion: z.number().int().nonnegative(),
    thicknessMm: z.number().positive().nullable(),
    overrides: z.object({
      colorHex: hexSchema.optional(),
      anisotropyRotationRad: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2).optional(),
    }).strict().nullable().optional(),
  }).strict()).max(300),
  approval: z.object({
    ticket: z.string().min(20).max(6000),
    approvedAt: z.string().datetime(),
    approvedBy: z.object({ id: z.string(), name: z.string(), role: z.string() }).strict(),
    previewDayUrl: z.string().url().max(2048).nullable(),
    previewNightUrl: z.string().url().max(2048).nullable(),
    previewExplodedUrl: z.string().url().max(2048).nullable(),
    previewAnimationUrl: z.string().url().max(2048).nullable().optional(),
  }).strict(),
}).strict();
export type CpqRender3dSnapshot = z.infer<typeof render3dSnapshotSchema>;

/* ------------------------------------------------------------ papéis do kit */

function normalizarTexto(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Sugestão de papel 3D a partir do texto livre "papel na peça" (Face, Aro, Fundo, Lateral, Pintura, Iluminação, Fixação...).
 * Devolve `null` quando o texto é ambíguo ou desconhecido: nesse caso o vendedor/gestor precisa escolher. É só sugestão — o papel
 * 3D só vale depois de confirmado (`renderRole` gravado no kit). Regra repetida em `sugerirRenderRole` do HTML do CPQ.
 */
export function sugerirRenderRole(papel: string | null | undefined, opcoes: { ehPerfil?: boolean } = {}): CpqRenderRole | null {
  const tokens = new Set(normalizarTexto(String(papel ?? "")).split(/[^a-z0-9]+/).filter(Boolean));
  if (!tokens.size) return null;
  const tem = (...palavras: string[]) => palavras.some(palavra => tokens.has(palavra));
  const candidatos = new Set<CpqRenderRole>();
  if (tem("face", "frente", "visual", "translucida")) candidatos.add("face");
  if (tem("aro", "retorno", "retornos")) candidatos.add("return");
  if (tem("lateral", "laterais", "contorno", "perfil")) candidatos.add(opcoes.ehPerfil ? "profile" : "return");
  if (tem("fundo", "base", "costas", "verso", "back")) candidatos.add("back");
  if (tem("iluminacao", "led", "leds", "modulo", "fonte")) candidatos.add("led");
  if (tem("fixacao", "fixador", "fixadores", "solda")) candidatos.add("fixing");
  if (tem("pintura", "acabamento", "pu", "verniz")) candidatos.add("finish");
  if (tem("insumo", "insumos", "produtividade", "fabricacao", "mao", "obra", "embalagem")) candidatos.add("ignored");
  return candidatos.size === 1 ? [...candidatos][0] : null;
}

/** Papéis que representam peças físicas do corpo do letreiro (precisam de espessura cadastrada e de perfil visual). */
export const PAPEIS_ESTRUTURAIS: ReadonlyArray<CpqRenderRole> = ["face", "return", "back", "profile"];

/** Pequena utilidade determinística usada pelo hash do spec e pelos testes: JSON com chaves ordenadas. */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, filho: unknown) => {
    if (filho && typeof filho === "object" && !Array.isArray(filho)) {
      return Object.fromEntries(Object.entries(filho as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return filho;
  });
}
