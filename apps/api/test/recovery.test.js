const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { verifyAccessToken } = require('../src/auth/tokens');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('recuperación uniforme, de un uso y revocación de sesiones', async () => {
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const messages = [];
  const mailbox = { async sendPasswordReset(email, token) { messages.push({ email, token }); } };
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, mailbox, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const email = `recovery-${randomUUID()}@example.invalid`;
    const oldPassword = 'test-only-old-password';
    const newPassword = 'test-only-new-password';
    const registered = await post('/register', { name: 'Prueba recuperación', email, password: oldPassword, acceptedTerms: true });
    assert.equal(registered.status, 201);
    const { id } = await registered.json();
    const loggedIn = await post('/login', { email, password: oldPassword });
    assert.equal(loggedIn.status, 200);
    const session = await loggedIn.json();
    const existing = await post('/password-reset/request', { email });
    const missing = await post('/password-reset/request', { email: `missing-${randomUUID()}@example.invalid` });
    assert.equal(existing.status, 202);
    assert.equal(missing.status, 202);
    assert.deepEqual(await existing.json(), await missing.json());
    assert.equal(messages.length, 1);
    assert.equal(messages[0].email, email);
    const confirmed = await post('/password-reset/confirm', { token: messages[0].token, password: newPassword });
    assert.equal(confirmed.status, 200);
    assert.equal((await confirmed.json()).status, 'ok');
    assert.equal((await post('/password-reset/confirm', { token: messages[0].token, password: newPassword })).status, 400);
    assert.equal((await post('/refresh', { refreshToken: session.refreshToken })).status, 401);
    await assert.rejects(verifyAccessToken(pool, authConfig, session.accessToken), (error) => error.status === 401);
    assert.equal((await post('/login', { email, password: oldPassword })).status, 401);
    assert.equal((await post('/login', { email, password: newPassword })).status, 200);
    await post('/password-reset/request', { email });
    const expiring = messages.at(-1).token;
    const hash = createHash('sha256').update(expiring).digest('hex');
    await pool.execute('UPDATE password_reset_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE user_id = ? AND token_hash = ?', [id, hash]);
    assert.equal((await post('/password-reset/confirm', { token: expiring, password: newPassword })).status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
