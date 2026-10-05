import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { estudioChapas, materiaPrimaCadastros, materiaPrimaCategorias } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import {
  calcularNestingMultiMaterial,
  CpqNestingError,
  emitirReciboNesting,
  type CpqMaterial,
} from "../services/cpqNesting";
import {
  calcularHashPecasParaNesting,
  verificarReciboDecisaoFactibilidade,
  verificarTicketAnaliseFactibilidade,
} from "../services/cpqFactibilidadeFabricacao";

const chapaInput = z
  .object({
    mubisysMateriaPrimaId: z.number().int().positive(),
    nome: z.string().trim().min(1).max(256),
    larguraMm: z.number().int().min(10).max(50_000),
    alturaMm: z.number().int().min(10).max(50_000),
    pantoneCode: z.string().trim().max(32).nullable().optional(),
    cmykC: z.number().finite().min(0).max(100).nullable().optional(),
    cmykM: z.number().finite().min(0).max(100).nullable().optional(),
    cmykY: z.number().finite().min(0).max(100).nullable().optional(),
    cmykK: z.number().finite().min(0).max(100).nullable().optional(),
    transmissaoLuzPct: z.number().finite().min(0).max(100).nullable().optional(),
    transparenciaTipo: z.enum(["opaca", "translucida", "transparente"]).nullable().optional(),
    principal: z.boolean().optional().default(false),
    temCor: z.boolean().optional().default(true),
    espessuraMm: z.number().finite().positive().max(10_000).nullable().optional(),
    densidadeGCm3: z.number().finite().positive().max(1_000).nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const cmyk = [input.cmykC, input.cmykM, input.cmykY, input.cmykK];
    if (cmyk.some(value => value != null) && cmyk.some(value => value == null))
      context.addIssue({ code: "custom", message: "Preencha os quatro canais CMYK ou deixe todos vazios." });
  });

const pecaNestingInput = z.object({
  id: z.string().min(1).max(80),
  svg: z.string().min(20).max(1_500_000),
  larguraMm: z.number().finite().positive().max(50_000),
  alturaMm: z.number().finite().positive().max(50_000),
}).strict();

const nestingInput = z
  .object({
    sourceId: z.string().min(1).max(80).optional(),
    resultadoHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    ticketAnalise: z.string().min(20).max(2000).optional(),
    acaoFactibilidade: z.enum(["APROVAR_EMENDA_TECNICA", "REDIMENSIONAR_PARA_CABER"]).nullable().optional(),
    reciboDecisaoFactibilidade: z.string().min(20).max(2000).nullable().optional(),
    svg: z.string().min(20).max(1_500_000).optional(),
    larguraSvgMm: z.number().finite().positive().max(50_000).optional(),
    alturaSvgMm: z.number().finite().positive().max(50_000).optional(),
    pecas: z.array(pecaNestingInput).min(1).max(100).optional(),
    lotesPorMaterial: z.array(z.object({
      materiaPrimaId: z.number().int().positive(),
      pecas: z.array(pecaNestingInput).min(1).max(100),
    }).strict()).min(1).max(10).optional(),
    espacamentoMm: z.number().finite().min(0).max(50).optional().default(0),
    materiaPrimaIds: z.array(z.number().int().positive()).min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.pecas?.length && !input.lotesPorMaterial?.length && (!input.svg || !input.larguraSvgMm || !input.alturaSvgMm)) {
      context.addIssue({ code: "custom", message: "Informe uma arte e escala física ou uma lista de peças vetoriais." });
    }
    if (input.sourceId && (!input.resultadoHash || !input.ticketAnalise || (!input.lotesPorMaterial?.length && (!input.pecas?.length || input.materiaPrimaIds.length !== 1)))) {
      context.addIssue({ code: "custom", message: "Nesting do CPQ precisa do recibo de factibilidade e de uma lista de peças por material." });
    }
    if (input.pecas?.length && input.pecas.reduce((sum, peca) => sum + peca.svg.length, 0) > 1_500_000) {
      context.addIssue({ code: "custom", message: "O conjunto de SVGs excede o limite de tamanho permitido." });
    }
    if (input.lotesPorMaterial && input.lotesPorMaterial.reduce((sum, lote) => sum + lote.pecas.reduce((subtotal, peca) => subtotal + peca.svg.length, 0), 0) > 1_500_000) {
      context.addIssue({ code: "custom", message: "Os lotes de SVG excedem o limite de tamanho permitido." });
    }
    if (input.lotesPorMaterial) {
      const loteIds = input.lotesPorMaterial.map(lote => lote.materiaPrimaId);
      if (new Set(loteIds).size !== loteIds.length || loteIds.length !== input.materiaPrimaIds.length
        || loteIds.some(id => !input.materiaPrimaIds.includes(id))) {
        context.addIssue({ code: "custom", message: "Cada materia-prima precisa ter exatamente um lote geometrico." });
      }
    }
    if (new Set(input.materiaPrimaIds).size !== input.materiaPrimaIds.length) {
      context.addIssue({
        code: "custom",
        message: "A lista de matérias-primas não pode ter IDs repetidos.",
      });
    }
  });

function erro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Origem inválida é rejeitada abaixo.
  }
  erro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

async function sessao(req: Request, res: Response) {
  const result = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (!result)
    erro(res, 401, "Entre no Radrasys para acessar o nesting do CPQ.");
  return result;
}

async function exigirGestor(req: Request, res: Response): Promise<boolean> {
  const current = await sessao(req, res);
  if (!current) return false;
  if (
    !["admin", "master", "gestor"].includes(String(current.user.role ?? ""))
  ) {
    erro(
      res,
      403,
      "Somente gestor, admin ou master pode cadastrar formatos de chapa."
    );
    return false;
  }
  return true;
}

function capturar(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioNesting] Falha na rota:", error);
      if (!res.headersSent)
        erro(res, 500, "Não foi possível concluir o nesting agora.");
    });
  };
}

/** Formatos de chapa cadastrados localmente e nesting por material no CPQ. */
export function registrarRotasEstudioNesting(app: Express): void {
  app.get("/api/letra-caixa/chapas", capturar(listarChapas));
  app.post("/api/letra-caixa/chapas", capturar(criarChapa));
  app.put("/api/letra-caixa/chapas/:id", capturar(atualizarChapa));
  app.delete("/api/letra-caixa/chapas/:id", capturar(desativarChapa));
  app.post("/api/letra-caixa/nesting", capturar(calcularNesting));
  app.get("/api/letra-caixa/materias-peso", capturar(listarDadosPeso));
}

async function listarChapas(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await sessao(req, res))) return;
  const parsedId = req.query.materiaPrimaId
    ? Number(req.query.materiaPrimaId)
    : null;
  if (parsedId != null && (!Number.isInteger(parsedId) || parsedId <= 0)) {
    erro(res, 400, "O ID da matéria-prima é inválido.");
    return;
  }
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const rows = await db
    .select()
    .from(estudioChapas)
    .where(
      parsedId == null
        ? eq(estudioChapas.ativo, true)
        : eq(estudioChapas.mubisysMateriaPrimaId, parsedId)
    )
    .orderBy(
      asc(estudioChapas.mubisysMateriaPrimaId),
      asc(estudioChapas.larguraMm),
      asc(estudioChapas.alturaMm)
    );
  res.setHeader("Cache-Control", "private, no-store");
  const cadastros = rows.length
    ? await db.select({ id: materiaPrimaCadastros.mubisysMateriaPrimaId, espessuraMm: materiaPrimaCadastros.espessuraMm, densidadeKgM3: materiaPrimaCadastros.densidadeKgM3 })
        .from(materiaPrimaCadastros)
        .where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, Array.from(new Set(rows.map(row => row.mubisysMateriaPrimaId)))))
    : [];
  const dadosPorMateria = new Map(cadastros.map(item => [item.id, {
    espessuraMm: item.espessuraMm == null ? null : Number(item.espessuraMm),
    densidadeGCm3: item.densidadeKgM3 == null ? null : Number((Number(item.densidadeKgM3) / 1000).toFixed(4)),
  }]));
  res.json({ chapas: rows.map(row => ({ ...row, espessuraMm: dadosPorMateria.get(row.mubisysMateriaPrimaId)?.espessuraMm ?? null, densidadeGCm3: dadosPorMateria.get(row.mubisysMateriaPrimaId)?.densidadeGCm3 ?? null })) });
}

/** Dados técnicos (espessura, densidade, dimensões do perfil, peso específico) usados só para estimar o peso do letreiro. */
async function listarDadosPeso(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await sessao(req, res))) return;
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [cadastros, categorias] = await Promise.all([
    db.select().from(materiaPrimaCadastros),
    db.select().from(materiaPrimaCategorias),
  ]);
  const categoriaPorId = new Map(categorias.map(item => [item.id, item]));
  const numero = (valor: string | null) => (valor == null ? null : Number(valor));
  const materias = cadastros.map(cadastro => {
    const categoria = cadastro.categoriaId == null ? null : categoriaPorId.get(cadastro.categoriaId) ?? null;
    const tipo = categoria?.usaDadosChapa ? "chapa" : categoria?.usaDadosPerfil ? "perfil" : categoria?.usaDadosBobina ? "bobina" : "outro";
    const densidadeKgM3 = numero(cadastro.densidadeKgM3);
    return {
      id: cadastro.mubisysMateriaPrimaId,
      tipo,
      espessuraMm: numero(cadastro.espessuraMm),
      densidadeGCm3: densidadeKgM3 == null ? null : densidadeKgM3 / 1000,
      perfilAlturaMm: numero(cadastro.perfilAlturaMm),
      perfilLarguraMm: numero(cadastro.perfilLarguraMm),
      perfilComprimentoMm: numero(cadastro.perfilComprimentoMm),
      pesoEspecificoKg: numero(cadastro.pesoEspecificoKg),
    };
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ materias });
}

async function salvarChapa(
  req: Request,
  res: Response,
  id?: number
): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const parsed = chapaInput.safeParse(req.body);
  if (!parsed.success)
    return void erro(
      res,
      400,
      "Confira material e dimensões da chapa (em milímetros)."
    );
  const { espessuraMm, densidadeGCm3, ...data } = parsed.data;
  const materiasMubiSys = await listarMateriasPrimas();
  if (
    !materiasMubiSys.some(
      material => material.id === data.mubisysMateriaPrimaId
    )
  ) {
    return void erro(
      res,
      422,
      "A matéria-prima não existe no catálogo atual do MubiSys."
    );
  }
  const { temCor } = data;
  const values = {
    mubisysMateriaPrimaId: data.mubisysMateriaPrimaId,
    temCor,
    nome: data.nome,
    larguraMm: Math.max(data.larguraMm, data.alturaMm),
    alturaMm: Math.min(data.larguraMm, data.alturaMm),
    pantoneCode: temCor ? data.pantoneCode?.trim().toUpperCase() || null : null,
    cmykC: temCor ? data.cmykC == null ? null : String(data.cmykC) : null,
    cmykM: temCor ? data.cmykM == null ? null : String(data.cmykM) : null,
    cmykY: temCor ? data.cmykY == null ? null : String(data.cmykY) : null,
    cmykK: temCor ? data.cmykK == null ? null : String(data.cmykK) : null,
    transmissaoLuzPct: temCor ? data.transmissaoLuzPct == null ? null : String(data.transmissaoLuzPct) : null,
    transparenciaTipo: temCor ? data.transparenciaTipo ?? null : null,
    ativo: true,
    updatedAt: new Date(),
  };
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  try {
    const record = await db.transaction(async tx => {
      const existentes = await tx
        .select({ id: estudioChapas.id, principal: estudioChapas.principal })
        .from(estudioChapas)
        .where(eq(estudioChapas.mubisysMateriaPrimaId, data.mubisysMateriaPrimaId));
      const outroPrincipal = existentes.some(row => row.principal && row.id !== id);
      const principal = data.principal || !outroPrincipal;
      if (principal) {
        await tx.update(estudioChapas).set({ principal: false })
          .where(eq(estudioChapas.mubisysMateriaPrimaId, data.mubisysMateriaPrimaId));
      }
      if (espessuraMm != null || densidadeGCm3 != null) {
        const dadosTecnicos = {
          ...(espessuraMm != null ? { espessuraMm: String(espessuraMm) } : {}),
          ...(densidadeGCm3 != null ? { densidadeKgM3: String(Math.round(densidadeGCm3 * 1000 * 10000) / 10000) } : {}),
        };
        await tx.insert(materiaPrimaCadastros)
          .values({ mubisysMateriaPrimaId: data.mubisysMateriaPrimaId, ...dadosTecnicos, updatedAt: new Date() })
          .onConflictDoUpdate({ target: materiaPrimaCadastros.mubisysMateriaPrimaId, set: { ...dadosTecnicos, updatedAt: new Date() } });
      }
      const chapaValues = { ...values, principal };
      if (id == null) {
        const [inserted] = await tx.insert(estudioChapas).values(chapaValues).returning();
        return inserted;
      }
      const [updated] = await tx.update(estudioChapas).set(chapaValues)
        .where(eq(estudioChapas.id, id)).returning();
      return updated;
    });
    if (!record) return void erro(res, 404, "Formato de chapa não encontrado.");
    if (id == null) res.status(201).json({ chapa: record });
    else res.json({ chapa: record });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      erro(res, 409, "Já existe esse tamanho de chapa para a matéria-prima.");
      return;
    }
    throw error;
  }
}

async function criarChapa(req: Request, res: Response): Promise<void> {
  await salvarChapa(req, res);
}

async function atualizarChapa(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return void erro(res, 400, "O ID do formato de chapa é inválido.");
  await salvarChapa(req, res, id);
}

async function desativarChapa(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return void erro(res, 400, "O ID do formato de chapa é inválido.");
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const record = await db.transaction(async tx => {
    const [chapa] = await tx.select().from(estudioChapas).where(eq(estudioChapas.id, id));
    if (!chapa) return null;
    await tx.update(estudioChapas)
      .set({ ativo: false, principal: false, updatedAt: new Date() })
      .where(eq(estudioChapas.id, id));
    if (chapa.principal) {
      const [substituta] = await tx.select({ id: estudioChapas.id }).from(estudioChapas)
        .where(and(eq(estudioChapas.mubisysMateriaPrimaId, chapa.mubisysMateriaPrimaId), eq(estudioChapas.ativo, true)))
        .orderBy(asc(estudioChapas.larguraMm), asc(estudioChapas.alturaMm))
        .limit(1);
      if (substituta) await tx.update(estudioChapas)
        .set({ principal: true, updatedAt: new Date() })
        .where(eq(estudioChapas.id, substituta.id));
    }
    return { id: chapa.id };
  });
  if (!record) return void erro(res, 404, "Formato de chapa não encontrado.");
  res.json({ success: true, id });
}

async function calcularNesting(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await sessao(req, res))) return;
  const parsed = nestingInput.safeParse(req.body);
  if (!parsed.success)
    return void erro(
      res,
      400,
      "Confira SVG, escala física, espaçamento e materiais selecionados."
    );
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");

  const [catalogo, chapas] = await Promise.all([
    listarMateriasPrimas(),
    db
      .select()
      .from(estudioChapas)
      .where(
        inArray(
          estudioChapas.mubisysMateriaPrimaId,
          parsed.data.materiaPrimaIds
        )
      )
      .then(rows => rows.filter(row => row.ativo)),
  ]);
  const byId = new Map(catalogo.map(material => [material.id, material]));
  const lotesPorMaterial = new Map((parsed.data.lotesPorMaterial ?? []).map(lote => [lote.materiaPrimaId, lote.pecas]));
  const materiais: CpqMaterial[] = [];
  for (const id of parsed.data.materiaPrimaIds) {
    const material = byId.get(id);
    if (!material)
      return void erro(
        res,
        422,
        `A matéria-prima ${id} não está no catálogo atual do MubiSys.`
      );
    materiais.push({
      id: material.id,
      nome: material.nome,
      custoUnitario: Number(material.valor_custo) || 0,
      unidadeCusto: material.unidade_custo || "",
      chapas: chapas.filter(chapa => chapa.mubisysMateriaPrimaId === id),
      ...(lotesPorMaterial.has(id) ? { pecas: lotesPorMaterial.get(id)! } : {}),
    });
  }

  if (parsed.data.sourceId) {
    try {
      const claims = verificarTicketAnaliseFactibilidade(
        parsed.data.ticketAnalise!,
        parsed.data.sourceId,
        parsed.data.resultadoHash!
      );
      let factorPecas: "hashPecasParaNesting" | "hashPecasRedimensionadasOpcao" = "hashPecasParaNesting";
      if (claims.statusFactibilidade === "REQUER_APROVACAO_EMENDA") {
        const acao = parsed.data.acaoFactibilidade;
        const recibo = parsed.data.reciboDecisaoFactibilidade;
        if (!acao || !recibo) throw new Error("A emenda precisa ser aprovada antes do nesting.");
        const decisao = verificarReciboDecisaoFactibilidade(
          recibo,
          parsed.data.sourceId,
          parsed.data.resultadoHash!,
          acao
        );
        if (acao === "REDIMENSIONAR_PARA_CABER") {
          if (
            claims.hashSvgRedimensionadoOpcao == null ||
            decisao.fatorEscalaAprovada == null ||
            Math.abs(decisao.fatorEscalaAprovada - claims.fatorEscalaMinimoParaCaber) > 1e-8
          ) throw new Error("O redimensionamento não corresponde à opção aprovada.");
          factorPecas = "hashPecasRedimensionadasOpcao";
        }
      } else if (parsed.data.acaoFactibilidade || parsed.data.reciboDecisaoFactibilidade) {
        throw new Error("Uma análise apta não pode usar uma decisão de emenda.");
      }
      const lotes = parsed.data.lotesPorMaterial ?? [{ materiaPrimaId: parsed.data.materiaPrimaIds[0], pecas: parsed.data.pecas! }];
      if (parsed.data.lotesPorMaterial && claims.materiais.length !== lotes.length)
        throw new Error("Os lotes de materiais não correspondem à análise de factibilidade assinada.");
      for (const lote of lotes) {
        const materialAssinado = claims.materiais.find(item => item.idMateriaPrima === lote.materiaPrimaId);
        if (!materialAssinado) throw new Error(`O material ${lote.materiaPrimaId} não pertence à análise de factibilidade assinada.`);
        const hashEsperado = materialAssinado[factorPecas];
        if (!hashEsperado || calcularHashPecasParaNesting(lote.pecas) !== hashEsperado)
          throw new Error(`As peças de ${lote.materiaPrimaId} não correspondem ao resultado aprovado.`);
      }
    } catch (error) {
      erro(res, 409, error instanceof Error ? error.message : "Recalcule a factibilidade antes do nesting.");
      return;
    }
  }

  try {
    const resultado = await calcularNestingMultiMaterial({
      svg: parsed.data.svg,
      larguraSvgMm: parsed.data.larguraSvgMm,
      alturaSvgMm: parsed.data.alturaSvgMm,
      pecas: parsed.data.pecas,
      espacamentoMm: parsed.data.espacamentoMm,
      materiais,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      motor: "Deepnest local",
      unidades: { comprimento: "mm", area: "m2", perimetro: "m" },
      calculadoEm: new Date().toISOString(),
      materiais: resultado.map(material => ({
        ...material,
        reciboIntegridade: parsed.data.sourceId
          ? emitirReciboNesting(parsed.data.sourceId, parsed.data.resultadoHash!, parsed.data.acaoFactibilidade ?? null, material)
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof CpqNestingError) {
      const status =
        error.code === "configuration" || error.code === "engine"
          ? 503
          : error.code === "no_fit"
            ? 422
            : 400;
      erro(res, status, error.message);
      return;
    }
    throw error;
  }
}
