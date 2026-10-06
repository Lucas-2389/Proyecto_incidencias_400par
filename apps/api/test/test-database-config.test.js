const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const valid = {
  PORT: '3000',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_NAME: 'incidencias',
  DB_USER: 'incidencias_app',
  DB_PASSWORD: 'sentinel-not-a-real-password',
  DB_TEST_NAME: 'incidencias_test',
};

test('la configuración de pruebas usa una base aislada y la cuenta de aplicación', () => {
  const config = loadTestDatabaseConfig({ env: { ...valid } });
  assert.equal(config.database, 'incidencias_test');
  assert.equal(config.user, 'incidencias_app');
  assert.equal(config.host, '127.0.0.1');
});

test('rechaza la base operativa, nombres de prueba inseguros y root', () => {
  for (const name of ['incidencias', 'incidencias_test; DROP DATABASE incidencias', '', undefined]) {
    assert.throws(() => loadTestDatabaseConfig({ env: { ...valid, DB_TEST_NAME: name } }), /DB_TEST_NAME/);
  }
  assert.throws(() => loadTestDatabaseConfig({ env: { ...valid, DB_USER: 'root' } }), /DB_USER/);
});
