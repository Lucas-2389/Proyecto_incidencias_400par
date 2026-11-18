const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const mysql = require('mysql2/promise');
const { randomUUID } = require('node:crypto');
const { createReport } = require('../src/incidents/report');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { loadMetropolitanTerritory } = require('../scripts/load-metropolitan-territory');
const { createTerritoryRouter, resolvePoint } = require('../src/territory/router');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/ayacucho-metropolitan.geojson'), 'utf8'));

test('paquete INEI contiene cinco UBIGEO distintos y procedencia reproducible', () => {
  assert.deepEqual(data.features.map((feature) => feature.properties.code), ['050101', '050104', '050110', '050115', '050116']);
  assert.match(data.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(data.referenceOnly, true);
  for (const feature of data.features) {
    assert.equal(feature.geometry.type, 'MultiPolygon');
    assert.equal(feature.bbox.length, 4);
  }
});

integration('carga INEI, simulación, catálogo, resolución y reversión son consistentes', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const app = express();
  app.use('/territory', createTerritoryRouter(pool));
  app.use((error, req, res, next) => res.status(error.status ?? 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/territory`;
  let loaded = false;
  let initialVersion;
  try {
    const [[before]] = await pool.execute("SELECT version_id FROM territory_state WHERE scope = 'ayacucho-metropolitan'");
    initialVersion = before.version_id;
    const simulated = await loadMetropolitanTerritory(pool, { dryRun: true });
    assert.equal(simulated.dryRun, true);
    const [[afterSimulation]] = await pool.execute("SELECT version_id FROM territory_state WHERE scope = 'ayacucho-metropolitan'");
    assert.equal(afterSimulation.version_id, before.version_id);
    const report = await loadMetropolitanTerritory(pool);
    loaded = !report.unchanged;
    const repeated = await loadMetropolitanTerritory(pool);
    assert.equal(repeated.unchanged, true);
    assert.equal(repeated.version, report.version);

    const districts = await (await fetch(`${base}/districts?scope=ayacucho-metropolitan`)).json();
    assert.equal(districts.length, 5);
    assert.deepEqual(districts.map((district) => district.code).sort(), data.features.map((feature) => feature.properties.code));
    const boundaries = await (await fetch(`${base}/districts/boundaries`)).json();
    assert.equal(boundaries.features.length, 5);
    assert.equal(boundaries.version, report.version);
    for (const feature of boundaries.features) {
      const [[point]] = await pool.execute(`SELECT ST_Y(ST_Centroid(ST_SRID(area, 0))) AS latitude,
        ST_X(ST_Centroid(ST_SRID(area, 0))) AS longitude FROM district_boundaries WHERE district_id = ?`, [feature.properties.id]);
      const resolved = await resolvePoint(pool, point.latitude, point.longitude);
      assert.equal(resolved.status, 'resolved');
      assert.equal(resolved.district.id, feature.properties.id);
    }
    assert.equal((await resolvePoint(pool, 0, 0)).status, 'outside_coverage');
    const all = await (await fetch(`${base}/districts`)).json();
    const provinceId = districts[0].provinceId;
    const province = await (await fetch(`${base}/districts?provinceId=${provinceId}`)).json();
    assert.equal(province.length, 5);
    assert.ok(all.length >= province.length);
    assert.equal((await fetch(`${base}/districts?scope=unknown`)).status, 422);
    await assert.rejects(loadMetropolitanTerritory(pool, { data: { ...data, features: data.features.slice(1) } }), /incompleto/);
    await assert.rejects(loadMetropolitanTerritory(pool, { data: { ...data, downloadedAt: 'different' }, beforeCommit() { throw new Error('interrupted'); } }), /interrupted/);
    const [[afterFailure]] = await pool.execute("SELECT version_id FROM territory_state WHERE scope = 'ayacucho-metropolitan'");
    assert.equal(afterFailure.version_id, report.version);

    const [[category]] = await pool.execute('SELECT id FROM incident_categories WHERE active = TRUE LIMIT 1');
    let concurrentReport;
    let completed = false;
    const concurrentVersion = await loadMetropolitanTerritory(pool, {
      data: { ...data, downloadedAt: 'concurrency-test' },
      async beforeCommit() {
        concurrentReport = createReport(pool, {
          categoryId: category.id, description: 'Prueba concurrente territorial',
          location: { latitude: -13.13456237788502, longitude: -74.2520881574097 },
        }, { source: 'MOBILE_APP', scopeType: 'guest', scopeId: randomUUID(), key: randomUUID() })
          .then((result) => { completed = true; return result; });
        await new Promise((resolve) => setTimeout(resolve, 80));
        assert.equal(completed, false);
      },
    });
    const created = await concurrentReport;
    const [[location]] = await pool.execute('SELECT territory_version_id, territory_status FROM incident_locations WHERE incident_id = ?', [created.receipt.id]);
    assert.equal(location.territory_version_id, concurrentVersion.version);
    assert.equal(location.territory_status, 'resolved');
    await loadMetropolitanTerritory(pool, { rollback: true });
  } finally {
    let [[current]] = await pool.execute("SELECT version_id FROM territory_state WHERE scope = 'ayacucho-metropolitan'");
    while (current.version_id !== initialVersion) {
      await loadMetropolitanTerritory(pool, { rollback: true });
      [[current]] = await pool.execute("SELECT version_id FROM territory_state WHERE scope = 'ayacucho-metropolitan'");
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

integration('resolución distingue fronteras compartidas y solapamientos', async () => {
  const connection = await mysql.createConnection(loadTestDatabaseConfig());
  try {
    await connection.beginTransaction();
    const [[province]] = await connection.execute('SELECT id FROM provinces LIMIT 1');
    const districtIds = [];
    for (const polygon of ['MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))', 'MULTIPOLYGON(((11 10,12 10,12 11,11 11,11 10)))']) {
      const [district] = await connection.execute('INSERT INTO districts (province_id, code, name) VALUES (?, ?, ?)', [province.id, randomUUID().slice(0, 12), 'Prueba territorial']);
      districtIds.push(district.insertId);
      await connection.execute("INSERT INTO district_boundaries (district_id, area) VALUES (?, ST_GeomFromText(?,4326,'axis-order=long-lat'))", [district.insertId, polygon]);
    }
    assert.equal((await resolvePoint(connection, 10.5, 11)).status, 'boundary');
    assert.equal((await resolvePoint(connection, 10.5, 10.5)).district.id, districtIds[0]);
    await connection.execute("UPDATE district_boundaries SET area = ST_GeomFromText('MULTIPOLYGON(((10.2 10,12 10,12 11,10.2 11,10.2 10)))',4326,'axis-order=long-lat') WHERE district_id = ?", [districtIds[1]]);
    assert.equal((await resolvePoint(connection, 10.5, 10.5)).status, 'overlap');
  } finally { await connection.rollback(); await connection.end(); }
});
