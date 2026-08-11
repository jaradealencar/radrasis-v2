import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";
import jwt from "jsonwebtoken";
import { getLocalUserByEmail, getLocalUserById } from "../db/db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  // Usuário local (e-mail+senha ou OAuth mapeado), disponível em paralelo ao OAuth user
  localUser: {
    id: number;
    name: string;
    email: string | null;
    role: "master" | "admin" | "gestor" | "vendas" | "logistica" | "producao" | "financeiro" | "empacotamento";
  } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let localUser: TrpcContext["localUser"] = null;

  // 1. Tenta autenticar via OAuth (cookie app_session_id)
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // 2. Se autenticado via OAuth, tenta mapear para um localUser pelo e-mail
  if (user && user.email) {
    try {
      const dbUser = await getLocalUserByEmail(user.email.toLowerCase());
      if (dbUser && dbUser.active === "sim") {
        localUser = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
        };
      }
    } catch {
      // silently ignore
    }
  }

  // 2b. Se for o dono do projeto e não há localUser ainda (sem cadastro local), cria localUser sintético como master
  if (!localUser && user && user.openId === ENV.ownerOpenId) {
    localUser = {
      id: 0,
      name: user.name ?? "Master",
      email: user.email ?? null,
      role: "master",
    };
  }

  // 3. Tenta autenticar via local_session cookie (e-mail+senha ou OAuth callback)
  if (!localUser) {
    const localSessionCookie = opts.req.cookies?.local_session;
    if (localSessionCookie) {
      try {
        const decoded = jwt.verify(
          localSessionCookie,
          process.env.JWT_SECRET ?? "secret"
        ) as { localUserId: number; role: string; name: string; email: string };

        const dbUser = await getLocalUserById(decoded.localUserId);
        if (dbUser && dbUser.active === "sim") {
          localUser = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          };
        }
      } catch {
        localUser = null;
      }
    }
  }

  // 4. Se há localUser mas não há user OAuth, cria user sintético para compatibilidade
  //    com protectedProcedure (que verifica ctx.user)
  if (localUser && !user) {
    user = {
      id: localUser.id,
      openId: `local_${localUser.id}`,
      name: localUser.name,
      email: localUser.email ?? "",
      loginMethod: "local",
      role: (localUser.role === "master" || localUser.role === "admin" ? "admin" : "user") as "admin" | "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    localUser,
  };
}
