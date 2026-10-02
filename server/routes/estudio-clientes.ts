import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { estudioClientes } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";

function validarCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const base = cpf.slice(0, 9);
  const primeiro = digito(base);
  return cpf === base + primeiro + digito(base + primeiro);
}

function validarCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const base = cnpj.slice(0, 12);
  const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(base + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj === base + primeiro + segundo;
}

function documentoValido(documento: string): boolean {
  return documento.length === 11 ? validarCpf(documento) : validarCnpj(documento);
}

const clienteSchema = z.object({
  documento: z.string().regex(/^(\d{11}|\d{14})$/),
  razao: z.string().trim().max(256).nullable(),
  fantasia: z.string().trim().max(256).nullable(),
  endereco: z.string().trim().max(1000).nullable(),
  email: z.string().trim().max(320).nullable(),
  whatsapp: z.string().trim().max(40).nullable(),
}).strict().refine((cliente) => documentoValido(cliente.documento), {
  path: ["documento"],
  message: "CPF ou CNPJ inválido.",
});

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
      console.error("[EstudioClientes] Falha na rota:", error);
      if (!res.headersSent) respostaErro(res, 500, "Não foi possível acessar o cadastro de clientes agora.");
    });
  };
}

async function exigirSessao(req: Request, res: Response): Promise<boolean> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (sessao) return true;
  respostaErro(res, 401, "Entre no Radrasys para acessar o cadastro de clientes.");
  return false;
}

/** Cadastro compartilhado de clientes do Estúdio, separado dos snapshots de cotação. */
export function registrarRotasEstudioClientes(app: Express): void {
  app.get("/api/letra-caixa/clientes", rota(listarOuConsultarCliente));
  app.post("/api/letra-caixa/clientes", rota(salvarCliente));
}

async function listarOuConsultarCliente(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }

  const documentoInformado = typeof req.query.documento === "string" ? req.query.documento : "";
  if (documentoInformado) {
    const documento = documentoInformado.replace(/\D/g, "");
    if (!documentoValido(documento)) {
      respostaErro(res, 400, "Informe um CPF ou CNPJ completo para consultar o cadastro.");
      return;
    }
    const [cliente] = await db.select().from(estudioClientes)
      .where(eq(estudioClientes.documento, documento)).limit(1);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ cliente: cliente ?? null });
    return;
  }

  const busca = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : "";
  const digitos = busca.replace(/\D/g, "");
  const pagina = Math.max(1, Math.min(10000, Number.parseInt(String(req.query.pagina ?? "1"), 10) || 1));
  const limite = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limite ?? "25"), 10) || 25));
  const filtros = busca ? [
    ilike(estudioClientes.razao, `%${busca}%`),
    ilike(estudioClientes.fantasia, `%${busca}%`),
    ilike(estudioClientes.email, `%${busca}%`),
    ilike(estudioClientes.whatsapp, `%${busca}%`),
    ...(digitos ? [ilike(estudioClientes.documento, `%${digitos}%`)] : []),
  ] : [];
  const filtro = filtros.length ? or(...filtros) : undefined;
  const [contagem] = filtro
    ? await db.select({ total: count() }).from(estudioClientes).where(filtro)
    : await db.select({ total: count() }).from(estudioClientes);
  const clientes = filtro
    ? await db.select().from(estudioClientes).where(filtro).orderBy(desc(estudioClientes.updatedAt)).limit(limite).offset((pagina - 1) * limite)
    : await db.select().from(estudioClientes).orderBy(desc(estudioClientes.updatedAt)).limit(limite).offset((pagina - 1) * limite);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ clientes, total: contagem?.total ?? 0, pagina, limite });
}

async function salvarCliente(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirSessao(req, res))) return;
  const validado = clienteSchema.safeParse(req.body);
  if (!validado.success) {
    respostaErro(res, 400, "Confira os dados do cliente antes de salvar.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }

  const dados = validado.data;
  const [cliente] = await db.insert(estudioClientes).values(dados).onConflictDoUpdate({
    target: estudioClientes.documento,
    set: { ...dados, updatedAt: new Date() },
  }).returning();
  res.json({ cliente });
}
