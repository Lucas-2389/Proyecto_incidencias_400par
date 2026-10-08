const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { safeStartupError } = require('../src/server');

test('diagnóstico excluye secretos, URI, certificado y stack', () => {
  const secret = 'private-sentinel-value';
  const error = Object.assign(new Error(`mysql://user:${secret}@host -----BEGIN CERTIFICATE----- ${secret}`),
    { code: 'ER_ACCESS_DENIED_ERROR', errno: 1045, sqlState: '28000', password: secret });
  const record = safeStartupError(error, 'mysql_pool_and_ca');
  assert.equal(record.code, 'ER_ACCESS_DENIED_ERROR');
  assert.equal(record.errno, 1045);
  assert.equal(record.sqlState, '28000');
  assert.equal(JSON.stringify(record).includes(secret), false);
  assert.equal(Object.hasOwn(record, 'stack'), false);
  assert.equal(safeStartupError({ name: secret, code: secret }, 'http_listen').code, null);
  assert.equal(safeStartupError(new Error(`DB_PASSWORD es obligatorio ${secret}`), 'environment_validation').message.includes(secret), false);
});

test('arranque fallido informa etapa y conserva status 1', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, DB_USER: 'root' },
  });
  assert.equal(result.status, 1);
  const record = JSON.parse(result.stderr.trim());
  assert.equal(record.stage, 'environment_validation');
  assert.equal(record.message, 'DB_USER debe ser una cuenta de aplicación');
});

test('CA inexistente se identifica sin revelar la ruta', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, APP_ENV: 'development', DB_USER: 'incidencias_app', DB_PASSWORD: 'test-only',
      DB_HOST: 'localhost', DB_PORT: '3307', DB_NAME: 'incidencias', PORT: '3000',
      DB_SSL: 'true', DB_CA_PATH: './private-sentinel-missing-ca.pem', JWT_SECRET: 'x'.repeat(40) },
  });
  assert.equal(result.status, 1);
  const record = JSON.parse(result.stderr.trim());
  assert.equal(record.stage, 'mysql_pool_and_ca');
  assert.equal(record.message, 'No se pudo leer DB_CA_PATH');
  assert.equal(result.stderr.includes('private-sentinel'), false);
});
