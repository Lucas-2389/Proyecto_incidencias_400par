const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { changePassword } = require('../src/auth/profile');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('perfil propio, correo inmutable y cambio transaccional de contraseña', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 4 });
  const authConfig = { jwtSecret: 'profile-test-secret-longer-than-thirty-two-characters' };
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    const call = (path, method = 'GET', body, token) => fetch(base + path, {
      method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const email = `profile-${randomUUID()}@example.invalid`;
    const password = 'profile-test-password';
    const created = await call('/register', 'POST', { name: 'Antes', email, password, acceptedTerms: true });
    const user = await created.json();
    const first = await (await call('/login', 'POST', { email, password })).json();
    const second = await (await call('/login', 'POST', { email, password })).json();
    assert.equal((await call('/me')).status, 401);
    const initial = await (await call('/me', 'GET', undefined, first.accessToken)).json();
    assert.equal(initial.phone, null);
    assert.deepEqual(Object.keys(initial).sort(), ['email', 'id', 'name', 'phone']);
    const updated = await (await call('/me', 'PATCH', { name: 'Después', phone: '+51 999 111 222' }, first.accessToken)).json();
    assert.equal(updated.name, 'Después');
    assert.equal(updated.phone, '+51 999 111 222');
    assert.equal((await (await call('/me', 'GET', undefined, second.accessToken)).json()).phone, updated.phone);
    for (const invalid of [{ name: '' }, { phone: 'texto' }, { name: 'Alterado', email: 'otro@example.invalid' },
      { id: randomUUID() }, { role: 'SuperAdministrador' }, { password: 'injected' }]) {
      assert.equal((await call('/me', 'PATCH', invalid, first.accessToken)).status, 422);
    }
    assert.equal((await (await call('/me', 'GET', undefined, first.accessToken)).json()).name, 'Después');
    assert.equal((await (await call('/me', 'PATCH', { phone: '' }, first.accessToken)).json()).phone, null);
    assert.equal((await call('/password/change', 'POST', { currentPassword: password, newPassword: password })).status, 401);
    assert.equal((await call('/password/change', 'POST', { currentPassword: 'wrong', newPassword: password }, first.accessToken)).status, 400);
    assert.equal((await call('/password/change', 'POST', { currentPassword: password, newPassword: 'short' }, first.accessToken)).status, 422);
    const faultyPool = { async getConnection() {
      const connection = await pool.getConnection();
      return new Proxy(connection, { get(target, property) {
        if (property === 'execute') return async (sql, values) => {
          if (sql.startsWith('UPDATE password_reset_tokens')) throw new Error('Simulated rollback');
          return target.execute(sql, values);
        };
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    } };
    await assert.rejects(changePassword(faultyPool, user.id, { currentPassword: password, newPassword: 'rollback-test-password' }));
    assert.equal((await call('/me', 'GET', undefined, first.accessToken)).status, 200);
    const newPassword = 'new-profile-test-password';
    const [changed, refreshed] = await Promise.all([
      call('/password/change', 'POST', { currentPassword: password, newPassword }, first.accessToken),
      call('/refresh', 'POST', { refreshToken: second.refreshToken }),
    ]);
    assert.equal(changed.status, 204);
    if (refreshed.status === 200) {
      const rotated = await refreshed.json();
      assert.equal((await call('/me', 'GET', undefined, rotated.accessToken)).status, 401);
      assert.equal((await call('/refresh', 'POST', { refreshToken: rotated.refreshToken })).status, 401);
    } else assert.equal(refreshed.status, 401);
    assert.equal((await call('/me', 'GET', undefined, first.accessToken)).status, 401);
    assert.equal((await call('/refresh', 'POST', { refreshToken: first.refreshToken })).status, 401);
    assert.equal((await call('/login', 'POST', { email, password: newPassword })).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
