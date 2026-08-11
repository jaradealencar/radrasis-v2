import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import type { AppRole } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: {
    id: string;
    name: string;
    email: string;
    role: AppRole;
  } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: TrpcContext["user"] = null;

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(opts.req.headers),
    });
    if (session) {
      user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role as AppRole,
      };
    }
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
