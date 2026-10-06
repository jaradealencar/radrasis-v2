import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  estudioChapas,
  estudioImprimaxAdesivos,
  estudioMapeamentoCoresCotacao,
  estudioPrecosImpressao,
} from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { CpqFactibilidadeError, calcularMetricasVisiveisSvgPorCaminho } from "../services/cpqFactibilidadeFabricacao";
import { aplicarCustosBobinaAgrupados, consolidarRegioesFotograficas, type CpqCorCatalogo, desconsiderarAdesivoDaSugestao, extrairRegioesCorSvg, hexParaRgb, sugerirMaterialParaCor } from "../services/cpqCoresMateriais";
import { listarPantone, pantoneMaisProximos, rgbParaCmykAproximado } from "../services/cpqPantone";
import { IMPRIMAX_CATALOGO_PADRAO, IMPRIMAX_CATALOGO_VERSAO } from "../../shared/imprimax-catalogo-2026-08";

const porcentagem = z.number().finite().min(0).max(100).nullable().optional();
const moedaM2 = z.number().finite().min(0).max(1_000_000).nullable();
const boundingBoxMm = z.object({
  minX: z.number().finite(), maxX: z.number().finite(), minY: z.number().finite(), maxY: z.number().finite(),
}).strict().refine(box => box.maxX > box.minX && box.maxY > box.minY);
const dadosRegiaoPreco = z.object({
  areaLiquidaM2: z.number().finite().min(0).max(50_000),
  areaTotalM2: z.number().finite().positive().max(50_000),
  larguraMm: z.number().finite().positive().max(50_000),
  alturaMm: z.number().finite().positive().max(50_000),
  boundingBoxesMm: z.array(boundingBoxMm).min(1).max(500),
}).strict().refine(dados => dados.areaTotalM2 + 0.000001 >= dados.areaLiquidaM2, {
  path: ["areaTotalM2"], message: "A área do Bounding Box não pode ser menor que a área líquida.",
});
const cmykInput = z.object({ c: porcentagem, m: porcentagem, y: porcentagem, k: porcentagem }).strict().nullable().optional()
  .superRefine((value, context) => {
    if (!value) return;
    const channels = [value.c, value.m, value.y, value.k];
    if (channels.some(channel => channel != null) && channels.some(channel => channel == null))
      context.addIssue({ code: "custom", message: "Preencha os quatro canais CMYK ou deixe-os vazios." });
  });
const catalogoItem = z.object({
  codigo: z.string().trim().min(1).max(80),
  linha: z.string().trim().min(1).max(120),
  nomeCor: z.string().trim().min(1).max(160),
  tipoVinil: z.enum(["monomerico", "polimerico", "translucido"]),
  acabamento: z.string().trim().max(40).nullable().optional(),
  corHex: z.string().regex(/^#[\da-f]{6}$/i).nullable().optional(),
  pantoneCode: z.string().trim().max(32).nullable().optional(),
  cmykC: porcentagem, cmykM: porcentagem, cmykY: porcentagem, cmykK: porcentagem,
  transmissaoLuzPct: porcentagem,
  precoM2: moedaM2.optional(),
  catalogoVersao: z.string().trim().max(60).nullable().optional(),
  origemUrl: z.string().trim().max(1000).url().nullable().optional(),
}).strict().superRefine((item, context) => {
  const channels = [item.cmykC, item.cmykM, item.cmykY, item.cmykK];
  if (channels.some(channel => channel != null) && channels.some(channel => channel == null))
    context.addIssue({ code: "custom", message: "Preencha os quatro canais CMYK ou deixe todos vazios." });
  if (!item.corHex && !item.pantoneCode && channels.every(channel => channel == null))
    context.addIssue({ code: "custom", message: "Informe HEX, Pantone ou CMYK para localizar a cor do adesivo." });
});

const analisarInput = z.object({
  sourceId: z.string().trim().min(1).max(80),
  regioes: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    tipoCor: z.enum(["solida", "gradiente", "complexa", "desconhecida"]),
    corHex: z.string().regex(/^#[\da-f]{6}$/i).nullable().optional(),
    pantoneCode: z.string().trim().max(32).nullable().optional(),
    cmyk: cmykInput,
    coresGradiente: z.array(z.string().regex(/^#[\da-f]{6}$/i)).max(20).optional(),
    pathIndexes: z.array(z.number().int().nonnegative().max(499)).max(500).optional(),
    dadosPreco: dadosRegiaoPreco.optional(),
    areaM2: z.number().finite().min(0).max(50_000).nullable().optional(),
    observacao: z.string().trim().max(300).nullable().optional(),
  }).strict()).min(1).max(500),
  iluminacao: z.enum(["sem_iluminacao", "frontlight", "backlight"]),
  transmissaoMinimaPct: z.number().finite().min(0).max(100).nullable().optional(),
  baseImpressao: z.enum(["branco", "transparente"]),
  construcaoFace: z.enum(["acrilico_total", "outra", "nao_informada"]).default("nao_informada"),
  laminar: z.boolean(),
  caixaLetreiroMm: boundingBoxMm.nullable().optional(),
  // O vendedor descartou a leitura de adesivo (possível erro de leitura da arte): nenhuma região pede adesivo.
  semAdesivo: z.boolean().optional(),
}).strict().superRefine((input, context) => {
  if (new Set(input.regioes.map(region => region.key)).size !== input.regioes.length)
    context.addIssue({ code: "custom", message: "As regiões de cor precisam ter identificadores únicos." });
});

const analisarSvgInput = z.object({
  sourceId: z.string().trim().min(1).max(80),
  svgArte: z.string().min(20).max(1_500_000),
  svgGeometria: z.string().min(20).max(1_500_000),
  larguraSvgMm: z.number().finite().positive().max(50_000),
  alturaSvgMm: z.number().finite().positive().max(50_000),
  iluminacao: z.enum(["sem_iluminacao", "frontlight", "backlight"]),
  transmissaoMinimaPct: z.number().finite().min(0).max(100).nullable().optional(),
  baseImpressao: z.enum(["branco", "transparente"]),
  construcaoFace: z.enum(["acrilico_total", "outra", "nao_informada"]).default("nao_informada"),
  laminar: z.boolean(),
  semAdesivo: z.boolean().optional(),
}).strict();

const aprovarInput = z.object({
  sourceId: z.string().trim().min(1).max(80),
  autorizaAdesivoSobreAcrilico: z.boolean().optional(),
}).strict();

function erro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function decimalBanco(value: number | null | undefined): string | null {
  return value == null ? null : String(value);
}

function cmykCompleto(value: {
  c?: number | null;
  m?: number | null;
  y?: number | null;
  k?: number | null;
} | null | undefined): { c: number; m: number; y: number; k: number } | null {
  if (value?.c == null || value.m == null || value.y == null || value.k == null) return null;
  return { c: value.c, m: value.m, y: value.y, k: value.k };
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try { if (new URL(origin).host === req.get("host")) return true; } catch { /* rejeita origem inválida */ }
  erro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

async function obterSessao(req: Request, res: Response) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!session) erro(res, 401, "Entre no Radrasys para usar a análise de cores do CPQ.");
  return session;
}

async function exigirGestor(req: Request, res: Response) {
  const session = await obterSessao(req, res);
  if (!session) return null;
  if (!["admin", "master", "gestor"].includes(String(session.user.role ?? ""))) {
    erro(res, 403, "Somente gestor, admin ou master pode manter o catálogo de cores e custos.");
    return null;
  }
  return session;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioCores] Falha na rota:", error);
      if (!res.headersSent) erro(res, 500, "Não foi possível concluir a operação de cores agora.");
    });
  };
}

export function registrarRotasEstudioCores(app: Express): void {
  app.get("/api/letra-caixa/cores/catalogo", rota(carregarCatalogo));
  app.put("/api/letra-caixa/cores/catalogo-imprimax", rota(importarCatalogo));
  app.put("/api/letra-caixa/cores/precos-impressao", rota(salvarPrecos));
  app.post("/api/letra-caixa/cores/analisar-svg", rota(analisarSvg));
  app.post("/api/letra-caixa/cores/aprovar", rota(aprovarCores));
  app.put("/api/letra-caixa/cores/imprimax-padrao", rota(importarCatalogoImprimaxPadrao));
  app.get("/api/letra-caixa/cores/pantone", rota(listarPantoneReferencia));
  app.post("/api/letra-caixa/cores/pantone/referencias", rota(referenciasPantone));
}

/**
 * Carrega o catálogo Imprimax do repositório (cores sólidas do catálogo 05/08/2026). Atualiza só os dados que vêm do
 * catálogo e preserva o que o gestor já cadastrou à mão (preço por m², Pantone, CMYK e transmissão de luz).
 */
async function importarCatalogoImprimaxPadrao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const now = new Date();
  await db.transaction(async tx => {
    for (const item of IMPRIMAX_CATALOGO_PADRAO) {
      const dados = {
        codigo: item.codigo,
        linha: item.linha,
        nomeCor: item.nomeCor,
        tipoVinil: item.tipoVinil,
        acabamento: item.acabamento,
        corHex: item.corHex,
        catalogoVersao: IMPRIMAX_CATALOGO_VERSAO,
      };
      await tx.insert(estudioImprimaxAdesivos).values({ ...dados, ativo: true, updatedAt: now })
        .onConflictDoUpdate({ target: estudioImprimaxAdesivos.codigo, set: { ...dados, ativo: true, updatedAt: now } });
    }
  });
  res.json({ importados: IMPRIMAX_CATALOGO_PADRAO.length, versao: IMPRIMAX_CATALOGO_VERSAO });
}

async function listarPantoneReferencia(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await obterSessao(req, res))) return;
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.json({ pantone: listarPantone() });
}

/** Para cada cor (#RRGGBB) devolve o Pantone de referência mais próximo e um CMYK aproximado. */
async function referenciasPantone(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await obterSessao(req, res))) return;
  const parsed = z.object({ cores: z.array(z.string().trim().max(9)).min(1).max(60) }).strict().safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, "Informe de 1 a 60 cores em hexadecimal.");
  const referencias = parsed.data.cores.map(hex => {
    const rgb = hexParaRgb(hex);
    if (!rgb) return { hex, valida: false as const };
    return {
      hex,
      valida: true as const,
      cmykAproximado: rgbParaCmykAproximado(rgb),
      pantone: pantoneMaisProximos(hex, 3) ?? [],
    };
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ referencias });
}

async function carregarCatalogo(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await obterSessao(req, res))) return;
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [adesivos, precos] = await Promise.all([
    db.select().from(estudioImprimaxAdesivos).where(eq(estudioImprimaxAdesivos.ativo, true)).orderBy(asc(estudioImprimaxAdesivos.linha), asc(estudioImprimaxAdesivos.codigo)),
    db.select().from(estudioPrecosImpressao).where(eq(estudioPrecosImpressao.id, 1)).limit(1),
  ]);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ adesivos, precos: precos[0] ?? null });
}

async function importarCatalogo(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const parsed = z.object({ itens: z.array(catalogoItem).min(1).max(5000) }).strict().safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, "Revise os itens do catálogo Imprimax antes de importar.");
  if (new Set(parsed.data.itens.map(item => item.codigo.toLocaleUpperCase("pt-BR"))).size !== parsed.data.itens.length)
    return void erro(res, 400, "Cada item importado precisa ter um código único.");
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const now = new Date();
  await db.transaction(async tx => {
    for (const item of parsed.data.itens) {
      const values = {
        ...item,
        codigo: item.codigo.trim().toLocaleUpperCase("pt-BR"),
        cmykC: decimalBanco(item.cmykC),
        cmykM: decimalBanco(item.cmykM),
        cmykY: decimalBanco(item.cmykY),
        cmykK: decimalBanco(item.cmykK),
        transmissaoLuzPct: decimalBanco(item.transmissaoLuzPct),
        precoM2: decimalBanco(item.precoM2),
        ativo: true,
        updatedAt: now,
      };
      await tx.insert(estudioImprimaxAdesivos).values(values)
        .onConflictDoUpdate({
          target: estudioImprimaxAdesivos.codigo,
          set: values,
        });
    }
  });
  res.json({ importados: parsed.data.itens.length });
}

async function salvarPrecos(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const parsed = z.object({
    vinilBrancoM2: moedaM2,
    vinilBrancoTransmissaoPct: porcentagem,
    vinilTransparenteM2: moedaM2,
    vinilTransparenteTransmissaoPct: porcentagem,
    impressaoM2: moedaM2,
    laminacaoM2: moedaM2,
    larguraBobinaMm: z.number().int().positive().max(50_000).nullable(),
    larguraUtilBobinaMm: z.number().int().positive().max(50_000).nullable(),
    sangriaPerimetralMm: z.number().finite().min(0).max(50),
    retalhoReutilizavel: z.boolean(),
    laminacaoPadrao: z.boolean(),
  }).strict().superRefine((value, context) => {
    if (value.larguraBobinaMm != null && value.larguraUtilBobinaMm != null
      && value.larguraUtilBobinaMm > value.larguraBobinaMm) {
      context.addIssue({ code: "custom", path: ["larguraUtilBobinaMm"], message: "A largura útil não pode superar a largura total da bobina." });
    }
  }).safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, "Informe valores válidos por m²; use nulo para custo ainda não cadastrado.");
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const values = {
    vinilBrancoM2: decimalBanco(parsed.data.vinilBrancoM2),
    vinilBrancoTransmissaoPct: decimalBanco(parsed.data.vinilBrancoTransmissaoPct),
    vinilTransparenteM2: decimalBanco(parsed.data.vinilTransparenteM2),
    vinilTransparenteTransmissaoPct: decimalBanco(parsed.data.vinilTransparenteTransmissaoPct),
    impressaoM2: decimalBanco(parsed.data.impressaoM2),
    laminacaoM2: decimalBanco(parsed.data.laminacaoM2),
    larguraBobinaMm: parsed.data.larguraBobinaMm,
    larguraUtilBobinaMm: parsed.data.larguraUtilBobinaMm,
    sangriaPerimetralMm: String(parsed.data.sangriaPerimetralMm),
    retalhoReutilizavel: parsed.data.retalhoReutilizavel,
    laminacaoPadrao: parsed.data.laminacaoPadrao,
    updatedAt: new Date(),
  };
  await db.insert(estudioPrecosImpressao).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: estudioPrecosImpressao.id, set: values });
  res.json({ success: true });
}

async function persistirAnaliseCores(parsed: z.infer<typeof analisarInput>, res: Response): Promise<void> {
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [chapas, adesivos, precosRows] = await Promise.all([
    // Bobinas (adesivo comum, kraft) não têm cor de chapa: só entram no nesting, não na sugestão de material.
    db.select().from(estudioChapas).where(and(eq(estudioChapas.ativo, true), eq(estudioChapas.bobina, false), eq(estudioChapas.temCor, true))),
    db.select().from(estudioImprimaxAdesivos).where(eq(estudioImprimaxAdesivos.ativo, true)),
    db.select().from(estudioPrecosImpressao).where(eq(estudioPrecosImpressao.id, 1)).limit(1),
  ]);
  const precos = precosRows[0] ?? null;
  const sugestoes = parsed.regioes.map(regiao => sugerirMaterialParaCor({
    regiao: { ...regiao, cmyk: cmykCompleto(regiao.cmyk) },
    chapas: chapas as CpqCorCatalogo[],
    adesivos: adesivos as CpqCorCatalogo[],
    iluminacao: parsed.iluminacao,
    transmissaoMinimaPct: parsed.transmissaoMinimaPct,
    baseImpressao: parsed.baseImpressao,
    laminar: parsed.laminar || Boolean(precos?.laminacaoPadrao),
    precos,
    construcaoFace: parsed.construcaoFace,
  }));
  const sugestoesFinais = parsed.semAdesivo ? sugestoes.map(desconsiderarAdesivoDaSugestao) : sugestoes;
  const resultados = aplicarCustosBobinaAgrupados(sugestoesFinais, parsed.regioes, precos, parsed.caixaLetreiroMm ?? null);
  await db.transaction(async tx => {
    await tx.delete(estudioMapeamentoCoresCotacao)
      .where(eq(estudioMapeamentoCoresCotacao.sourceId, parsed.sourceId));
    for (const resultado of resultados) {
      const regiao = parsed.regioes.find(item => item.key === resultado.regionKey)!;
      await tx.insert(estudioMapeamentoCoresCotacao).values({
        sourceId: parsed.sourceId,
        regionKey: resultado.regionKey,
        corHex: regiao.corHex ?? null,
        corRgbJson: resultado.corRgb,
        pantoneCode: regiao.pantoneCode ?? null,
        cmykC: resultado.cmyk?.c == null ? null : String(resultado.cmyk.c),
        cmykM: resultado.cmyk?.m == null ? null : String(resultado.cmyk.m),
        cmykY: resultado.cmyk?.y == null ? null : String(resultado.cmyk.y),
        cmykK: resultado.cmyk?.k == null ? null : String(resultado.cmyk.k),
        tipoCor: regiao.tipoCor,
        areaM2: resultado.areaM2 == null ? null : String(resultado.areaM2),
        modoIluminacao: parsed.iluminacao,
        tipoSugestao: resultado.tipoSugestao,
        chapaId: resultado.chapaId,
        imprimaxAdesivoId: resultado.imprimaxAdesivoId,
        deltaE00: resultado.deltaE00 == null ? null : String(resultado.deltaE00),
        custoEstimado: resultado.custoEstimado == null ? null : String(resultado.custoEstimado),
        detalhesJson: {
          corRgb: resultado.corRgb,
          cmyk: resultado.cmyk ?? null,
          cmykOriginal: regiao.cmyk ?? null,
          coresGradiente: regiao.coresGradiente ?? [],
          pathIndexes: regiao.pathIndexes ?? [],
          dadosPreco: regiao.dadosPreco ?? null,
          areaConsumoM2: resultado.areaConsumoM2,
          areaLiquidaM2: resultado.areaLiquidaM2 ?? null,
          areaTotalM2: resultado.areaTotalM2 ?? resultado.areaM2,
          avisos: resultado.avisos,
          alternativas: resultado.alternativas,
          unidadeCusto: resultado.unidadeCusto,
          precificacao: resultado.precificacao,
          chapaMateriaPrimaId: resultado.chapaMateriaPrimaId,
          chapaBaseId: resultado.chapaBaseId,
          chapaBaseMateriaPrimaId: resultado.chapaBaseMateriaPrimaId,
          requerChapaBase: resultado.requerChapaBase,
          requerConfirmacaoConstrucao: resultado.requerConfirmacaoConstrucao,
          composicaoFace: resultado.composicaoFace,
          construcaoFace: parsed.construcaoFace,
          baseImpressao: parsed.baseImpressao,
          transmissaoMinimaPct: parsed.transmissaoMinimaPct ?? null,
          iluminacao: parsed.iluminacao,
          laminar: parsed.laminar || Boolean(precos?.laminacaoPadrao),
          fatorVersaoAlgoritmo: "ciede2000-d65-bobina-v2",
        },
        aprovado: false,
        aprovadoPor: null,
        aprovadoEm: null,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [estudioMapeamentoCoresCotacao.sourceId, estudioMapeamentoCoresCotacao.regionKey],
        set: {
          corHex: regiao.corHex ?? null,
          corRgbJson: resultado.corRgb,
          pantoneCode: regiao.pantoneCode ?? null,
          cmykC: resultado.cmyk?.c == null ? null : String(resultado.cmyk.c),
          cmykM: resultado.cmyk?.m == null ? null : String(resultado.cmyk.m),
          cmykY: resultado.cmyk?.y == null ? null : String(resultado.cmyk.y),
          cmykK: resultado.cmyk?.k == null ? null : String(resultado.cmyk.k),
          tipoCor: regiao.tipoCor,
          areaM2: resultado.areaM2 == null ? null : String(resultado.areaM2),
          modoIluminacao: parsed.iluminacao,
          tipoSugestao: resultado.tipoSugestao,
          chapaId: resultado.chapaId,
          imprimaxAdesivoId: resultado.imprimaxAdesivoId,
          deltaE00: resultado.deltaE00 == null ? null : String(resultado.deltaE00),
          custoEstimado: resultado.custoEstimado == null ? null : String(resultado.custoEstimado),
          detalhesJson: {
            corRgb: resultado.corRgb,
            cmyk: resultado.cmyk ?? null,
            cmykOriginal: regiao.cmyk ?? null,
            coresGradiente: regiao.coresGradiente ?? [],
            pathIndexes: regiao.pathIndexes ?? [],
            dadosPreco: regiao.dadosPreco ?? null,
            areaConsumoM2: resultado.areaConsumoM2,
            areaLiquidaM2: resultado.areaLiquidaM2 ?? null,
            areaTotalM2: resultado.areaTotalM2 ?? resultado.areaM2,
            avisos: resultado.avisos,
            alternativas: resultado.alternativas,
            unidadeCusto: resultado.unidadeCusto,
            precificacao: resultado.precificacao,
            chapaMateriaPrimaId: resultado.chapaMateriaPrimaId,
            chapaBaseId: resultado.chapaBaseId,
            chapaBaseMateriaPrimaId: resultado.chapaBaseMateriaPrimaId,
            requerChapaBase: resultado.requerChapaBase,
            requerConfirmacaoConstrucao: resultado.requerConfirmacaoConstrucao,
            composicaoFace: resultado.composicaoFace,
            construcaoFace: parsed.construcaoFace,
            baseImpressao: parsed.baseImpressao,
            transmissaoMinimaPct: parsed.transmissaoMinimaPct ?? null,
            iluminacao: parsed.iluminacao,
            laminar: parsed.laminar || Boolean(precos?.laminacaoPadrao),
            fatorVersaoAlgoritmo: "ciede2000-d65-bobina-v2",
          },
          aprovado: false,
          aprovadoPor: null,
          aprovadoEm: null,
          updatedAt: new Date(),
        },
      });
    }
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ sourceId: parsed.sourceId, resultados });
}

async function analisarSvg(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await obterSessao(req, res))) return;
  const parsed = analisarSvgInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, "Confira arte, geometria, escala e iluminação antes de analisar as cores.");
  if (parsed.data.iluminacao !== "sem_iluminacao" && parsed.data.transmissaoMinimaPct == null)
    return void erro(res, 400, "Informe a transmissão mínima definida pela engenharia para avaliar a face iluminada.");
  try {
    const regioes = extrairRegioesCorSvg(parsed.data.svgArte);
    const metricas = calcularMetricasVisiveisSvgPorCaminho(
      parsed.data.svgGeometria,
      parsed.data.larguraSvgMm,
      parsed.data.alturaSvgMm,
    );
    if (metricas.length !== regioes.length)
      return void erro(res, 422, "A fonte colorida e o vetor de corte não têm os mesmos caminhos. Reenvie ou revise a arte.");
    const possuiCamadas = metricas.some(metrica => metrica.camada != null);
    if (possuiCamadas && !metricas.some(metrica => metrica.camada === "face" && metrica.areaM2 > 0))
      return void erro(res, 422, "O SVG em camadas precisa conter caminhos fechados na camada Face.");

    const agregadas = new Map<string, {
      tipoCor: "solida" | "gradiente" | "complexa" | "desconhecida";
      corHex: string | null;
      pantoneCode: string | null;
      cmyk: { c: number; m: number; y: number; k: number } | null;
      coresGradiente: string[];
      areaM2: number;
      pathIndexes: number[];
      caixasMm: Array<{ minX: number; maxX: number; minY: number; maxY: number }>;
    }>();
    regioes.forEach((regiao, index) => {
      const metrica = metricas[index];
      if (possuiCamadas && metrica.camada !== "face") return;
      const areaM2 = metrica.areaM2;
      if (regiao.tipoCor === "desconhecida" || areaM2 <= 0) return;
      if (!metrica.boundsMm || !metrica.contornosBoundsMm.length) throw new CpqFactibilidadeError("Missing bounds for a vector region.", "invalid_geometry");
      const signature = JSON.stringify([
        regiao.tipoCor,
        regiao.corHex ?? null,
        (regiao.pantoneCode ?? "").toUpperCase().replace(/\s+/g, ""),
        regiao.cmyk ?? null,
        regiao.coresGradiente ?? [],
      ]);
      const group = agregadas.get(signature) ?? {
        tipoCor: regiao.tipoCor,
        corHex: regiao.corHex ?? null,
        pantoneCode: regiao.pantoneCode ?? null,
        cmyk: regiao.cmyk ?? null,
        coresGradiente: regiao.coresGradiente ?? [],
        areaM2: 0,
        pathIndexes: [],
        caixasMm: [],
      };
      group.areaM2 += areaM2;
      group.pathIndexes.push(regiao.pathIndex ?? index);
      group.caixasMm.push(...metrica.contornosBoundsMm);
      agregadas.set(signature, group);
    });
    if (!agregadas.size)
      return void erro(res, 422, "Não há regiões preenchidas visíveis para analisar no vetor.");

    const grupos = consolidarRegioesFotograficas([...agregadas.values()]);
    const todasCaixas = grupos.flatMap(grupo => grupo.caixasMm);
    const caixaLetreiroMm = {
      minX: Math.min(...todasCaixas.map(box => box.minX)), maxX: Math.max(...todasCaixas.map(box => box.maxX)),
      minY: Math.min(...todasCaixas.map(box => box.minY)), maxY: Math.max(...todasCaixas.map(box => box.maxY)),
    };
    const body = {
      sourceId: parsed.data.sourceId,
      caixaLetreiroMm,
      regioes: grupos.map(({ caixasMm, ...region }, index) => ({
        ...region,
        key: `regiao-${index + 1}`,
        areaM2: Number(region.areaM2.toFixed(6)),
        dadosPreco: {
          areaLiquidaM2: Number(region.areaM2.toFixed(8)),
          areaTotalM2: Number(caixasMm.reduce((soma, box) => soma + ((box.maxX - box.minX) * (box.maxY - box.minY)) / 1_000_000, 0).toFixed(8)),
          larguraMm: Math.max(...caixasMm.map(box => box.maxX)) - Math.min(...caixasMm.map(box => box.minX)),
          alturaMm: Math.max(...caixasMm.map(box => box.maxY)) - Math.min(...caixasMm.map(box => box.minY)),
          boundingBoxesMm: caixasMm,
        },
      })),
      iluminacao: parsed.data.iluminacao,
      transmissaoMinimaPct: parsed.data.transmissaoMinimaPct ?? null,
      baseImpressao: parsed.data.baseImpressao,
      laminar: parsed.data.laminar,
      construcaoFace: parsed.data.construcaoFace,
      semAdesivo: parsed.data.semAdesivo === true,
    };
    const validated = analisarInput.safeParse(body);
    if (!validated.success)
      return void erro(res, 422, "A extração vetorial produziu dados fora dos limites aceitos.");
    await persistirAnaliseCores(validated.data, res);
  } catch (error) {
    if (error instanceof CpqFactibilidadeError)
      return void erro(res, 422, error.message);
    return void erro(res, 400, error instanceof Error ? error.message : "Não foi possível extrair cores da arte.");
  }
}

async function aprovarCores(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const session = await obterSessao(req, res);
  if (!session) return;
  const parsed = aprovarInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, "A cotação informada é inválida.");
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const mappings = await db.select().from(estudioMapeamentoCoresCotacao)
    .where(eq(estudioMapeamentoCoresCotacao.sourceId, parsed.data.sourceId));
  if (!mappings.length) return void erro(res, 409, "Analise as cores antes de aprovar os materiais.");
  const exigeAutorizacaoAdesivo = mappings.some(row =>
    (row.tipoSugestao === "impresso" || row.tipoSugestao === "imprimax")
      && (row.detalhesJson as Record<string, unknown>).requerChapaBase === true);
  if (exigeAutorizacaoAdesivo && parsed.data.autorizaAdesivoSobreAcrilico !== true)
    return void erro(res, 409, "O vendedor precisa autorizar a composição de acrílico transparente com adesivo antes da aprovação.");
  const pendenciaConsumoBobina = mappings.find(row => {
    if (row.tipoSugestao !== "impresso" && row.tipoSugestao !== "imprimax") return false;
    const details = row.detalhesJson as Record<string, unknown>;
    return row.custoEstimado == null || typeof details.areaTotalM2 !== "number" || details.areaTotalM2 <= 0
      || typeof details.areaConsumoM2 !== "number" || details.areaConsumoM2 <= 0;
  });
  if (pendenciaConsumoBobina)
    return void erro(res, 409, "O custo do adesivo está pendente: cadastre na Administração do CPQ o preço do vinil e da impressão (e, se for o caso, a bobina real e a sangria), confira a geometria ou desconsidere o adesivo se a arte foi lida errado.");
  const pendenciaComposicao = mappings.find(row => {
    const details = row.detalhesJson as Record<string, unknown>;
    return (details.requerChapaBase === true && details.chapaBaseMateriaPrimaId == null)
      || details.requerConfirmacaoConstrucao === true;
  });
  if (pendenciaComposicao)
    return void erro(res, 409, "Falta definir a composição da face: cadastre uma chapa transparente principal compatível e confirme se a face é toda em acrílico.");
  await db.update(estudioMapeamentoCoresCotacao).set({
    aprovado: true,
    aprovadoPor: session.user.id,
    aprovadoEm: new Date(),
    updatedAt: new Date(),
  }).where(eq(estudioMapeamentoCoresCotacao.sourceId, parsed.data.sourceId));
  res.json({ success: true, aprovadoPor: session.user.name, quantidade: mappings.length });
}
