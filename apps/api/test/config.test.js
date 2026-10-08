const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { apiEnvPath, readRawConfig } = require('../src/config/env');
const { loadConfig } = require('../src/config');

test('carga el archivo de la API por ruta absoluta y respeta variables del proceso', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'incidencias-env-'));
  const filePath = path.join(directory, 'api.env');
  fs.writeFileSync(filePath, 'DB_HOST=desde-archivo\nDB_PORT=3307\nDB_USER=incidencias_app\n');
  const originalCwd = process.cwd();
  try {
    process.chdir(os.tmpdir());
    const raw = readRawConfig({ env: { DB_HOST: 'desde-proceso' }, filePath });
    assert.equal(raw.dbHost, 'desde-proceso');
    assert.equal(raw.dbPort, '3307');
    assert.equal(raw.dbUser, 'incidencias_app');
    assert.equal(path.isAbsolute(apiEnvPath), true);
    assert.equal(apiEnvPath, path.resolve(__dirname, '../.env'));
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('no carga MYSQL_ROOT_PASSWORD del archivo de Compose', () => {
  const env = {};
  const raw = readRawConfig({ env, filePath: path.join(os.tmpdir(), 'archivo-api-inexistente.env') });
  assert.equal(raw.dbHost, undefined);
  assert.equal(Object.hasOwn(env, 'MYSQL_ROOT_PASSWORD'), false);
});

const validEnv = Object.freeze({
  PORT: '3000',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_NAME: 'incidencias',
  DB_USER: 'incidencias_app',
  DB_PASSWORD: 'sentinel-secret-do-not-print',
});

test('valida y centraliza la configuración antes del arranque', () => {
  const config = loadConfig({ env: { ...validEnv }, filePath: 'archivo-inexistente.env' });
  assert.equal(config.http.port, 3000);
  assert.equal(config.database.port, 3307);
  assert.equal(config.database.user, 'incidencias_app');
  assert.equal(config.database.password, validEnv.DB_PASSWORD);
  assert.equal(config.database.ssl, false);
  assert.equal(config.database.caPath, undefined);
  assert.equal(Object.isFrozen(config.database), true);
});

test('rechaza cada variable faltante sin mostrar el secreto', () => {
  for (const name of Object.keys(validEnv)) {
    const env = { ...validEnv };
    delete env[name];
    assert.throws(
      () => loadConfig({ env, filePath: 'archivo-inexistente.env' }),
      (error) => error.message.includes(name) && !error.message.includes(validEnv.DB_PASSWORD),
    );
  }
});

test('rechaza puertos inválidos y usuarios administrativos', () => {
  for (const name of ['PORT', 'DB_PORT']) {
    for (const value of ['0', '65536', 'abc', '3307.5']) {
      assert.throws(
        () => loadConfig({ env: { ...validEnv, [name]: value }, filePath: 'archivo-inexistente.env' }),
        new RegExp(name),
      );
    }
  }
  for (const user of ['root', 'ROOT', 'avnadmin', 'AVNADMIN']) {
    assert.throws(
      () => loadConfig({ env: { ...validEnv, DB_USER: user }, filePath: 'archivo-inexistente.env' }),
      /DB_USER debe ser una cuenta de aplicación/,
    );
  }
});

test('DB_SSL exige un booleano y CA; resuelve rutas relativas desde apps/api', () => {
  for (const value of ['yes', '1', '']) {
    assert.throws(() => loadConfig({ env: { ...validEnv, DB_SSL: value }, filePath: 'archivo-inexistente.env' }), /DB_SSL/);
  }
  assert.throws(() => loadConfig({ env: { ...validEnv, DB_SSL: 'true' }, filePath: 'archivo-inexistente.env' }), /DB_CA_PATH/);
  const config = loadConfig({ env: { ...validEnv, DB_SSL: 'true', DB_CA_PATH: './certs/ca.pem' }, filePath: 'archivo-inexistente.env' });
  assert.equal(config.database.ssl, true);
  assert.equal(config.database.caPath, path.resolve(__dirname, '../certs/ca.pem'));
  const local = loadConfig({ env: { ...validEnv, DB_SSL: 'false', DB_CA_PATH: 'no-existe.pem' }, filePath: 'archivo-inexistente.env' });
  assert.equal(local.database.caPath, undefined);
});

test('production exige HTTPS, origen explícito, JWT y almacenamiento de fotos', () => {
  const environment = { ...validEnv, APP_ENV: 'production', JWT_SECRET: 'x'.repeat(40),
    PUBLIC_API_URL: 'https://api.example.invalid/api/v1', CORS_ORIGINS: 'https://admin.example.invalid',
    EVIDENCE_DIR: path.resolve('evidence'), UPLOAD_CONFIGURATION: 'local' };
  const config = loadConfig({ env: environment, filePath: 'archivo-inexistente.env' });
  assert.equal(config.http.appEnv, 'production');
  assert.deepEqual(config.http.corsOrigins, ['https://admin.example.invalid']);
  assert.equal(config.http.publicApiUrl, 'https://api.example.invalid/api/v1');
  for (const invalid of [
    { PUBLIC_API_URL: 'http://api.example.invalid/api/v1' },
    { CORS_ORIGINS: 'http://admin.example.invalid' },
    { CORS_ORIGINS: 'https://admin.example.invalid/path' },
    { JWT_SECRET: undefined },
    { EVIDENCE_DIR: undefined },
    { EVIDENCE_DIR: '.local/evidence' },
    { CORS_ORIGINS: undefined },
    { UPLOAD_CONFIGURATION: 'memory' },
    { DEV_MAILBOX_DIR: '.local/mailbox' },
    { DB_NAME: 'incidencias_remote_test' },
  ]) assert.throws(() => loadConfig({ env: { ...environment, ...invalid }, filePath: 'archivo-inexistente.env' }));
});

test('rechaza root antes de abrir el servidor HTTP', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...validEnv, DB_USER: 'root' },
    encoding: 'utf8',
    timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DB_USER debe ser una cuenta de aplicación/);
  assert.equal(result.stderr.includes(validEnv.DB_PASSWORD), false);
});

test('Cloudinary exige las tres credenciales y permite production sin EVIDENCE_DIR', () => {
  const environment = { ...validEnv, APP_ENV: 'production', JWT_SECRET: 'x'.repeat(40),
    PUBLIC_API_URL: 'https://api.example.invalid/api/v1', CORS_ORIGINS: 'https://admin.example.invalid',
    UPLOAD_CONFIGURATION: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'example',
    CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'sentinel-cloud-secret' };
  const config = loadConfig({ env: environment, filePath: 'archivo-inexistente.env' });
  assert.equal(config.evidence.directory, undefined);
  assert.equal(config.evidence.cloudinary.cloud_name, 'example');
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    assert.throws(() => loadConfig({ env: { ...environment, [key]: '' }, filePath: 'archivo-inexistente.env' }),
      error => error.message.includes(key) && !error.message.includes(environment.CLOUDINARY_API_SECRET));
  }
});
