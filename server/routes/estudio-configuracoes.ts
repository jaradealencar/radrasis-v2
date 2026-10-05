import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { estudioConfiguracoes } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";

const CONFIGURACAO_PADRAO = {
  custoFixoPct: 40,
  vendedores: [] as string[],
  whatsappVendedores: {} as Record<string, string>,
  formasPagamento: { cartao: true, boleto: true, ted: true },
  jurosCartaoPct: [0, 0, 0, 0, 0, 0],
  papeisPeca: [
    "Face",
    "Fundo",
    "Lateral",
    "Pintura",
    "Iluminação",
    "Fixação",
    "Insumo fabricação",
    "Produtividade",
  ],
  regrasLeituraArte: "",
};

const configuracaoSchema = z
  .object({
    custoFixoPct: z.number().min(0).max(1000),
    vendedores: z.array(z.string().trim().min(1).max(120)).max(200),
    whatsappVendedores: z.record(z.string(), z.string().max(32)),
    formasPagamento: z
      .object({
        cartao: z.boolean(),
        boleto: z.boolean(),
        ted: z.boolean(),
      })
      .strict(),
    jurosCartaoPct: z.array(z.number().min(0).max(100)).length(6),
    papeisPeca: z.array(z.string().trim().min(1).max(120)).max(200),
    regrasLeituraArte: z.string().max(4000).default(""),
  })
  .strict();

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Origem malformada é rejeitada abaixo.
  }
  res
    .status(403)
    .json({ error: "A solicitação precisa vir do próprio sistema." });
  return false;
}

async function exigirSessao(req: Request, res: Response): Promise<boolean> {
  const sessao = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (sessao) return true;
  res
    .status(401)
    .json({
      error: "Entre no Radrasys para carregar e salvar as configurações.",
    });
  return false;
}

function registrarHandler(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioConfiguracoes] Falha na rota:", error);
      if (!res.headersSent)
        res
          .status(500)
          .json({ error: "Não foi possível salvar as configurações agora." });
    });
  };
}

/** Configuração comum do CPQ Letreiros Express, armazenada no Postgres do Radrasys. */
export function registrarRotasEstudioConfiguracoes(app: Express): void {
  app.get(
    "/api/letra-caixa/configuracoes",
    registrarHandler(carregarConfiguracoes)
  );
  app.put(
    "/api/letra-caixa/configuracoes",
    registrarHandler(salvarConfiguracoes)
  );
}

async function carregarConfiguracoes(
  req: Request,
  res: Response
): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "O banco de dados está indisponível." });
    return;
  }

  const [linha] = await db
    .select()
    .from(estudioConfiguracoes)
    .where(eq(estudioConfiguracoes.id, 1))
    .limit(1);
  const salvo = linha?.configuracaoJson;
  const combinado =
    salvo && typeof salvo === "object" && !Array.isArray(salvo)
      ? {
          ...CONFIGURACAO_PADRAO,
          ...salvo,
          formasPagamento: {
            ...CONFIGURACAO_PADRAO.formasPagamento,
            ...(typeof salvo.formasPagamento === "object" &&
            salvo.formasPagamento !== null
              ? salvo.formasPagamento
              : {}),
          },
        }
      : CONFIGURACAO_PADRAO;
  const validado = configuracaoSchema.safeParse(combinado);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ config: validado.success ? validado.data : CONFIGURACAO_PADRAO });
}

async function salvarConfiguracoes(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const validado = z
    .object({ config: configuracaoSchema })
    .strict()
    .safeParse(req.body);
  if (!validado.success) {
    res
      .status(400)
      .json({ error: "Confira os dados das configurações antes de salvar." });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "O banco de dados está indisponível." });
    return;
  }

  const config = validado.data.config;
  await db
    .insert(estudioConfiguracoes)
    .values({ id: 1, configuracaoJson: config })
    .onConflictDoUpdate({
      target: estudioConfiguracoes.id,
      set: { configuracaoJson: config, updatedAt: new Date() },
    });
  res.json({ success: true });
}
