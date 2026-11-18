const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { createReport } = require('../src/incidents/report');
const { createAssignment } = require('../src/dispatch/assignments');
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
  const [siteRows] = await pool.execute("SELECT s.id, s.institution_id AS institutionId, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE AND s.name IN ('DEMO Comisaría PNP Ayacucho A', 'DEMO SAMU Ayacucho', 'DEMO Compañía de Bomberos Ayacucho n.º 63', 'DEMO Base Serenazgo Huamanga') AND s.is_demo = TRUE");
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
      const assigned = await response.json();
      assert.equal(assigned.corrected, false);
      assert.deepEqual(assigned.unitIds, []);
      assert.deepEqual(assigned.personnelIds, []);
      const [[reserves]] = await pool.execute(
        'SELECT (SELECT COUNT(*) FROM unit_assignments WHERE institution_assignment_id=?) + (SELECT COUNT(*) FROM personnel_assignments WHERE institution_assignment_id=?) AS total',
        [assigned.id, assigned.id]);
      assert.equal(reserves.total, 0);
    }
    const [[assignmentCount]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id = ?', [first.id]);
    assert.equal(assignmentCount.total, 3);
    assert.equal((await post(fourth.id, { institutionId: sites.get('samu').institutionId, siteId: sites.get('samu').id }, operatorToken)).status, 403);
    const operatorAssignment = await post(fourth.id, { institutionId: sites.get('pnp').institutionId,
      siteId: sites.get('pnp').id, operatorUserId: operator.id }, operatorToken);
    assert.equal(operatorAssignment.status, 201);
    assert.equal((await operatorAssignment.json()).operatorUserId, operator.id);
    const getOperators = (siteId, bearer = operatorToken, incidentId = first.id) => fetch(`${base}/${incidentId}/operators?siteId=${siteId}`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    const eligible = await getOperators(sites.get('pnp').id);
    assert.equal(eligible.status, 200);
    const eligiblePeople = await eligible.json();
    assert.ok(eligiblePeople.some((person) => person.id === operator.id));
    for (const person of eligiblePeople) assert.deepEqual(Object.keys(person).sort(), ['id', 'name']);
    assert.equal((await getOperators(sites.get('samu').id)).status, 403);
    assert.equal((await getOperators('invalid', token)).status, 422);
    assert.equal((await getOperators(randomUUID(), token)).status, 404);
    assert.equal((await getOperators(sites.get('pnp').id, token, randomUUID())).status, 404);
    assert.equal((await getOperators(sites.get('pnp').id, token)).status, 200);
    const emptySiteId = randomUUID();
    await pool.execute('INSERT INTO sites (id, institution_id, name, location) SELECT ?, institution_id, ?, location FROM sites WHERE id = ?',
      [emptySiteId, 'DEMO Sede vacía de prueba', sites.get('pnp').id]);
    assert.deepEqual(await (await getOperators(emptySiteId, token)).json(), []);
    await pool.execute('UPDATE sites SET active = FALSE WHERE id = ?', [emptySiteId]);
    assert.equal((await getOperators(emptySiteId, token)).status, 404);
    const [[adminRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'AdministradorInstitucional'");
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [operator.id, adminRole.id]);
    await pool.execute('UPDATE institution_memberships SET role_id = ? WHERE user_id = ?', [adminRole.id, operator.id]);
    const adminToken = (await login(pool, authConfig, { email: operatorEmail, password })).accessToken;
    assert.equal((await getOperators(sites.get('pnp').id, adminToken)).status, 200);
    await pool.execute('UPDATE institution_memberships SET role_id = ? WHERE user_id = ?', [operatorRole.id, operator.id]);
    await pool.execute('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [operator.id, adminRole.id]);
    await pool.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [operator.id]);
    const inactiveList = await (await getOperators(sites.get('pnp').id, token)).json();
    assert.equal(inactiveList.some((person) => person.id === operator.id), false);
    await pool.execute("UPDATE users SET status = 'active' WHERE id = ?", [operator.id]);
    const concurrentIncident = await makeIncident();
    const concurrent = await Promise.all(['pnp', 'samu'].map((type) => {
      const site = sites.get(type);
      return post(concurrentIncident.id, { institutionId: site.institutionId, siteId: site.id });
    }));
    assert.deepEqual(concurrent.map((response) => response.status), [201, 201]);
    const duplicateIncident = await makeIncident();
    const pnpBody = { institutionId: sites.get('pnp').institutionId, siteId: sites.get('pnp').id };
    const duplicateResponses = await Promise.all([post(duplicateIncident.id, pnpBody), post(duplicateIncident.id, pnpBody)]);
    assert.deepEqual(duplicateResponses.map((response) => response.status).sort(), [201, 409]);
    const [[duplicateCount]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id = ?', [duplicateIncident.id]);
    assert.equal(duplicateCount.total, 1);
    const rollbackIncident = await makeIncident();
    const rollbackAuth = { user: { id: actor.id }, roles: new Set(['SuperAdministrador']), memberships: [] };
    const faultyPool = {
      execute: pool.execute.bind(pool),
      async getConnection() {
        const connection = await pool.getConnection();
        return new Proxy(connection, {
          get(target, property) {
            if (property === 'execute') return (sql, args) => {
              if (sql.includes('INSERT INTO audit_logs')) throw new Error('Fallo de confirmación inyectado');
              return target.execute(sql, args);
            };
            const value = target[property];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    };
    const [[historyBefore]] = await pool.execute('SELECT COUNT(*) AS total FROM incident_history WHERE incident_id = ?', [rollbackIncident.id]);
    await assert.rejects(createAssignment(faultyPool, rollbackIncident.id, rollbackAuth, pnpBody, randomUUID()), /Fallo de confirmación/);
    const [[rolledBack]] = await pool.execute('SELECT status FROM incidents WHERE id = ?', [rollbackIncident.id]);
    const [[historyAfter]] = await pool.execute('SELECT COUNT(*) AS total FROM incident_history WHERE incident_id = ?', [rollbackIncident.id]);
    const [[assignmentsAfter]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id = ?', [rollbackIncident.id]);
    assert.equal(rolledBack.status, 'reported');
    assert.equal(historyAfter.total, historyBefore.total);
    assert.equal(assignmentsAfter.total, 0);
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
    for (const resources of [{ unitIds: [], personnelIds: [] }, { unitIds: [unitId] }, { personnelIds: [personnelId] }]) {
      const incident = await makeIncident();
      const request = { institutionId: pnp.institutionId, siteId: pnp.id, ...resources };
      // Single-resource cases get their own available resource.
      if (resources.unitIds?.length) {
        const availableUnit = randomUUID();
        await pool.execute("INSERT INTO units (id, institution_id, site_id, code, type) VALUES (?, ?, ?, ?, 'Patrullero')", [availableUnit, pnp.institutionId, pnp.id, `TEST-${randomUUID()}`]);
        request.unitIds = [availableUnit];
      }
      if (resources.personnelIds?.length) {
        const availablePerson = randomUUID();
        await pool.execute('INSERT INTO personnel (id, institution_id, site_id, code, name) VALUES (?, ?, ?, ?, ?)', [availablePerson, pnp.institutionId, pnp.id, `TEST-${randomUUID()}`, 'Prueba individual']);
        request.personnelIds = [availablePerson];
      }
      const response = await post(incident.id, request);
      assert.equal(response.status, 201);
      const assigned = await response.json();
      assert.deepEqual(assigned.unitIds, request.unitIds ?? []);
      assert.deepEqual(assigned.personnelIds, request.personnelIds ?? []);
    }
    const invalidIncident = await makeIncident();
    for (const field of ['unitIds', 'personnelIds']) {
      for (const invalid of [null, 'invalid', [unitId, unitId], ['invalid'], Array.from({ length: 31 }, () => randomUUID())]) {
        assert.equal((await post(invalidIncident.id, { institutionId: pnp.institutionId, siteId: pnp.id, [field]: invalid })).status, 422);
      }
    }
    const [[invalidAssignments]] = await pool.execute('SELECT COUNT(*) AS total FROM institution_assignments WHERE incident_id=?', [invalidIncident.id]);
    assert.equal(invalidAssignments.total, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
