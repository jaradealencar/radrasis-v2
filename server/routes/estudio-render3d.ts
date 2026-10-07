/**
 * Rotas REST da renderização 3D do CPQ Letreiros Express (`/api/letra-caixa/render3d/*`).
 *
 * - Vendedor (qualquer sessão): resolver o spec do orçamento, subir os previews e aprovar a visualização.
 * - Administração (gestor/admin/master): perfis visuais (PBR) versionados, mapas de textura e vínculos matéria-prima → perfil.
 * Os endpoints públicos (link do cliente) ficam em `estudio-cotacoes.ts`, ao lado do snapshot que leem.
 */
import { randomUUID, createHash } from "node:crypto";
import { fromNodeHeaders } from "better-auth/node";
import express, { type Express, type Request, type Response } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  cpqRender3dApprovals,
  cpqRenderMaterialAssets,
  cpqRenderMaterialLinks,
  cpqRenderMaterialProfiles,
  estudioChapas,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
} from "../../drizzle/schema";
import {
  COLOR_SPACE_PADRAO_POR_TIPO,
  MATERIAL_FAMILIES,
  PAPEIS_ESTRUTURAIS,
  TEXTURE_KINDS,
  materialFamilySchema,
  pbrParametersSchema,
  textureKindSchema,
  type CpqRender3dApproval,
} from "../../shared/cpq-render3d";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { storagePut } from "../db/storage";
import {
  CpqRender3dError,
  emitirTicketRender3d,
  montarBlocoSnapshot,
  resolveCpqRender3dSpec,
  resumoMateriaisParaSnapshot,
  verifyCpqRender3dTicket,
} from "../services/cpqRender3d";
import { IMAGEM_3D_MAX_BYTES, extensaoDoMime, validarImagem3d } from "../services/cpqRender3dImagem";

const PAPEIS_ADMIN = ["gestor", "admin", "master"];
const PREVIEW_MAX_BYTES = 3 * 1024 * 1024;
const TIPOS_PREVIEW = ["dia", "noite", "explodido"] as const;
/** Previews só podem apontar para arquivos do nosso storage (UploadThing): nunca uma URL arbitrária no snapshot. */
const HOST_STORAGE = /^https:\/\/([a-z0-9-]+\.)*(ufs\.sh|utfs\.io|uploadthing\.com)\//i;

const rawImagem = express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: IMAGEM_3D_MAX_BYTES });
const rawPreview = express.raw({ type: ["image/png", "image/jpeg"], limit: PREVIEW_MAX_BYTES });

type Ator = { id: string; nome: string; role: string };

function erro(res: Response, status: number, mensagem: string, extra: Record<string, unknown> = {}): void {
  res.status(status).json({ error: mensagem, ...extra });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // cabeçalho Origin inválido
  }
  erro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

async function obterAtor(req: Request): Promise<Ator | null> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  return sessao ? { id: sessao.user.id, nome: sessao.user.name, role: String(sessao.user.role ?? "") } : null;
}

async function exigirAtor(req: Request, res: Response, papeis?: string[]): Promise<Ator | null> {
  if (!mesmaOrigem(req, res)) return null;
  const ator = await obterAtor(req);
  if (!ator) { erro(res, 401, "Entre no Radrasys para usar a visualização 3D."); return null; }
  if (papeis && !papeis.includes(ator.role)) {
    erro(res, 403, "Esta área é restrita a Gestor, Admin ou Master.");
    return null;
  }
  return ator;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((falha: unknown) => {
      console.error("[EstudioRender3d] Falha na rota:", falha);
      if (!res.headersSent) erro(res, 500, "Não foi possível concluir esta operação agora.");
    });
  };
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor == null) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

export function registrarRotasEstudioRender3d(app: Express): void {
  // Vendedor
  app.post("/api/letra-caixa/render3d/spec", rota(resolverSpec));
  app.post("/api/letra-caixa/render3d/aprovar", rota(aprovar));
  app.post("/api/letra-caixa/render3d/preview/:tipo", (req, res) => {
    rawPreview(req, res, falha => {
      if (falha) {
        const status = (falha as { status?: number }).status ?? 400;
        erro(res, status, status === 413 ? "O preview passa de 3 MB." : "Envie o preview como PNG ou JPEG.");
        return;
      }
      void rota(enviarPreview)(req, res);
    });
  });

  // Administração: perfis visuais, mapas e vínculos
  app.get("/api/letra-caixa/render3d/material-profiles", rota(listarPerfis));
  app.post("/api/letra-caixa/render3d/material-profiles", rota(criarPerfil));
  app.put("/api/letra-caixa/render3d/material-profiles/:id", rota(atualizarPerfil));
  app.delete("/api/letra-caixa/render3d/material-profiles/:id", rota(excluirPerfil));
  app.post("/api/letra-caixa/render3d/material-profiles/:id/assets", (req, res) => {
    rawImagem(req, res, falha => {
      if (falha) {
        const status = (falha as { status?: number }).status ?? 400;
        erro(res, status, status === 413 ? "A imagem passa de 4 MB." : "Envie a textura como PNG, JPEG ou WebP.");
        return;
      }
      void rota(enviarAsset)(req, res);
    });
  });
  app.delete("/api/letra-caixa/render3d/material-profiles/:id/assets/:assetId", rota(removerAsset));
  app.put("/api/letra-caixa/render3d/material-links/:mubisysMateriaPrimaId", rota(salvarVinculo));
}

/* ---------------------------------------------------------------- vendedor */

const specInputSchema = z.object({
  sourceId: z.string().trim().min(1).max(80),
  snapshot: z.unknown(),
});

async function resolverSpec(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res);
  if (!ator) return;
  const parsed = specInputSchema.safeParse(req.body);
  if (!parsed.success) { erro(res, 400, "Envie o orçamento (snapshot) para montar o 3D."); return; }
  try {
    const spec = await resolveCpqRender3dSpec({
      sourceId: parsed.data.sourceId,
      snapshot: parsed.data.snapshot,
      user: { id: ator.id, name: ator.nome, role: ator.role },
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json(spec);
  } catch (falha) {
    if (falha instanceof CpqRender3dError) { erro(res, falha.codigo === "configuracao" ? 500 : 400, falha.message); return; }
    throw falha;
  }
}

const aprovarInputSchema = z.object({
  sourceId: z.string().trim().min(1).max(80),
  snapshot: z.unknown(),
  specHash: z.string().regex(/^[a-f0-9]{64}$/),
  previewDayUrl: z.string().url().max(2048),
  previewNightUrl: z.string().url().max(2048),
  previewExplodedUrl: z.string().url().max(2048),
}).strict();

async function aprovar(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res);
  if (!ator) return;
  const parsed = aprovarInputSchema.safeParse(req.body);
  if (!parsed.success) { erro(res, 400, "Confira o orçamento, o hash da especificação e as três imagens de preview (dia, noite e explodida)."); return; }
  const { sourceId, specHash } = parsed.data;
  for (const url of [parsed.data.previewDayUrl, parsed.data.previewNightUrl, parsed.data.previewExplodedUrl])
    if (!HOST_STORAGE.test(url)) { erro(res, 400, "Os previews precisam ser enviados pelo próprio sistema."); return; }

  let spec;
  try {
    spec = await resolveCpqRender3dSpec({ sourceId, snapshot: parsed.data.snapshot, user: { id: ator.id, name: ator.nome, role: ator.role } });
  } catch (falha) {
    if (falha instanceof CpqRender3dError) { erro(res, falha.codigo === "configuracao" ? 500 : 400, falha.message); return; }
    throw falha;
  }
  if (spec.specHash !== specHash) {
    erro(res, 409, "O orçamento mudou depois da visualização que você viu. Recarregue o 3D e aprove de novo.");
    return;
  }
  if (spec.blockers.length) {
    erro(res, 422, "A visualização 3D ainda tem pendências e não pode ser aprovada.", { blockers: spec.blockers });
    return;
  }
  const db = await getDb();
  if (!db) { erro(res, 503, "O banco de dados está indisponível."); return; }

  const approvedAt = new Date().toISOString();
  const ticket = emitirTicketRender3d({
    kind: "render3d-approval",
    sourceId,
    specHash,
    vectorHash: spec.vectorHash,
    user: { id: ator.id, name: ator.nome, role: ator.role },
    approvedAt,
  });
  const approval: CpqRender3dApproval = {
    specHash,
    ticket,
    approvedAt,
    approvedBy: { id: ator.id, name: ator.nome, role: ator.role },
    previewDayUrl: parsed.data.previewDayUrl,
    previewNightUrl: parsed.data.previewNightUrl,
    previewExplodedUrl: parsed.data.previewExplodedUrl,
  };
  const materiais = resumoMateriaisParaSnapshot(spec);
  await db.insert(cpqRender3dApprovals).values({
    sourceId,
    specHash,
    vectorHash: spec.vectorHash,
    approvedById: ator.id,
    approvedByName: ator.nome.slice(0, 160),
    approvedByRole: ator.role.slice(0, 32),
    previewDayUrl: approval.previewDayUrl,
    previewNightUrl: approval.previewNightUrl,
    previewExplodedUrl: approval.previewExplodedUrl,
    profileIds: [...new Set(materiais.map(material => material.profileId))],
    materiaisJson: materiais,
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ approval, render3d: montarBlocoSnapshot(spec, approval) });
}

async function enviarPreview(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res);
  if (!ator) return;
  const tipo = String(req.params.tipo);
  if (!(TIPOS_PREVIEW as readonly string[]).includes(tipo)) { erro(res, 400, "Tipo de preview inválido."); return; }
  const sourceId = typeof req.query.sourceId === "string" ? req.query.sourceId : "";
  const specHash = typeof req.query.specHash === "string" ? req.query.specHash : "";
  try {
    const claims = verifyCpqRender3dTicket(String(req.get("x-render3d-ticket") ?? ""), sourceId, specHash, "render3d-spec");
    if (claims.userId !== ator.id) { erro(res, 403, "O ticket do 3D é de outro usuário."); return; }
  } catch (falha) {
    if (falha instanceof CpqRender3dError) { erro(res, 409, falha.message); return; }
    throw falha;
  }
  if (!Buffer.isBuffer(req.body)) { erro(res, 415, "Envie o preview como PNG ou JPEG."); return; }
  const validada = validarImagem3d(req.body, { maxBytes: PREVIEW_MAX_BYTES });
  if ("erro" in validada) { erro(res, 400, validada.erro); return; }
  if (validada.info.mime === "image/webp") { erro(res, 415, "Envie o preview como PNG ou JPEG."); return; }
  try {
    const guardada = await storagePut(
      `cpq-render3d/${ator.id}/${specHash.slice(0, 12)}-${tipo}-${randomUUID()}.${extensaoDoMime(validada.info.mime)}`,
      req.body,
      validada.info.mime,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({ url: guardada.url, key: guardada.key });
  } catch (falha) {
    console.error("[EstudioRender3d] Falha ao guardar o preview:", falha);
    erro(res, 502, "Não foi possível guardar o preview agora.");
  }
}

/* ------------------------------------------------------------ administração */

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function bancoOuErro(res: Response): Promise<Db | null> {
  const db = await getDb();
  if (!db) erro(res, 503, "O banco de dados está indisponível.");
  return db;
}

function slugificar(texto: string): string {
  const base = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return base.length >= 2 ? base : `perfil-${randomUUID().slice(0, 6)}`;
}

/** Um perfil citado numa aprovação 3D é imutável: edição cria nova versão. */
async function perfilTravado(db: Db, perfilId: number): Promise<boolean> {
  const [uso] = await db.select({ id: cpqRender3dApprovals.id }).from(cpqRender3dApprovals)
    .where(sql`${perfilId} = ANY(${cpqRender3dApprovals.profileIds})`).limit(1);
  return !!uso;
}

const perfilInputSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  familia: materialFamilySchema,
  acabamento: z.string().trim().max(160).nullable().optional(),
  notas: z.string().trim().max(4000).nullable().optional(),
  calibrado: z.boolean().optional(),
  pbr: pbrParametersSchema,
}).strict();

const perfilCriarSchema = perfilInputSchema.extend({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}$/).optional(),
  baseadoEmPerfilId: z.number().int().positive().optional(),
}).strict();

const perfilAtualizarSchema = perfilInputSchema.extend({
  repontarVinculos: z.boolean().optional().default(true),
}).strict();

function idDaRota(req: Request, nome = "id"): number | null {
  const valor = Number(req.params[nome]);
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

async function ativosDoPerfil(db: Db, perfilIds: number[]) {
  if (!perfilIds.length) return [];
  const todos = await db.select().from(cpqRenderMaterialAssets).orderBy(asc(cpqRenderMaterialAssets.id));
  const conjunto = new Set(perfilIds);
  return todos.filter(asset => conjunto.has(asset.profileId));
}

function dtoAsset(linha: typeof cpqRenderMaterialAssets.$inferSelect) {
  return {
    id: linha.id,
    profileId: linha.profileId,
    kind: linha.kind,
    url: linha.url,
    mimeType: linha.mimeType,
    sha256: linha.sha256,
    widthPx: linha.widthPx,
    heightPx: linha.heightPx,
    tileWidthMm: numeroOuNulo(linha.tileWidthMm),
    tileHeightMm: numeroOuNulo(linha.tileHeightMm),
    colorSpace: linha.colorSpace,
    sourceNote: linha.sourceNote,
    calibrated: linha.calibrated,
    createdAt: linha.createdAt,
  };
}

export type StatusMaterial3d = "sem_mapeamento" | "incompleto" | "estimado" | "aprovado";

/**
 * Situação visual de uma matéria-prima: sem vínculo; incompleta (falta dado físico estrutural ou mapa de um metal); estimada
 * (perfil genérico ou ainda não calibrado contra a amostra); aprovada (perfil próprio, calibrado, com os dados físicos).
 */
export function statusVisualMaterial(entrada: {
  vinculado: boolean;
  familia: string | null;
  calibrado: boolean;
  espessuraMm: number | null;
  fisico: boolean;
  temMapas: boolean;
}): StatusMaterial3d {
  if (!entrada.vinculado || !entrada.familia) return "sem_mapeamento";
  if (entrada.fisico && !(entrada.espessuraMm && entrada.espessuraMm > 0)) return "incompleto";
  if (["stainless_brushed", "aluminum_profile"].includes(entrada.familia) && !entrada.temMapas) return "incompleto";
  if (entrada.familia === "generic_dielectric" || !entrada.calibrado) return "estimado";
  return "aprovado";
}

async function listarPerfis(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const db = await bancoOuErro(res);
  if (!db) return;

  const [perfis, vinculos, aprovacoes, cadastros, formatos] = await Promise.all([
    db.select().from(cpqRenderMaterialProfiles).orderBy(asc(cpqRenderMaterialProfiles.slug), desc(cpqRenderMaterialProfiles.versao)),
    db.select().from(cpqRenderMaterialLinks),
    db.select({ profileIds: cpqRender3dApprovals.profileIds }).from(cpqRender3dApprovals),
    db.select({ cadastro: materiaPrimaCadastros, categoria: materiaPrimaCategorias }).from(materiaPrimaCadastros)
      .leftJoin(materiaPrimaCategorias, eq(materiaPrimaCadastros.categoriaId, materiaPrimaCategorias.id)),
    db.select({ id: estudioChapas.mubisysMateriaPrimaId }).from(estudioChapas).where(eq(estudioChapas.ativo, true)),
  ]);
  const assets = await ativosDoPerfil(db, perfis.map(perfil => perfil.id));
  const travados = new Set(aprovacoes.flatMap(linha => linha.profileIds));
  const assetsPorPerfil = new Map<number, ReturnType<typeof dtoAsset>[]>();
  for (const asset of assets) assetsPorPerfil.set(asset.profileId, [...(assetsPorPerfil.get(asset.profileId) ?? []), dtoAsset(asset)]);
  const perfilPorId = new Map(perfis.map(perfil => [perfil.id, perfil]));
  const usoPorPerfil = new Map<number, number>();
  for (const vinculo of vinculos) usoPorPerfil.set(vinculo.profileId, (usoPorPerfil.get(vinculo.profileId) ?? 0) + 1);

  let catalogo: Awaited<ReturnType<typeof listarMateriasPrimas>> = [];
  let catalogoErro: string | null = null;
  try {
    catalogo = await listarMateriasPrimas();
  } catch (falha) {
    console.error("[EstudioRender3d] Falha ao ler o catálogo do MubiSys:", falha);
    catalogoErro = "Não foi possível carregar o catálogo de matérias-primas do MubiSys agora.";
  }
  const cadastroPorId = new Map(cadastros.map(item => [item.cadastro.mubisysMateriaPrimaId, item]));
  const comFormato = new Set(formatos.map(formato => formato.id));
  const vinculoPorId = new Map(vinculos.map(vinculo => [vinculo.mubisysMateriaPrimaId, vinculo]));

  const materias = catalogo
    .filter(materia => String(materia.status ?? "").toLowerCase() !== "inativo")
    .map(materia => {
      const item = cadastroPorId.get(materia.id);
      const vinculo = vinculoPorId.get(materia.id);
      const perfil = vinculo ? perfilPorId.get(vinculo.profileId) : undefined;
      const usaChapa = item?.categoria?.usaDadosChapa === true || item?.categoria?.usaDadosBobina === true || comFormato.has(materia.id);
      const usaPerfil = item?.categoria?.usaDadosPerfil === true;
      const espessuraMm = numeroOuNulo(item?.cadastro.espessuraMm);
      return {
        id: materia.id,
        nome: materia.nome,
        categoriaMubisys: materia.categoria,
        categoriaLocal: item?.categoria?.nome ?? null,
        unidade: materia.unidade_custo,
        tipoFisico: usaPerfil ? "perfil" : usaChapa ? "chapa" : "outro",
        espessuraMm,
        perfilAlturaMm: numeroOuNulo(item?.cadastro.perfilAlturaMm),
        perfilLarguraMm: numeroOuNulo(item?.cadastro.perfilLarguraMm),
        vinculo: vinculo ? { profileId: vinculo.profileId, overrides: vinculo.overridesJson ?? null, atualizadoPor: vinculo.atualizadoPor, updatedAt: vinculo.updatedAt } : null,
        status: statusVisualMaterial({
          vinculado: !!perfil,
          familia: perfil?.familia ?? null,
          calibrado: perfil?.calibrado ?? false,
          espessuraMm,
          fisico: usaChapa || usaPerfil,
          temMapas: perfil ? (assetsPorPerfil.get(perfil.id) ?? []).some(asset => asset.kind !== "reference") : false,
        }),
      };
    });

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    familias: MATERIAL_FAMILIES,
    tiposMapa: TEXTURE_KINDS,
    papeisEstruturais: PAPEIS_ESTRUTURAIS,
    perfis: perfis.map(perfil => ({
      id: perfil.id,
      slug: perfil.slug,
      versao: perfil.versao,
      nome: perfil.nome,
      familia: perfil.familia,
      ativo: perfil.ativo,
      acabamento: perfil.acabamento,
      calibrado: perfil.calibrado,
      pbr: perfil.pbrJson,
      notas: perfil.notas,
      autorNome: perfil.autorNome,
      travado: travados.has(perfil.id),
      vinculos: usoPorPerfil.get(perfil.id) ?? 0,
      assets: assetsPorPerfil.get(perfil.id) ?? [],
      updatedAt: perfil.updatedAt,
    })),
    materias,
    catalogoErro,
  });
}

async function copiarAssets(db: Db, origemId: number, destinoId: number): Promise<void> {
  const origem = await db.select().from(cpqRenderMaterialAssets).where(eq(cpqRenderMaterialAssets.profileId, origemId));
  if (!origem.length) return;
  await db.insert(cpqRenderMaterialAssets).values(origem.map(({ id: _id, profileId: _profileId, createdAt: _createdAt, ...resto }) => ({ ...resto, profileId: destinoId })));
}

async function criarPerfil(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const parsed = perfilCriarSchema.safeParse(req.body);
  if (!parsed.success) { erro(res, 400, "Confira os dados do perfil visual (nome, família e parâmetros PBR dentro dos limites)."); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  const slug = parsed.data.slug ?? slugificar(parsed.data.nome);
  const [existente] = await db.select({ id: cpqRenderMaterialProfiles.id }).from(cpqRenderMaterialProfiles).where(eq(cpqRenderMaterialProfiles.slug, slug)).limit(1);
  if (existente) { erro(res, 409, "Já existe um perfil com este identificador. Edite-o (cria nova versão) ou escolha outro nome."); return; }
  const [criado] = await db.insert(cpqRenderMaterialProfiles).values({
    slug,
    versao: 1,
    nome: parsed.data.nome,
    familia: parsed.data.familia,
    acabamento: parsed.data.acabamento ?? null,
    notas: parsed.data.notas ?? null,
    calibrado: parsed.data.calibrado ?? false,
    pbrJson: parsed.data.pbr,
    autorNome: ator.nome.slice(0, 160),
  }).returning({ id: cpqRenderMaterialProfiles.id });
  if (parsed.data.baseadoEmPerfilId) await copiarAssets(db, parsed.data.baseadoEmPerfilId, criado.id);
  res.status(201).json({ id: criado.id, slug, versao: 1 });
}

async function atualizarPerfil(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const id = idDaRota(req);
  const parsed = perfilAtualizarSchema.safeParse(req.body);
  if (!id || !parsed.success) { erro(res, 400, "Confira os dados do perfil visual."); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  const [atual] = await db.select().from(cpqRenderMaterialProfiles).where(eq(cpqRenderMaterialProfiles.id, id)).limit(1);
  if (!atual) { erro(res, 404, "Perfil visual não encontrado."); return; }
  const valores = {
    nome: parsed.data.nome,
    familia: parsed.data.familia,
    acabamento: parsed.data.acabamento ?? null,
    notas: parsed.data.notas ?? null,
    calibrado: parsed.data.calibrado ?? atual.calibrado,
    pbrJson: parsed.data.pbr,
    autorNome: ator.nome.slice(0, 160),
  };
  if (!(await perfilTravado(db, id))) {
    await db.update(cpqRenderMaterialProfiles).set({ ...valores, updatedAt: new Date() }).where(eq(cpqRenderMaterialProfiles.id, id));
    res.json({ id, versao: atual.versao, novaVersao: false });
    return;
  }
  // Perfil já usado numa aprovação: nunca muda. Cria a próxima versão do mesmo slug e (opcionalmente) repontua os vínculos.
  const nova = await db.transaction(async tx => {
    const [ultima] = await tx.select({ versao: cpqRenderMaterialProfiles.versao }).from(cpqRenderMaterialProfiles)
      .where(eq(cpqRenderMaterialProfiles.slug, atual.slug)).orderBy(desc(cpqRenderMaterialProfiles.versao)).limit(1);
    await tx.update(cpqRenderMaterialProfiles).set({ ativo: false }).where(eq(cpqRenderMaterialProfiles.slug, atual.slug));
    const [criada] = await tx.insert(cpqRenderMaterialProfiles).values({ ...valores, slug: atual.slug, versao: (ultima?.versao ?? atual.versao) + 1, ativo: true })
      .returning({ id: cpqRenderMaterialProfiles.id, versao: cpqRenderMaterialProfiles.versao });
    const mapas = await tx.select().from(cpqRenderMaterialAssets).where(eq(cpqRenderMaterialAssets.profileId, id));
    if (mapas.length)
      await tx.insert(cpqRenderMaterialAssets).values(mapas.map(({ id: _id, profileId: _profileId, createdAt: _createdAt, ...resto }) => ({ ...resto, profileId: criada.id })));
    if (parsed.data.repontarVinculos)
      await tx.update(cpqRenderMaterialLinks).set({ profileId: criada.id, atualizadoPor: ator.nome.slice(0, 160), updatedAt: new Date() }).where(eq(cpqRenderMaterialLinks.profileId, id));
    return criada;
  });
  res.status(201).json({ id: nova.id, versao: nova.versao, novaVersao: true });
}

async function excluirPerfil(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const id = idDaRota(req);
  if (!id) { erro(res, 400, "Perfil inválido."); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  if (await perfilTravado(db, id)) { erro(res, 409, "Este perfil foi usado numa aprovação 3D e não pode ser excluído."); return; }
  const [vinculo] = await db.select({ id: cpqRenderMaterialLinks.mubisysMateriaPrimaId }).from(cpqRenderMaterialLinks).where(eq(cpqRenderMaterialLinks.profileId, id)).limit(1);
  if (vinculo) { erro(res, 409, "Este perfil ainda está ligado a matérias-primas. Desfaça os vínculos antes de excluir."); return; }
  await db.delete(cpqRenderMaterialProfiles).where(eq(cpqRenderMaterialProfiles.id, id));
  res.json({ success: true });
}

const assetQuerySchema = z.object({
  kind: textureKindSchema,
  tileWidthMm: z.coerce.number().positive().max(5000).optional(),
  tileHeightMm: z.coerce.number().positive().max(5000).optional(),
  calibrated: z.enum(["true", "false"]).optional(),
  sourceNote: z.string().trim().max(500).optional(),
});

async function enviarAsset(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const perfilId = idDaRota(req);
  const query = assetQuerySchema.safeParse(req.query);
  if (!perfilId || !query.success) { erro(res, 400, "Informe o tipo do mapa e, para mapas de textura, a escala real do tile em mm."); return; }
  if (!Buffer.isBuffer(req.body)) { erro(res, 415, "Envie a textura como PNG, JPEG ou WebP."); return; }
  const { kind } = query.data;
  // Mapas de textura repetem sobre a peça: a escala real é obrigatória. A foto de referência é só comparação humana.
  if (kind !== "reference" && !(query.data.tileWidthMm && query.data.tileHeightMm)) {
    erro(res, 400, "Informe quantos milímetros reais o tile representa (largura e altura).");
    return;
  }
  const validada = validarImagem3d(req.body);
  if ("erro" in validada) { erro(res, 400, validada.erro); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  const [perfil] = await db.select({ id: cpqRenderMaterialProfiles.id }).from(cpqRenderMaterialProfiles).where(eq(cpqRenderMaterialProfiles.id, perfilId)).limit(1);
  if (!perfil) { erro(res, 404, "Perfil visual não encontrado."); return; }
  if (await perfilTravado(db, perfilId)) { erro(res, 409, "Este perfil foi usado numa aprovação 3D. Crie uma nova versão para trocar os mapas."); return; }

  const sha256 = createHash("sha256").update(req.body).digest("hex");
  let guardada;
  try {
    guardada = await storagePut(`cpq-render3d-materiais/${perfilId}/${kind}-${sha256.slice(0, 12)}.${extensaoDoMime(validada.info.mime)}`, req.body, validada.info.mime);
  } catch (falha) {
    console.error("[EstudioRender3d] Falha ao guardar a textura:", falha);
    erro(res, 502, "Não foi possível guardar a textura agora.");
    return;
  }
  const criado = await db.transaction(async tx => {
    // Um mapa por tipo (exceto fotos de referência, que podem ser várias).
    if (kind !== "reference") await tx.delete(cpqRenderMaterialAssets).where(and(eq(cpqRenderMaterialAssets.profileId, perfilId), eq(cpqRenderMaterialAssets.kind, kind)));
    const [linha] = await tx.insert(cpqRenderMaterialAssets).values({
      profileId: perfilId,
      kind,
      url: guardada.url,
      storageKey: guardada.key,
      mimeType: validada.info.mime,
      sha256,
      widthPx: validada.info.largura,
      heightPx: validada.info.altura,
      tileWidthMm: query.data.tileWidthMm != null ? String(query.data.tileWidthMm) : null,
      tileHeightMm: query.data.tileHeightMm != null ? String(query.data.tileHeightMm) : null,
      colorSpace: COLOR_SPACE_PADRAO_POR_TIPO[kind],
      sourceNote: query.data.sourceNote ?? null,
      calibrated: query.data.calibrated === "true",
    }).returning();
    return linha;
  });
  res.status(201).json(dtoAsset(criado));
}

async function removerAsset(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const perfilId = idDaRota(req);
  const assetId = idDaRota(req, "assetId");
  if (!perfilId || !assetId) { erro(res, 400, "Mapa inválido."); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  if (await perfilTravado(db, perfilId)) { erro(res, 409, "Este perfil foi usado numa aprovação 3D. Crie uma nova versão para remover mapas."); return; }
  await db.delete(cpqRenderMaterialAssets).where(and(eq(cpqRenderMaterialAssets.id, assetId), eq(cpqRenderMaterialAssets.profileId, perfilId)));
  res.json({ success: true });
}

const vinculoInputSchema = z.object({
  profileId: z.number().int().positive().nullable(),
  overrides: z.object({
    colorHex: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    anisotropyRotationRad: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2).optional(),
  }).strict().nullable().optional(),
}).strict();

async function salvarVinculo(req: Request, res: Response): Promise<void> {
  const ator = await exigirAtor(req, res, PAPEIS_ADMIN);
  if (!ator) return;
  const materiaPrimaId = idDaRota(req, "mubisysMateriaPrimaId");
  const parsed = vinculoInputSchema.safeParse(req.body);
  if (!materiaPrimaId || !parsed.success) { erro(res, 400, "Confira a matéria-prima e o perfil visual."); return; }
  const db = await bancoOuErro(res);
  if (!db) return;
  if (parsed.data.profileId == null) {
    await db.delete(cpqRenderMaterialLinks).where(eq(cpqRenderMaterialLinks.mubisysMateriaPrimaId, materiaPrimaId));
    res.json({ success: true, vinculo: null });
    return;
  }
  const [perfil] = await db.select({ id: cpqRenderMaterialProfiles.id }).from(cpqRenderMaterialProfiles).where(eq(cpqRenderMaterialProfiles.id, parsed.data.profileId)).limit(1);
  if (!perfil) { erro(res, 404, "Perfil visual não encontrado."); return; }
  const valores = {
    profileId: parsed.data.profileId,
    overridesJson: parsed.data.overrides && Object.keys(parsed.data.overrides).length ? parsed.data.overrides : null,
    atualizadoPor: ator.nome.slice(0, 160),
    updatedAt: new Date(),
  };
  await db.insert(cpqRenderMaterialLinks).values({ mubisysMateriaPrimaId: materiaPrimaId, ...valores })
    .onConflictDoUpdate({ target: cpqRenderMaterialLinks.mubisysMateriaPrimaId, set: valores });
  res.json({ success: true, vinculo: { mubisysMateriaPrimaId: materiaPrimaId, ...valores } });
}
