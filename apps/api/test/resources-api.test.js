const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { transitions } = require('../src/resources/units');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('personal y unidades respetan sede, unicidad, disponibilidad y transiciones', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const email = `resource-admin-${randomUUID()}@example.invalid`;
  const password = 'test-only-secret-value';
  const user = await registerCitizen(pool, { name: 'Admin recursos', email, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'AdministradorInstitucional'");
  const [sites] = await pool.execute("SELECT s.id, s.institution_id AS institutionId, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE");
  const pnp = sites.find((site) => site.type === 'pnp');
  const fire = sites.find((site) => site.type === 'bomberos');
  assert.ok(pnp && fire);
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
  await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [user.id, pnp.institutionId, pnp.id, role.id]);
  const token = (await login(pool, authConfig, { email, password })).accessToken;
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/resources`;
    const call = (route, method, body) => fetch(base + route, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const code = `TEST-${randomUUID().slice(0, 8)}`;
    const personCreated = await call('/personnel', 'POST', { institutionId: pnp.institutionId, siteId: pnp.id, code, name: 'Persona de prueba' });
    assert.equal(personCreated.status, 201);
    const person = await personCreated.json();
    assert.equal((await call(`/personnel/${person.id}`, 'PATCH', { name: 'Nombre corregido' })).status, 200);
    assert.equal((await call('/personnel', 'POST', { institutionId: fire.institutionId, siteId: fire.id, code: `${code}-F`, name: 'Ajeno' })).status, 403);
    assert.equal((await call('/personnel', 'POST', { institutionId: pnp.institutionId, siteId: randomUUID(), code: `${code}-X`, name: 'Sede inválida' })).status, 403);
    assert.equal((await call('/personnel', 'POST', { institutionId: pnp.institutionId, siteId: pnp.id, code, name: 'Duplicado' })).status, 409);
    const unitCode = `UNIT-${randomUUID().slice(0, 8)}`;
    const unitCreated = await call('/units', 'POST', { institutionId: pnp.institutionId, siteId: pnp.id,
      code: unitCode, type: 'Patrullero', plate: 'TEST-123', capacityDescription: '4 personas' });
    assert.equal(unitCreated.status, 201);
    const unit = await unitCreated.json();
    assert.equal(unit.status, 'available');
    assert.equal((await call('/units', 'POST', { institutionId: pnp.institutionId, siteId: pnp.id, code: unitCode, type: 'Duplicada' })).status, 409);
    const initialAvailable = await (await call(`/units?institutionId=${pnp.institutionId}&siteId=${pnp.id}&available=true`, 'GET')).json();
    assert.ok(initialAvailable.some((row) => row.id === unit.id));
    assert.equal((await call(`/units/${unit.id}/status`, 'PATCH', { status: 'attending' })).status, 409);
    assert.equal((await call(`/units/${unit.id}/status`, 'PATCH', { status: 'maintenance' })).status, 200);
    const unavailable = await (await call('/units?available=true', 'GET')).json();
    assert.ok(!unavailable.some((row) => row.id === unit.id));
    assert.equal((await call(`/units/${unit.id}/status`, 'PATCH', { status: 'available' })).status, 200);
    const [history] = await pool.execute('SELECT previous_status, new_status, actor_user_id FROM unit_status_history WHERE unit_id = ? ORDER BY id', [unit.id]);
    assert.deepEqual(history.map((row) => row.new_status), ['maintenance', 'available']);
    assert.ok(history.every((row) => row.actor_user_id === user.id));
    const movedSiteId = randomUUID();
    await pool.execute("INSERT INTO sites (id, institution_id, name, location) VALUES (?, ?, ?, ST_GeomFromText('POINT(-74.21 -13.15)', 4326, 'axis-order=long-lat'))", [movedSiteId, pnp.institutionId, 'Sede extra de prueba']);
    assert.equal((await call(`/units/${unit.id}`, 'PATCH', { siteId: movedSiteId })).status, 403);
    const superEmail = `resource-super-${randomUUID()}@example.invalid`;
    const superUser = await registerCitizen(pool, { name: 'Super prueba', email: superEmail, password, acceptedTerms: true });
    const [[superRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [superUser.id, superRole.id]);
    const superToken = (await login(pool, authConfig, { email: superEmail, password })).accessToken;
    const superCall = (route, method, body) => fetch(base + route, {
      method, headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await superCall(`/units/${unit.id}`, 'PATCH', { siteId: randomUUID() })).status, 422);
    const moved = await superCall(`/units/${unit.id}`, 'PATCH', { siteId: movedSiteId });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).siteId, movedSiteId);
    assert.equal((await superCall(`/personnel/${person.id}`, 'PATCH', { siteId: movedSiteId })).status, 200);
    assert.equal((await call(`/units/${unit.id}`, 'GET')).status, 403);
    assert.equal((await superCall(`/units/${unit.id}/status`, 'PATCH', { status: 'assigned' })).status, 409);
    const [[incident]] = await pool.execute("SELECT id FROM incidents WHERE reference = 'DEMO-AY-003'");
    const assignmentId = randomUUID();
    const unitAssignmentId = randomUUID();
    await pool.execute('INSERT INTO institution_assignments (id, incident_id, institution_id, site_id) VALUES (?, ?, ?, ?)',
      [assignmentId, incident.id, pnp.institutionId, movedSiteId]);
    await pool.execute('INSERT INTO unit_assignments (id, institution_assignment_id, unit_id) VALUES (?, ?, ?)',
      [unitAssignmentId, assignmentId, unit.id]);
    for (const status of ['assigned', 'en_route', 'attending', 'returning']) {
      assert.equal((await superCall(`/units/${unit.id}/status`, 'PATCH', { status })).status, 200);
    }
    assert.equal((await superCall(`/units/${unit.id}/status`, 'PATCH', { status: 'available' })).status, 409);
    await pool.execute('UPDATE unit_assignments SET released_at = UTC_TIMESTAMP(3) WHERE id = ?', [unitAssignmentId]);
    assert.equal((await superCall(`/units/${unit.id}/status`, 'PATCH', { status: 'available' })).status, 200);
    const [operationalHistory] = await pool.execute('SELECT new_status FROM unit_status_history WHERE unit_id = ? ORDER BY id', [unit.id]);
    assert.deepEqual(operationalHistory.slice(-5).map((row) => row.new_status), ['assigned', 'en_route', 'attending', 'returning', 'available']);
    assert.equal((await call(`/personnel/${person.id}`, 'DELETE')).status, 403);
    assert.equal((await superCall(`/personnel/${person.id}`, 'DELETE')).status, 204);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

test('la máquina de estados contiene cada hito y rechaza saltos operativos', () => {
  const path = ['available', 'assigned', 'en_route', 'attending', 'returning', 'available'];
  for (let i = 1; i < path.length; i += 1) assert.ok(transitions[path[i - 1]].has(path[i]));
  assert.ok(transitions.available.has('maintenance'));
  assert.ok(transitions.available.has('out_of_service'));
  assert.ok(!transitions.available.has('attending'));
  assert.ok(!transitions.maintenance.has('assigned'));
});
