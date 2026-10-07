/**
 * Resolver da renderização 3D paramétrica do CPQ Letreiros Express.
 *
 * O navegador desenha, mas não decide sozinho material, papel nem profundidade: este módulo lê o orçamento (rascunho ou snapshot),
 * confere no banco as medidas cadastradas e os perfis visuais e devolve uma `CpqRender3dSpec` imutável, assinada por hash, com a
 * lista estruturada do que ainda impede a aprovação (`blockers`). Aparência não altera preço: nada aqui toca custo, nesting ou margem.
 *
 * A montagem do spec (`montarSpec`) é pura; o acesso a dados entra por `CpqRender3dFonte`, então os testes não precisam de banco.
 * O mesmo caminho serve a três usos: rascunho do passo 3D (fonte = banco ao vivo), verificação na emissão (idem) e link público
 * (fonte "fixada" no snapshot: perfis e espessuras exatamente como na aprovação).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  cpqRenderMaterialAssets,
  cpqRenderMaterialLinks,
  cpqRenderMaterialProfiles,
  estudioChapas,
  estudioKits,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
} from "../../drizzle/schema";
import {
  CPQ_RENDER3D_SPEC_VERSION,
  PAPEIS_ESTRUTURAIS,
  jsonCanonico,
  pbrParametersSchema,
  render3dConstructionSchema,
  render3dDraftSchema,
  sugerirRenderRole,
  type CpqRender3dApproval,
  type CpqRender3dBlocker,
  type CpqRender3dDraftInput,
  type CpqRender3dKitConstruction,
  type CpqRender3dPublicView,
  type CpqRender3dSnapshot,
  type CpqRender3dSpec,
  type CpqRenderConstruction,
  type CpqRenderRegion,
  type CpqRenderRole,
  type CpqRenderTextureAsset,
  type CpqResolvedRenderMaterial,
  type CpqPbrParameters,
  type CpqTextureColorSpace,
  type CpqTextureKind,
  type CpqMaterialFamily,
} from "../../shared/cpq-render3d";
import {
  aplicarOverridesPbr,
  familiaPresetSemVinculo,
  presetPbr,
  type CpqRenderLinkOverrides,
} from "../../shared/cpq-render3d-presets";
import { inspecionarSvgRender3d } from "../../shared/cpq-render3d-svg";
import { getDb } from "../db/db";
import { contornosFisicosDoSvg, verificarTicketAnaliseFactibilidade } from "./cpqFactibilidadeFabricacao";

export class CpqRender3dError extends Error {
  constructor(message: string, readonly codigo: "ticket_invalido" | "ticket_expirado" | "configuracao" | "entrada_invalida" | "desatualizado") {
    super(message);
    this.name = "CpqRender3dError";
  }
}

/* ------------------------------------------------------------- fonte de dados */

/** Aparência global da matéria-prima (Administração > Produtos > Matérias-primas, migration 0094). Foto de textura é só referência. */
export interface AparenciaCadastradaMateria {
  modo: "nao_informada" | "cor" | "textura";
  corHex: string | null;
  corDescricao: string | null;
  texturaDescricao: string | null;
}

export interface DadosMateriaRender {
  id: number;
  usaChapa: boolean;
  usaBobina: boolean;
  usaPerfil: boolean;
  /** Existe formato ativo em `estudio_chapas` (é chapa/bobina de verdade para o nesting). */
  temFormatoChapa: boolean;
  espessuraMm: number | null;
  perfilAlturaMm: number | null;
  perfilLarguraMm: number | null;
  /** Ausente na fonte "fixada" (link público): lá a cor já vem gravada em `overrides` do snapshot. */
  aparencia?: AparenciaCadastradaMateria;
}

export interface PerfilVisualResolvido {
  id: number;
  versao: number;
  nome: string;
  familia: CpqMaterialFamily;
  /** Calibrado contra amostra física por um gestor. Falso = aparência aproximada (vira aviso, não bloqueio). */
  calibrado: boolean;
  pbr: CpqPbrParameters;
  assets: CpqRenderTextureAsset[];
}

export interface VinculoVisualResolvido {
  perfil: PerfilVisualResolvido;
  overrides: CpqRenderLinkOverrides | null;
}

export interface CpqRender3dFonte {
  /** Construção 3D cadastrada no kit do produto/modelo (já validada), ou null. */
  construcaoDoKit(produtoId: number | null, modeloId: number | null): Promise<CpqRender3dKitConstruction | null>;
  materias(ids: number[]): Promise<Map<number, DadosMateriaRender>>;
  /** Perfil visual de cada matéria-prima para um papel. A fonte ao vivo usa o vínculo atual; a "fixada" usa o do snapshot. */
  vinculos(pedidos: Array<{ materiaPrimaId: number; role: CpqRenderRole }>): Promise<Map<string, VinculoVisualResolvido>>;
  /** Fonte "fixada" (link público): não valida cadastro nem papéis, só reconstrói o que foi aprovado. */
  readonly fixada?: boolean;
}

export const chaveVinculo = (materiaPrimaId: number, role: CpqRenderRole) => `${materiaPrimaId}:${role}`;

const HEX_COR = /^#[\da-f]{6}$/i;

/**
 * Cor efetiva do material: override explícito do vínculo > cor cadastrada na matéria-prima > cor do perfil visual. A cor cadastrada
 * vira um `colorHex` em `overrides` (e por isso entra no hash, no snapshot e no link público), mas só quando o perfil não tem mapa
 * de cor próprio (a foto/mapa já traz a cor; tingir por cima a distorceria).
 */
export function overridesComAparencia(
  overrides: CpqRenderLinkOverrides | null,
  perfil: Pick<PerfilVisualResolvido, "assets">,
  aparencia: AparenciaCadastradaMateria | undefined,
): CpqRenderLinkOverrides | null {
  if (overrides?.colorHex) return overrides;
  if (aparencia?.modo !== "cor" || !aparencia.corHex || !HEX_COR.test(aparencia.corHex)) return overrides;
  if (perfil.assets.some(asset => asset.kind === "baseColor")) return overrides;
  return { ...overrides, colorHex: aparencia.corHex.toLowerCase() };
}

/** Aviso (nunca bloqueio) quando a aparência cadastrada não define a cor do desenho. */
function avisoDeAparencia(nome: string, aparencia: AparenciaCadastradaMateria | undefined, overrides: CpqRenderLinkOverrides | null): string | null {
  if (overrides?.colorHex || !aparencia) return null;
  if (aparencia.modo === "nao_informada") return `"${nome}" não tem cor/textura cadastrada na matéria-prima: o 3D usa a cor do perfil visual.`;
  if (aparencia.modo === "cor") return `"${nome}" tem só a descrição da cor${aparencia.corDescricao ? ` ("${aparencia.corDescricao}")` : ""}, sem código HEX: o 3D usa a cor do perfil visual.`;
  return `"${nome}" tem uma foto de textura de referência, mas ela não vira mapa PBR: o 3D usa o perfil visual.`;
}

/* -------------------------------------------------------------------- hash */

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export type CpqRender3dSpecSemAssinatura = Omit<CpqRender3dSpec, "specHash" | "ticket">;

/**
 * Hash canônico do que é DESENHADO: geometria (via `vectorHash`), medidas, construção, regiões, materiais resolvidos (perfil, versão,
 * PBR, espessura, mapas) e papéis. Avisos e pendências ficam de fora de propósito: são derivados e não mudam a aparência.
 */
export function hashCpqRender3dSpec(spec: CpqRender3dSpecSemAssinatura): string {
  const { svg: _svg, warnings: _warnings, blockers: _blockers, ...conteudo } = spec;
  return sha256(jsonCanonico(conteudo));
}

/* ------------------------------------------------------------------ tickets */

type ClaimsTicket = {
  kind: "render3d-spec" | "render3d-approval";
  sourceId: string;
  specHash: string;
  vectorHash?: string;
  userId: string;
  userName?: string;
  userRole?: string;
  approvedAt?: string;
  iat: number;
  exp: number;
};
export type CpqRender3dTicketClaims = ClaimsTicket;

const TTL_TICKET_SPEC_MS = 2 * 60 * 60 * 1000;
/** Mesma validade da aprovação de preço (7 dias). */
const TTL_TICKET_APROVACAO_MS = 7 * 24 * 60 * 60 * 1000;

function segredo(): string {
  const valor = process.env.JWT_SECRET;
  if (!valor || valor.length < 32)
    throw new CpqRender3dError("JWT_SECRET precisa ter pelo menos 32 caracteres para assinar o 3D.", "configuracao");
  return valor;
}

function assinar(claims: ClaimsTicket): string {
  const codificado = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const assinatura = createHmac("sha256", segredo()).update(codificado).digest("base64url");
  return `${codificado}.${assinatura}`;
}

export function emitirTicketRender3d(entrada: {
  kind: ClaimsTicket["kind"];
  sourceId: string;
  specHash: string;
  vectorHash?: string;
  user: { id: string; name: string; role: string };
  approvedAt?: string;
  agora?: number;
}): string {
  const agora = entrada.agora ?? Date.now();
  return assinar({
    kind: entrada.kind,
    sourceId: entrada.sourceId,
    specHash: entrada.specHash,
    ...(entrada.vectorHash ? { vectorHash: entrada.vectorHash } : {}),
    userId: entrada.user.id,
    userName: entrada.user.name,
    userRole: entrada.user.role,
    ...(entrada.approvedAt ? { approvedAt: entrada.approvedAt } : {}),
    iat: agora,
    exp: agora + (entrada.kind === "render3d-approval" ? TTL_TICKET_APROVACAO_MS : TTL_TICKET_SPEC_MS),
  });
}

/** Confere assinatura, validade, orçamento e hash. Lança `CpqRender3dError` (ticket errado, de outro orçamento/spec ou expirado). */
export function verifyCpqRender3dTicket(
  ticket: string,
  sourceId: string,
  specHash: string,
  kind?: ClaimsTicket["kind"],
  agora = Date.now(),
): CpqRender3dTicketClaims {
  const [codificado, assinaturaRecebida, extra] = String(ticket ?? "").split(".");
  if (!codificado || !assinaturaRecebida || extra) throw new CpqRender3dError("O ticket do 3D é inválido.", "ticket_invalido");
  const esperada = createHmac("sha256", segredo()).update(codificado).digest();
  let recebida: Buffer;
  try {
    recebida = Buffer.from(assinaturaRecebida, "base64url");
  } catch {
    throw new CpqRender3dError("O ticket do 3D é inválido.", "ticket_invalido");
  }
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada))
    throw new CpqRender3dError("O ticket do 3D não corresponde à assinatura do servidor.", "ticket_invalido");
  let claims: ClaimsTicket;
  try {
    claims = JSON.parse(Buffer.from(codificado, "base64url").toString("utf8")) as ClaimsTicket;
  } catch {
    throw new CpqRender3dError("O ticket do 3D é inválido.", "ticket_invalido");
  }
  if (claims.kind !== "render3d-spec" && claims.kind !== "render3d-approval")
    throw new CpqRender3dError("O ticket não é de uma visualização 3D.", "ticket_invalido");
  if (kind && claims.kind !== kind) throw new CpqRender3dError("O ticket do 3D é de outro tipo.", "ticket_invalido");
  if (claims.sourceId !== sourceId || claims.specHash !== specHash)
    throw new CpqRender3dError("O ticket do 3D pertence a outro orçamento ou a outra versão do desenho.", "ticket_invalido");
  if (!(claims.exp > agora)) throw new CpqRender3dError("O ticket do 3D expirou. Gere e aprove a visualização de novo.", "ticket_expirado");
  return claims;
}

/* ------------------------------------------------------------- montagem pura */

type Linha = {
  materiaPrimaId: number;
  nome: string;
  unidade: string;
  quantidade: number;
  /** Papel confirmado (gravado no kit/orçamento); `null` = só existe sugestão. */
  roleDeclarado: CpqRenderRole | null;
  roleSugerido: CpqRenderRole | null;
  papel: string | null;
};

const UNIDADES_CONTAVEIS = new Set(["un", "und", "unid", "unidade", "unidades", "pc", "pcs", "pca", "peca", "pecas", "modulo", "modulos", "kit"]);

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function unidadeContavel(unidade: string): boolean {
  return UNIDADES_CONTAVEIS.has(normalizar(unidade).replace(/[^a-z]/g, ""));
}

const TOLERANCIA_PROPORCAO = 0.03;
const TOLERANCIA_PERFIL_MM = 1;

function bloqueio(code: string, message: string, field: string | null = null, mubisysMateriaPrimaId: number | null = null): CpqRender3dBlocker {
  return { code, message, field, mubisysMateriaPrimaId };
}

/** Caixa envolvente dos contornos do SVG (em unidades do viewBox), em cache por hash: o spec é pedido a cada visita ao passo 3D. */
const cacheCaixaSvg = new Map<string, { largura: number; altura: number } | { erro: string }>();

function caixaDoSvg(svg: string, hash: string): { largura: number; altura: number } | { erro: string } {
  const anterior = cacheCaixaSvg.get(hash);
  if (anterior) return anterior;
  const viewBox = svg.match(/<svg\b[^>]*\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  let resultado: { largura: number; altura: number } | { erro: string };
  if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0)
    resultado = { erro: "O SVG não tem um viewBox válido para conferir a proporção." };
  else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    try {
      for (const poligono of contornosFisicosDoSvg(svg, viewBox[2], viewBox[3]))
        for (const anel of poligono) for (const [x, y] of anel) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      resultado = maxX - minX > 0 && maxY - minY > 0 ? { largura: maxX - minX, altura: maxY - minY } : { erro: "O SVG não tem geometria visível." };
    } catch (erro) {
      resultado = { erro: erro instanceof Error ? erro.message : "Não foi possível ler a geometria do SVG." };
    }
  }
  if (cacheCaixaSvg.size >= 40) cacheCaixaSvg.delete(cacheCaixaSvg.keys().next().value as string);
  cacheCaixaSvg.set(hash, resultado);
  return resultado;
}

/** Proporção do desenho (caixa envolvente dos contornos) contra as medidas físicas informadas. */
function conferirProporcao(svg: string, hash: string, larguraMm: number, alturaMm: number): { ok: boolean; mensagem?: string } {
  const caixa = caixaDoSvg(svg, hash);
  if ("erro" in caixa) return { ok: false, mensagem: caixa.erro };
  const larguraSvg = caixa.largura, alturaSvg = caixa.altura;
  const proporcaoSvg = larguraSvg / alturaSvg, proporcaoFisica = larguraMm / alturaMm;
  const diferenca = Math.abs(proporcaoSvg - proporcaoFisica) / proporcaoFisica;
  if (diferenca > TOLERANCIA_PROPORCAO)
    return {
      ok: false,
      mensagem: `A proporção do desenho (${proporcaoSvg.toFixed(3)}) não bate com as medidas físicas (${proporcaoFisica.toFixed(3)}); diferença de ${(diferenca * 100).toFixed(1)}%.`,
    };
  return { ok: true };
}

export interface EntradaMontagem {
  sourceId: string;
  draft: CpqRender3dDraftInput;
  construcaoKit: CpqRender3dKitConstruction | null;
  fonte: CpqRender3dFonte;
}

/** Monta o spec (sem assinatura) a partir do rascunho e da fonte de dados. */
export async function montarSpec(entrada: EntradaMontagem): Promise<CpqRender3dSpecSemAssinatura> {
  const { draft, fonte } = entrada;
  const fixada = fonte.fixada === true;
  const blockers: CpqRender3dBlocker[] = [];
  const warnings: string[] = [];

  /* --- desenho --- */
  const svg = draft.nestingSvg ?? "";
  const largura = draft.larguraNestingMm ?? 0;
  const altura = draft.alturaNestingMm ?? 0;
  const inspecao = inspecionarSvgRender3d(svg);
  if (!draft.nestingSvg) blockers.push(bloqueio("svg_ausente", "O SVG vetorial aprovado é obrigatório para o 3D.", "nestingSvg"));
  else if (!inspecao.ok) for (const motivo of inspecao.motivos) blockers.push(bloqueio("svg_invalido", motivo, "nestingSvg"));
  if (!(largura > 0 && altura > 0)) blockers.push(bloqueio("medidas_ausentes", "As medidas físicas do letreiro (largura e altura) estão ausentes.", "larguraNestingMm"));
  const vectorHash = sha256(svg);

  if (!fixada && draft.nestingSvg && inspecao.ok) {
    if (!draft.factibilidade) {
      blockers.push(bloqueio("factibilidade_ausente", "Calcule e aprove a factibilidade (nesting) antes do 3D: ela amarra o desenho aprovado.", "factibilidade"));
    } else {
      try {
        const analise = verificarTicketAnaliseFactibilidade(draft.factibilidade.ticketAnalise, entrada.sourceId, draft.factibilidade.resultadoHash);
        if (analise.hashSvgEntrada !== vectorHash)
          blockers.push(bloqueio("svg_divergente", "O desenho do 3D não é o mesmo que foi aprovado na factibilidade. Refaça o nesting.", "nestingSvg"));
      } catch (erro) {
        blockers.push(bloqueio("factibilidade_invalida", erro instanceof Error ? erro.message : "A factibilidade não pôde ser conferida.", "factibilidade"));
      }
    }
    if (largura > 0 && altura > 0) {
      const proporcao = conferirProporcao(svg, vectorHash, largura, altura);
      if (!proporcao.ok) blockers.push(bloqueio("proporcao_incompativel", proporcao.mensagem ?? "Proporção incompatível.", "larguraNestingMm"));
    }
  }

  /* --- composição --- */
  const idsMaterias = [...new Set(draft.materiais.flatMap(linha => (linha.mubisysMateriaPrimaId ? [linha.mubisysMateriaPrimaId] : [])))];
  const materias = await fonte.materias(idsMaterias);

  const linhas: Linha[] = [];
  for (const linha of draft.materiais) {
    if (!linha.mubisysMateriaPrimaId || !(linha.quantidade > 0)) continue;
    const dados = materias.get(linha.mubisysMateriaPrimaId);
    linhas.push({
      materiaPrimaId: linha.mubisysMateriaPrimaId,
      nome: linha.nome,
      unidade: linha.unidade,
      quantidade: linha.quantidade,
      roleDeclarado: linha.renderRole ?? null,
      roleSugerido: sugerirRenderRole(linha.papel, { ehPerfil: dados?.usaPerfil === true }),
      papel: linha.papel ?? null,
    });
  }

  // Papel efetivo: o confirmado; sem confirmação, a sugestão serve só ao preview (e a linha física vira pendência).
  type LinhaPapel = Linha & { role: CpqRenderRole; confirmado: boolean };
  const comPapel: LinhaPapel[] = [];
  for (const linha of linhas) {
    const dados = materias.get(linha.materiaPrimaId);
    const fisica = !!dados && (dados.temFormatoChapa || dados.usaChapa || dados.usaBobina || dados.usaPerfil);
    const role = linha.roleDeclarado ?? linha.roleSugerido;
    if (!role) {
      if (fisica && !fixada)
        blockers.push(bloqueio("papel_ambiguo", `Defina o papel 3D de "${linha.nome}" (o texto do papel não permite saber o que ele é na montagem).`, "renderRole", linha.materiaPrimaId));
      continue;
    }
    if (!linha.roleDeclarado && fisica && !fixada)
      blockers.push({ ...bloqueio("papel_nao_confirmado", `Confirme o papel 3D de "${linha.nome}" (sugestão: ${role}).`, "renderRole", linha.materiaPrimaId), suggestion: role });
    // O que o cliente envia é conferido no banco: papel x tipo de material.
    if (!fixada && dados) {
      if (role === "profile" && !dados.usaPerfil)
        blockers.push(bloqueio("papel_incompativel", `"${linha.nome}" tem papel de perfil, mas não está cadastrado como perfil.`, "renderRole", linha.materiaPrimaId));
      if ((role === "face" || role === "back") && !(dados.temFormatoChapa || dados.usaChapa || dados.usaBobina))
        blockers.push(bloqueio("papel_incompativel", `"${linha.nome}" tem papel de ${role === "face" ? "face" : "fundo"}, mas não está cadastrado como chapa ou bobina.`, "renderRole", linha.materiaPrimaId));
    }
    comPapel.push({ ...linha, role, confirmado: !!linha.roleDeclarado });
  }

  /* --- regiões de cor da face --- */
  const faceLinhas = comPapel.filter(linha => linha.role === "face");
  const faceDeclarada = faceLinhas.find(linha => linha.confirmado) ?? faceLinhas[0] ?? null;
  const regioes: CpqRenderRegion[] = [];
  const idsFaceExtras = new Set<number>();
  const mapeamento = draft.mapeamentoCores;
  const pathCount = inspecao.pathCount;
  const regioesUsaveis = mapeamento?.aprovado === true || fixada ? mapeamento?.regioes ?? [] : [];
  const indicesCobertos = new Set<number>();
  let regioesMapeiam = regioesUsaveis.length > 0;
  if (regioesMapeiam && pathCount > 0 && regioesUsaveis.some(regiao => regiao.pathIndexes.some(indice => indice >= pathCount))) {
    regioesMapeiam = false;
    warnings.push("O desenho de corte usa menos formas que a arte colorida: as cores aprovadas não podem ser distribuídas por forma. A face usa a cor da primeira região aprovada.");
  }
  if (mapeamento && !mapeamento.aprovado && !fixada)
    blockers.push(bloqueio("cores_nao_aprovadas", "Aprove o mapeamento de cores antes do 3D.", "mapeamentoCores"));
  if (regioesMapeiam) {
    for (const regiao of regioesUsaveis) {
      // `pendente` só nasce da decisão "o projeto não precisa de adesivo" (desconsiderarAdesivoDaSugestao): a região deixa de pedir
      // adesivo/acrílico-base e a face segue a composição do kit. Com o mapeamento já aprovado isso não é pendência, é a face do kit.
      const semAdesivo = regiao.tipoSugestao === "pendente";
      if (semAdesivo) warnings.push(`A região de cor ${regiao.regionKey} está sem adesivo (decisão do vendedor): o 3D usa a face da composição.`);
      const materialId = semAdesivo
        ? faceDeclarada?.materiaPrimaId ?? null
        : regiao.tipoSugestao === "chapa"
          ? regiao.chapaMateriaPrimaId
          : regiao.requerChapaBase ? regiao.chapaBaseMateriaPrimaId : faceDeclarada?.materiaPrimaId ?? null;
      if (materialId == null)
        blockers.push(bloqueio("regiao_sem_material", `A região de cor ${regiao.regionKey} não tem chapa/base definida para a face.`, "mapeamentoCores"));
      else idsFaceExtras.add(materialId);
      const cor = regiao.corHex ?? regiao.coresGradiente[0] ?? null;
      if (!regiao.corHex && cor) warnings.push(`A região ${regiao.regionKey} é um degradê/arte complexa: o 3D usa uma cor representativa (${cor}).`);
      regiao.pathIndexes.forEach(indice => indicesCobertos.add(indice));
      regioes.push({ regionKey: regiao.regionKey, pathIndexes: [...regiao.pathIndexes].sort((a, b) => a - b), colorHex: cor?.toLowerCase() ?? null, materialId, profileId: null });
    }
    if (pathCount > 0 && indicesCobertos.size < pathCount)
      warnings.push(`${pathCount - indicesCobertos.size} forma(s) do desenho não pertencem a nenhuma região de cor; usam a face padrão.`);
  } else if (regioesUsaveis.length) {
    const primeira = regioesUsaveis.find(regiao => regiao.tipoSugestao !== "pendente");
    if (primeira) {
      const materialId = primeira.tipoSugestao === "chapa" ? primeira.chapaMateriaPrimaId : primeira.requerChapaBase ? primeira.chapaBaseMateriaPrimaId : faceDeclarada?.materiaPrimaId ?? null;
      if (materialId != null) idsFaceExtras.add(materialId);
      regioes.push({ regionKey: primeira.regionKey, pathIndexes: [], colorHex: (primeira.corHex ?? primeira.coresGradiente[0] ?? null)?.toLowerCase() ?? null, materialId, profileId: null });
    }
  }

  const defaultFaceMaterialId = regioesMapeiam
    ? (faceDeclarada?.materiaPrimaId ?? regioes.find(regiao => regiao.materialId != null)?.materialId ?? null)
    : (regioes[0]?.materialId ?? faceDeclarada?.materiaPrimaId ?? null);
  if (defaultFaceMaterialId != null) idsFaceExtras.add(defaultFaceMaterialId);
  if (!idsFaceExtras.size)
    blockers.push(bloqueio("sem_face", "A composição não tem material com papel de face.", "materiais"));

  /* --- construção cadastrada no kit --- */
  const construcaoKit = entrada.construcaoKit;
  if (!construcaoKit)
    blockers.push(bloqueio("construcao_ausente", "O kit deste produto não tem a construção 3D cadastrada (profundidade, afastamento, aba...). Cadastre em Administração > Produtos.", "render3dConstruction"));

  /* --- materiais resolvidos --- */
  const pedidos: Array<{ materiaPrimaId: number; role: CpqRenderRole }> = [];
  const nomePorId = new Map(linhas.map(linha => [linha.materiaPrimaId, linha.nome]));
  const visual = new Map<string, { materiaPrimaId: number; role: CpqRenderRole }>();
  const incluir = (materiaPrimaId: number, role: CpqRenderRole) => {
    const chave = chaveVinculo(materiaPrimaId, role);
    if (!visual.has(chave)) visual.set(chave, { materiaPrimaId, role });
  };
  for (const id of idsFaceExtras) incluir(id, "face");
  for (const linha of comPapel) if (["return", "back", "profile", "led", "fixing"].includes(linha.role)) incluir(linha.materiaPrimaId, linha.role);
  for (const item of visual.values()) pedidos.push(item);
  const idsFaltantes = [...new Set(pedidos.map(pedido => pedido.materiaPrimaId))].filter(id => !materias.has(id));
  if (idsFaltantes.length) {
    const extras = await fonte.materias(idsFaltantes);
    extras.forEach((valor, id) => materias.set(id, valor));
  }
  const vinculos = await fonte.vinculos(pedidos);

  const materiais: CpqResolvedRenderMaterial[] = [];
  for (const { materiaPrimaId, role } of visual.values()) {
    const dados = materias.get(materiaPrimaId);
    const nome = nomePorId.get(materiaPrimaId) ?? `Matéria-prima #${materiaPrimaId}`;
    const vinculo = vinculos.get(chaveVinculo(materiaPrimaId, role));
    const avisos: string[] = [];
    let espessura = dados?.espessuraMm ?? null;
    if (espessura != null && !(espessura > 0)) espessura = null;
    if (PAPEIS_ESTRUTURAIS.includes(role) && espessura == null && !fixada)
      blockers.push(bloqueio("espessura_ausente", `A espessura de "${nome}" não está cadastrada (Administração > Produtos > Matérias-primas).`, "espessuraMm", materiaPrimaId));
    if (vinculo) {
      const overrides = overridesComAparencia(vinculo.overrides, vinculo.perfil, dados?.aparencia);
      const pbr = aplicarOverridesPbr(vinculo.perfil.pbr, overrides);
      const avisoAparencia = !fixada && ["face", "return", "back", "profile"].includes(role) ? avisoDeAparencia(nome, dados?.aparencia, overrides) : null;
      if (avisoAparencia) warnings.push(avisoAparencia);
      const generico = vinculo.perfil.familia === "generic_dielectric";
      if (generico) avisos.push("O perfil visual é o genérico (estimado).");
      else if (!vinculo.perfil.calibrado) {
        avisos.push("Perfil visual ainda não calibrado contra a amostra física.");
        warnings.push(`"${nome}": o perfil visual "${vinculo.perfil.nome}" ainda não foi calibrado contra a amostra física (aparência aproximada).`);
      }
      if (!vinculo.perfil.assets.some(asset => asset.kind !== "reference") && ["stainless_brushed", "aluminum_profile"].includes(vinculo.perfil.familia))
        avisos.push("Perfil metálico sem mapas de textura: o veio/escovado não aparece.");
      materiais.push({
        mubisysMateriaPrimaId: materiaPrimaId,
        materialName: nome,
        role,
        profileId: vinculo.perfil.id,
        profileVersion: vinculo.perfil.versao,
        profileName: vinculo.perfil.nome,
        family: vinculo.perfil.familia,
        thicknessMm: espessura,
        pbr,
        assets: vinculo.perfil.assets,
        estimated: generico,
        warnings: avisos,
        overrides,
      });
      if (generico && !fixada && ![ "fixing"].includes(role))
        blockers.push(bloqueio("perfil_generico", `"${nome}" está ligado ao perfil genérico (estimado). Escolha um perfil calibrado.`, "profileId", materiaPrimaId));
    } else {
      const familia = familiaPresetSemVinculo(role);
      avisos.push("Sem perfil visual cadastrado: aparência estimada por um preset genérico.");
      materiais.push({
        mubisysMateriaPrimaId: materiaPrimaId,
        materialName: nome,
        role,
        profileId: 0,
        profileVersion: 0,
        profileName: "Preset estimado (sem perfil visual)",
        family: familia,
        thicknessMm: espessura,
        pbr: presetPbr(familia),
        assets: [],
        estimated: true,
        warnings: avisos,
      });
      if (!fixada && role !== "fixing")
        blockers.push(bloqueio("material_sem_vinculo", `"${nome}" não tem perfil visual (Administração > Materiais 3D). O preview é estimado e não pode ser aprovado.`, "profileId", materiaPrimaId));
      else if (role === "fixing") warnings.push(`"${nome}" (fixação) não tem perfil visual: desenhado com preset estimado.`);
    }
  }
  materiais.sort((a, b) => a.role.localeCompare(b.role) || a.mubisysMateriaPrimaId - b.mubisysMateriaPrimaId);
  for (const regiao of regioes) {
    const perfil = regiao.materialId == null ? null : materiais.find(material => material.role === "face" && material.mubisysMateriaPrimaId === regiao.materialId);
    regiao.profileId = perfil && perfil.profileId > 0 ? perfil.profileId : null;
  }

  /* --- espessuras e profundidade --- */
  const materiaisDoPapel = (role: CpqRenderRole) => materiais.filter(material => material.role === role);
  const espessuraDe = (role: CpqRenderRole) => Math.max(0, ...materiaisDoPapel(role).map(material => material.thicknessMm ?? 0));
  const temRetorno = materiaisDoPapel("return").length > 0 || materiaisDoPapel("profile").length > 0;
  const temFundo = materiaisDoPapel("back").length > 0;
  if (materiaisDoPapel("profile").length && materiaisDoPapel("return").length)
    warnings.push("A composição tem perfil lateral e material de retorno/aro: o 3D desenha o perfil como lateral e ainda não modela a faixa plana do aro.");
  if (!temRetorno && !fixada) warnings.push("A composição não tem material de lateral (retorno ou perfil): o 3D mostra só face e fundo.");
  if (!temFundo && !fixada) warnings.push("A composição não tem material de fundo: o 3D não desenha o fundo.");

  const perfis = comPapel.filter(linha => linha.role === "profile");
  for (const linha of perfis) {
    const alturaPerfil = materias.get(linha.materiaPrimaId)?.perfilAlturaMm;
    if (alturaPerfil && construcaoKit && Math.abs(alturaPerfil - construcaoKit.boxDepthMm) > TOLERANCIA_PERFIL_MM)
      warnings.push(`A profundidade do kit (${construcaoKit.boxDepthMm} mm) difere da altura cadastrada de "${linha.nome}" (${alturaPerfil} mm).`);
  }

  /* --- iluminação --- */
  const linhasLed = comPapel.filter(linha => linha.role === "led");
  const ledContavel = linhasLed.filter(linha => unidadeContavel(linha.unidade));
  const ledCount = ledContavel.length ? Math.round(ledContavel.reduce((total, linha) => total + linha.quantidade, 0)) : null;
  if (construcaoKit && construcaoKit.kind !== "non_illuminated" && !fixada) {
    if (!linhasLed.length)
      blockers.push(bloqueio("iluminacao_sem_led", "A construção é iluminada, mas a composição não tem material de LED (papel 3D \"LED\").", "materiais"));
    else if (ledCount == null && construcaoKit.ledPitchMm == null)
      blockers.push(bloqueio("led_passo_ausente", "Informe o passo entre LEDs no kit ou use um material de LED em unidades para a distribuição.", "ledPitchMm"));
    if (construcaoKit.ledModuleWidthMm == null || construcaoKit.ledModuleHeightMm == null)
      warnings.push("O tamanho do módulo LED não está cadastrado no kit: os módulos são desenhados com tamanho ilustrativo.");
  }
  if (construcaoKit?.kind === "non_illuminated" && linhasLed.length)
    warnings.push("O kit é sem iluminação, mas a composição tem LED: o 3D não ilumina nada.");

  const fixingTypes = draft.tiposFixacao.filter(tipo => tipo !== "sem_fixacao");

  const construction: CpqRenderConstruction = {
    kind: construcaoKit?.kind ?? "non_illuminated",
    boxDepthMm: construcaoKit?.boxDepthMm ?? 0,
    wallStandoffMm: construcaoKit?.wallStandoffMm ?? 0,
    faceLipMm: construcaoKit?.faceLipMm ?? 0,
    returnSheetThicknessMm: espessuraDe("profile") || espessuraDe("return"),
    backThicknessMm: espessuraDe("back"),
    faceThicknessMm: espessuraDe("face"),
    ledPitchMm: construcaoKit?.ledPitchMm ?? null,
    ledModuleWidthMm: construcaoKit?.ledModuleWidthMm ?? null,
    ledModuleHeightMm: construcaoKit?.ledModuleHeightMm ?? null,
    ledEdgeClearanceMm: construcaoKit?.ledEdgeClearanceMm ?? 0,
    ledCount,
    fixingTypes,
  };

  // Profundidade que não comporta face + fundo + retorno é pendência, não um desenho torto.
  if (construcaoKit && construction.faceThicknessMm + construction.backThicknessMm >= construction.boxDepthMm)
    blockers.push(bloqueio("profundidade_insuficiente", `A profundidade do kit (${construction.boxDepthMm} mm) não comporta as espessuras de face (${construction.faceThicknessMm} mm) e fundo (${construction.backThicknessMm} mm).`, "boxDepthMm"));

  return {
    version: CPQ_RENDER3D_SPEC_VERSION,
    sourceId: entrada.sourceId,
    vectorHash,
    svg,
    widthMm: largura,
    heightMm: altura,
    construction,
    regions: regioes,
    materials: materiais,
    defaultFaceMaterialId,
    warnings: [...new Set(warnings)],
    blockers,
  };
}

/* ---------------------------------------------------------------- API pública */

export async function resolveCpqRender3dSpec(entrada: {
  sourceId: string;
  snapshot: unknown;
  user: { id: string; name: string; role: string };
  fonte?: CpqRender3dFonte;
}): Promise<CpqRender3dSpec> {
  const parsed = render3dDraftSchema.safeParse(entrada.snapshot);
  if (!parsed.success) throw new CpqRender3dError("Os dados do orçamento para o 3D estão incompletos ou inválidos.", "entrada_invalida");
  const fonte = entrada.fonte ?? criarFonteBanco();
  const draft = parsed.data;
  const construcaoKit = await fonte.construcaoDoKit(draft.mubisysProdutoId, draft.mubisysModeloId);
  const spec = await montarSpec({ sourceId: entrada.sourceId, draft, construcaoKit, fonte });
  const specHash = hashCpqRender3dSpec(spec);
  return { ...spec, specHash, ticket: emitirTicketRender3d({ kind: "render3d-spec", sourceId: entrada.sourceId, specHash, vectorHash: spec.vectorHash, user: entrada.user }) };
}

/**
 * Spec de uma cotação JÁ emitida (link público): usa a fonte "fixada" no snapshot — perfis por id/versão, espessuras e construção
 * exatamente como foram aprovados — e não aplica nenhuma validação de cadastro (só reconstrói o que o vendedor aprovou).
 */
export async function resolverSpecPublico(snapshotCotacao: unknown, render3d: CpqRender3dSnapshot): Promise<CpqRender3dSpec> {
  const parsed = render3dDraftSchema.safeParse(snapshotCotacao);
  if (!parsed.success) throw new CpqRender3dError("O snapshot da cotação não permite montar o 3D.", "entrada_invalida");
  const draft = parsed.data;
  const linhaPorId = new Map(draft.materiais.flatMap(linha => (linha.mubisysMateriaPrimaId ? [[linha.mubisysMateriaPrimaId, linha] as const] : [])));
  const aprovados = new Set(render3d.materials.map(material => `${material.mubisysMateriaPrimaId}:${material.role}`));
  const materiais: CpqRender3dDraftInput["materiais"] = [
    ...render3d.materials.map(material => {
      const linha = linhaPorId.get(material.mubisysMateriaPrimaId);
      return {
        mubisysMateriaPrimaId: material.mubisysMateriaPrimaId,
        nome: linha?.nome ?? `Matéria-prima ${material.mubisysMateriaPrimaId}`,
        unidade: linha?.unidade ?? "",
        quantidade: linha?.quantidade || 1,
        papel: null,
        renderRole: material.role,
      };
    }),
    // LED e fixação sem perfil visual (estimados) não entram no snapshot do 3D, mas aparecem na composição com o papel confirmado.
    ...draft.materiais.filter(linha =>
      linha.mubisysMateriaPrimaId && linha.renderRole && ["led", "fixing"].includes(linha.renderRole)
      && !aprovados.has(`${linha.mubisysMateriaPrimaId}:${linha.renderRole}`)),
  ];
  // O orçamento de origem faz parte do hash aprovado: o snapshot guarda o mesmo sourceId.
  const sourceId = typeof (snapshotCotacao as { sourceId?: unknown })?.sourceId === "string" ? (snapshotCotacao as { sourceId: string }).sourceId : "";
  const spec = await montarSpec({
    sourceId,
    draft: { ...draft, materiais },
    construcaoKit: render3d.construction,
    fonte: criarFonteFixada(render3d),
  });
  const specHash = hashCpqRender3dSpec(spec);
  if (specHash !== render3d.specHash) console.warn(`[CpqRender3d] O spec reconstruído do link público difere do aprovado (${render3d.specHash.slice(0, 12)} ≠ ${specHash.slice(0, 12)}).`);
  return { ...spec, specHash, ticket: "" };
}

/** Valores que o snapshot guarda para cada material (e com os quais a verificação na emissão compara). */
export function resumoMateriaisParaSnapshot(spec: CpqRender3dSpec): CpqRender3dSnapshot["materials"] {
  return spec.materials
    .filter(material => material.profileId > 0)
    .map(material => ({
      mubisysMateriaPrimaId: material.mubisysMateriaPrimaId,
      role: material.role,
      profileId: material.profileId,
      profileVersion: material.profileVersion,
      thicknessMm: material.thicknessMm,
      ...(material.overrides ? { overrides: material.overrides } : {}),
    }));
}

/**
 * Verificação na emissão: o snapshot traz a aprovação 3D e o servidor refaz o spec a partir dos MESMOS dados do orçamento. Qualquer
 * mudança relevante (vetor, medidas, composição, papel, cor, profundidade, perfil ou versão) muda o `specHash` e derruba a emissão.
 */
export async function verificarRender3dNaEmissao(entrada: {
  sourceId: string;
  snapshot: unknown;
  render3d: CpqRender3dSnapshot;
  user: { id: string; name: string; role: string };
  fonte?: CpqRender3dFonte;
}): Promise<{ specHash: string; vectorHash: string }> {
  const { render3d } = entrada;
  let claims: CpqRender3dTicketClaims;
  try {
    claims = verifyCpqRender3dTicket(render3d.approval.ticket, entrada.sourceId, render3d.specHash, "render3d-approval");
  } catch (erro) {
    throw erro instanceof CpqRender3dError ? erro : new CpqRender3dError("A aprovação do 3D não é válida.", "ticket_invalido");
  }
  if (claims.vectorHash !== render3d.vectorHash)
    throw new CpqRender3dError("O desenho aprovado no 3D não é o do orçamento.", "ticket_invalido");
  if (claims.userId !== render3d.approval.approvedBy.id || claims.approvedAt !== render3d.approval.approvedAt)
    throw new CpqRender3dError("Os dados da aprovação do 3D foram alterados.", "ticket_invalido");

  const spec = await resolveCpqRender3dSpec({ sourceId: entrada.sourceId, snapshot: entrada.snapshot, user: entrada.user, fonte: entrada.fonte });
  if (spec.blockers.length)
    throw new CpqRender3dError(`A visualização 3D tem pendências: ${spec.blockers.map(item => item.message).join(" ")}`, "desatualizado");
  if (spec.specHash !== render3d.specHash || spec.vectorHash !== render3d.vectorHash)
    throw new CpqRender3dError("O orçamento mudou depois da aprovação do 3D (desenho, medidas, composição, materiais ou profundidade). Aprove a visualização 3D de novo.", "desatualizado");

  const esperado = jsonCanonico(resumoMateriaisParaSnapshot(spec));
  const recebido = jsonCanonico([...render3d.materials].sort((a, b) => a.role.localeCompare(b.role) || a.mubisysMateriaPrimaId - b.mubisysMateriaPrimaId));
  if (esperado !== recebido)
    throw new CpqRender3dError("Os perfis visuais do snapshot não correspondem aos usados na aprovação.", "desatualizado");
  const construcaoEsperada = jsonCanonico(render3dConstructionSchema.parse(render3d.construction));
  const construcaoKit = jsonCanonico({
    kind: spec.construction.kind,
    boxDepthMm: spec.construction.boxDepthMm,
    wallStandoffMm: spec.construction.wallStandoffMm,
    faceLipMm: spec.construction.faceLipMm,
    ledPitchMm: spec.construction.ledPitchMm,
    ledEdgeClearanceMm: spec.construction.ledEdgeClearanceMm,
    ...(spec.construction.ledModuleWidthMm != null ? { ledModuleWidthMm: spec.construction.ledModuleWidthMm } : {}),
    ...(spec.construction.ledModuleHeightMm != null ? { ledModuleHeightMm: spec.construction.ledModuleHeightMm } : {}),
  });
  if (construcaoEsperada !== construcaoKit)
    throw new CpqRender3dError("A construção 3D do snapshot não corresponde à cadastrada no kit.", "desatualizado");
  return { specHash: spec.specHash, vectorHash: spec.vectorHash };
}

/** Bloco `render3d` que o servidor grava a partir de uma aprovação (o navegador só envia o ticket e as URLs dos previews). */
export function montarBlocoSnapshot(spec: CpqRender3dSpec, approval: CpqRender3dApproval): CpqRender3dSnapshot {
  const { construction } = spec;
  return {
    version: CPQ_RENDER3D_SPEC_VERSION,
    specHash: spec.specHash,
    vectorHash: spec.vectorHash,
    construction: {
      kind: construction.kind,
      boxDepthMm: construction.boxDepthMm,
      wallStandoffMm: construction.wallStandoffMm,
      faceLipMm: construction.faceLipMm,
      ledPitchMm: construction.ledPitchMm,
      ledEdgeClearanceMm: construction.ledEdgeClearanceMm,
      ...(construction.ledModuleWidthMm != null ? { ledModuleWidthMm: construction.ledModuleWidthMm } : {}),
      ...(construction.ledModuleHeightMm != null ? { ledModuleHeightMm: construction.ledModuleHeightMm } : {}),
    },
    materials: resumoMateriaisParaSnapshot(spec),
    approval: {
      ticket: approval.ticket,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      previewDayUrl: approval.previewDayUrl,
      previewNightUrl: approval.previewNightUrl,
      previewExplodedUrl: approval.previewExplodedUrl,
    },
  };
}

/** Visão pública: só o necessário para desenhar (sem custos, margem, fórmulas, recibos, notas nem nomes de perfil/fornecedor). */
export function visaoPublicaDoSpec(spec: CpqRender3dSpec, previews: { dia: string | null; noite: string | null; explodido: string | null }): CpqRender3dPublicView {
  return {
    specHash: spec.specHash,
    svg: spec.svg,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    construction: spec.construction,
    regions: spec.regions,
    defaultFaceMaterialId: spec.defaultFaceMaterialId,
    materials: spec.materials.map(material => ({
      mubisysMateriaPrimaId: material.mubisysMateriaPrimaId,
      materialName: nomeComercial(material.role),
      role: material.role,
      profileId: material.profileId,
      profileVersion: material.profileVersion,
      family: material.family,
      thicknessMm: material.thicknessMm,
      pbr: material.pbr,
      // Foto de referência é para comparação humana interna: não vai ao cliente.
      assets: material.assets.filter(asset => asset.kind !== "reference").map(asset => ({ ...asset, sourceNote: null })),
      estimated: material.estimated,
    })),
    previewDayUrl: previews.dia,
    previewNightUrl: previews.noite,
    previewExplodedUrl: previews.explodido,
  };
}

const NOMES_COMERCIAIS: Record<CpqRenderRole, string> = {
  face: "Face",
  return: "Lateral",
  back: "Fundo",
  profile: "Perfil lateral",
  led: "Iluminação",
  fixing: "Fixação",
  finish: "Acabamento",
  ignored: "",
};
function nomeComercial(role: CpqRenderRole): string {
  return NOMES_COMERCIAIS[role];
}

/* --------------------------------------------------------------- fontes de dados */

function numero(valor: unknown): number | null {
  if (valor == null) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

async function carregarAssets(perfilIds: number[]): Promise<Map<number, CpqRenderTextureAsset[]>> {
  const mapa = new Map<number, CpqRenderTextureAsset[]>();
  if (!perfilIds.length) return mapa;
  const db = await getDb();
  if (!db) return mapa;
  const linhas = await db.select().from(cpqRenderMaterialAssets).where(inArray(cpqRenderMaterialAssets.profileId, perfilIds));
  for (const linha of linhas.sort((a, b) => a.id - b.id)) {
    const lista = mapa.get(linha.profileId) ?? [];
    lista.push({
      id: linha.id,
      kind: linha.kind as CpqTextureKind,
      url: linha.url,
      storageKey: linha.storageKey,
      mimeType: linha.mimeType,
      sha256: linha.sha256,
      widthPx: linha.widthPx,
      heightPx: linha.heightPx,
      tileWidthMm: numero(linha.tileWidthMm),
      tileHeightMm: numero(linha.tileHeightMm),
      colorSpace: linha.colorSpace as CpqTextureColorSpace,
      sourceNote: linha.sourceNote,
      calibrated: linha.calibrated,
    });
    mapa.set(linha.profileId, lista);
  }
  return mapa;
}

export function lerPbrPersistido(valor: unknown): CpqPbrParameters | null {
  const parsed = pbrParametersSchema.safeParse(valor);
  return parsed.success ? (parsed.data as CpqPbrParameters) : null;
}

type LinhaPerfil = typeof cpqRenderMaterialProfiles.$inferSelect;

async function perfisResolvidos(linhas: LinhaPerfil[]): Promise<Map<number, PerfilVisualResolvido>> {
  const assets = await carregarAssets(linhas.map(linha => linha.id));
  const mapa = new Map<number, PerfilVisualResolvido>();
  for (const linha of linhas) {
    const pbr = lerPbrPersistido(linha.pbrJson);
    if (!pbr) continue; // perfil corrompido: tratado como sem vínculo (nunca desenha valor inventado)
    mapa.set(linha.id, {
      id: linha.id,
      versao: linha.versao,
      nome: linha.nome,
      familia: linha.familia as CpqMaterialFamily,
      calibrado: linha.calibrado,
      pbr,
      assets: assets.get(linha.id) ?? [],
    });
  }
  return mapa;
}

function overridesDoBanco(valor: unknown): CpqRenderLinkOverrides | null {
  if (!valor || typeof valor !== "object") return null;
  const bruto = valor as Record<string, unknown>;
  const overrides: CpqRenderLinkOverrides = {};
  if (typeof bruto.colorHex === "string" && /^#[\da-f]{6}$/i.test(bruto.colorHex)) overrides.colorHex = bruto.colorHex;
  if (typeof bruto.anisotropyRotationRad === "number" && Number.isFinite(bruto.anisotropyRotationRad)) overrides.anisotropyRotationRad = bruto.anisotropyRotationRad;
  return Object.keys(overrides).length ? overrides : null;
}

export function criarFonteBanco(): CpqRender3dFonte {
  return {
    async construcaoDoKit(produtoId, modeloId) {
      if (!produtoId || !modeloId) return null;
      const db = await getDb();
      if (!db) return null;
      const [kit] = await db.select({ dadosJson: estudioKits.dadosJson }).from(estudioKits).where(eq(estudioKits.chave, `${produtoId}_${modeloId}`)).limit(1);
      const parsed = render3dConstructionSchema.safeParse(kit?.dadosJson?.render3dConstruction);
      return parsed.success ? parsed.data : null;
    },
    async materias(ids) {
      const mapa = new Map<number, DadosMateriaRender>();
      if (!ids.length) return mapa;
      const db = await getDb();
      if (!db) return mapa;
      const [cadastros, formatos] = await Promise.all([
        db.select({ cadastro: materiaPrimaCadastros, categoria: materiaPrimaCategorias })
          .from(materiaPrimaCadastros)
          .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCadastros.categoriaId, materiaPrimaCategorias.id))
          .where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, ids)),
        db.select({ materiaPrimaId: estudioChapas.mubisysMateriaPrimaId }).from(estudioChapas)
          .where(and(inArray(estudioChapas.mubisysMateriaPrimaId, ids), eq(estudioChapas.ativo, true))),
      ]);
      const comFormato = new Set(formatos.map(linha => linha.materiaPrimaId));
      for (const id of ids)
        mapa.set(id, { id, usaChapa: false, usaBobina: false, usaPerfil: false, temFormatoChapa: comFormato.has(id), espessuraMm: null, perfilAlturaMm: null, perfilLarguraMm: null });
      for (const { cadastro, categoria } of cadastros)
        mapa.set(cadastro.mubisysMateriaPrimaId, {
          id: cadastro.mubisysMateriaPrimaId,
          usaChapa: categoria?.usaDadosChapa === true,
          usaBobina: categoria?.usaDadosBobina === true,
          usaPerfil: categoria?.usaDadosPerfil === true,
          temFormatoChapa: comFormato.has(cadastro.mubisysMateriaPrimaId),
          espessuraMm: numero(cadastro.espessuraMm),
          perfilAlturaMm: numero(cadastro.perfilAlturaMm),
          perfilLarguraMm: numero(cadastro.perfilLarguraMm),
          aparencia: {
            modo: cadastro.aparenciaModo === "cor" || cadastro.aparenciaModo === "textura" ? cadastro.aparenciaModo : "nao_informada",
            corHex: cadastro.aparenciaCorHex ?? null,
            corDescricao: cadastro.aparenciaCorDescricao ?? null,
            texturaDescricao: cadastro.texturaDescricao ?? null,
          },
        });
      return mapa;
    },
    async vinculos(pedidos) {
      const resultado = new Map<string, VinculoVisualResolvido>();
      const ids = [...new Set(pedidos.map(pedido => pedido.materiaPrimaId))];
      if (!ids.length) return resultado;
      const db = await getDb();
      if (!db) return resultado;
      const vinculos = await db.select().from(cpqRenderMaterialLinks).where(inArray(cpqRenderMaterialLinks.mubisysMateriaPrimaId, ids));
      if (!vinculos.length) return resultado;
      const perfisBanco = await db.select().from(cpqRenderMaterialProfiles).where(inArray(cpqRenderMaterialProfiles.id, [...new Set(vinculos.map(vinculo => vinculo.profileId))]));
      const perfis = await perfisResolvidos(perfisBanco);
      for (const vinculo of vinculos) {
        const perfil = perfis.get(vinculo.profileId);
        if (!perfil) continue;
        for (const pedido of pedidos)
          if (pedido.materiaPrimaId === vinculo.mubisysMateriaPrimaId)
            resultado.set(chaveVinculo(pedido.materiaPrimaId, pedido.role), { perfil, overrides: overridesDoBanco(vinculo.overridesJson) });
      }
      return resultado;
    },
  };
}

/**
 * Fonte "fixada" para o link público: usa os perfis (por id, imutáveis) e as espessuras exatamente como foram aprovados, em vez
 * do vínculo atual — assim uma nova versão do perfil nunca altera uma cotação já emitida.
 */
export function criarFonteFixada(snapshot: CpqRender3dSnapshot): CpqRender3dFonte {
  return {
    fixada: true,
    async construcaoDoKit() {
      return snapshot.construction;
    },
    async materias(ids) {
      const mapa = new Map<number, DadosMateriaRender>();
      for (const id of ids) {
        const doSnapshot = snapshot.materials.find(material => material.mubisysMateriaPrimaId === id);
        mapa.set(id, { id, usaChapa: true, usaBobina: false, usaPerfil: false, temFormatoChapa: true, espessuraMm: doSnapshot?.thicknessMm ?? null, perfilAlturaMm: null, perfilLarguraMm: null });
      }
      return mapa;
    },
    async vinculos(pedidos) {
      const resultado = new Map<string, VinculoVisualResolvido>();
      const aprovados = pedidos.flatMap(pedido => {
        const material = snapshot.materials.find(item => item.mubisysMateriaPrimaId === pedido.materiaPrimaId && item.role === pedido.role);
        return material && material.profileId > 0 ? [{ pedido, material }] : [];
      });
      if (!aprovados.length) return resultado;
      const db = await getDb();
      if (!db) return resultado;
      const linhas = await db.select().from(cpqRenderMaterialProfiles).where(inArray(cpqRenderMaterialProfiles.id, [...new Set(aprovados.map(item => item.material.profileId))]));
      const perfis = await perfisResolvidos(linhas);
      for (const { pedido, material } of aprovados) {
        const perfil = perfis.get(material.profileId);
        if (!perfil || perfil.versao !== material.profileVersion) continue;
        resultado.set(chaveVinculo(pedido.materiaPrimaId, pedido.role), { perfil, overrides: overridesDoBanco(material.overrides) });
      }
      return resultado;
    },
  };
}
