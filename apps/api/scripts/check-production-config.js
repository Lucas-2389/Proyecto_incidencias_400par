const { loadEnvironment } = require('../src/config/env');
const { loadConfig } = require('../src/config');
const { createConnectionOptions } = require('../src/db/pool');
try {
  const env = { ...loadEnvironment(), APP_ENV: 'production', NODE_ENV: 'production', DEV_MAILBOX_DIR: '' };
  const config = loadConfig({ env });
  if (config.database.user !== 'incidencias_app' || !config.database.ssl || config.evidence.uploadConfiguration !== 'cloudinary') {
    throw new Error('Producción requiere incidencias_app, TLS y Cloudinary');
  }
  const options = createConnectionOptions(config.database);
  if (options.ssl.rejectUnauthorized !== true) throw new Error('TLS inválido');
  console.log('Configuración production válida; CA legible y verificación TLS activa. Sin escribir en MySQL.');
} catch {
  console.error('Configuración production inválida: revisar variables, CA y guía Render. Valores omitidos.');
  process.exitCode = 1;
}
