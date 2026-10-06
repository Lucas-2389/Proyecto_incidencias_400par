const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { aggregatePublic } = require('../src/geospatial/router');

test('agregado público suprime celdas pequeñas y amplía las sensibles', () => {
  const rows = [
    { categoryId: 1, latitude: -13.16, longitude: -74.22, isSensitive: 0 },
    { categoryId: 1, latitude: -13.16, longitude: -74.22, isSensitive: 0 },
    { categoryId: 2, latitude: -13.16, longitude: -74.22, isSensitive: 1 },
    { categoryId: 2, latitude: -13.16, longitude: -74.22, isSensitive: 1 },
    { categoryId: 2, latitude: -13.16, longitude: -74.22, isSensitive: 1 },
  ];
  const cells = aggregatePublic(rows);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].count, 3);
  assert.equal(cells[0].cellSizeDegrees, 0.2);
  assert.notEqual(cells[0].latitude, rows[0].latitude);
  assert.ok(!JSON.stringify(cells).includes('description'));
});

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;
integration('mapa, agregados y directorio verifican MySQL, ámbito y auditoría', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const secret = 'sentinel-test-secret-longer-than-thirty-two-characters';
  const password = 'test-only-secret-value';
  const makeUser = async (role, institutionId = null, siteId = null) => {
    const email = `geo-${randomUUID()}@example.invalid`;
    const user = await registerCitizen(pool, { name: 'Prueba Geo', email, password, acceptedTerms: true });
    if (role !== 'Ciudadano') {
      const [[roleRow]] = await pool.execute('SELECT id FROM roles WHERE code = ?', [role]);
      await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, roleRow.id]);
      if (institutionId) await pool.execute(
        'INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
        [user.id, institutionId, siteId, roleRow.id],
      );
    }
    return (await login(pool, { jwtSecret: secret }, { email, password })).accessToken;
  };
  const [[district]] = await pool.execute("SELECT id FROM districts WHERE code = 'DEMO-AYA-CENTRO'");
  const [siteRows] = await pool.execute("SELECT s.id, s.institution_id AS institutionId FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE AND i.type IN ('pnp', 'bomberos') ORDER BY i.type");
  const fireSite = siteRows[0];
  const policeSite = siteRows[1];
  const [superToken, operatorToken, otherAdminToken, citizenToken] = await Promise.all([
    makeUser('SuperAdministrador'), makeUser('Operador', policeSite.institutionId, policeSite.id),
    makeUser('AdministradorInstitucional', fireSite.institutionId, fireSite.id), makeUser('Ciudadano'),
  ]);
  const categoryCode = `geo_${randomUUID().slice(0, 8)}`;
  const [categoryResult] = await pool.execute(
    "INSERT INTO incident_categories (code, name, family, is_sensitive) VALUES (?, 'Prueba geoespacial', 'security', TRUE)", [categoryCode],
  );
  const categoryId = categoryResult.insertId;
  await pool.execute("INSERT INTO routing_rules (category_id, institution_type, reason) VALUES (?, 'pnp', 'Prueba geoespacial')", [categoryId]);
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const id = randomUUID();
    ids.push(id);
    await pool.execute(
      "INSERT INTO incidents (id, reference, category_id, source, description, occurred_at) VALUES (?, ?, ?, 'PHONE', 'Dato privado', UTC_TIMESTAMP(3))",
      [id, `GEO-${randomUUID().slice(0, 12)}`, categoryId],
    );
    await pool.execute(
      "INSERT INTO incident_locations (incident_id, location_point, district_id) VALUES (?, ST_GeomFromText('POINT(-74.22 -13.16)', 4326, 'axis-order=long-lat'), ?)",
      [id, district.id],
    );
  }
  const outsideId = randomUUID();
  await pool.execute(
    "INSERT INTO incidents (id, reference, category_id, source, description, occurred_at) VALUES (?, ?, ?, 'PHONE', 'Fuera de ámbito', UTC_TIMESTAMP(3))",
    [outsideId, `GEO-${randomUUID().slice(0, 12)}`, categoryId],
  );
  await pool.execute("INSERT INTO incident_locations (incident_id, location_point) VALUES (?, ST_GeomFromText('POINT(-72 -12)', 4326, 'axis-order=long-lat'))", [outsideId]);
  const app = createApp({ checkDatabase: async () => {} }, { pool,
    authConfig: { jwtSecret: secret }, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const from = new Date(Date.now() - 3600000).toISOString();
    const to = new Date(Date.now() + 3600000).toISOString();
    const filters = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&categoryId=${categoryId}`;
    const get = (path, token) => fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const heatmapResponse = await get(`/public/heatmap?${filters}`);
    assert.equal(heatmapResponse.status, 200);
    const heatmap = await heatmapResponse.json();
    assert.equal(heatmap.length, 1);
    assert.equal(heatmap[0].count, 3);
    assert.equal(heatmap[0].cellSizeDegrees, 0.2);
    assert.ok(!JSON.stringify(heatmap).includes('Dato privado'));
    const districtHeatmap = await (await get(`/public/heatmap?${filters}&type=security&districtId=${district.id}`)).json();
    assert.equal(districtHeatmap[0].count, 3);
    assert.deepEqual(await (await get(`/public/heatmap?${filters}&type=emergency`)).json(), []);
    assert.deepEqual(await (await get(`/public/heatmap?${filters}&institutionId=${policeSite.institutionId}`)).json(), []);
    const otherHour = (new Date().getUTCHours() + 1) % 24;
    const narrowResponse = await get(`/public/heatmap?${filters}&districtId=${district.id}&hour=${otherHour}`);
    assert.equal(narrowResponse.status, 200);
    assert.equal((await narrowResponse.json()).length, 0);
    const invalid = await get(`/public/heatmap?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}`);
    assert.equal(invalid.status, 422);
    assert.equal((await get(`/ops/map?${filters}`, citizenToken)).status, 403);
    const map = await (await get(`/ops/map?${filters}`, operatorToken)).json();
    assert.deepEqual(map.incidents.map((row) => row.id).sort(), ids.sort());
    assert.ok(map.sites.some((row) => row.id === policeSite.id));
    assert.ok(!map.sites.some((row) => row.id === fireSite.id));
    const stats = await (await get(`/ops/stats?${filters}`, operatorToken)).json();
    assert.equal(stats.total, 3);
    assert.equal(stats.byCategory[categoryId], 3);
    assert.equal((await get(`/ops/map?${filters}&institutionId=${policeSite.institutionId}`, otherAdminToken)).status, 403);
    const create = (token, body) => fetch(`${base}/admin/directory`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await create(otherAdminToken, { name: 'Prohibido', phone: '999', scope: 'national' })).status, 403);
    const nationalResponse = await create(superToken, { name: `Nacional ${randomUUID()}`, phone: '105', scope: 'national' });
    assert.equal(nationalResponse.status, 201);
    const national = await nationalResponse.json();
    const localResponse = await create(otherAdminToken, { name: `Local ${randomUUID()}`, phone: '066123456',
      scope: 'local', institutionId: fireSite.institutionId, siteId: fireSite.id, districtId: district.id });
    assert.equal(localResponse.status, 201);
    const local = await localResponse.json();
    const directory = await (await get(`/public/directory?districtId=${district.id}`)).json();
    assert.ok(directory.some((entry) => entry.id === national.id));
    assert.ok(directory.some((entry) => entry.id === local.id));
    const fallback = await (await get('/public/directory?districtId=999999')).json();
    assert.ok(fallback.some((entry) => entry.id === national.id));
    assert.ok(!fallback.some((entry) => entry.id === local.id));
    const patch = await fetch(`${base}/admin/directory/${local.id}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${otherAdminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '066654321' }),
    });
    assert.equal(patch.status, 200);
    assert.equal((await patch.json()).phone, '066654321');
    assert.equal((await fetch(`${base}/admin/directory/${local.id}`, { method: 'DELETE',
      headers: { authorization: `Bearer ${otherAdminToken}` } })).status, 204);
    const [[audit]] = await pool.execute("SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ? AND action LIKE 'directory.%'", [local.id]);
    assert.equal(audit.count, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
