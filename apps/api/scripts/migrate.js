const path = require('node:path');
const mysql = require('mysql2/promise');
const { loadConfig } = require('../src/config');
const { runMigrations } = require('../src/db/migrations');
const { loadTestDatabaseConfig } = require('./integration-config');

async function main() {
  const target = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  if (target !== 'test' && target !== 'app') {
    throw new Error('Indica --target=test o --target=app explícitamente');
  }
  const database = target === 'test' ? loadTestDatabaseConfig() : loadConfig().database;
  const pool = mysql.createPool({ ...database, connectionLimit: 2, waitForConnections: false });
  try {
    const result = await runMigrations(pool, { directory: path.join(__dirname, '../migrations') });
    console.log(`Migraciones aplicadas: ${result.applied}/${result.total} en ${database.database}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const safeMessage = /^(Indica --target|DB_|Checksum distinto|Migración vacía|No se pudo obtener)/.test(error.message)
    ? error.message
    : 'No se pudieron aplicar migraciones';
  console.error(safeMessage);
  process.exitCode = 1;
});
