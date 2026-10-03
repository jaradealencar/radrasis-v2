import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { estudioChapas } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import {
  calcularNestingMultiMaterial,
  CpqNestingError,
  type CpqMaterial,
} from "../services/cpqNesting";

const chapaInput = z
  .object({
    mubisysMateriaPrimaId: z.number().int().positive(),
    nome: z.string().trim().min(1).max(256),
    larguraMm: z.number().int().min(10).max(50_000),
    alturaMm: z.number().int().min(10).max(50_000),
  })
  .strict();

const nestingInput = z
  .object({
    svg: z.string().min(20).max(1_500_000),
    larguraSvgMm: z.number().finite().positive().max(50_000),
    alturaSvgMm: z.number().finite().positive().max(50_000),
    espacamentoMm: z.number().finite().min(0).max(50).optional().default(0),
    materiaPrimaIds: z.array(z.number().int().positive()).min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
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
  res.json({ chapas: rows });
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
  const { data } = parsed;
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
  const values = {
    mubisysMateriaPrimaId: data.mubisysMateriaPrimaId,
    nome: data.nome,
    larguraMm: Math.max(data.larguraMm, data.alturaMm),
    alturaMm: Math.min(data.larguraMm, data.alturaMm),
    ativo: true,
    updatedAt: new Date(),
  };
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  try {
    if (id == null) {
      const [record] = await db
        .insert(estudioChapas)
        .values(values)
        .returning();
      res.status(201).json({ chapa: record });
    } else {
      const [record] = await db
        .update(estudioChapas)
        .set(values)
        .where(eq(estudioChapas.id, id))
        .returning();
      if (!record)
        return void erro(res, 404, "Formato de chapa não encontrado.");
      res.json({ chapa: record });
    }
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
  const [record] = await db
    .update(estudioChapas)
    .set({ ativo: false, updatedAt: new Date() })
    .where(eq(estudioChapas.id, id))
    .returning({ id: estudioChapas.id });
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
    });
  }

  try {
    const resultado = await calcularNestingMultiMaterial({
      ...parsed.data,
      materiais,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      motor: "Deepnest local",
      unidades: { comprimento: "mm", area: "m2", perimetro: "m" },
      calculadoEm: new Date().toISOString(),
      materiais: resultado,
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
