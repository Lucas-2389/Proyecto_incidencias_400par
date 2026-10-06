const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { createReport } = require('../src/incidents/report');
const { NotificationSender } = require('../src/notifications/sender');
const { createFcmSender } = require('../src/notifications/fcm');
const { stripSecrets } = require('../src/audit/router');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

test('canal push ausente o fallido no impide la notificación interna', async () => {
  const notice = { userId: 'test', title: 'Prueba' };
  assert.deepEqual(await new NotificationSender().send(notice), { delivered: false, reason: 'not_configured' });
  assert.deepEqual(await createFcmSender(null, { env: {} }).send(notice), { delivered: false, reason: 'not_configured' });
  assert.deepEqual(await new NotificationSender({ send: async () => { throw new Error('fallo externo'); } }).send(notice),
    { delivered: false, reason: 'provider_failed' });
  assert.deepEqual(stripSecrets({ password: 'clave', nested: { accessToken: 'token', status: 'ok' } }),
    { password: '[REDACTED]', nested: { accessToken: '[REDACTED]', status: 'ok' } });
});

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;
integration('alertas vigentes, avisos por destinatario y auditoría por ámbito', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 4 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const users = {};
  async function makeUser(key, role, institutionId = null, siteId = null) {
    const email = `phase9-${randomUUID()}@example.invalid`;
    const user = await registerCitizen(pool, { name: `Prueba ${key}`, email, password, acceptedTerms: true });
    if (role !== 'Ciudadano') {
      const [[roleRow]] = await pool.execute('SELECT id FROM roles WHERE code = ?', [role]);
      await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, roleRow.id]);
      if (institutionId) await pool.execute(
        'INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
        [user.id, institutionId, siteId, roleRow.id],
      );
    }
    users[key] = { ...user, token: (await login(pool, authConfig, { email, password })).accessToken };
  }
  const [[district]] = await pool.execute("SELECT id FROM districts WHERE code = 'DEMO-AYA-CENTRO'");
  const [siteRows] = await pool.execute("SELECT s.id, s.institution_id AS institutionId, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE AND i.type IN ('pnp', 'bomberos')");
  const sites = new Map(siteRows.map((row) => [row.type, row]));
  await makeUser('super', 'SuperAdministrador');
  await makeUser('fireAdmin', 'AdministradorInstitucional', sites.get('bomberos').institutionId, sites.get('bomberos').id);
  await makeUser('policeAdmin', 'AdministradorInstitucional', sites.get('pnp').institutionId, sites.get('pnp').id);
  await makeUser('operator', 'Operador', sites.get('bomberos').institutionId, sites.get('bomberos').id);
  await makeUser('citizen', 'Ciudadano');
  const [[fire]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'fire'");
  const report = (await createReport(pool, { categoryId: fire.id, description: 'Reporte de prueba',
    location: { latitude: -13.16, longitude: -74.22 } }, { source: 'MOBILE_APP', reporterUserId: users.citizen.id,
    scopeType: 'user', scopeId: users.citizen.id, key: randomUUID() })).receipt;
  const sent = [];
  const sender = new NotificationSender({ send: async (notification) => { sent.push(notification); } });
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, notificationSender: sender,
    logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const request = (path, key, options = {}) => fetch(`${base}${path}`, {
      ...options, headers: { authorization: `Bearer ${users[key].token}`, 'content-type': 'application/json', ...options.headers },
    });
    const now = Date.now();
    const alertBody = { districtId: district.id, type: 'weather', title: `Alerta ${randomUUID()}`,
      message: 'Prueba de lluvia', validFrom: new Date(now - 60000).toISOString(),
      validUntil: new Date(now + 3600000).toISOString() };
    assert.equal((await request('/admin/alerts', 'policeAdmin', { method: 'POST', body: JSON.stringify({ ...alertBody, districtId: null }) })).status, 403);
    const activeResponse = await request('/admin/alerts', 'fireAdmin', { method: 'POST', body: JSON.stringify(alertBody) });
    assert.equal(activeResponse.status, 201);
    const active = await activeResponse.json();
    const expiredResponse = await request('/admin/alerts', 'super', { method: 'POST', body: JSON.stringify({ ...alertBody,
      validFrom: new Date(now - 7200000).toISOString(), validUntil: new Date(now - 3600000).toISOString() }) });
    assert.equal(expiredResponse.status, 201);
    const expired = await expiredResponse.json();
    const publicAlerts = await (await fetch(`${base}/public/alerts?districtId=${district.id}`)).json();
    assert.ok(publicAlerts.some((alert) => alert.id === active.id));
    assert.ok(!publicAlerts.some((alert) => alert.id === expired.id));
    assert.ok(!(await (await fetch(`${base}/public/alerts?districtId=999999`)).json()).some((alert) => alert.id === active.id));
    assert.equal((await request(`/admin/alerts/${active.id}`, 'policeAdmin', { method: 'PATCH', body: JSON.stringify({ title: 'No permitido' }) })).status, 403);
    const changed = await request(`/admin/alerts/${active.id}`, 'fireAdmin', { method: 'PATCH', body: JSON.stringify({ title: 'Alerta actualizada' }) });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).title, 'Alerta actualizada');
    const assignmentResponse = await request(`/ops/incidents/${report.id}/assignments`, 'super', {
      method: 'POST', body: JSON.stringify({ institutionId: sites.get('bomberos').institutionId,
        siteId: sites.get('bomberos').id, operatorUserId: users.operator.id }),
    });
    assert.equal(assignmentResponse.status, 201);
    const assignment = await assignmentResponse.json();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].userId, users.operator.id);
    const notices = await (await request('/notifications/mine?unread=true', 'operator')).json();
    assert.ok(notices.some((notice) => notice.incidentId === report.id));
    const notice = notices.find((item) => item.incidentId === report.id);
    const deviceToken = `test-device-token-${randomUUID()}`;
    const deviceResponse = await request('/notifications/devices', 'operator', { method: 'POST',
      body: JSON.stringify({ token: deviceToken }) });
    assert.equal(deviceResponse.status, 201);
    const device = await deviceResponse.json();
    assert.ok(!JSON.stringify(device).includes(deviceToken));
    const fcmCalls = [];
    let closed = false;
    const fcm = createFcmSender(pool, { env: { FCM_PROJECT_ID: 'incidencias-test' }, sdk: {
      app: { applicationDefault: () => ({}), initializeApp: () => ({}), deleteApp: async () => { closed = true; } },
      messaging: { getMessaging: () => ({ sendEachForMulticast: async (payload) => {
        fcmCalls.push(payload);
        return { successCount: 1, responses: [{ success: true }] };
      } }) },
    } });
    assert.deepEqual(await fcm.send({ userId: users.operator.id, incidentId: report.id,
      type: 'assignment', title: 'Atención', message: 'Nueva asignación' }), { delivered: true, reason: undefined });
    assert.deepEqual(fcmCalls[0].tokens, [deviceToken]);
    assert.equal((await request(`/notifications/devices/${device.id}`, 'citizen', { method: 'DELETE' })).status, 404);
    assert.equal((await request(`/notifications/devices/${device.id}`, 'operator', { method: 'DELETE' })).status, 204);
    assert.equal((await fcm.send({ userId: users.operator.id, type: 'assignment', title: 'Atención', message: 'Prueba' })).reason, 'no_devices');
    await fcm.close();
    assert.equal(closed, true);
    assert.equal((await request(`/notifications/${notice.id}/read`, 'citizen', { method: 'PATCH' })).status, 404);
    assert.equal((await request(`/notifications/${notice.id}/read`, 'operator', { method: 'PATCH' })).status, 200);
    assert.ok(!(await (await request('/notifications/mine?unread=true', 'operator')).json()).some((item) => item.id === notice.id));
    const statusResponse = await request(`/ops/incidents/${report.id}/status`, 'operator', { method: 'PATCH',
      body: JSON.stringify({ assignmentId: assignment.id, status: 'en_route', note: 'En camino' }) });
    assert.equal(statusResponse.status, 200);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].userId, users.citizen.id);
    assert.ok((await (await request('/notifications/mine', 'citizen')).json()).some((item) => item.incidentId === report.id));
    const personnelResponse = await request('/resources/personnel', 'fireAdmin', { method: 'POST',
      body: JSON.stringify({ institutionId: sites.get('bomberos').institutionId, siteId: sites.get('bomberos').id,
        code: `AUD-${randomUUID().slice(0, 8)}`, name: 'Auditoría de prueba' }) });
    assert.equal(personnelResponse.status, 201);
    const person = await personnelResponse.json();
    const ownAudit = await (await request(`/admin/audit?entityId=${person.id}`, 'fireAdmin')).json();
    assert.ok(ownAudit.some((entry) => entry.action === 'personnel.post' && entry.actorUserId === users.fireAdmin.id));
    assert.equal((await request(`/admin/audit?institutionId=${sites.get('bomberos').institutionId}`, 'policeAdmin')).status, 403);
    const cross = await (await request(`/admin/audit?entityId=${person.id}`, 'policeAdmin')).json();
    assert.deepEqual(cross, []);
    const adminAlertAudit = await (await request(`/admin/audit?entityId=${active.id}`, 'fireAdmin')).json();
    assert.ok(adminAlertAudit.some((entry) => entry.action === 'alert.create'));
    for (const status of ['attending', 'resolved', 'closed']) {
      const next = await request(`/ops/incidents/${report.id}/status`, 'operator', { method: 'PATCH',
        body: JSON.stringify({ assignmentId: assignment.id, status, note: `Paso ${status}` }) });
      assert.equal(next.status, 200);
    }
    const retained = await (await request(`/admin/audit?entityId=${report.id}`, 'fireAdmin')).json();
    assert.ok(retained.some((entry) => entry.action === 'assignment.status' && entry.afterData.status === 'closed'));
    assert.equal((await request(`/admin/alerts/${active.id}`, 'fireAdmin', { method: 'DELETE' })).status, 204);
    const afterDelete = await (await fetch(`${base}/public/alerts?districtId=${district.id}`)).json();
    assert.ok(!afterDelete.some((alert) => alert.id === active.id));
    const superAudit = await (await request(`/admin/audit?entityId=${person.id}`, 'super')).json();
    assert.ok(superAudit.length >= 1);
    const [[denied]] = await pool.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE actor_user_id = ? AND action = 'access.denied'", [users.policeAdmin.id]);
    assert.ok(denied.total >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
