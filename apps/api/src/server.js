const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { getPool, closePool } = require('./db/pool');
const { createHealthService } = require('./health/service');
const { startServer } = require('./lifecycle');
const path = require('node:path');
const { createFileMailbox } = require('./auth/mailbox');

async function main() {
  const config = loadConfig();
  const pool = getPool(config.database);
  const mailbox = config.auth.devMailboxDir
    ? createFileMailbox(path.resolve(__dirname, '..', config.auth.devMailboxDir))
    : undefined;
  const app = createApp(createHealthService(pool), { pool, authConfig: config.auth, mailbox });
  await startServer({ app, port: config.http.port, closePool });
}

main().catch(async (error) => {
  const safeMessage = /^(DB_|PORT)/.test(error.message)
    ? error.message
    : 'No se pudo iniciar la API';
  console.error(safeMessage);
  try { await closePool(); } catch { /* Error interno omitido del log público. */ }
  process.exitCode = 1;
});
