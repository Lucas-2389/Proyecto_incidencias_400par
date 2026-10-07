const { readRawConfig } = require('./env');
const path = require('node:path');

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} es obligatorio`);
  }
  return value.trim();
}

function requiredPort(value, name) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535`);
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535`);
  }
  return port;
}

function httpsUrl(value, name, production) {
  if (!value) return undefined;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} debe ser una URL válida`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || (production && parsed.protocol !== 'https:')) {
    throw new Error(`${name} debe ser una URL HTTP(S) válida${production ? ' con HTTPS' : ''}`);
  }
  return parsed.origin + parsed.pathname.replace(/\/$/, '');
}

function loadConfig(options) {
  const raw = readRawConfig(options);
  const user = requiredText(raw.dbUser, 'DB_USER');
  if (user.toLowerCase() === 'root') {
    throw new Error('DB_USER no puede ser root');
  }
  requiredText(raw.dbPassword, 'DB_PASSWORD');
  if (raw.jwtSecret !== undefined && raw.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  const appEnv = raw.appEnv || 'development';
  if (!['development', 'production'].includes(appEnv)) throw new Error('APP_ENV debe ser development o production');
  const production = appEnv === 'production';
  const corsOrigins = (raw.corsOrigins || '').split(',').map((entry) => entry.trim()).filter(Boolean)
    .map((entry) => {
      const url = httpsUrl(entry, 'CORS_ORIGINS', production);
      if (url !== new URL(url).origin) throw new Error('CORS_ORIGINS debe contener solo orígenes');
      return url;
    });
  const publicApiUrl = httpsUrl(raw.publicApiUrl, 'PUBLIC_API_URL', production);
  const uploadConfiguration = raw.uploadConfiguration || 'local';
  if (uploadConfiguration !== 'local') throw new Error('UPLOAD_CONFIGURATION solo admite local en V1');
  if (production && (!raw.jwtSecret || !publicApiUrl || !raw.evidenceDir || corsOrigins.length === 0)) {
    throw new Error('JWT_SECRET, PUBLIC_API_URL, EVIDENCE_DIR y CORS_ORIGINS son obligatorios en production');
  }
  if (production && !path.isAbsolute(raw.evidenceDir)) throw new Error('EVIDENCE_DIR debe ser absoluto en production');
  if (production && raw.devMailboxDir) throw new Error('DEV_MAILBOX_DIR no está permitido en production');

  return Object.freeze({
    http: Object.freeze({ port: requiredPort(raw.port, 'PORT'), appEnv, corsOrigins: Object.freeze(corsOrigins), publicApiUrl }),
    database: Object.freeze({
      host: requiredText(raw.dbHost, 'DB_HOST'),
      port: requiredPort(raw.dbPort, 'DB_PORT'),
      database: requiredText(raw.dbName, 'DB_NAME'),
      user,
      password: raw.dbPassword,
    }),
    auth: Object.freeze({ jwtSecret: raw.jwtSecret, devMailboxDir: raw.devMailboxDir }),
    evidence: Object.freeze({ directory: raw.evidenceDir, uploadConfiguration }),
  });
}

module.exports = { loadConfig };
