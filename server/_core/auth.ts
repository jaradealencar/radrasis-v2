import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { drizzle } from "drizzle-orm/neon-serverless";
import bcrypt from "bcryptjs";
import { getPool } from "../db/db-connection";
import * as schema from "../../drizzle/schema";
import { APP_ROLES } from "../../drizzle/schema";

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
    // `roles` precisa cobrir as 8 roles de negócio inteiras — o plugin
    // rejeita em runtime (`YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE`)
    // qualquer valor de `role` passado pra createUser/setRole que não seja
    // uma chave deste mapa, mesmo já validado como AppRole no schema. Só
    // admin/master ganham permissão de gerenciar outros usuários no nível
    // do plugin (adminAc); as demais são "userAc" (sem essa permissão) —
    // a autorização real do app continua sendo requireRole() em
    // server/_core/trpc.ts, isto aqui é só pro plugin aceitar o valor.
    admin({
      defaultRole: "vendas",
      adminRoles: ["admin", "master"],
      roles: Object.fromEntries(
        APP_ROLES.map(role => [role, role === "admin" || role === "master" ? adminAc : userAc])
      ),
    }),
    // Login por nome (roles sem e-mail real, ex. producao/empacotamento)
    // além de e-mail — ver decisão na Tarefa 3.1 do plano de migração.
    // `username` pode ser um e-mail normalizado (users com e-mail real) ou
    // um slug do nome (users sem e-mail, ex. "joao.silva") — o validador
    // padrão só aceita alfanumérico+underscore, por isso libera "." também.
    username({
      usernameValidator: (value: string) => /^[a-zA-Z0-9_.@-]+$/.test(value),
    }),
  ],
  advanced: {
    cookiePrefix: "radrasys",
  },
});
