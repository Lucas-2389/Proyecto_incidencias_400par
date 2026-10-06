const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');
const sharp = require('sharp');
const { createApp } = require('../src/app');
const { createHealthService } = require('../src/health/service');
const { createEvidenceStore } = require('../src/incidents/evidence-store');
const { loadConfig } = require('../src/config');
const { loadTestDatabaseConfig } = require('./integration-config');

async function main() {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 5 });
  const config = loadConfig();
  const evidenceStore = createEvidenceStore(path.resolve(__dirname, '../.local/pilot-http-evidence'));
  const app = createApp(createHealthService(pool), { pool, authConfig: config.auth, evidenceStore,
    logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    async function call(method, route, { token, body, headers = {}, expected = 200 } = {}) {
      const response = await fetch(base + route, { method, headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...headers,
      }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
      assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${result.code || ''}`);
      return result;
    }
    const password = process.env.DEMO_PASSWORD;
    assert.ok(password && password.length >= 12, 'Se requiere DEMO_PASSWORD local');
    const citizen = await call('POST', '/auth/login', { body: { email: 'citizen@demo.invalid', password } });
    const admin = await call('POST', '/auth/login', { body: { email: 'superadmin@demo.invalid', password } });
    const citizenToken = citizen.accessToken;
    const adminToken = admin.accessToken;
    const categories = await call('GET', '/catalog/categories');
    const fire = categories.find((item) => item.code === 'fire');
    assert.ok(fire, 'Categoría DEMO incendio');
    const receipts = [];
    for (let index = 0; index < 3; index += 1) {
      const key = randomUUID();
      const body = { categoryId: fire.id, description: `Incendio DEMO del recorrido ${index + 1}`,
        location: { latitude: -13.16, longitude: -74.22, accuracyMeters: 8,
          capturedAt: new Date().toISOString() }, clientRequestId: key };
      const receipt = await call('POST', '/incidents', { token: citizenToken, body,
        headers: { 'Idempotency-Key': key }, expected: 201 });
      if (index === 0) {
        const repeated = await call('POST', '/incidents', { token: citizenToken, body,
          headers: { 'Idempotency-Key': key } });
        assert.equal(repeated.reference, receipt.reference);
      }
      receipts.push(receipt);
    }
    const incident = receipts[0];
    const photo = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff6600' } }).png().toBuffer();
    const form = new FormData();
    form.append('photo', new Blob([photo], { type: 'image/png' }), 'demo.png');
    const evidence = await call('POST', `/incidents/${incident.id}/evidence`, {
      token: citizenToken, body: form, expected: 201 });
    assert.equal(evidence.mediaType, 'image/png');
    const mine = await call('GET', '/incidents/mine', { token: citizenToken });
    assert.ok(mine.some((item) => item.id === incident.id));
    const suggestions = await call('GET', `/ops/incidents/${incident.id}/suggestions`, { token: adminToken });
    const fireSite = suggestions.suggestions.find((item) => item.institutionType === 'bomberos');
    assert.ok(fireSite, 'Bomberos DEMO sugerido');
    await call('PATCH', `/ops/incidents/${incident.id}/status`, { token: adminToken,
      body: { status: 'verifying', note: 'Revisión DEMO' } });
    await call('PATCH', `/ops/incidents/${incident.id}/verification`, { token: adminToken,
      body: { verificationStatus: 'verified', reason: 'Reporte DEMO comprobado' } });
    const [[resources]] = await pool.execute(
      `SELECT u.id AS unitId, p.id AS personnelId, m.user_id AS operatorId
       FROM units u JOIN personnel p ON p.site_id = u.site_id AND p.active = TRUE
       JOIN institution_memberships m ON m.site_id = u.site_id
       JOIN users actor ON actor.id = m.user_id AND actor.email = 'operator-bomberos@demo.invalid'
       WHERE u.site_id = ? AND u.status = 'available' LIMIT 1`, [fireSite.siteId]);
    assert.ok(resources, 'Recursos y operador DEMO disponibles');
    const assignment = await call('POST', `/ops/incidents/${incident.id}/assignments`, { token: adminToken,
      body: { institutionId: fireSite.institutionId, siteId: fireSite.siteId,
        operatorUserId: resources.operatorId, unitIds: [resources.unitId], personnelIds: [resources.personnelId] }, expected: 201 });
    for (const status of ['en_route', 'attending', 'resolved', 'closed']) {
      await call('PATCH', `/ops/incidents/${incident.id}/status`, { token: adminToken,
        body: { assignmentId: assignment.id, status, note: `Hito DEMO ${status}` } });
    }
    const detail = await call('GET', `/incidents/${incident.id}`, { token: citizenToken });
    assert.equal(detail.status, 'closed');
    assert.ok(detail.evidence.some((item) => item.id === evidence.id));
    const notices = await call('GET', '/notifications/mine', { token: citizenToken });
    assert.ok(notices.some((item) => item.incidentId === incident.id));
    const inbox = await call('GET', '/ops/incidents?status=closed', { token: adminToken });
    assert.ok(inbox.some((item) => item.id === incident.id));
    const map = await call('GET', '/ops/map?from=' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString())
      + '&to=' + encodeURIComponent(new Date(Date.now() + 60000).toISOString()), { token: adminToken });
    assert.ok(map.incidents.some((item) => item.id === incident.id));
    const heatmap = await call('GET', '/public/heatmap?from=' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString())
      + '&to=' + encodeURIComponent(new Date(Date.now() + 60000).toISOString()));
    assert.ok(heatmap.some((cell) => cell.count >= 3));
    let directory = await call('GET', '/public/directory');
    if (directory.length === 0) {
      await call('POST', '/admin/directory', { token: adminToken, expected: 201,
        body: { name: 'DEMO Línea de ayuda', phone: '100', scope: 'national' } });
      directory = await call('GET', '/public/directory');
    }
    assert.ok(directory.length > 0);
    const audits = await call('GET', `/admin/audit?entityType=incident&entityId=${incident.id}`, { token: adminToken });
    assert.ok(audits.some((item) => item.action === 'assignment.status'));
    console.log(JSON.stringify({ reference: incident.reference, status: detail.status,
      evidence: detail.evidence.length, notices: notices.length, mapIncidents: map.incidents.length,
      heatmapCells: heatmap.length, contacts: directory.length, auditEvents: audits.length }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
}

main().catch((error) => {
  const detail = error.name === 'AssertionError' ? error.message : 'fallo de red o base de datos';
  console.error(`Recorrido HTTP falló: ${detail}`);
  process.exitCode = 1;
});
