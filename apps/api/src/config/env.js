const path = require('node:path');
const dotenv = require('dotenv');

const apiEnvPath = path.resolve(__dirname, '../../.env');

function loadEnvironment({ env = process.env, filePath = apiEnvPath } = {}) {
  const result = dotenv.config({ path: filePath, processEnv: env, quiet: true });
  if (result.error && result.error.code !== 'ENOENT') {
    throw new Error('No se pudo leer el archivo de configuración de la API');
  }
  return env;
}

function readRawConfig(options) {
  const env = loadEnvironment(options);
  return {
    port: env.PORT,
    dbHost: env.DB_HOST,
    dbPort: env.DB_PORT,
    dbName: env.DB_NAME,
    dbUser: env.DB_USER,
    dbPassword: env.DB_PASSWORD,
    dbSsl: env.DB_SSL,
    dbCaPath: env.DB_CA_PATH,
    jwtSecret: env.JWT_SECRET,
    devMailboxDir: env.DEV_MAILBOX_DIR,
    evidenceDir: env.EVIDENCE_DIR,
    appEnv: env.APP_ENV,
    corsOrigins: env.CORS_ORIGINS,
    publicApiUrl: env.PUBLIC_API_URL,
    uploadConfiguration: env.UPLOAD_CONFIGURATION,
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: env.CLOUDINARY_API_SECRET,
  };
}

module.exports = { apiEnvPath, loadEnvironment, readRawConfig };
