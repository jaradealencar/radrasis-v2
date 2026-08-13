import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { user as userTable } from "../../drizzle/schema";

// Mesma normalização de server/routers.ts (localUsers.create) e da tela de
// login (client/src/pages/LocalLogin.tsx) — o que o usuário digita no login
// passa por essa função antes de virar o `username` procurado no banco, então
// o username salvo aqui PRECISA ser derivado do mesmo jeito (ex.: "_" vira
// "."), senão o login nunca casa com o valor digitado.
function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug || "usuario";
}

// Primeiro usuário admin do sistema — mesmo caminho de criação usado pelo
// endpoint `localUsers.create` (server/routers.ts), via `auth.api.createUser`
// do Better Auth, pra garantir hash de senha (bcrypt) e linhas em
// `user`/`account` consistentes com o resto do app.
const NAME = "Daniel Jara";
const USERNAME = slugifyName(NAME);
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const EMAIL = `${USERNAME}@local.internal`;
const ROLE = "admin";

async function main() {
  if (!PASSWORD) throw new Error("SEED_ADMIN_PASSWORD ausente — defina no .env antes de rodar o seed.");

  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

  const [existing] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, USERNAME));
  if (existing) {
    console.log(`Usuário "${USERNAME}" já existe (id=${existing.id}) — nada a fazer.`);
    return;
  }

  const { user } = await auth.api.createUser({
    body: {
      email: EMAIL,
      password: PASSWORD,
      name: NAME,
      role: ROLE,
      data: { username: USERNAME, displayUsername: NAME },
    },
  });

  console.log(`Usuário admin criado: username="${USERNAME}" id=${user.id}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha ao criar usuário admin:", error);
    process.exit(1);
  });
