const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { verifyAccessToken } = require('../src/auth/tokens');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('refresh rota el token, logout lo revoca y la versión invalida JWT anterior', async () => {
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const email = `session-${randomUUID()}@example.invalid`;
    const password = 'test-only-secret-value';
    const registered = await post('/register', { name: 'Prueba sesión', email, password, acceptedTerms: true });
    assert.equal(registered.status, 201);
    const { id } = await registered.json();
    const loggedIn = await post('/login', { email, password });
    assert.equal(loggedIn.status, 200);
    const first = await loggedIn.json();
    assert.equal((await verifyAccessToken(pool, authConfig, first.accessToken)).id, id);
    const rotated = await post('/refresh', { refreshToken: first.refreshToken });
    assert.equal(rotated.status, 200);
    const second = await rotated.json();
    assert.notEqual(second.refreshToken, first.refreshToken);
    assert.equal((await post('/refresh', { refreshToken: first.refreshToken })).status, 401);
    assert.equal((await post('/logout', { refreshToken: second.refreshToken })).status, 204);
    assert.equal((await post('/refresh', { refreshToken: second.refreshToken })).status, 401);
    const expired = jwt.sign(
      { ver: 1 }, authConfig.jwtSecret,
      { algorithm: 'HS256', subject: id, issuer: 'incidencias', audience: 'incidencias-api', expiresIn: -1 },
    );
    await assert.rejects(verifyAccessToken(pool, authConfig, expired), (error) => error.status === 401);
    const loggedInAgain = await post('/login', { email, password });
    assert.equal(loggedInAgain.status, 200);
    const third = await loggedInAgain.json();
    const [simultaneousA, simultaneousB] = await Promise.all([
      post('/refresh', { refreshToken: third.refreshToken }),
      post('/refresh', { refreshToken: third.refreshToken }),
    ]);
    assert.deepEqual([simultaneousA.status, simultaneousB.status].sort(), [200, 401]);
    await pool.execute('UPDATE refresh_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE user_id = ? AND revoked_at IS NULL', [id]);
    const winner = simultaneousA.status === 200 ? simultaneousA : simultaneousB;
    const activeRefresh = (await winner.json()).refreshToken;
    assert.equal((await post('/refresh', { refreshToken: activeRefresh })).status, 401);
    await pool.execute('UPDATE users SET credential_version = credential_version + 1 WHERE id = ?', [id]);
    await assert.rejects(verifyAccessToken(pool, authConfig, first.accessToken), (error) => error.status === 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
