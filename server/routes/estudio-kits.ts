import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { estudioKits } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";

const kitSchema = z.object({
  linhas: z.array(z.record(z.string(), z.unknown())).max(300).default([]),
  precificacao: z.record(z.string(), z.unknown()).nullable().optional(),
  nomeCompleto: z.string().max(512).nullable().optional(),
  descricaoProduto: z.string().max(5000).optional(),
  prazoDiasUteis: z.number().int().min(0).nullable().optional(),
  kitProdutos: z.array(z.object({
    key: z.string().regex(/^\d+_\d+$/),
    nome: z.string().max(512),
  }).passthrough()).max(300).optional(),
  fotoUrl: z.string().max(1_500_000).nullable().optional(),
  fotoAssetId: z.string().max(512).nullable().optional(),
  categoria: z.string().max(100).nullable().optional(),
  subcategoria: z.string().max(100).nullable().optional(),
  tipoProduto: z.string().max(100).nullable().optional(),
}).passthrough();

function respostaErro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Rejeita cabeçalho Origin inválido.
  }
  respostaErro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioKits] Falha na rota:", error);
      if (!res.headersSent) respostaErro(res, 500, "Não foi possível salvar o cadastro do produto agora.");
    });
  };
}

async function exigirSessao(req: Request, res: Response): Promise<boolean> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (sessao) return true;
  respostaErro(res, 401, "Entre no Radrasys para carregar e salvar os cadastros de produtos.");
  return false;
}

/** Composições por modelo do Estúdio, persistidas no Postgres compartilhado. */
export function registrarRotasEstudioKits(app: Express): void {
  app.get("/api/letra-caixa/kits", rota(listarKits));
  app.put("/api/letra-caixa/kits/:chave", rota(salvarKit));
}

async function listarKits(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }

  const registros = await db.select().from(estudioKits).orderBy(asc(estudioKits.chave));
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ kits: registros.map(registro => ({ chave: registro.chave, kit: registro.dadosJson })) });
}

async function salvarKit(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const chave = req.params.chave;
  if (!/^\d+_\d+$/.test(chave)) {
    respostaErro(res, 400, "O identificador do produto/modelo é inválido.");
    return;
  }

  const parsed = z.object({ kit: kitSchema }).strict().safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Confira os dados do produto antes de salvar.");
    return;
  }
  const [produtoId, modeloId] = chave.split("_").map(Number);
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }

  await db.insert(estudioKits).values({
    chave,
    produtoId,
    modeloId,
    dadosJson: parsed.data.kit,
  }).onConflictDoUpdate({
    target: estudioKits.chave,
    set: { produtoId, modeloId, dadosJson: parsed.data.kit, updatedAt: new Date() },
  });
  res.json({ success: true, chave });
}
