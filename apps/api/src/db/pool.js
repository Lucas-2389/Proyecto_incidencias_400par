const mysql = require('mysql2/promise');

let pool;

function getPool(databaseConfig, createPool = mysql.createPool) {
  if (!pool) {
    pool = createPool({
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      user: databaseConfig.user,
      password: databaseConfig.password,
      connectionLimit: 5,
      waitForConnections: false,
      connectTimeout: 3000,
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

module.exports = { getPool, closePool };
