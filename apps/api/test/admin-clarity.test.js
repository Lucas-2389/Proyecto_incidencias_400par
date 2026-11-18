const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { loadMetropolitanTerritory } = require('../scripts/load-metropolitan-territory');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('cinco distritos conectan registro, mapas, métricas, cuentas, contactos e historial', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 5 });
  const authConfig = { jwtSecret: 'clarity-test-secret-longer-than-thirty-two-characters' };
  const password = 'clarity-test-password-only';
  let failAudit = false;
  const routedPool = {
    execute: pool.execute.bind(pool), query: pool.query.bind(pool),
    async getConnection() {
      const connection = await pool.getConnection();
      return new Proxy(connection, { get(target, key) {
        if (key === 'execute') return (sql, values) => {
          if (failAudit && sql.includes('INSERT INTO audit_logs')) throw new Error('Fallo de auditoría inducido');
          return target.execute(sql, values);
        };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    },
  };
  const app = createApp({ checkDatabase: async () => {} }, { pool: routedPool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  let loaded;
  try {
    loaded = await loadMetropolitanTerritory(pool);
    const superEmail = `clarity-${randomUUID()}@example.invalid`;
    const superUser = await registerCitizen(pool, { name: 'Administradora de prueba', email: superEmail, password, acceptedTerms: true });
    const [[superRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [superUser.id, superRole.id]);
    const superToken = (await login(pool, authConfig, { email: superEmail, password })).accessToken;
    const request = (route, { token = superToken, method = 'GET', body } = {}) => fetch(`${base}${route}`, {
      method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json', 'Idempotency-Key': randomUUID() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    async function create(route, body, token = superToken) {
      const response = await request(route, { method: 'POST', body, token });
      const result = await response.json();
      assert.equal(response.status, 201, `${route}: ${JSON.stringify(result)}`);
      return result;
    }
    const institution = await create('/admin/institutions', { name: `Organización ${randomUUID()}`, type: 'municipalidad' });
    const [category] = await pool.execute("INSERT INTO incident_categories (code, name, family) VALUES (?, 'Categoría territorial de prueba', 'security')", [`clarity_${randomUUID().slice(0, 8)}`]);
    const categoryId = category.insertId;
    const districts = await (await request('/territory/districts?scope=ayacucho-metropolitan', { token: null })).json();
    assert.equal(districts.length, 5);
    const cases = [];
    for (const district of districts) {
      const [[point]] = await pool.execute(`SELECT ST_Y(ST_Centroid(ST_SRID(area,0))) AS latitude,
        ST_X(ST_Centroid(ST_SRID(area,0))) AS longitude FROM district_boundaries WHERE district_id = ?`, [district.id]);
      const site = await create('/admin/sites', { institutionId: institution.id, districtId: district.id, name: `Sede ${district.name}`, location: point });
      assert.equal(site.districtId, district.id);
      assert.equal(site.territoryStatus, 'resolved');
      const email = `operator-${randomUUID()}@example.invalid`;
      const operator = await create('/admin/users', { name: `Operador ${district.name}`, email, password,
        role: 'Operador', institutionId: institution.id, siteId: site.id });
      const operatorToken = (await login(pool, authConfig, { email, password })).accessToken;
      const phone = await create('/ops/incidents/phone', { institutionId: institution.id, siteId: site.id, categoryId,
        description: `Reporte telefónico ${district.name}`, location: point });
      const mobile = await create('/incidents', { categoryId, description: `Reporte móvil ${district.name}`, location: point });
      for (const incident of [phone, mobile]) {
        const [[stored]] = await pool.execute('SELECT district_id, territory_status FROM incident_locations WHERE incident_id = ?', [incident.id]);
        assert.equal(stored.district_id, district.id);
        assert.equal(stored.territory_status, 'resolved');
      }
      await create(`/ops/incidents/${phone.id}/assignments`, { institutionId: institution.id, siteId: site.id,
        operatorUserId: operator.id, reason: 'Derivación territorial de prueba' });
      const contact = await create('/admin/directory', { name: `Contacto ${district.name}`, phone: '066123456',
        scope: 'local', institutionId: institution.id, siteId: site.id, districtId: district.id });
      cases.push({ district, site, phone, mobile, operator, operatorToken, contact, point });
    }
    const range = new URLSearchParams({ from: new Date(Date.now() - 3600000).toISOString(), to: new Date(Date.now() + 3600000).toISOString(), categoryId: String(categoryId) });
    for (const item of cases) {
      const filter = `${range}&districtId=${item.district.id}`;
      const map = await (await request(`/ops/map?${filter}`)).json();
      assert.deepEqual(map.incidents.map((incident) => incident.id).sort(), [item.phone.id, item.mobile.id].sort());
      assert.ok(map.sites.every((site) => site.districtId === item.district.id));
      const stats = await (await request(`/ops/stats?${filter}`)).json();
      assert.equal(stats.total, 2);
      assert.equal(typeof stats.averageAssignmentMinutes, 'number');
      const publicMap = await (await request(`/public/incidents?${filter}`, { token: null })).json();
      assert.deepEqual(publicMap.incidents.map((incident) => incident.id).sort(), [item.phone.id, item.mobile.id].sort());
      assert.ok(publicMap.incidents.every((incident) => incident.location.approximate));
      const operatorMap = await (await request(`/ops/map?${filter}`, { token: item.operatorToken })).json();
      assert.deepEqual(operatorMap.incidents.map((incident) => incident.id), [item.phone.id]);
      const contacts = await (await request(`/public/directory?districtId=${item.district.id}`, { token: null })).json();
      assert.ok(contacts.some((contact) => contact.id === item.contact.id && contact.siteName === item.site.name));
      assert.ok(!contacts.some((contact) => cases.some((other) => other.district.id !== item.district.id && other.contact.id === contact.id)));
    }

    await create(`/ops/incidents/${cases[0].mobile.id}/assignments`, { institutionId: institution.id, siteId: cases[0].site.id, reason: 'Primera atención visible' });
    await create(`/ops/incidents/${cases[0].mobile.id}/assignments`, { institutionId: institution.id, siteId: cases[1].site.id, reason: 'Atención concurrente visible' });
    const averageStats = await (await request(`/ops/stats?${range}&districtId=${cases[0].district.id}`)).json();
    const [[average]] = await pool.execute(`SELECT AVG(TIMESTAMPDIFF(SECOND, i.created_at, a.assigned_at) / 60) AS minutes
      FROM institution_assignments a JOIN incidents i ON i.id = a.incident_id WHERE i.id IN (?, ?)`, [cases[0].phone.id, cases[0].mobile.id]);
    assert.equal(averageStats.averageAssignmentMinutes, Number(Number(average.minutes).toFixed(2)));
    const noData = await (await request(`/ops/stats?${range}&districtId=99999999`)).json();
    assert.equal(noData.total, 0);
    assert.equal(noData.averageAssignmentMinutes, null);

    const boundaries = await (await request('/territory/districts/boundaries', { token: null })).json();
    const first = cases[0];
    const ring = boundaries.features.find((feature) => feature.properties.id === first.district.id).geometry.coordinates[0][0];
    let borderPoint;
    for (let index = 0; index < ring.length; index += Math.max(1, Math.floor(ring.length / 30))) {
      const longitude = ring[index][0] * 0.9999 + first.point.longitude * 0.0001;
      const latitude = ring[index][1] * 0.9999 + first.point.latitude * 0.0001;
      const approximateLongitude = (Math.floor(longitude / 0.01) + 0.5) * 0.01;
      const approximateLatitude = (Math.floor(latitude / 0.01) + 0.5) * 0.01;
      const [[probe]] = await pool.execute(`SELECT ST_Contains(area, ST_GeomFromText(?,4326,'axis-order=long-lat')) AS originalInside,
        ST_Contains(area, ST_GeomFromText(?,4326,'axis-order=long-lat')) AS approximateInside
        FROM district_boundaries WHERE district_id = ?`, [`POINT(${longitude} ${latitude})`, `POINT(${approximateLongitude} ${approximateLatitude})`, first.district.id]);
      if (probe.originalInside && !probe.approximateInside) { borderPoint = { latitude, longitude }; break; }
    }
    assert.ok(borderPoint, 'La prueba debe cubrir una aproximación que cruza el límite real');
    const borderReport = await create('/incidents', { categoryId, description: 'Reporte junto al límite', location: borderPoint });
    const borderList = await (await request(`/public/incidents?${range}&districtId=${first.district.id}`, { token: null })).json();
    assert.ok(borderList.incidents.some((incident) => incident.id === borderReport.id));

    // More than one unfiltered page must not hide the selected district.
    for (let index = 0; index < 201; index += 1) {
      const id = randomUUID();
      await pool.execute("INSERT INTO incidents (id, reference, category_id, source, description, occurred_at, created_at) VALUES (?, ?, ?, 'PHONE', 'Otro distrito', UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE))", [id, `PAGE-${id.slice(0, 24)}`, categoryId]);
      await pool.execute("INSERT INTO incident_locations (incident_id, location_point, district_id) VALUES (?, ST_GeomFromText('POINT(-74.2 -13.15)',4326,'axis-order=long-lat'), ?)", [id, cases[1].district.id]);
    }
    const selectedList = await (await request(`/ops/incidents?districtId=${cases[0].district.id}`)).json();
    assert.ok(selectedList.some((incident) => incident.id === cases[0].phone.id));
    assert.ok(selectedList.every((incident) => incident.districtId === cases[0].district.id));
    const selectedSites = await (await request(`/admin/sites?districtId=${cases[0].district.id}`)).json();
    assert.ok(selectedSites.every((site) => site.districtId === cases[0].district.id));

    const adminEmail = `admin-${randomUUID()}@example.invalid`;
    await create('/admin/users', { name: 'Administradora local', email: adminEmail, password,
      role: 'AdministradorInstitucional', institutionId: institution.id, siteId: cases[0].site.id });
    const adminToken = (await login(pool, authConfig, { email: adminEmail, password })).accessToken;
    const users = await (await request('/admin/users', { token: adminToken })).json();
    assert.ok(users.every((user) => user.siteId === cases[0].site.id));
    assert.equal((await request(`/admin/users/${cases[1].operator.id}`, { method: 'PATCH', token: adminToken, body: { name: 'Ajeno' } })).status, 403);
    const [[operatorRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'Operador'");
    await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [cases[0].operator.id, institution.id, cases[1].site.id, operatorRole.id]);
    assert.equal((await request(`/admin/users/${cases[0].operator.id}`, { method: 'PATCH', token: adminToken, body: { status: 'inactive' } })).status, 403);
    assert.equal((await request(`/admin/users/${cases[0].operator.id}`, { method: 'PATCH', body: { name: 'Nombre actualizado' } })).status, 200);

    const contact = cases[0].contact;
    await request(`/admin/directory/${contact.id}`, { method: 'PATCH', body: { phone: '066654321' } });
    const audit = await (await request(`/admin/audit?entityId=${contact.id}&entityType=directory`)).json();
    assert.ok(audit.some((event) => event.actorName && event.entityName && event.beforeData?.phone === '066123456' && event.afterData.phone === '066654321'));
    for (let index = 0; index < 60; index += 1) {
      await pool.execute(`INSERT INTO audit_logs (actor_user_id,institution_id,site_id,district_id,action,entity_type,entity_id,after_data)
        VALUES (?,?,?,?, 'directory.update', ?, ?, ?)`, [superUser.id, institution.id, cases[0].site.id, cases[0].district.id,
        index % 2 ? 'directory_entry' : 'directory', contact.id, JSON.stringify({ name: contact.name, password: 'PRIVATE-SENTINEL' })]);
    }
    const path = `/admin/audit?entityType=directory&entityId=${contact.id}&limit=25`;
    const pageOneResponse = await request(path, { token: adminToken });
    const pageOne = await pageOneResponse.json();
    const snapshot = pageOneResponse.headers.get('X-Audit-Snapshot');
    assert.equal(pageOne.length, 25);
    assert.equal(pageOneResponse.headers.get('X-Has-More'), 'true');
    assert.equal(JSON.stringify(pageOne).includes('PRIVATE-SENTINEL'), false);
    await request(`/admin/directory/${contact.id}`, { method: 'PATCH', body: { phone: '066111222' } });
    const pageTwo = await (await request(`${path}&offset=25&snapshotId=${snapshot}`, { token: adminToken })).json();
    assert.equal(pageTwo.length, 25);
    assert.ok(pageTwo.every((event) => Number(event.id) <= Number(snapshot) && !pageOne.some((first) => first.id === event.id)));
    const search = await (await request(`${path}&q=${encodeURIComponent(contact.name)}`, { token: adminToken })).json();
    assert.equal(search.length, 25);
    assert.deepEqual(await (await request(`/admin/audit?entityId=${cases[1].contact.id}&q=Contacto`, { token: adminToken })).json(), []);

    failAudit = true;
    const failedEmail = `failed-${randomUUID()}@example.invalid`;
    assert.equal((await request('/admin/users', { method: 'POST', body: { name: 'Fallo', email: failedEmail, password,
      role: 'Operador', institutionId: institution.id, siteId: cases[0].site.id } })).status, 500);
    const [[failedUser]] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE email = ?', [failedEmail]);
    assert.equal(failedUser.total, 0);
    assert.equal((await request(`/admin/directory/${contact.id}`, { method: 'PATCH', body: { phone: '066999999' } })).status, 500);
    const [[retained]] = await pool.execute('SELECT phone FROM directory_entries WHERE id = ?', [contact.id]);
    assert.equal(retained.phone, '066111222');
    assert.equal((await request(`/admin/sites/${cases[0].site.id}`, { method: 'PATCH', body: { name: 'Fallo' } })).status, 500);
    const [[retainedSite]] = await pool.execute('SELECT name FROM sites WHERE id = ?', [cases[0].site.id]);
    assert.equal(retainedSite.name, cases[0].site.name);
    failAudit = false;
    assert.equal((await request(`/admin/users/${cases[1].operator.id}`, { method: 'PATCH', body: { status: 'inactive' } })).status, 200);
    assert.equal((await request('/ops/incidents', { token: cases[1].operatorToken })).status, 401);
    assert.equal((await request(`/admin/directory/${contact.id}`, { method: 'DELETE' })).status, 204);
    assert.ok(!(await (await request(`/public/directory?districtId=${cases[0].district.id}`, { token: null })).json()).some((entry) => entry.id === contact.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (loaded && !loaded.unchanged) await loadMetropolitanTerritory(pool, { rollback: true });
    await pool.end();
  }
});
