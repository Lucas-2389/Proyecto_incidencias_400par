const assert = require('node:assert/strict');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { hashPassword, verifyPassword } = require('../src/auth/password');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

test('bcrypt nunca devuelve contraseña en claro y valida política', async () => {
  const plain = 'demo-only-secret-value';
  const hash = await hashPassword(plain);
  assert.notEqual(hash, plain);
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword(plain, hash), true);
  assert.equal(await verifyPassword('wrong-value', hash), false);
  await assert.rejects(hashPassword('short'), (error) => error.status === 422 && !error.message.includes('short'));
});

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;
integration('los usuarios DEMO en MySQL guardan solo hashes bcrypt', async () => {
  const connection = await mysql.createConnection(loadTestDatabaseConfig());
  try {
    const [rows] = await connection.query("SELECT password_hash FROM users WHERE email LIKE '%@demo.invalid'");
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.match(row.password_hash, /^\$2[aby]\$12\$/);
      assert.equal(row.password_hash.includes('demo-only-secret-value'), false);
    }
  } finally {
    await connection.end();
  }
});
