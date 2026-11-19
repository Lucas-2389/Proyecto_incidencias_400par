const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTerritoryRouter } = require('../src/territory/router');
const { createGeospatialRouter } = require('../src/geospatial/router');
const { signAccessToken } = require('../src/auth/tokens');

test('referencia regional sirve 11 provincias con geometrías cerradas y procedencia', async () => {
  const app = express();
  app.use(createTerritoryRouter({}));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ayacucho/reference-boundaries`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/geo\+json/);
    const data = await response.json();
    assert.equal(data.referenceOnly, true);
    assert.match(data.source, /^https:\/\/geosinpad\.indeci\.gob\.pe\//);
    assert.match(data.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(new Set(data.features.map(f => f.properties.provinceCode)).size, 11);
    assert.equal(new Set(data.features.map(f => f.properties.code)).size, data.features.length);
    for (const feature of data.features) {
      assert.match(feature.properties.code, /^05\d{4}$/);
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) for (const ring of polygon) {
        assert.ok(ring.length >= 4);
        assert.deepEqual(ring[0], ring.at(-1));
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('capa de sedes exige perfil operativo y no consulta datos de personal ni contacto', async () => {
  let role = 'Operador';
  const pool = { execute: async sql => {
    if (sql.includes('FROM users WHERE')) return [[{ id: 'user', status: 'active', credential_version: 1 }]];
    if (sql.includes('FROM user_roles')) return [[{ code: role }]];
    if (sql.includes('FROM institution_memberships')) return [[]];
    assert.match(sql, /s.active = TRUE AND i.active = TRUE/);
    assert.match(sql, /d.code LIKE '05%'/);
    assert.doesNotMatch(sql, /phone|email|personnel|assignments|coverage/i);
    return [[{ id: 'site', name: 'Sede prueba', institutionName: 'PNP prueba', institutionType: 'pnp',
      isDemo: 1, districtCode: '050101', districtName: 'Ayacucho', latitude: '-13.16', longitude: '-74.22' }]];
  } };
  const auth = { jwtSecret: 'test-only-map-reference-secret-32-characters' };
  const token = signAccessToken({ id: 'user', credential_version: 1 }, auth);
  const app = express();
  app.use(createGeospatialRouter(pool, auth));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/ops/map/sites`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.completeDirectory, false);
    assert.equal(result.sites[0].isDemo, true);
    assert.equal(result.sites[0].latitude, -13.16);
    role = 'Ciudadano';
    assert.equal((await fetch(url, { headers: { authorization: `Bearer ${token}` } })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
