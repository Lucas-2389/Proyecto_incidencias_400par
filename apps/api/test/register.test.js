const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('registro ciudadano responde 201, 400 y 409 y persiste hash y rol', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const app = createApp({ checkDatabase: async () => {} }, { pool, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth/register`;
    const email = `test-${randomUUID()}@example.invalid`;
    const password = 'test-only-secret-value';
    const body = { name: 'Ciudadano de prueba', email, password, acceptedTerms: true };
    const send = (data) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const created = await send(body);
    const account = await created.json();
    assert.equal(created.status, 201);
    assert.equal(account.email, email);
    assert.equal(account.role, 'Ciudadano');
    assert.equal(JSON.stringify(account).includes(password), false);
    const connection = await pool.getConnection();
    try {
      const [[stored]] = await connection.execute('SELECT password_hash FROM users WHERE id = ?', [account.id]);
      assert.match(stored.password_hash, /^\$2[aby]\$12\$/);
      assert.notEqual(stored.password_hash, password);
      const [[role]] = await connection.execute('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', [account.id]);
      assert.equal(role.code, 'Ciudadano');
    } finally { connection.release(); }
    const invalid = await send({ ...body, email: 'not-an-email' });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'VALIDATION_ERROR');
    const duplicate = await send(body);
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, 'CONFLICT');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
