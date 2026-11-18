const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const test = require('node:test');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { runMigrations } = require('../src/db/migrations');
const { seedReference } = require('../scripts/seed-reference');
const { seedDemo, demoSites, demoDistricts } = require('../scripts/seed-demo');
const { loadMetropolitanTerritory } = require('../scripts/load-metropolitan-territory');
const { login } = require('../src/auth/login');
const { createApp } = require('../src/app');

// Seed reconciliation renames fixtures, so it uses a separate isolated database.
const integration = process.env.RUN_MYSQL_INTEGRATION === '1' && process.env.DB_SEED_TEST_NAME ? test : test.skip;

integration('seed amplía sedes legado, conserva identidades y se repite concurrentemente', async () => {
  const config = loadTestDatabaseConfig({ env: { ...process.env, DB_TEST_NAME: process.env.DB_SEED_TEST_NAME } });
  const pool = mysql.createPool({ ...config, connectionLimit: 4 });
  const connection = await pool.getConnection();
  const legacyDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-legacy-migrations-'));
  const password = 'domain-test-password-only';
  const previous = [
    ['pnp', 'DEMO PNP Ayacucho', 'DEMO Comisaría Centro', 'DEMO-PNP-01'],
    ['samu', 'DEMO SAMU Ayacucho', 'DEMO Base SAMU Centro', 'DEMO-SAMU-01'],
    ['bomberos', 'DEMO Bomberos Ayacucho', 'DEMO Compañía Centro', 'DEMO-BOM-01'],
    ['municipalidad', 'DEMO Municipalidad/Serenazgo Ayacucho', 'DEMO Base Serenazgo', 'DEMO-MUN-01'],
  ];
  const snapshot = async () => {
    const [sites] = await connection.query('SELECT id, institution_id AS institutionId, district_id AS districtId, name FROM sites WHERE is_demo=TRUE ORDER BY id');
    const [users] = await connection.query("SELECT id, email, password_hash AS passwordHash FROM users WHERE email LIKE '%@demo.invalid' ORDER BY id");
    const [memberships] = await connection.query('SELECT id, user_id, institution_id, site_id, role_id FROM institution_memberships ORDER BY id');
    return { sites, users, memberships };
  };
  try {
    const migrationDirectory = path.join(__dirname, '../migrations');
    for (const file of await fs.readdir(migrationDirectory)) {
      if (/^00[1-9]_|^01[01]_/.test(file)) {
        await fs.copyFile(path.join(migrationDirectory, file), path.join(legacyDirectory, file));
      }
    }
    await runMigrations(pool, { directory: legacyDirectory });
    await seedReference(connection);
    const [[existing]] = await connection.query('SELECT COUNT(*) AS total FROM sites WHERE is_demo=TRUE');
    if (existing.total === 0) {
      const hash = await bcrypt.hash(password, 12);
      const [[role]] = await connection.execute("SELECT id FROM roles WHERE code='Operador'");
      for (const [type, name, siteName, unit] of previous) {
        const institutionId = randomUUID();
        const siteId = randomUUID();
        const userId = randomUUID();
        await connection.execute('INSERT INTO institutions (id, name, type, is_demo) VALUES (?, ?, ?, TRUE)', [institutionId, name, type]);
        await connection.execute("INSERT INTO sites (id, institution_id, name, location, is_demo) VALUES (?, ?, ?, ST_GeomFromText('POINT(-74.22 -13.16)', 4326, 'axis-order=long-lat'), TRUE)", [siteId, institutionId, siteName]);
        await connection.execute('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)', [userId, 'DEMO operador previo', `operator-${type}@demo.invalid`, hash]);
        await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
        await connection.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [userId, institutionId, siteId, role.id]);
        await connection.execute("INSERT INTO units (id, institution_id, site_id, code, type, is_demo) VALUES (?, ?, ?, ?, 'DEMO vehículo previo', TRUE)", [randomUUID(), institutionId, siteId, unit]);
        await connection.execute('INSERT INTO personnel (id, institution_id, site_id, code, name, is_demo) VALUES (?, ?, ?, ?, ?, TRUE)', [randomUUID(), institutionId, siteId, `${unit}-P`, 'DEMO persona previa']);
      }
    }
    const legacyIncident = randomUUID();
    const [[legacyCategory]] = await connection.execute("SELECT id FROM incident_categories WHERE code='medical_emergency'");
    const [[legacySubtype]] = await connection.execute("SELECT id FROM incident_subcategories WHERE code='medical_injury'");
    await connection.execute("INSERT INTO incidents (id, reference, category_id, subcategory_id, source, description, affected_people, occurred_at) VALUES (?, ?, ?, ?, 'PHONE', 'DEMO reporte anterior al triaje', 3, UTC_TIMESTAMP(3))",
      [legacyIncident, `LEGACY-${randomUUID().slice(0, 12)}`, legacyCategory.id, legacySubtype.id]);
    await runMigrations(pool, { directory: migrationDirectory });
    const [[upgraded]] = await connection.execute('SELECT affected_people, subcategory_id, is_conscious, is_breathing, has_bleeding FROM incidents WHERE id=?', [legacyIncident]);
    assert.deepEqual({ ...upgraded }, { affected_people: 3, subcategory_id: legacySubtype.id, is_conscious: null, is_breathing: null, has_bleeding: null });
    const [legacyUnits] = await connection.query("SELECT id, institution_id, site_id, code FROM units WHERE code IN ('DEMO-PNP-01','DEMO-SAMU-01','DEMO-BOM-01','DEMO-MUN-01') ORDER BY code");
    const [legacyUsers] = await connection.query("SELECT id, email, password_hash FROM users WHERE email IN ('operator-pnp@demo.invalid','operator-samu@demo.invalid','operator-bomberos@demo.invalid','operator-municipalidad@demo.invalid') ORDER BY email");
    assert.deepEqual(await seedDemo(connection, password), { institutions: 8, sites: 16, districts: 5, incidents: 3 });
    const first = await snapshot();
    assert.equal(first.sites.length, 16);
    assert.equal(new Set(first.sites.map((row) => row.institutionId)).size, 8);
    assert.equal(new Set(first.sites.map((row) => row.districtId)).size, 5);
    const [retainedUnits] = await connection.query("SELECT id, institution_id, site_id, code FROM units WHERE code IN ('DEMO-PNP-01','DEMO-SAMU-01','DEMO-BOM-01','DEMO-MUN-01') ORDER BY code");
    const [retainedUsers] = await connection.query("SELECT id, email, password_hash FROM users WHERE email IN ('operator-pnp@demo.invalid','operator-samu@demo.invalid','operator-bomberos@demo.invalid','operator-municipalidad@demo.invalid') ORDER BY email");
    assert.deepEqual(retainedUnits, legacyUnits);
    assert.deepEqual(retainedUsers, legacyUsers);
    await seedDemo(connection, 'another-test-password-only');
    assert.deepEqual(await snapshot(), first);
    const secondConnection = await pool.getConnection();
    try {
      await Promise.all([seedDemo(connection, password), seedDemo(secondConnection, password)]);
    } finally { secondConnection.release(); }
    assert.deepEqual(await snapshot(), first);
    const failed = {
      query: connection.query.bind(connection),
      beginTransaction: connection.beginTransaction.bind(connection),
      commit: connection.commit.bind(connection),
      rollback: connection.rollback.bind(connection),
      async execute(sql, values) {
        if (sql.startsWith('UPDATE sites')) throw new Error('Fallo de seed inducido');
        return connection.execute(sql, values);
      },
    };
    await assert.rejects(seedDemo(failed, password), /Fallo de seed inducido/);
    const [[lock]] = await connection.query("SELECT IS_FREE_LOCK('incidencias_demo_seed') AS freeLock");
    assert.equal(lock.freeLock, 1);
    assert.deepEqual(await snapshot(), first);
    const authConfig = { jwtSecret: 'domain-test-secret-longer-than-thirty-two-characters' };
    for (const site of demoSites.filter((row) => row.operator)) {
      const signedIn = await login(pool, authConfig, { email: `${site.operator}@demo.invalid`, password });
      assert.ok(signedIn.accessToken);
      const [memberships] = await connection.execute(
        'SELECT s.name FROM institution_memberships m JOIN sites s ON s.id=m.site_id JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id WHERE u.email=? AND r.code=\'Operador\' AND m.active=TRUE',
        [`${site.operator}@demo.invalid`]);
      assert.deepEqual(memberships.map((row) => row.name), [`DEMO ${site.site}`]);
    }
    assert.ok((await login(pool, authConfig, { email: 'superadmin@demo.invalid', password })).accessToken);
    const [[globalRole]] = await connection.query("SELECT COUNT(*) AS total FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE u.email='superadmin@demo.invalid' AND r.code='SuperAdministrador'");
    assert.equal(globalRole.total, 1);
    const [zones] = await connection.query('SELECT z.id FROM site_coverage_zones z JOIN sites s ON s.id=z.site_id WHERE s.is_demo=TRUE AND z.is_demo=TRUE');
    assert.equal(zones.length, 16);
    for (const district of demoDistricts) {
      const [[match]] = await connection.execute(
        "SELECT COUNT(*) AS total FROM district_boundaries b JOIN districts d ON d.id=b.district_id WHERE d.code=? AND ST_Intersects(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))",
        [district.code, `POINT(${district.longitude} ${district.latitude})`]);
      assert.equal(match.total, 1);
    }
    const [[outside]] = await connection.query("SELECT COUNT(*) AS total FROM site_coverage_zones WHERE ST_Intersects(area, ST_GeomFromText('POINT(-72 -12)', 4326, 'axis-order=long-lat'))");
    assert.equal(outside.total, 0);
    const server = createApp({ checkDatabase: async () => {} }, {
      pool, authConfig, logger: { info() {}, error() {} },
    }).listen(0, '127.0.0.1');
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${server.address().port}/api/v1`;
      const tokenFor = async (email) => (await login(pool, authConfig, { email, password })).accessToken;
      const citizenToken = await tokenFor('citizen@demo.invalid');
      const chaccoToken = await tokenFor('operator-pnp-chacco@demo.invalid');
      const centralToken = await tokenFor('operator-pnp@demo.invalid');
      const superToken = await tokenFor('superadmin@demo.invalid');
      const get = (route, token) => fetch(base + route, { headers: { authorization: `Bearer ${token}` } });
      const post = (route, body, token, method = 'POST') => fetch(base + route, {
        method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'Idempotency-Key': randomUUID() },
        body: JSON.stringify(body),
      });
      const categories = await (await get('/catalog/categories?institutionType=samu', citizenToken)).json();
      const traffic = categories.find((row) => row.code === 'traffic_accident');
      assert.ok(traffic);
      const subtypes = await (await get(`/catalog/categories/${traffic.id}/subcategories?institutionType=samu`, citizenToken)).json();
      const subtype = subtypes.find((row) => row.code === 'traffic_collision');
      const district = demoDistricts.find((row) => row.key === 'jesus-nazareno');
      const report = { categoryId: traffic.id, subcategoryId: subtype.id, affectedPeople: 3,
        description: 'DEMO Tres afectados, persona principal conductor de vehículo rojo.',
        isConscious: false, isBreathing: true, hasBleeding: true,
        location: { latitude: district.latitude, longitude: district.longitude } };
      const response = await post('/incidents', report, citizenToken);
      assert.equal(response.status, 201);
      const incident = await response.json();
      const detail = await (await get(`/incidents/${incident.id}`, chaccoToken)).json();
      assert.equal(detail.affectedPeople, 3);
      assert.equal(detail.subcategoryId, subtype.id);
      assert.equal(detail.isConscious, false);
      assert.equal(detail.isBreathing, true);
      assert.equal(detail.hasBleeding, true);
      assert.equal((await get(`/incidents/${incident.id}`, centralToken)).status, 403);
      const suggestions = await (await get(`/ops/incidents/${incident.id}/suggestions`, superToken)).json();
      const chacco = first.sites.find((row) => row.name === 'DEMO Comisaría PNP Chacco');
      assert.ok(suggestions.suggestions.some((row) => row.siteId === chacco.id));
      assert.ok(suggestions.suggestions.some((row) => row.institutionType === 'samu'));
      const assigned = await post(`/ops/incidents/${incident.id}/assignments`, { institutionId: chacco.institutionId, siteId: chacco.id }, chaccoToken);
      assert.equal(assigned.status, 201);
      const withoutResources = await assigned.json();
      assert.deepEqual(withoutResources.unitIds, []);
      assert.deepEqual(withoutResources.personnelIds, []);
      const next = await (await post('/incidents', report, citizenToken)).json();
      const unit = { id: randomUUID() };
      const person = { id: randomUUID() };
      await connection.execute("INSERT INTO units (id, institution_id, site_id, code, type) VALUES (?, ?, ?, ?, 'Patrullero de prueba')", [unit.id, chacco.institutionId, chacco.id, `TEST-${randomUUID()}`]);
      await connection.execute('INSERT INTO personnel (id, institution_id, site_id, code, name) VALUES (?, ?, ?, ?, ?)', [person.id, chacco.institutionId, chacco.id, `TEST-${randomUUID()}`, 'Persona de prueba']);
      const withResources = await post(`/ops/incidents/${next.id}/assignments`, {
        institutionId: chacco.institutionId, siteId: chacco.id, unitIds: [unit.id], personnelIds: [person.id],
      }, chaccoToken);
      assert.equal(withResources.status, 201);
      const resourceAssignment = await withResources.json();
      const [historyBefore] = await connection.execute('SELECT * FROM incident_history WHERE incident_id=? ORDER BY id', [next.id]);
      await seedDemo(connection, password);
      const [historyAfter] = await connection.execute('SELECT * FROM incident_history WHERE incident_id=? ORDER BY id', [next.id]);
      assert.deepEqual(historyAfter, historyBefore);
      const [[reserved]] = await connection.execute('SELECT status FROM units WHERE id=?', [unit.id]);
      assert.equal(reserved.status, 'assigned');
      // Restore availability through the normal lifecycle for repeatable verification.
      for (const status of ['en_route', 'attending', 'resolved', 'closed']) {
        const transition = await post(`/ops/incidents/${next.id}/status`, { assignmentId: resourceAssignment.id, status, note: 'DEMO verificación de ciclo' }, superToken, 'PATCH');
        assert.equal(transition.status, 200);
      }
    } finally { await new Promise((resolve) => server.close(resolve)); }
    const beforeTerritory = await snapshot();
    const loaded = await loadMetropolitanTerritory(pool);
    try {
      await seedDemo(connection, password);
      await seedDemo(connection, 'another-test-password-only');
      const canonical = await snapshot();
      assert.deepEqual(canonical.users, beforeTerritory.users);
      assert.deepEqual(canonical.memberships, beforeTerritory.memberships);
      assert.deepEqual(canonical.sites.map(({ districtId, ...site }) => site), beforeTerritory.sites.map(({ districtId, ...site }) => site));
      assert.equal(new Set(canonical.sites.map((site) => site.districtId)).size, 5);
      const [[duplicates]] = await connection.execute("SELECT COUNT(*) AS total FROM districts WHERE code IN ('DEMO-AYA-CENTRO','DEMO-CA','DEMO-SJB','DEMO-JN','DEMO-AACD')");
      assert.equal(duplicates.total, 0);
    } finally {
      if (!loaded.unchanged) await loadMetropolitanTerritory(pool, { rollback: true });
    }
  } finally {
    connection.release();
    await pool.end();
    await fs.rm(legacyDirectory, { recursive: true, force: true });
  }
});
