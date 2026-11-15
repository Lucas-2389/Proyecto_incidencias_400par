const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { seedReference, subcategories } = require('../scripts/seed-reference');

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
    const snapshot = async () => {
      const [rows] = await pool.query('SELECT id, code, category_id AS categoryId FROM incident_subcategories WHERE code IN (?) ORDER BY code', [subcategories.map((item) => item[1])]);
      return rows.map((row) => ({ ...row }));
    };
    const connection = await pool.getConnection();
    try {
      await seedReference(connection);
      const before = await snapshot();
      assert.equal(before.length, 12);
      const fire = categories.find((item) => item.code === 'fire');
      await connection.execute("UPDATE routing_rules SET is_demo=FALSE WHERE category_id=? AND institution_type='bomberos' AND subcategory_id IS NULL", [fire.id]);
      const [[rulesBefore]] = await connection.execute('SELECT COUNT(*) AS total FROM routing_rules');
      await seedReference(connection);
      assert.deepEqual(await snapshot(), before);
      const [[rulesAfter]] = await connection.execute('SELECT COUNT(*) AS total FROM routing_rules');
      assert.equal(rulesAfter.total, rulesBefore.total);
      const [sensitive] = await connection.execute("SELECT is_sensitive AS isSensitive FROM incident_subcategories WHERE code LIKE 'violence_%'");
      assert.ok(sensitive.length >= 3 && sensitive.every((row) => row.isSensitive === 1));
    } finally { connection.release(); }
    const samu = await (await get('/categories?institutionType=samu')).json();
    assert.ok(samu.some((item) => item.code === 'traffic_accident'));
    assert.ok(samu.some((item) => item.code === 'medical_emergency'));
    assert.equal(new Set(samu.map((item) => item.id)).size, samu.length);
    const medical = samu.find((item) => item.code === 'medical_emergency');
    assert.equal((await (await get(`/categories/${medical.id}/subcategories?institutionType=samu`)).json()).length, 3);
    assert.equal((await get('/categories?institutionType=invalid')).status, 422);
    assert.equal((await get(`/categories/${medical.id}/subcategories?institutionType=invalid`)).status, 422);
    assert.deepEqual(await (await get('/categories?institutionType=otra')).json(), []);
    const customCode = `test-${randomUUID().slice(0, 8)}`;
    assert.equal((await write('/categories', 'POST', { code: customCode, name: 'No permitido', family: 'security' }, 'invalid')).status, 401);
    assert.equal((await write('/categories', 'POST', { code: customCode, name: 'No permitido', family: 'security' }, citizenToken)).status, 403);
    const created = await write('/categories', 'POST', { code: customCode, name: 'Categoría nueva', family: 'security', defaultPriority: 'high' });
    assert.equal(created.status, 201);
    const category = await created.json();
    assert.equal(category.defaultPriority, 'high');
    const sub = await write(`/categories/${category.id}/subcategories`, 'POST', { code: `${customCode}-sub`, name: 'Subtipo nuevo' });
    assert.equal(sub.status, 201);
    const subtype = await sub.json();
    const otherSub = await write(`/categories/${category.id}/subcategories`, 'POST', { code: `${customCode}-other`, name: 'Otro subtipo' });
    assert.equal(otherSub.status, 201);
    const [rule] = await pool.execute("INSERT INTO routing_rules (category_id, subcategory_id, institution_type, reason) VALUES (?, ?, 'otra', 'Prueba de filtro específico')", [category.id, subtype.id]);
    try {
      const filtered = await (await get('/categories?institutionType=otra')).json();
      assert.equal(filtered.filter((row) => row.id === category.id).length, 1);
      const filteredSubtypes = await (await get(`/categories/${category.id}/subcategories?institutionType=otra`)).json();
      assert.deepEqual(filteredSubtypes.map((row) => row.id), [subtype.id]);
      await write(`/subcategories/${subtype.id}`, 'PATCH', { active: false });
      assert.ok(!(await (await get('/categories?institutionType=otra')).json()).some((row) => row.id === category.id));
      await write(`/subcategories/${subtype.id}`, 'PATCH', { active: true });
    } finally { await pool.execute('DELETE FROM routing_rules WHERE id=?', [rule.insertId]); }
    assert.equal((await (await get(`/categories/${category.id}/subcategories`)).json()).length, 2);
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
