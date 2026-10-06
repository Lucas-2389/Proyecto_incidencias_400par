const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('instituciones: CRUD autorizado y rechazo de Ciudadano', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const createUser = async (role) => {
    const email = `${role}-${randomUUID()}@example.invalid`;
    const user = await registerCitizen(pool, { name: role, email, password, acceptedTerms: true });
    if (role !== 'Ciudadano') {
      const [[row]] = await pool.execute('SELECT id FROM roles WHERE code = ?', [role]);
      await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, row.id]);
    }
    return (await login(pool, authConfig, { email, password })).accessToken;
  };
  const admin = await createUser('SuperAdministrador');
  const citizen = await createUser('Ciudadano');
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/admin/institutions`;
    const call = (path, method, token, body) => fetch(base + path, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await call('', 'POST', citizen, { name: 'Rechazada', type: 'pnp' })).status, 403);
    assert.equal((await call('', 'GET', citizen)).status, 403);
    const created = await call('', 'POST', admin, { name: 'Institución de prueba', type: 'pnp', contactPhone: '999999999' });
    assert.equal(created.status, 201);
    const institution = await created.json();
    assert.equal(institution.active, true);
    assert.equal((await call('', 'POST', admin, { name: 'Inválida', type: 'unknown' })).status, 422);
    const updated = await call(`/${institution.id}`, 'PATCH', admin, { name: 'Institución actualizada' });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).name, 'Institución actualizada');
    const listed = await (await call('', 'GET', admin)).json();
    assert.ok(listed.some((row) => row.id === institution.id));
    const siteBase = `http://127.0.0.1:${server.address().port}/api/v1/admin/sites`;
    const siteCall = (path, method, token, body) => fetch(siteBase + path, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const [[district]] = await pool.execute("SELECT id FROM districts WHERE code = 'DEMO-AYA-CENTRO'");
    const siteResponse = await siteCall('', 'POST', admin, {
      institutionId: institution.id, districtId: district.id, name: 'Sede de prueba',
      location: { latitude: -13.16, longitude: -74.22 },
    });
    assert.equal(siteResponse.status, 201);
    const site = await siteResponse.json();
    assert.equal(site.location.latitude, -13.16);
    assert.equal(site.location.longitude, -74.22);
    assert.equal((await siteCall('', 'GET', citizen)).status, 403);
    const editedSite = await siteCall(`/${site.id}`, 'PATCH', admin, { name: 'Sede editada' });
    assert.equal(editedSite.status, 200);
    assert.equal((await editedSite.json()).name, 'Sede editada');
    const secondSiteResponse = await siteCall('', 'POST', admin, {
      institutionId: institution.id, districtId: district.id, name: 'Segunda sede',
      location: { latitude: -13.15, longitude: -74.21 },
    });
    assert.equal(secondSiteResponse.status, 201);
    const secondSite = await secondSiteResponse.json();
    const usersBase = `http://127.0.0.1:${server.address().port}/api/v1/admin/users`;
    const userCall = (path, method, token, body) => fetch(usersBase + path, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const adminEmail = `institution-admin-${randomUUID()}@example.invalid`;
    const institutionalAdmin = await userCall('', 'POST', admin, {
      name: 'Admin institucional', email: adminEmail, password, role: 'AdministradorInstitucional',
      institutionId: institution.id, siteId: site.id,
    });
    assert.equal(institutionalAdmin.status, 201);
    const institutionalAdminToken = (await login(pool, authConfig, { email: adminEmail, password })).accessToken;
    const operatorEmail = `institution-operator-${randomUUID()}@example.invalid`;
    const operator = await userCall('', 'POST', institutionalAdminToken, {
      name: 'Operador local', email: operatorEmail, password, role: 'Operador',
      institutionId: institution.id, siteId: site.id,
    });
    assert.equal(operator.status, 201);
    assert.equal((await userCall('', 'POST', institutionalAdminToken, {
      name: 'Operador ajeno', email: `foreign-${randomUUID()}@example.invalid`, password,
      role: 'Operador', institutionId: institution.id, siteId: secondSite.id,
    })).status, 403);
    assert.equal((await userCall('', 'POST', citizen, {
      name: 'Prohibido', email: `citizen-${randomUUID()}@example.invalid`, password,
      role: 'Operador', institutionId: institution.id, siteId: site.id,
    })).status, 403);
    const scopedUsers = await (await userCall('', 'GET', institutionalAdminToken)).json();
    assert.ok(scopedUsers.some((row) => row.email === operatorEmail));
    assert.ok(!scopedUsers.some((row) => row.siteId === secondSite.id));
    const changedOperator = await userCall(`/${(await operator.json()).id}`, 'PATCH', institutionalAdminToken, { status: 'inactive' });
    assert.equal(changedOperator.status, 200);
    assert.equal((await changedOperator.json()).status, 'inactive');
    const suffix = randomUUID().slice(0, 8);
    const [newDepartment] = await pool.execute('INSERT INTO departments (code, name) VALUES (?, ?)', [`TEST-${suffix}`, 'Departamento de prueba']);
    const [newProvince] = await pool.execute('INSERT INTO provinces (department_id, code, name) VALUES (?, ?, ?)', [newDepartment.insertId, `P-${suffix}`, 'Provincia de prueba']);
    const [newDistrict] = await pool.execute('INSERT INTO districts (province_id, code, name) VALUES (?, ?, ?)', [newProvince.insertId, `D-${suffix}`, 'Distrito de prueba']);
    const remoteSiteResponse = await siteCall('', 'POST', admin, {
      institutionId: institution.id, districtId: newDistrict.insertId, name: 'Sede de otro distrito',
      location: { latitude: -12.3, longitude: -73.5 },
    });
    assert.equal(remoteSiteResponse.status, 201);
    const remoteSite = await remoteSiteResponse.json();
    assert.equal(remoteSite.districtId, newDistrict.insertId);
    const adminSites = await (await siteCall('', 'GET', institutionalAdminToken)).json();
    assert.ok(adminSites.some((row) => row.id === site.id));
    assert.ok(!adminSites.some((row) => row.id === remoteSite.id));
    assert.ok(!adminSites.some((row) => row.id === secondSite.id));
    const scopedInstitutions = await (await call('', 'GET', institutionalAdminToken)).json();
    assert.deepEqual(scopedInstitutions.map((row) => row.id), [institution.id]);
    const coverageBase = `http://127.0.0.1:${server.address().port}/api/v1/admin/coverage`;
    const coverageCall = (path, method, body) => fetch(coverageBase + path, {
      method, headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const ring = [[-74.23, -13.17], [-74.20, -13.17], [-74.20, -13.14], [-74.23, -13.14], [-74.23, -13.17]];
    const firstZone = await coverageCall(`/sites/${site.id}`, 'POST', { name: 'Zona A', coordinates: ring });
    assert.equal(firstZone.status, 201);
    const zoneA = await firstZone.json();
    assert.equal(zoneA.siteId, site.id);
    const secondZone = await coverageCall(`/sites/${secondSite.id}`, 'POST', { name: 'Zona B', coordinates: ring });
    assert.equal(secondZone.status, 201);
    const zoneB = await secondZone.json();
    const thirdZone = await coverageCall(`/sites/${site.id}`, 'POST', { name: 'Zona C', coordinates: ring });
    assert.equal(thirdZone.status, 201);
    assert.equal((await (await coverageCall(`/sites/${site.id}`, 'GET')).json()).length, 2);
    const candidates = await (await coverageCall('/candidates?latitude=-13.16&longitude=-74.22', 'GET')).json();
    assert.ok(candidates.some((row) => row.siteId === site.id));
    assert.ok(candidates.some((row) => row.siteId === secondSite.id));
    assert.equal(candidates.filter((row) => row.siteId === site.id).length, 1);
    assert.deepEqual(await (await coverageCall('/candidates?latitude=-12&longitude=-72', 'GET')).json(), []);
    assert.equal((await coverageCall(`/${zoneB.id}`, 'PATCH', { active: false })).status, 200);
    const oneCandidate = await (await coverageCall('/candidates?latitude=-13.16&longitude=-74.22', 'GET')).json();
    assert.ok(oneCandidate.some((row) => row.siteId === site.id));
    assert.ok(!oneCandidate.some((row) => row.siteId === secondSite.id));
    assert.equal((await siteCall(`/${site.id}`, 'DELETE', admin)).status, 204);
    assert.equal((await (await siteCall(`/${site.id}`, 'GET', admin)).json()).active, false);
    const inactiveCandidates = await (await coverageCall('/candidates?latitude=-13.16&longitude=-74.22', 'GET')).json();
    assert.ok(!inactiveCandidates.some((row) => row.siteId === site.id));
    assert.equal((await call(`/${institution.id}`, 'DELETE', admin)).status, 204);
    const inactive = await (await call(`/${institution.id}`, 'GET', admin)).json();
    assert.equal(inactive.active, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
