import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { adminAc } from "better-auth/plugins/admin/access";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import { getPool } from "../db/db-connection";
import * as schema from "../../drizzle/schema";

// Instância própria (mesmo pool compartilhado de server/db/db.ts via
// getPool()) — o adapter do Better Auth precisa de um client Drizzle
// síncrono na inicialização, diferente do getDb() lazy/assíncrono usado no
// resto do server.
const db = drizzle(getPool());

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Mesma lib (bcryptjs) e custo (10) já usados em todo o resto do app
    // pra senha admin-provisionada — evita ter dois esquemas de hash
    // convivendo (o scrypt padrão do Better Auth vs. bcrypt do resto).
    password: {
      hash: (password: string) => bcrypt.hash(password, 10),
      verify: ({ hash, password }: { hash: string; password: string }) =>
        bcrypt.compare(password, hash),
    },
  },
  plugins: [
    // adminRoles: quem o plugin considera "admin" pros próprios endpoints
    // dele (createUser/setRole/etc.). A autorização real do app continua
    // sendo requireRole() em server/_core/trpc.ts. "master" precisa
    // aparecer também em `roles` (reaproveitando o `adminAc` padrão do
    // plugin) — senão o plugin rejeita `adminRoles` com um valor que não
    // tem role de permissão correspondente.
    admin({
      defaultRole: "vendas",
      adminRoles: ["admin", "master"],
      roles: { admin: adminAc, master: adminAc },
    }),
    // Login por nome (roles sem e-mail real, ex. producao/empacotamento)
    // além de e-mail — ver decisão na Tarefa 3.1 do plano de migração.
    username(),
  ],
  advanced: {
    cookiePrefix: "radrasys",
  },
});
