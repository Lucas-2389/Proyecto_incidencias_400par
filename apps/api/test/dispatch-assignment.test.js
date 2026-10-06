const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { createReport } = require('../src/incidents/report');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('derivación múltiple, corrección auditada y reserva concurrente sin ocupación doble', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 5 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const email = `dispatch-super-${randomUUID()}@example.invalid`;
  const actor = await registerCitizen(pool, { name: 'Super despacho', email, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actor.id, role.id]);
  const token = (await login(pool, authConfig, { email, password })).accessToken;
  const [[category]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'traffic_accident'");
  const [siteRows] = await pool.execute('SELECT s.id, s.institution_id AS institutionId, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE AND s.is_demo = TRUE');
  const sites = new Map(siteRows.map((row) => [row.type, row]));
  for (const type of ['pnp', 'samu', 'bomberos', 'municipalidad']) assert.ok(sites.has(type));
  const [fireRules] = await pool.execute("SELECT id FROM routing_rules WHERE category_id = ? AND institution_type = 'bomberos' AND active = TRUE", [category.id]);
  if (!fireRules.length) await pool.execute("INSERT INTO routing_rules (category_id, institution_type, priority, reason) VALUES (?, 'bomberos', 50, 'Prueba de accidente grave')", [category.id]);
  const makeIncident = async () => (await createReport(pool, { categoryId: category.id, description: 'Accidente de prueba',
    location: { latitude: -13.16, longitude: -74.22 } }, { source: 'PHONE', creatorUserId: actor.id,
    scopeType: 'operator', scopeId: actor.id, key: randomUUID() })).receipt;
  const first = await makeIncident();
  const second = await makeIncident();
  const third = await makeIncident();
  const fourth = await makeIncident();
  const operatorEmail = `dispatch-operator-${randomUUID()}@example.invalid`;
  const operator = await registerCitizen(pool, { name: 'Operador PNP', email: operatorEmail, password, acceptedTerms: true });
  const [[operatorRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'Operador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [operator.id, operatorRole.id]);
  await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
    [operator.id, sites.get('pnp').institutionId, sites.get('pnp').id, operatorRole.id]);
  const operatorToken = (await login(pool, authConfig, { email: operatorEmail, password })).accessToken;
  const unitId = randomUUID();
  const personnelId = randomUUID();
  await pool.execute('INSERT INTO units (id, institution_id, site_id, code, type) VALUES (?, ?, ?, ?, ?)',
    [unitId, sites.get('pnp').institutionId, sites.get('pnp').id, `TEST-${randomUUID().slice(0, 8)}`, 'Patrullero']);
  await pool.execute('INSERT INTO personnel (id, institution_id, site_id, code, name) VALUES (?, ?, ?, ?, ?)',
    [personnelId, sites.get('pnp').institutionId, sites.get('pnp').id, `TEST-${randomUUID().slice(0, 8)}`, 'Agente prueba']);
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/ops/incidents`;
    const post = (id, body, bearer = token) => fetch(`${base}/${id}/assignments`, { method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const suggestion = await (await fetch(`${base}/${first.id}/suggestions`, { headers: { authorization: `Bearer ${token}` } })).json();
    assert.ok(['pnp', 'samu', 'bomberos'].every((type) => suggestion.suggestions.some((row) => row.institutionType === type)));
    for (const type of ['pnp', 'samu', 'bomberos']) {
      const site = sites.get(type);
      const response = await post(first.id, { institutionId: site.institutionId, siteId: site.id });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).corrected, false);
    }
    const [[assignmentCount]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id = ?', [first.id]);
    assert.equal(assignmentCount.total, 3);
    assert.equal((await post(fourth.id, { institutionId: sites.get('samu').institutionId, siteId: sites.get('samu').id }, operatorToken)).status, 403);
    const operatorAssignment = await post(fourth.id, { institutionId: sites.get('pnp').institutionId,
      siteId: sites.get('pnp').id, operatorUserId: operator.id }, operatorToken);
    assert.equal(operatorAssignment.status, 201);
    assert.equal((await operatorAssignment.json()).operatorUserId, operator.id);
    const manual = sites.get('municipalidad');
    assert.equal((await post(second.id, { institutionId: manual.institutionId, siteId: manual.id })).status, 422);
    const correction = await post(second.id, { institutionId: manual.institutionId, siteId: manual.id, reason: 'Desvío manual de prueba' });
    assert.equal(correction.status, 201);
    assert.equal((await correction.json()).corrected, true);
    const [[audit]] = await pool.execute("SELECT action, after_data AS afterData FROM audit_logs WHERE entity_type = 'institution_assignment' AND action = 'assignment.override' ORDER BY id DESC LIMIT 1");
    assert.equal(audit.action, 'assignment.override');
    assert.equal(audit.afterData.reason, 'Desvío manual de prueba');
    const pnp = sites.get('pnp');
    assert.equal((await post(second.id, { institutionId: pnp.institutionId, siteId: pnp.id, unitIds: [unitId], personnelIds: [randomUUID()] })).status, 409);
    const [[rollbackUnit]] = await pool.execute('SELECT status FROM units WHERE id = ?', [unitId]);
    assert.equal(rollbackUnit.status, 'available');
    const [[rollbackCount]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id = ? AND site_id = ?', [second.id, pnp.id]);
    assert.equal(rollbackCount.total, 0);
    const [a, b] = await Promise.all([
      post(second.id, { institutionId: pnp.institutionId, siteId: pnp.id, unitIds: [unitId], personnelIds: [personnelId] }),
      post(third.id, { institutionId: pnp.institutionId, siteId: pnp.id, unitIds: [unitId], personnelIds: [personnelId] }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const [[activeUnits]] = await pool.execute('SELECT COUNT(*) AS total FROM unit_assignments WHERE unit_id = ? AND released_at IS NULL', [unitId]);
    const [[activePeople]] = await pool.execute('SELECT COUNT(*) AS total FROM personnel_assignments WHERE personnel_id = ? AND released_at IS NULL', [personnelId]);
    assert.equal(activeUnits.total, 1);
    assert.equal(activePeople.total, 1);
    const [[assignedUnit]] = await pool.execute('SELECT status FROM units WHERE id = ?', [unitId]);
    assert.equal(assignedUnit.status, 'assigned');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
