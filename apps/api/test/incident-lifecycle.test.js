const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { createReport } = require('../src/incidents/report');
const { createAssignment } = require('../src/dispatch/assignments');
const { advanceIncident } = require('../src/dispatch/lifecycle');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('verificación, estados multiinstitución, duplicados e historial conservan coherencia', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 4 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const citizenEmail = `lifecycle-citizen-${randomUUID()}@example.invalid`;
  const citizen = await registerCitizen(pool, { name: 'Ciudadano ciclo', email: citizenEmail, password, acceptedTerms: true });
  const citizenToken = (await login(pool, authConfig, { email: citizenEmail, password })).accessToken;
  const superEmail = `lifecycle-super-${randomUUID()}@example.invalid`;
  const actor = await registerCitizen(pool, { name: 'Super ciclo', email: superEmail, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actor.id, role.id]);
  const token = (await login(pool, authConfig, { email: superEmail, password })).accessToken;
  const [[category]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'traffic_accident'");
  const [sites] = await pool.execute("SELECT s.id, s.institution_id AS institutionId, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE AND s.is_demo = TRUE AND i.type IN ('pnp','samu')");
  const pnp = sites.find((row) => row.type === 'pnp');
  const samu = sites.find((row) => row.type === 'samu');
  const makeIncident = async () => (await createReport(pool, { categoryId: category.id, description: 'Incidente de ciclo',
    location: { latitude: -13.16, longitude: -74.22 } }, { source: 'MOBILE_APP', reporterUserId: citizen.id,
    scopeType: 'user', scopeId: citizen.id, key: randomUUID() })).receipt;
  const incident = await makeIncident();
  const duplicate = await makeIncident();
  const unitId = randomUUID();
  await pool.execute('INSERT INTO units (id, institution_id, site_id, code, type) VALUES (?, ?, ?, ?, ?)',
    [unitId, pnp.institutionId, pnp.id, `LIFE-${randomUUID().slice(0, 8)}`, 'Patrullero']);
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const call = (path, method, body, auth = token) => fetch(base + path, {
      method, headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await call(`/ops/incidents/${incident.id}/verification`, 'PATCH', { verificationStatus: 'false', reason: 'No autorizado' }, citizenToken)).status, 403);
    assert.equal((await call(`/ops/incidents/${incident.id}/status`, 'PATCH', { status: 'closed', note: 'Salto' })).status, 409);
    assert.equal((await call(`/ops/incidents/${incident.id}/status`, 'PATCH', { status: 'verifying', note: 'Revisión inicial' })).status, 200);
    const verified = await call(`/ops/incidents/${incident.id}/verification`, 'PATCH', { verificationStatus: 'verified', priority: 'critical', reason: 'Confirmación DEMO' });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).priority, 'critical');
    const pnpAssignment = await (await call(`/ops/incidents/${incident.id}/assignments`, 'POST', { institutionId: pnp.institutionId, siteId: pnp.id, unitIds: [unitId] })).json();
    const samuAssignment = await (await call(`/ops/incidents/${incident.id}/assignments`, 'POST', { institutionId: samu.institutionId, siteId: samu.id })).json();
    for (const status of ['en_route', 'attending', 'resolved']) {
      const changed = await call(`/ops/incidents/${incident.id}/status`, 'PATCH', { assignmentId: pnpAssignment.id, status, note: `Hito ${status}` });
      assert.equal(changed.status, 200);
      assert.equal((await changed.json()).status, 'assigned');
    }
    assert.equal((await call(`/ops/incidents/${incident.id}/status`, 'PATCH', { assignmentId: pnpAssignment.id, status: 'closed', note: 'PNP cerró' })).status, 200);
    let [[global]] = await pool.execute('SELECT status FROM incidents WHERE id = ?', [incident.id]);
    assert.equal(global.status, 'assigned');
    for (const status of ['en_route', 'attending', 'resolved', 'closed']) {
      const changed = await call(`/ops/incidents/${incident.id}/status`, 'PATCH', { assignmentId: samuAssignment.id, status, note: `SAMU ${status}` });
      assert.equal(changed.status, 200);
    }
    [[global]] = await pool.execute('SELECT status, priority, verification_status AS verificationStatus FROM incidents WHERE id = ?', [incident.id]);
    assert.equal(global.status, 'closed');
    assert.equal(global.priority, 'critical');
    assert.equal(global.verificationStatus, 'verified');
    const [[unit]] = await pool.execute('SELECT status FROM units WHERE id = ?', [unitId]);
    assert.equal(unit.status, 'available');
    const [[reservation]] = await pool.execute('SELECT released_at AS releasedAt FROM unit_assignments WHERE unit_id = ? AND institution_assignment_id = ?', [unitId, pnpAssignment.id]);
    assert.ok(reservation.releasedAt);
    const [history] = await pool.execute('SELECT event_type AS eventType FROM incident_history WHERE incident_id = ? ORDER BY id', [incident.id]);
    assert.ok(history.some((row) => row.eventType === 'verification.changed'));
    assert.equal(history.filter((row) => row.eventType === 'assignment.status').length, 8);
    const [audits] = await pool.execute("SELECT action FROM audit_logs WHERE entity_type = 'incident' AND entity_id = ?", [incident.id]);
    assert.ok(audits.some((row) => row.action === 'assignment.status'));
    const [notifications] = await pool.execute('SELECT id FROM notifications WHERE incident_id = ? AND user_id = ?', [incident.id, citizen.id]);
    assert.ok(notifications.length >= 2);
    assert.equal((await call(`/ops/incidents/${duplicate.id}/duplicates`, 'POST', { primaryIncidentId: incident.id, reason: 'Mismo evento DEMO' })).status, 201);
    const [[link]] = await pool.execute('SELECT primary_incident_id AS primaryId FROM incident_duplicates WHERE duplicate_incident_id = ?', [duplicate.id]);
    assert.equal(link.primaryId, incident.id);
    assert.equal((await call(`/incidents/${duplicate.id}`, 'GET', undefined, citizenToken)).status, 200);
    assert.equal((await call(`/incidents/${incident.id}`, 'GET', undefined, citizenToken)).status, 200);
    const own = await (await call('/incidents/mine', 'GET', undefined, citizenToken)).json();
    assert.ok(own.some((row) => row.id === incident.id));
    assert.ok(own.some((row) => row.id === duplicate.id));
    assert.equal((await call('/ops/incidents', 'GET', undefined, citizenToken)).status, 403);
    const inbox = await (await call('/ops/incidents?status=closed', 'GET')).json();
    assert.ok(inbox.some((row) => row.id === incident.id));
    const citizenDetail = await (await call(`/incidents/${incident.id}`, 'GET', undefined, citizenToken)).json();
    assert.equal(citizenDetail.operatorUserId, undefined);
    assert.equal(citizenDetail.personnelIds, undefined);
    assert.equal(citizenDetail.priority, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

integration('fallo antes de auditoría revierte estado, historial, recursos y aviso', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const password = 'test-only-secret-value';
  const email = `rollback-super-${randomUUID()}@example.invalid`;
  const actor = await registerCitizen(pool, { name: 'Super rollback', email, password, acceptedTerms: true });
  const [[role]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actor.id, role.id]);
  const [[category]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'traffic_accident'");
  const [[site]] = await pool.execute("SELECT s.id, s.institution_id AS institutionId FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.type = 'pnp' AND i.is_demo = TRUE LIMIT 1");
  const receipt = (await createReport(pool, { categoryId: category.id, description: 'Rollback de estado',
    location: { latitude: -13.16, longitude: -74.22 } }, { source: 'MOBILE_APP', reporterUserId: actor.id,
    scopeType: 'user', scopeId: actor.id, key: randomUUID() })).receipt;
  const unitId = randomUUID();
  await pool.execute('INSERT INTO units (id, institution_id, site_id, code, type) VALUES (?, ?, ?, ?, ?)',
    [unitId, site.institutionId, site.id, `ROLL-${randomUUID().slice(0, 8)}`, 'Patrullero']);
  const auth = { user: { id: actor.id }, roles: new Set(['SuperAdministrador']), memberships: [] };
  const assignment = await createAssignment(pool, receipt.id, auth, {
    institutionId: site.institutionId, siteId: site.id, unitIds: [unitId],
  }, randomUUID());
  const [[beforeHistory]] = await pool.execute('SELECT COUNT(*) AS total FROM incident_history WHERE incident_id = ?', [receipt.id]);
  const [[beforeAudit]] = await pool.execute('SELECT COUNT(*) AS total FROM audit_logs WHERE entity_id = ? AND entity_type = ?', [receipt.id, 'incident']);
  const faultyPool = {
    async getConnection() {
      const connection = await pool.getConnection();
      return new Proxy(connection, {
        get(target, property) {
          if (property === 'execute') return (sql, args) => {
            if (sql.includes('INSERT INTO audit_logs')) throw new Error('Fallo inyectado antes de auditoría');
            return target.execute(sql, args);
          };
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
  try {
    await assert.rejects(advanceIncident(faultyPool, receipt.id, auth, {
      assignmentId: assignment.id, status: 'en_route', note: 'Prueba de rollback',
    }, randomUUID()), /Fallo inyectado/);
    const [[storedAssignment]] = await pool.execute('SELECT status FROM institution_assignments WHERE id = ?', [assignment.id]);
    const [[storedUnit]] = await pool.execute('SELECT status FROM units WHERE id = ?', [unitId]);
    const [[storedIncident]] = await pool.execute('SELECT status FROM incidents WHERE id = ?', [receipt.id]);
    const [[afterHistory]] = await pool.execute('SELECT COUNT(*) AS total FROM incident_history WHERE incident_id = ?', [receipt.id]);
    const [[afterAudit]] = await pool.execute('SELECT COUNT(*) AS total FROM audit_logs WHERE entity_id = ? AND entity_type = ?', [receipt.id, 'incident']);
    const [[notices]] = await pool.execute('SELECT COUNT(*) AS total FROM notifications WHERE incident_id = ?', [receipt.id]);
    assert.equal(storedAssignment.status, 'assigned');
    assert.equal(storedUnit.status, 'assigned');
    assert.equal(storedIncident.status, 'assigned');
    assert.equal(afterHistory.total, beforeHistory.total);
    assert.equal(afterAudit.total, beforeAudit.total);
    assert.equal(notices.total, 0);
  } finally { await pool.end(); }
});
