const mysql = require('mysql2/promise');
const fs = require('node:fs');

let pool;

function createConnectionOptions(databaseConfig) {
  let ssl;
  if (databaseConfig.ssl) {
    if (!databaseConfig.caPath) throw new Error('DB_CA_PATH es obligatorio cuando DB_SSL=true');
    try {
      ssl = { ca: fs.readFileSync(databaseConfig.caPath), rejectUnauthorized: true };
    } catch {
      throw new Error('No se pudo leer DB_CA_PATH');
    }
  }
  return {
    host: databaseConfig.host,
    port: databaseConfig.port,
    database: databaseConfig.database,
    user: databaseConfig.user,
    password: databaseConfig.password,
    connectTimeout: databaseConfig.ssl ? 15000 : 3000,
    ...(ssl ? { ssl } : {}),
  };
}

function getPool(databaseConfig, createPool = mysql.createPool) {
  if (!pool) {
    pool = createPool({
      ...createConnectionOptions(databaseConfig),
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 50,
    });
  }
  return pool;
}

async function closePool() {
  if (!pool) return;
  const closingPool = pool;
  pool = undefined;
  await closingPool.end();
}

module.exports = { createConnectionOptions, getPool, closePool };
