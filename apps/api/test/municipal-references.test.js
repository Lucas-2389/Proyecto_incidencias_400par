const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const dataset = require('../data/ayacucho-municipalities.json');
const { assertLocal, planReferences } = require('../scripts/import-ayacucho-municipalities');
const { referenceDistrictContains } = require('../src/institutions/reference-geometry');

test('inventario cubre los 124 distritos regionales sin duplicar ni utilizar coordenadas de capitales', () => {
  const regional = JSON.parse(readFileSync(path.join(__dirname, '../data/ayacucho-reference.geojson'), 'utf8'));
  assert.equal(dataset.municipalities.length, 124);
  assert.equal(new Set(dataset.municipalities.map(row => row.id)).size, 124);
  assert.deepEqual(new Set(dataset.municipalities.map(row => row.districtCode)), new Set(regional.features.map(row => row.properties.code)));
  for (const row of dataset.municipalities) {
    assert.ok(row.address && row.ineiAddress);
    assert.ok(row.sources.includes(dataset.source));
    if (row.latitude !== null) {
      assert.ok(Number.isFinite(row.longitude));
      const url = new URL(row.mapUrl);
      assert.equal(url.hostname, 'maps.google.com');
      assert.equal(url.searchParams.get('daddr'), `${row.latitude},${row.longitude}`);
      assert.ok(row.sourceUrl.startsWith('https://www.gob.pe/institucion/'));
    }
  }
});

test('importador rechaza producción, base remota y cuentas administrativas', () => {
  const config = { http: { appEnv: 'development' }, database: { host: '127.0.0.1', database: 'incidencias', user: 'incidencias_app' } };
  assert.doesNotThrow(() => assertLocal(config));
  for (const patch of [{ host: 'aiven.example' }, { user: 'root' }, { user: 'avnadmin' }, { database: 'another' }]) {
    assert.throws(() => assertLocal({ ...config, database: { ...config.database, ...patch } }));
  }
  assert.throws(() => assertLocal({ ...config, http: { appEnv: 'production' } }));
});

test('puntos publicados fuera del distrito permanecen pendientes; no se reemplazan por centroides', async () => {
  let queries = 0;
  const connection = { execute: async () => { queries++; return [[{ inside: 0 }]]; } };
  const plan = await planReferences(connection);
  assert.ok(queries > 0);
  assert.equal(plan.filter(row => row.locationStatus === 'published_inside_district').length, 0);
  assert.equal(plan.filter(row => row.locationStatus === 'district_mismatch').length, queries);
  assert.ok(plan.some(row => row.locationStatus === 'missing_coordinates' && row.latitude === null));
  assert.equal(plan.find(row => row.id === 'andres-avelino-central').locationStatus, 'building_review_required');
});

test('una observación del edificio bloquea la reimportación aunque el punto esté dentro del distrito', async () => {
  const plan = await planReferences({ execute: async () => [[{ inside: 1 }]] });
  const reference = plan.find(row => row.id === 'andres-avelino-central');
  assert.ok(reference.locationHold);
  assert.equal(reference.locationStatus, 'building_review_required');
});

test('distritos ajenos a la cartografía regional no habilitan un marcador', async () => {
  const connection = { execute: () => { throw new Error('No debe consultar un distrito inexistente'); } };
  assert.equal(await referenceDistrictContains(connection, '150101', -12, -77), false);
});
