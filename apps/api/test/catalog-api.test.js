const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('catálogo público inicial y administración de prioridad sin recompilar clientes', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const email = `catalog-super-${randomUUID()}@example.invalid`;
  const user = await registerCitizen(pool, { name: 'Super catálogo', email, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
  const token = (await login(pool, authConfig, { email, password })).accessToken;
  const citizenEmail = `catalog-citizen-${randomUUID()}@example.invalid`;
  await registerCitizen(pool, { name: 'Ciudadano catálogo', email: citizenEmail, password, acceptedTerms: true });
  const citizenToken = (await login(pool, authConfig, { email: citizenEmail, password })).accessToken;
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/catalog`;
    const get = (path) => fetch(base + path);
    const write = (path, method, body, bearer = token) => fetch(base + path, {
      method, headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const categories = await (await get('/categories')).json();
    for (const code of ['fire', 'traffic_accident', 'medical_emergency', 'flood', 'landslide', 'earthquake_damage',
      'robbery', 'assault', 'aggression', 'fight', 'vandalism', 'harassment', 'violence', 'suspicious_activity']) {
      assert.ok(categories.some((item) => item.code === code), code);
    }
    assert.equal(categories.find((item) => item.code === 'fire').defaultPriority, 'high');
    const customCode = `test-${randomUUID().slice(0, 8)}`;
    assert.equal((await write('/categories', 'POST', { code: customCode, name: 'No permitido', family: 'security' }, 'invalid')).status, 401);
    assert.equal((await write('/categories', 'POST', { code: customCode, name: 'No permitido', family: 'security' }, citizenToken)).status, 403);
    const created = await write('/categories', 'POST', { code: customCode, name: 'Categoría nueva', family: 'security', defaultPriority: 'high' });
    assert.equal(created.status, 201);
    const category = await created.json();
    assert.equal(category.defaultPriority, 'high');
    const sub = await write(`/categories/${category.id}/subcategories`, 'POST', { code: `${customCode}-sub`, name: 'Subtipo nuevo' });
    assert.equal(sub.status, 201);
    assert.equal((await (await get(`/categories/${category.id}/subcategories`)).json()).length, 1);
    const updated = await write(`/categories/${category.id}`, 'PATCH', { defaultPriority: 'critical' });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).defaultPriority, 'critical');
    assert.equal((await write(`/categories/${category.id}`, 'PATCH', { active: false })).status, 200);
    assert.ok(!(await (await get('/categories')).json()).some((item) => item.id === category.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
