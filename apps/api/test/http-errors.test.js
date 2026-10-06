const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');

async function withServer(action, options) {
  const app = createApp({ checkDatabase: async () => {} }, options);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await action(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('ruta v1 desconocida responde 404 uniforme con correlación', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/no-existe`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.code, 'NOT_FOUND');
    assert.equal(body.message, 'Recurso no encontrado');
    assert.match(body.correlationId, /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.get('x-correlation-id'), body.correlationId);
  });
});

test('JSON inválido responde error de validación sin contenido del cuerpo', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/no-existe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{secret-value',
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.equal(JSON.stringify(body).includes('secret-value'), false);
    assert.match(body.correlationId, /^[0-9a-f-]{36}$/);
  });
});

test('las respuestas v1 no se cachean y el log omite cuerpo, consulta y encabezados', async () => {
  const lines = [];
  const logger = { info: (line) => lines.push(line), error: () => {} };
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/no-existe?token=sentinel-query`, {
      method: 'POST',
      headers: { authorization: 'Bearer sentinel-token', 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'sentinel-body' }),
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }, { logger });
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, 'http_request');
  assert.equal(entry.method, 'POST');
  assert.equal(entry.status, 404);
  for (const secret of ['sentinel-query', 'sentinel-token', 'sentinel-body', 'password']) {
    assert.equal(lines[0].includes(secret), false);
  }
});
