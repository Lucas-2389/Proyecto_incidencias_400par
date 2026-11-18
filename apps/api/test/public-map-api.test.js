const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { createGeospatialRouter } = require('../src/geospatial/router');
const { errorHandler } = require('../src/http/errors');

const id = '00000000-0000-4000-8000-000000000001';
const row = { id, reference: 'DEMO-PUBLIC', categoryId: 2, districtId: 3, status: 'reported',
  createdAt: '2026-11-01T12:00:00Z', latitude: -13.161, longitude: -74.223,
  description: 'PRIVATE', callerContact: 'PRIVATE', isConscious: false };

async function serve(t, execute) {
  const app = express();
  app.use(createGeospatialRouter({ execute: (sql, params) => sql.includes('FROM district_aliases') ? Promise.resolve([[]]) : execute(sql, params) }, {}));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('proyección pública, filtros y reclasificación usan exclusión SQL antes del límite', async (t) => {
  let sensitive = false;
  const calls = [];
  const get = await serve(t, async (sql, params) => {
    assert.match(sql, /c\.is_sensitive = FALSE AND COALESCE\(sc\.is_sensitive, FALSE\) = FALSE/);
    assert.ok(sql.indexOf('c.is_sensitive = FALSE') < sql.indexOf('LIMIT'));
    assert.doesNotMatch(sql, /SELECT[^]*?(description|caller_contact|reporter_user_id|is_conscious)/);
    calls.push({ sql, params });
    return [sensitive ? [] : [row]];
  });
  const response = await get('/public/incidents?from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z&categoryId=2&districtId=3');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const list = await response.json();
  assert.deepEqual(calls[0].params, ['2026-11-01 00:00:00.000', '2026-11-02 00:00:00.000', 2, 2, 3, 3]);
  assert.match(calls[0].sql, /i.created_at >= \? AND i.created_at < \?/);
  assert.match(calls[0].sql, /LIMIT 5001/);
  assert.deepEqual(Object.keys(list.incidents[0]).sort(), ['categoryId', 'createdAt', 'districtId', 'id', 'location', 'reference', 'status']);
  const detailResponse = await get(`/public/incidents/${id}`);
  assert.equal(detailResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await detailResponse.json(), list.incidents[0]);
  assert.deepEqual(calls[1].params, [id]);
  assert.doesNotMatch(calls[1].sql, /created_at >=/);
  assert.equal(JSON.stringify(list).includes('PRIVATE'), false);
  sensitive = true;
  assert.deepEqual((await (await get('/public/incidents')).json()).incidents, []);
  const hidden = await get(`/public/incidents/${id}`);
  const missing = await get('/public/incidents/00000000-0000-4000-8000-000000000002');
  assert.equal(hidden.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await hidden.json(), await missing.json());
});

test('celdas aproximadas conservan negativos y límites geográficos', async (t) => {
  const get = await serve(t, async () => [[
    row, { ...row, latitude: -90, longitude: -180 }, { ...row, latitude: 90, longitude: 180 },
  ]]);
  const { incidents } = await (await get('/public/incidents')).json();
  assert.deepEqual(incidents.map((item) => item.location), [
    { latitude: -13.165, longitude: -74.225, approximate: true, cellSizeDegrees: 0.01 },
    { latitude: -89.995, longitude: -179.995, approximate: true, cellSizeDegrees: 0.01 },
    { latitude: 89.995, longitude: 179.995, approximate: true, cellSizeDegrees: 0.01 },
  ]);
});

test('fechas omitidas, validaciones y exceso de resultados públicos', async (t) => {
  let excess = false;
  const get = await serve(t, async () => [excess ? Array(5001).fill(row) : []]);
  const defaults = await (await get('/public/incidents')).json();
  assert.equal(new Date(defaults.to) - new Date(defaults.from), 7 * 86400000);
  for (const query of ['categoryId=0', 'districtId=x', 'from=2026-01-01',
    'from=bad&to=bad', 'from=2026-02-01&to=2026-01-01',
    'from=2026-01-01&to=2026-05-01', 'categoryId=1&categoryId=2']) {
    assert.equal((await get(`/public/incidents?${query}`)).status, 422, query);
  }
  excess = true;
  const response = await get('/public/incidents');
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'QUERY_LIMIT');
});
