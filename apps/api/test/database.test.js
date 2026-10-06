const assert = require('node:assert/strict');
const test = require('node:test');
const { getPool, closePool } = require('../src/db/pool');
const { checkDatabase } = require('../src/db/diagnostic');

const databaseConfig = Object.freeze({
  host: 'example.invalid',
  port: 3307,
  database: 'incidencias',
  user: 'incidencias_app',
  password: 'sentinel-secret-do-not-print',
});

test('crea un solo pool y lo reutiliza para comprobaciones consecutivas', async () => {
  let creations = 0;
  let queries = 0;
  const fakePool = {
    query: async () => { queries += 1; return [[{ '1': 1 }], []]; },
    end: async () => {},
  };
  const createPool = (options) => {
    creations += 1;
    assert.equal(options.user, 'incidencias_app');
    assert.equal(options.host, 'example.invalid');
    assert.equal(options.port, 3307);
    assert.equal(options.waitForConnections, false);
    assert.equal(options.connectionLimit, 5);
    return fakePool;
  };

  const first = getPool(databaseConfig, createPool);
  const second = getPool(databaseConfig, createPool);
  await checkDatabase(first);
  await checkDatabase(second);
  assert.equal(first, second);
  assert.equal(creations, 1);
  assert.equal(queries, 2);
  await closePool();
});

test('el diagnóstico solo ejecuta SELECT 1 con tiempo límite', async () => {
  const statements = [];
  const fakePool = {
    query: async (statement) => {
      statements.push(statement);
      return [[{ '1': 1 }], []];
    },
  };
  await checkDatabase(fakePool);
  assert.deepEqual(statements, [{ sql: 'SELECT 1', timeout: 3000 }]);
});

test('cierra el pool una sola vez tras comprobaciones y propaga errores de cierre', async () => {
  let endCalls = 0;
  let activeQueries = 0;
  const fakePool = {
    query: async () => {
      activeQueries += 1;
      activeQueries -= 1;
      return [[{ '1': 1 }], []];
    },
    end: async () => { endCalls += 1; },
  };
  getPool(databaseConfig, () => fakePool);
  await checkDatabase(fakePool);
  await closePool();
  await closePool();
  assert.equal(activeQueries, 0);
  assert.equal(endCalls, 1);

  getPool(databaseConfig, () => ({ end: async () => { throw new Error('close failed'); } }));
  await assert.rejects(closePool(), /close failed/);
});
