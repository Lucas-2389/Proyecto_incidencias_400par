const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { applicableRules } = require('../src/dispatch/suggestions');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('reglas determinísticas y coberturas sugieren sedes o excepción', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const [[fire]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'fire'");
  const [[medical]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'medical_emergency'");
  const [[robbery]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'robbery'");
  assert.deepEqual((await applicableRules(pool, fire.id, null)).map((rule) => rule.institutionType), ['bomberos']);
  assert.deepEqual((await applicableRules(pool, medical.id, null)).map((rule) => rule.institutionType), ['samu']);
  assert.deepEqual((await applicableRules(pool, robbery.id, null)).map((rule) => rule.institutionType), ['pnp']);
  const password = 'test-only-secret-value';
  const email = `suggestions-super-${randomUUID()}@example.invalid`;
  const user = await registerCitizen(pool, { name: 'Super sugerencias', email, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
  const token = (await login(pool, { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' }, { email, password })).accessToken;
  const app = createApp({ checkDatabase: async () => {} }, { pool,
    authConfig: { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' }, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/ops/incidents`;
    const get = (id) => fetch(`${base}/${id}/suggestions`, { headers: { authorization: `Bearer ${token}` } });
    const [demo] = await pool.execute("SELECT reference, id FROM incidents WHERE reference IN ('DEMO-AY-001','DEMO-AY-002','DEMO-AY-003')");
    const byReference = new Map(demo.map((row) => [row.reference, row.id]));
    const fireResult = await (await get(byReference.get('DEMO-AY-001'))).json();
    assert.equal(fireResult.exception, false);
    assert.ok(fireResult.suggestions.some((row) => row.institutionType === 'bomberos' && row.reason.includes('DEMO')));
    const medicalResult = await (await get(byReference.get('DEMO-AY-002'))).json();
    assert.ok(medicalResult.suggestions.some((row) => row.institutionType === 'samu'));
    const trafficResult = await (await get(byReference.get('DEMO-AY-003'))).json();
    assert.ok(trafficResult.suggestions.some((row) => row.institutionType === 'pnp'));
    assert.ok(trafficResult.suggestions.some((row) => row.institutionType === 'samu'));
    const outsideId = randomUUID();
    await pool.execute("INSERT INTO incidents (id, reference, category_id, source, description, occurred_at) VALUES (?, ?, ?, 'PHONE', 'Sin cobertura', UTC_TIMESTAMP(3))",
      [outsideId, `TEST-${randomUUID().slice(0, 12)}`, fire.id]);
    await pool.execute("INSERT INTO incident_locations (incident_id, location_point) VALUES (?, ST_GeomFromText('POINT(-72 -12)', 4326, 'axis-order=long-lat'))", [outsideId]);
    const outside = await (await get(outsideId)).json();
    assert.equal(outside.exception, true);
    assert.deepEqual(outside.suggestions, []);
    const exceptionInbox = await (await fetch(`${base}?exception=true`, { headers: { authorization: `Bearer ${token}` } })).json();
    assert.ok(exceptionInbox.some((item) => item.id === outsideId && item.exception));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
