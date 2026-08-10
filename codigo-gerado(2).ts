// Eu usei:
mysql.createPool({
  uri: process.env.DATABASE_URL,  // ← a MESMA variável que o Drizzle já usa
})