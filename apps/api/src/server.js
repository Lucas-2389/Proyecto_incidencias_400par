const path = require('node:path');
let closePool;
let notificationSender;

let startupStage = 'module_loading';
const safeMessages = new Set([
  'No se pudo leer el archivo de configuración de la API', 'No se pudo leer DB_CA_PATH',
  'DB_USER debe ser una cuenta de aplicación', 'DB_SSL debe ser true o false',
  'DB_CA_PATH es obligatorio cuando DB_SSL=true', 'JWT_SECRET debe tener al menos 32 caracteres',
  'APP_ENV debe ser development o production', 'DB_NAME debe ser incidencias en production',
  'UPLOAD_CONFIGURATION debe ser local o cloudinary',
  'JWT_SECRET, PUBLIC_API_URL, EVIDENCE_DIR y CORS_ORIGINS son obligatorios en production',
  'EVIDENCE_DIR debe ser absoluto en production', 'DEV_MAILBOX_DIR no está permitido en production',
  'FCM_PROJECT_ID inválido', 'CORS_ORIGINS debe contener solo orígenes',
]);
const safeCodes = new Set(['ENOENT', 'EACCES', 'EADDRINUSE', 'EADDRNOTAVAIL', 'ECONNREFUSED',
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'MODULE_NOT_FOUND',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'HANDSHAKE_SSL_ERROR', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID']);

function safeStartupError(error, stage) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const validation = /^(?:DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|DB_CA_PATH|PORT|CLOUDINARY_CLOUD_NAME|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET) es obligatorio$/.test(message)
    || /^(?:DB_PORT|PORT) debe ser un puerto entre 1 y 65535$/.test(message)
    || /^(?:PUBLIC_API_URL|CORS_ORIGINS) debe ser una URL (?:válida|HTTP\(S\) válida(?: con HTTPS)?)$/.test(message);
  return {
    event: 'startup_failed', stage,
    name: ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'].includes(error?.name) ? error.name : 'Error',
    code: safeCodes.has(error?.code) ? error.code : null,
    ...(Number.isSafeInteger(error?.errno) ? { errno: error.errno } : {}),
    ...(typeof error?.sqlState === 'string' && /^[A-Z0-9]{5}$/.test(error.sqlState) ? { sqlState: error.sqlState } : {}),
    message: safeMessages.has(message) || validation ? message : 'No se pudo iniciar la API; detalles sensibles omitidos',
  };
}

async function main() {
  startupStage = 'module_loading';
  const { loadConfig } = require('./config');
  const { createApp } = require('./app');
  const db = require('./db/pool');
  closePool = db.closePool;
  const { createHealthService } = require('./health/service');
  const { startServer } = require('./lifecycle');
  const { createFileMailbox } = require('./auth/mailbox');
  const { createEvidenceStorage } = require('./incidents/evidence-storage');
  const { createFcmSender } = require('./notifications/fcm');
  startupStage = 'environment_validation';
  const config = loadConfig();
  startupStage = 'mysql_pool_and_ca';
  const pool = db.getPool(config.database);
  startupStage = 'mailbox_configuration';
  const mailbox = config.auth.devMailboxDir
    ? createFileMailbox(path.resolve(__dirname, '..', config.auth.devMailboxDir))
    : undefined;
  startupStage = 'evidence_storage_configuration';
  const evidenceStore = createEvidenceStorage(config.evidence);
  startupStage = 'notifications_configuration';
  notificationSender = createFcmSender(pool);
  startupStage = 'express_and_frontend_configuration';
  const app = createApp(createHealthService(pool), { pool, authConfig: config.auth, mailbox, evidenceStore, notificationSender, httpConfig: config.http });
  startupStage = 'http_listen';
  await startServer({ app, port: config.http.port, closePool: async () => {
    try { await notificationSender.close(); } finally { await closePool(); }
  } });
}

if (require.main === module) main().catch(async (error) => {
  console.error(JSON.stringify(safeStartupError(error, startupStage)));
  try { await notificationSender?.close(); } catch { /* Error interno omitido del log público. */ }
  try { await closePool?.(); } catch { /* Error interno omitido del log público. */ }
  process.exitCode = 1;
});
module.exports = { safeStartupError };
