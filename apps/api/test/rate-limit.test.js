const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('login y recuperación responden 429 tras superar límites persistidos', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const app = createApp({ checkDatabase: async () => {} }, {
    pool,
    authConfig: { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' },
    mailbox: { async sendPasswordReset() {} },
    logger: { info() {}, error() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const loginEmail = `limit-login-${randomUUID()}@example.invalid`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await post('/login', { email: loginEmail, password: 'invalid-password' })).status, 401);
    }
    const blockedLogin = await post('/login', { email: loginEmail, password: 'invalid-password' });
    assert.equal(blockedLogin.status, 429);
    assert.equal((await blockedLogin.json()).code, 'RATE_LIMITED');
    const resetEmail = `limit-reset-${randomUUID()}@example.invalid`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await post('/password-reset/request', { email: resetEmail })).status, 202);
    }
    const blockedReset = await post('/password-reset/request', { email: resetEmail });
    assert.equal(blockedReset.status, 429);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS count FROM rate_limit_counters WHERE action IN (?, ?)', ['login', 'password_reset']);
    assert.ok(row.count >= 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
