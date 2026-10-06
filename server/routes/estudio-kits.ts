import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { estudioKits } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import { CATEGORIA_COM_PRODUTIVIDADES, ehMateriaProdutividade, MAX_PRODUTIVIDADES_RELACIONADAS } from "../../shared/produtividade-solda";

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
  // IDs (MubiSys) das produtividades de solda ligadas ao produto; só na categoria "Letreiros" (ver validarProdutividadesRelacionadas).
  produtividadesRelacionadas: z.array(z.number().int().positive()).max(MAX_PRODUTIVIDADES_RELACIONADAS).optional(),
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

/** Composições por modelo do CPQ Letreiros Express, persistidas no Postgres compartilhado. */
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

  const relacionadas = parsed.data.kit.produtividadesRelacionadas ?? [];
  if (relacionadas.length) {
    const erro = await validarProdutividadesRelacionadas(db, chave, parsed.data.kit.categoria, relacionadas);
    if (erro) {
      respostaErro(res, erro.status, erro.mensagem);
      return;
    }
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

type BancoDeDados = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Produtividades de solda ligadas a um produto: só para a categoria Letreiros, sem repetidas e só matérias-primas que são de
 * fato produtividade no catálogo do MubiSys. O catálogo é consultado apenas para os IDs que ainda não estavam salvos neste kit,
 * porque a gravação do kit é automática e frequente.
 */
async function validarProdutividadesRelacionadas(
  db: BancoDeDados,
  chave: string,
  categoria: unknown,
  ids: number[],
): Promise<{ status: number; mensagem: string } | null> {
  if (categoria !== CATEGORIA_COM_PRODUTIVIDADES)
    return { status: 400, mensagem: `Só produtos da categoria ${CATEGORIA_COM_PRODUTIVIDADES} podem ter produtividades de solda relacionadas.` };
  if (new Set(ids).size !== ids.length) return { status: 400, mensagem: "Há produtividades repetidas na lista." };

  const [existente] = await db.select({ dadosJson: estudioKits.dadosJson }).from(estudioKits).where(eq(estudioKits.chave, chave));
  const salvas = existente?.dadosJson?.produtividadesRelacionadas;
  const jaSalvas = new Set(Array.isArray(salvas) ? salvas : []);
  const novas = ids.filter(id => !jaSalvas.has(id));
  if (!novas.length) return null;

  let catalogo: Awaited<ReturnType<typeof listarMateriasPrimas>>;
  try {
    catalogo = await listarMateriasPrimas();
  } catch (error) {
    console.error("[EstudioKits] Falha ao conferir produtividades no MubiSys:", error);
    return { status: 503, mensagem: "Não foi possível confirmar as produtividades no MubiSys agora. Tente de novo em instantes." };
  }
  const nomePorId = new Map(catalogo.map(materia => [materia.id, materia.nome]));
  const invalidas = novas.filter(id => !ehMateriaProdutividade(nomePorId.get(id)));
  if (invalidas.length)
    return { status: 400, mensagem: `Estas matérias-primas não são produtividades de solda do catálogo do MubiSys: ${invalidas.join(", ")}.` };
  return null;
}
