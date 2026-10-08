const assert = require('node:assert/strict');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { checkDatabase } = require('../src/db/diagnostic');

async function withServer(app, action) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const address = server.address();
    await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('GET /api/health informa vida HTTP sin consultar MySQL', async () => {
  let checks = 0;
  const app = createApp({ checkDatabase: async () => { checks += 1; throw new Error('DB down'); } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  assert.equal(checks, 0);
});

test('GET /api/health/database consulta el servicio en cada petición', async () => {
  let checks = 0;
  const app = createApp({ checkDatabase: async () => { checks += 1; } });
  await withServer(app, async (baseUrl) => {
    for (let i = 0; i < 2; i += 1) {
      const response = await fetch(`${baseUrl}/api/health/database`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
  assert.equal(checks, 2);
});

test('fallos de conexión, timeout, pool y credenciales comparten respuesta 503 segura', async () => {
  const expected = {
    status: 'error',
    database: 'unavailable',
    code: 'DATABASE_UNAVAILABLE',
    message: 'Base de datos no disponible',
  };
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'POOL_CONNLIMIT', 'ER_ACCESS_DENIED_ERROR']) {
    const app = createApp({ checkDatabase: async () => {
      const error = new Error('driver-secret-sentinel');
      error.code = code;
      throw error;
    } });
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health/database`);
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(body.correlationId, /^[0-9a-f-]{36}$/);
      delete body.correlationId;
      assert.deepEqual(body, expected);
      assert.equal(JSON.stringify(body).includes('driver-secret-sentinel'), false);
    });
  }
});

test('log estructurado omite contraseña, usuario y error bruto', async () => {
  const lines = [];
  const logger = { error: (line) => lines.push(line) };
  const secret = 'sentinel-secret-do-not-print';
  const app = createApp({ checkDatabase: async () => {
    const error = new Error(`host 127.0.0.1 user incidencias_app password ${secret}`);
    error.code = 'ER_ACCESS_DENIED_ERROR';
    throw error;
  } }, { logger });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health/database`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.correlationId, body.correlationId);
    assert.equal(entry.category, 'authentication');
    assert.equal(entry.event, 'database_health_failed');
    assert.equal(typeof entry.durationMs, 'number');
  });
  assert.equal(lines[0].includes(secret), false);
  assert.equal(lines[0].includes('incidencias_app'), false);
  assert.equal(lines[0].includes('127.0.0.1'), false);
  assert.equal(lines[0].includes('password'), false);
});

test('con MySQL realmente inaccesible, health sigue 200 y database devuelve 503 seguro', async () => {
  const pool = mysql.createPool({ host: '127.0.0.1', port: 1, user: 'incidencias_app', password: 'test-only', database: 'incidencias', connectTimeout: 500 });
  const lines = [];
  const app = createApp({ checkDatabase: () => checkDatabase(pool) }, { logger: { error: (line) => lines.push(line) } });
  try {
    await withServer(app, async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok' });
      const database = await fetch(`${baseUrl}/api/health/database`);
      assert.equal(database.status, 503);
      const body = await database.json();
      assert.equal(body.code, 'DATABASE_UNAVAILABLE');
      assert.equal(JSON.stringify(body).includes('127.0.0.1'), false);
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].includes('test-only'), false);
  } finally {
    await pool.end();
  }
});
