import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// Verificar se já existe usuário com esse e-mail
const [existing] = await conn.execute(
  "SELECT * FROM local_users WHERE email = ?",
  ["jaradealencar@gmail.com"]
);

console.log("Existing local_users:", existing);

if (existing.length === 0) {
  // Criar usuário Master
  const passwordHash = await bcrypt.hash("master2024!", 10);
  await conn.execute(
    "INSERT INTO local_users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)",
    ["Daniel Jara", "jaradealencar@gmail.com", passwordHash, "master", "sim"]
  );
  console.log("✅ Usuário Master criado com sucesso!");
  console.log("   E-mail: jaradealencar@gmail.com");
  console.log("   Senha temporária: master2024!");
} else {
  // Atualizar para master se não for
  await conn.execute(
    "UPDATE local_users SET role = 'master', active = 'sim' WHERE email = ?",
    ["jaradealencar@gmail.com"]
  );
  console.log("✅ Usuário atualizado para Master!");
}

// Verificar usuário OAuth na tabela users
const [oauthUsers] = await conn.execute(
  "SELECT id, open_id, name, email, role FROM users WHERE email = ?",
  ["jaradealencar@gmail.com"]
);
console.log("\nOAuth users table:", oauthUsers);

// Verificar OWNER_OPEN_ID
console.log("\nOWNER_OPEN_ID env:", process.env.OWNER_OPEN_ID);

await conn.end();
