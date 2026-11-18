const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;
integration('DEMO MySQL: triaje, reintento, mapa público, seguimiento ajeno y reclasificación sensible', async (t) => {
  const config = loadTestDatabaseConfig();
  const pool = mysql.createPool({ ...config, connectionLimit: 3 });
  t.after(() => pool.end());
  const jwtSecret = 'local-test-secret-with-more-than-thirty-two-characters';
  const password = 'demo-test-only-password';
  const makeCitizen = async () => {
    const email = `map-${randomUUID()}@demo.invalid`;
    const user = await registerCitizen(pool, { name: 'DEMO mapa público', email, password, acceptedTerms: true });
    const session = await login(pool, { jwtSecret }, { email, password });
    return { user, token: session.accessToken };
  };
  const owner = await makeCitizen();
  const stranger = await makeCitizen();
  const [category] = await pool.execute(
    "INSERT INTO incident_categories (code, name, family, is_sensitive, is_demo) VALUES (?, 'DEMO clínica pública', 'emergency', FALSE, TRUE)",
    [`demo_map_${randomUUID().slice(0, 8)}`],
  );
  const categoryId = category.insertId;
  const [subtype] = await pool.execute(
    "INSERT INTO incident_subcategories (category_id, code, name, is_sensitive) VALUES (?, ?, 'DEMO subtipo', FALSE)",
    [categoryId, `demo_sub_${randomUUID().slice(0, 8)}`],
  );
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig: { jwtSecret },
    logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const get = (path, token) => fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const key = randomUUID();
  const body = { categoryId, subcategoryId: subtype.insertId, affectedPeople: 3,
    isConscious: false, isBreathing: true, hasBleeding: null,
    description: 'DEMO técnico. Persona principal junto al vehículo. Sin emergencia real.',
    callerContact: '999111222', location: { latitude: -13.161, longitude: -74.223, reference: 'DEMO privado' } };
  const post = () => fetch(`${base}/incidents`, { method: 'POST',
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ ...body, clientRequestId: key }) });
  const created = await post();
  assert.equal(created.status, 201);
  const receipt = await created.json();
  const repeated = await post();
  assert.ok([200, 201].includes(repeated.status));
  assert.equal((await repeated.json()).id, receipt.id);
  const detail = await (await get(`/incidents/${receipt.id}`, owner.token)).json();
  assert.equal(detail.isConscious, false);
  assert.equal(detail.isBreathing, true);
  assert.equal(detail.hasBleeding, null);
  assert.equal(detail.affectedPeople, 3);
  const list = await (await get(`/public/incidents?categoryId=${categoryId}`)).json();
  assert.equal(list.incidents.length, 1);
  const publicDetail = await (await get(`/public/incidents/${receipt.id}`)).json();
  assert.deepEqual(publicDetail, list.incidents[0]);
  assert.equal(publicDetail.location.approximate, true);
  assert.notEqual(publicDetail.location.latitude, body.location.latitude);
  assert.equal(JSON.stringify(publicDetail).includes('DEMO privado'), false);
  assert.equal(JSON.stringify(publicDetail).includes('999111222'), false);
  for (const field of ['description', 'callerContact', 'isConscious', 'evidence', 'history', 'reporterId']) {
    assert.equal(Object.hasOwn(publicDetail, field), false);
  }
  if (publicDetail.districtId !== null) {
    const districtList = await (await get(`/public/incidents?categoryId=${categoryId}&districtId=${publicDetail.districtId}`)).json();
    assert.equal(districtList.incidents[0].id, receipt.id);
  }
  await pool.execute("UPDATE incidents SET status = 'resolved', created_at = '2020-01-01' WHERE id = ?", [receipt.id]);
  assert.equal((await (await get(`/public/incidents?categoryId=${categoryId}`)).json()).incidents.length, 0);
  assert.equal((await (await get(`/public/incidents/${receipt.id}`)).json()).status, 'resolved');
  assert.equal((await get(`/incidents/${receipt.id}`, stranger.token)).status, 403);
  assert.equal((await get(`/incidents/${receipt.id}`)).status, 401);
  await pool.execute('UPDATE incident_subcategories SET is_sensitive = TRUE WHERE id = ?', [subtype.insertId]);
  assert.equal((await get(`/public/incidents/${receipt.id}`)).status, 404);
  await pool.execute('UPDATE incident_subcategories SET is_sensitive = FALSE WHERE id = ?', [subtype.insertId]);
  await pool.execute('UPDATE incident_categories SET is_sensitive = TRUE WHERE id = ?', [categoryId]);
  assert.equal((await get(`/public/incidents/${receipt.id}`)).status, 404);
  assert.equal((await get(`/incidents/${receipt.id}`, owner.token)).status, 200);
});
