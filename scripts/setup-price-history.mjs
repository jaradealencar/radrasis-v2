import mysql from 'mysql2/promise';
import { readFileSync, writeFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Criar tabela no banco
await conn.execute(`
  CREATE TABLE IF NOT EXISTS price_table_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    versao VARCHAR(16) NOT NULL,
    sectionId INT NOT NULL,
    sectionTitle VARCHAR(256),
    autor VARCHAR(128) DEFAULT 'sistema',
    campoAlterado VARCHAR(64),
    valorAnterior TEXT,
    valorNovo TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
`);
console.log('✅ Tabela price_table_history criada/verificada');

await conn.end();
console.log('✅ Banco atualizado com sucesso');
