const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { validateReport } = require('../src/incidents/report');

test('teléfono de contacto opcional acepta números y rechaza texto libre', () => {
  const report = { categoryId: 1, description: 'Prueba', location: { latitude: -13.16, longitude: -74.22 } };
  assert.equal(validateReport(report).callerContact, null);
  assert.equal(validateReport({ ...report, callerContact: '+51 999 111 222' }).callerContact, '+51 999 111 222');
  assert.throws(() => validateReport({ ...report, callerContact: 'llamar por chat' }), /Teléfono de contacto inválido/);
});

test('observaciones clínicas admiten booleanos y desconocidos sin alterar el contenido legado', () => {
  const report = { categoryId: 1, description: 'Prueba', location: { latitude: -13.16, longitude: -74.22 } };
  const legacy = validateReport(report);
  assert.deepEqual(validateReport({ ...report, isConscious: null, isBreathing: null, hasBleeding: null }), legacy);
  for (const field of ['isConscious', 'isBreathing', 'hasBleeding']) {
    assert.equal(validateReport({ ...report, [field]: false })[field], false);
    assert.equal(validateReport({ ...report, [field]: true })[field], true);
    for (const invalid of [0, 1, '', 'false', [], {}]) {
      assert.throws(() => validateReport({ ...report, [field]: invalid }), /Campo inválido/);
    }
  }
});

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('reportes móvil, invitado y telefónico validan GPS, fuente e idempotencia', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 4 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const password = 'test-only-secret-value';
  const email = `report-citizen-${randomUUID()}@example.invalid`;
  const citizen = await registerCitizen(pool, { name: 'Ciudadano reportante', email, password, acceptedTerms: true });
  const citizenToken = (await login(pool, authConfig, { email, password })).accessToken;
  const superEmail = `report-super-${randomUUID()}@example.invalid`;
  const superUser = await registerCitizen(pool, { name: 'Superadministrador reportes', email: superEmail, password, acceptedTerms: true });
  const [[superRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'SuperAdministrador'");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [superUser.id, superRole.id]);
  const superToken = (await login(pool, authConfig, { email: superEmail, password })).accessToken;
  const operatorEmail = `report-operator-${randomUUID()}@example.invalid`;
  const operator = await registerCitizen(pool, { name: 'Operador reportante', email: operatorEmail, password, acceptedTerms: true });
  const [[operatorRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'Operador'");
  const [[site]] = await pool.execute("SELECT s.id, s.institution_id AS institutionId FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.type = 'pnp' AND i.is_demo = TRUE AND s.name IN ('DEMO Comisaría PNP Ayacucho A', 'DEMO SAMU Ayacucho', 'DEMO Compañía de Bomberos Ayacucho n.º 63', 'DEMO Base Serenazgo Huamanga') LIMIT 1");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [operator.id, operatorRole.id]);
  await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
    [operator.id, site.institutionId, site.id, operatorRole.id]);
  const operatorToken = (await login(pool, authConfig, { email: operatorEmail, password })).accessToken;
  const [[category]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'fire'");
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  app.set('trust proxy', true);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const testOrigin = `2001:db8::${randomUUID().replace(/-/g, '').slice(0, 4)}:${randomUUID().replace(/-/g, '').slice(0, 4)}`;
    const post = (path, body, key, token) => fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Forwarded-For': testOrigin,
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    });
    const report = { categoryId: category.id, description: 'Tres afectados. Persona principal: conductor del vehículo rojo.',
      affectedPeople: 3, isConscious: false, isBreathing: true, hasBleeding: true,
      source: 'PHONE', callerContact: '+51 999 111 222',
      location: { latitude: -13.16, longitude: -74.22, accuracyMeters: 8.5,
        capturedAt: new Date(Date.now() - 60000).toISOString(), reference: 'Marcador final corregido' } };
    const bad = await post('/incidents', { ...report, location: { latitude: 91, longitude: -74.22 } }, randomUUID(), citizenToken);
    assert.equal(bad.status, 422);
    assert.equal((await post('/incidents', { ...report, location: { latitude: -13, longitude: 181 } }, randomUUID(), citizenToken)).status, 422);
    assert.equal((await post('/incidents', { ...report, description: '   ' }, randomUUID(), citizenToken)).status, 422);
    assert.equal((await post('/incidents', { ...report, occurredAt: '2050-01-01T00:00:00Z' }, randomUUID(), citizenToken)).status, 422);
    assert.equal((await post('/incidents', { ...report, location: { ...report.location, accuracyMeters: -1 } }, randomUUID(), citizenToken)).status, 422);
    assert.equal((await post('/incidents', { ...report, callerContact: 'contactar por chat' }, randomUUID(), citizenToken)).status, 422);
    const key = randomUUID();
    const created = await post('/incidents', report, key, citizenToken);
    assert.equal(created.status, 201);
    const first = await created.json();
    assert.equal(first.source, 'MOBILE_APP');
    assert.equal(first.status, 'reported');
    assert.equal(first.verified, false);
    const [[stored]] = await pool.execute(
      `SELECT i.reporter_user_id AS reporterId, i.priority, i.caller_contact AS callerContact, l.accuracy_meters AS accuracy,
       ST_X(l.location_point) AS latitude, ST_Y(l.location_point) AS longitude,
       l.reference_text AS referenceText, l.district_id AS districtId
       FROM incidents i JOIN incident_locations l ON l.incident_id = i.id WHERE i.id = ?`, [first.id],
    );
    assert.equal(stored.reporterId, citizen.id);
    assert.equal(stored.priority, 'high');
    assert.equal(stored.latitude, -13.16);
    assert.equal(stored.longitude, -74.22);
    assert.equal(Number(stored.accuracy), 8.5);
    assert.equal(stored.referenceText, 'Marcador final corregido');
    assert.equal(stored.callerContact, '+51 999 111 222');
    assert.ok(stored.districtId);
    const ownDetail = await (await fetch(`${base}/incidents/${first.id}`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    })).json();
    assert.equal(Object.hasOwn(ownDetail, 'callerContact'), false);
    assert.equal(ownDetail.affectedPeople, 3);
    assert.equal(ownDetail.description, report.description);
    assert.equal(ownDetail.isConscious, false);
    assert.equal(ownDetail.isBreathing, true);
    assert.equal(ownDetail.hasBleeding, true);
    assert.equal(ownDetail.history.length, 1);
    assert.equal(ownDetail.history[0].eventType, 'created');
    assert.deepEqual(Object.keys(ownDetail.history[0]).sort(), ['createdAt', 'eventType', 'newValue', 'previousValue']);
    // Insert out of chronological order, including two events with the same timestamp.
    for (const [previous, next, date] of [
      ['verifying', 'assigned', '2030-01-02 12:00:00'],
      ['reported', 'verifying', '2030-01-01 12:00:00'],
      ['assigned', 'en_route', '2030-01-02 12:00:00'],
    ]) {
      await pool.execute(`INSERT INTO incident_history
        (incident_id, actor_user_id, event_type, previous_value, new_value, note, created_at)
        VALUES (?, ?, 'status.changed', ?, ?, 'Nota interna privada', ?)`,
      [first.id, superUser.id, previous, next, date]);
    }
    const timeline = await (await fetch(`${base}/incidents/${first.id}`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    })).json();
    assert.deepEqual(timeline.history.map((event) => event.newValue), ['reported', 'verifying', 'assigned', 'en_route']);
    for (const event of timeline.history) {
      assert.deepEqual(Object.keys(event).sort(), ['createdAt', 'eventType', 'newValue', 'previousValue']);
    }
    assert.equal(JSON.stringify(timeline.history).includes('Nota interna'), false);
    assert.equal((await fetch(`${base}/incidents/${first.id}`)).status, 401);
    const strangerEmail = `stranger-${randomUUID()}@example.invalid`;
    await registerCitizen(pool, { name: 'Otro ciudadano', email: strangerEmail, password, acceptedTerms: true });
    const strangerToken = (await login(pool, authConfig, { email: strangerEmail, password })).accessToken;
    const denied = await fetch(`${base}/incidents/${first.id}`, { headers: { authorization: `Bearer ${strangerToken}` } });
    assert.equal(denied.status, 403);
    assert.equal(Object.hasOwn(await denied.json(), 'history'), false);
    const operatorDetail = await (await fetch(`${base}/incidents/${first.id}`, {
      headers: { authorization: `Bearer ${superToken}` },
    })).json();
    assert.equal(operatorDetail.callerContact, '+51 999 111 222');
    assert.equal(operatorDetail.isConscious, false);
    assert.equal(operatorDetail.isBreathing, true);
    assert.equal(operatorDetail.hasBleeding, true);
    const [[notice]] = await pool.execute(
      "SELECT id, user_id AS userId FROM notifications WHERE incident_id = ? AND type = 'incident_created' AND user_id = ?",
      [first.id, superUser.id],
    );
    assert.equal(notice.userId, superUser.id);
    const repeated = await post('/incidents', report, key, citizenToken);
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).id, first.id);
    const [[noticeCount]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM notifications WHERE incident_id = ? AND type = 'incident_created' AND user_id = ?",
      [first.id, superUser.id],
    );
    assert.equal(noticeCount.total, 1);
    assert.equal((await post('/incidents', { ...report, description: 'Contenido alterado' }, key, citizenToken)).status, 409);
    assert.equal((await post('/incidents', { ...report, isConscious: true }, key, citizenToken)).status, 409);
    const legacyBody = { ...report };
    delete legacyBody.isConscious;
    delete legacyBody.isBreathing;
    delete legacyBody.hasBleeding;
    const legacyKey = randomUUID();
    const legacyReceipt = await (await post('/incidents', legacyBody, legacyKey, citizenToken)).json();
    const legacyInput = { categoryId: category.id, subcategoryId: null, description: legacyBody.description,
      affectedPeople: 3, occurredAt: null, location: { ...legacyBody.location }, callerContact: legacyBody.callerContact };
    const legacyHash = createHash('sha256').update(JSON.stringify({ source: 'MOBILE_APP', input: legacyInput })).digest('hex');
    await pool.execute('UPDATE client_requests SET request_hash=? WHERE incident_id=?', [legacyHash, legacyReceipt.id]);
    const legacyRetry = await post('/incidents', { ...legacyBody, isConscious: null, isBreathing: null, hasBleeding: null }, legacyKey, citizenToken);
    assert.equal(legacyRetry.status, 200);
    assert.equal((await legacyRetry.json()).id, legacyReceipt.id);
    assert.equal((await post('/incidents', { ...legacyBody, hasBleeding: false }, legacyKey, citizenToken)).status, 409);
    const legacyDetail = await (await fetch(`${base}/incidents/${legacyReceipt.id}`, { headers: { authorization: `Bearer ${citizenToken}` } })).json();
    assert.equal(legacyDetail.isConscious, null);
    assert.equal(legacyDetail.isBreathing, null);
    assert.equal(legacyDetail.hasBleeding, null);
    await pool.execute('DELETE FROM incident_history WHERE incident_id = ?', [legacyReceipt.id]);
    const withoutHistory = await (await fetch(`${base}/incidents/${legacyReceipt.id}`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    })).json();
    assert.deepEqual(withoutHistory.history, []);
    assert.equal((await post('/incidents', { ...report, isBreathing: 1 }, randomUUID(), citizenToken)).status, 422);
    const concurrencyKey = randomUUID();
    const [a, b] = await Promise.all([post('/incidents', report, concurrencyKey, citizenToken), post('/incidents', report, concurrencyKey, citizenToken)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal((await a.json()).id, (await b.json()).id);
    const guest = await post('/incidents', report, randomUUID());
    assert.equal(guest.status, 201);
    const guestReceipt = await guest.json();
    const [[guestStored]] = await pool.execute('SELECT reporter_user_id AS reporterId, verification_status AS verification FROM incidents WHERE id = ?', [guestReceipt.id]);
    assert.equal(guestStored.reporterId, null);
    assert.equal(guestStored.verification, 'unverified');
    const guestDetail = await (await fetch(`${base}/incidents/${guestReceipt.id}`, { headers: { authorization: `Bearer ${superToken}` } })).json();
    assert.equal(guestDetail.hasBleeding, true);
    const phone = await post('/ops/incidents/phone', { categoryId: category.id, description: 'Llamada de prueba',
      isConscious: true, isBreathing: false, hasBleeding: null,
      institutionId: site.institutionId, siteId: site.id, source: 'MOBILE_APP' }, randomUUID(), operatorToken);
    assert.equal(phone.status, 201);
    const phoneReceipt = await phone.json();
    assert.equal(phoneReceipt.source, 'PHONE');
    const [[phoneStored]] = await pool.execute('SELECT created_by_user_id AS creator FROM incidents WHERE id = ?', [phoneReceipt.id]);
    assert.equal(phoneStored.creator, operator.id);
    const phoneDetail = await (await fetch(`${base}/incidents/${phoneReceipt.id}`, { headers: { authorization: `Bearer ${superToken}` } })).json();
    assert.equal(phoneDetail.isConscious, true);
    assert.equal(phoneDetail.isBreathing, false);
    assert.equal(phoneDetail.hasBleeding, null);
    assert.equal((await fetch(`${base}/incidents/${phoneReceipt.id}`, { headers: { authorization: `Bearer ${citizenToken}` } })).status, 403);
    const [[phoneLocation]] = await pool.execute('SELECT incident_id FROM incident_locations WHERE incident_id = ?', [phoneReceipt.id]);
    assert.equal(phoneLocation, undefined);
    assert.equal((await post('/ops/incidents/phone', { categoryId: category.id, description: 'Ajeno',
      institutionId: randomUUID(), siteId: site.id }, randomUUID(), operatorToken)).status, 403);
    const clientRequestId = randomUUID();
    assert.equal((await post('/incidents', { ...report, clientRequestId }, null, citizenToken)).status, 201);
    for (let i = 0; i < 9; i += 1) {
      assert.equal((await post('/incidents', report, randomUUID())).status, 201);
    }
    assert.equal((await post('/incidents', report, randomUUID())).status, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
