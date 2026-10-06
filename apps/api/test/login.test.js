const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('login emite JWT y rechaza credenciales erróneas o cuenta inactiva sin revelar causa', async () => {
  const jwtSecret = 'sentinel-test-secret-longer-than-thirty-two-characters';
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig: { jwtSecret }, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const email = `login-${randomUUID()}@example.invalid`;
    const password = 'test-only-secret-value';
    const registered = await post('/register', { name: 'Prueba login', email, password, acceptedTerms: true });
    assert.equal(registered.status, 201);
    const account = await registered.json();
    const success = await post('/login', { email, password });
    assert.equal(success.status, 200);
    const data = await success.json();
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.expiresIn, 900);
    assert.ok(data.refreshToken.length >= 40);
    assert.deepEqual(data.user.roles, ['Ciudadano']);
    assert.equal(jwt.verify(data.accessToken, jwtSecret, { algorithms: ['HS256'], issuer: 'incidencias', audience: 'incidencias-api' }).sub, account.id);
    const wrong = await post('/login', { email, password: 'wrong-password-value' });
    const missing = await post('/login', { email: `missing-${randomUUID()}@example.invalid`, password });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    const wrongBody = await wrong.json();
    const missingBody = await missing.json();
    assert.equal(wrongBody.code, missingBody.code);
    assert.equal(wrongBody.message, missingBody.message);
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', ['inactive', account.id]);
    const inactive = await post('/login', { email, password });
    assert.equal(inactive.status, 401);
    assert.equal((await inactive.json()).message, wrongBody.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
