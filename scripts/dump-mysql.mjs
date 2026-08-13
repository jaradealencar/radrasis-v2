import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.MYSQL_SOURCE_URL;
if (!url) {
  console.error('MYSQL_SOURCE_URL not set');
  process.exit(1);
}

const parsed = new URL(url);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 4000),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database,
  ssl: { rejectUnauthorized: true },
  multipleStatements: false,
});

const outDir = path.resolve('docs/database-backup');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${database}.sql`);
const stream = fs.createWriteStream(outFile, { encoding: 'utf8' });

function sqlEscapeValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

stream.write(`-- Dump of database ${database}\n-- Generated ${new Date().toISOString()}\n\n`);
stream.write('SET FOREIGN_KEY_CHECKS=0;\n\n');

const [tables] = await connection.query('SHOW TABLES');
const tableKey = tables.length ? Object.keys(tables[0])[0] : null;
const tableNames = tables.map((row) => row[tableKey]);

console.log(`Found ${tableNames.length} tables in ${database}`);

for (const table of tableNames) {
  console.log(`Dumping table: ${table}`);
  const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
  const createSql = createRow['Create Table'];
  stream.write(`-- ----------------------------\n-- Table structure for ${table}\n-- ----------------------------\n`);
  stream.write(`DROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n\n`);

  const [countRows] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
  const total = countRows[0].cnt;
  stream.write(`-- ----------------------------\n-- Records of ${table} (${total} rows)\n-- ----------------------------\n`);

  const batchSize = 500;
  let offset = 0;
  let columnNames = null;
  while (offset < total) {
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` LIMIT ${batchSize} OFFSET ${offset}`);
    if (rows.length === 0) break;
    if (!columnNames) columnNames = Object.keys(rows[0]);
    const values = rows
      .map((row) => `(${columnNames.map((col) => sqlEscapeValue(row[col])).join(', ')})`)
      .join(',\n');
    stream.write(
      `INSERT INTO \`${table}\` (${columnNames.map((c) => `\`${c}\``).join(', ')}) VALUES\n${values};\n`
    );
    offset += batchSize;
  }
  stream.write('\n');
}

stream.write('SET FOREIGN_KEY_CHECKS=1;\n');
stream.end();

await new Promise((resolve) => stream.on('finish', resolve));
await connection.end();

console.log(`\nBackup written to ${outFile}`);
