const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { createReport } = require('../src/incidents/report');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('perfil institucional y categorías históricas conservan contratos y ámbito', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const authConfig = { jwtSecret: 'institutional-profile-secret-longer-than-thirty-two' };
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const password = 'institutional-profile-password';
    const email = `institutional-${randomUUID()}@example.invalid`;
    const actor = await registerCitizen(pool, { name: 'Operador de perfil', email, password, acceptedTerms: true });
    const [roles] = await pool.execute("SELECT id, code FROM roles WHERE code IN ('Operador','AdministradorInstitucional','SuperAdministrador')");
    const operatorRole = roles.find((role) => role.code === 'Operador');
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actor.id, operatorRole.id]);
    const token = (await login(pool, authConfig, { email, password })).accessToken;
    const call = (path, method = 'GET', body) => fetch(base + path, { method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const empty = await (await call('/auth/me')).json();
    assert.ok(empty.roles.includes('Operador'));
    assert.deepEqual(empty.memberships, []);
    const [sites] = await pool.execute('SELECT s.id, s.name, s.institution_id AS institutionId, i.name AS institutionName FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE s.active = TRUE AND i.active = TRUE LIMIT 2');
    assert.equal(sites.length, 2);
    for (const site of sites) await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [actor.id, site.institutionId, site.id, operatorRole.id]);
    const adminRole = roles.find((role) => role.code === 'AdministradorInstitucional');
    await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, NULL, ?)', [actor.id, sites[0].institutionId, adminRole.id]);
    const populated = await (await call('/auth/me')).json();
    assert.equal(populated.memberships.length, 3);
    for (const site of sites) assert.ok(populated.memberships.some((item) => item.siteId === site.id && item.siteName === site.name && item.institutionName === site.institutionName && item.role === 'Operador'));
    assert.ok(populated.memberships.some((item) => item.siteId === null && item.siteName === null && item.role === 'AdministradorInstitucional'));
    const saved = await (await call('/auth/me', 'PATCH', { name: 'Nombre actualizado', phone: '' })).json();
    assert.deepEqual(Object.keys(saved).sort(), ['email', 'id', 'name', 'phone']);
    assert.equal(saved.name, 'Nombre actualizado');
    for (const invalid of [{ institutionId: sites[0].institutionId }, { siteId: sites[0].id }, { roles: ['SuperAdministrador'] }]) assert.equal((await call('/auth/me', 'PATCH', invalid)).status, 422);

    const [category] = await pool.execute("INSERT INTO incident_categories (code, name, family, default_priority) VALUES (?, 'Categoría histórica de prueba', 'emergency', 'normal')", [`history-${randomUUID()}`]);
    const receipt = (await createReport(pool, { categoryId: category.insertId, description: 'Reporte histórico de prueba', location: { latitude: -13.16, longitude: -74.22 } },
      { source: 'MOBILE_APP', reporterUserId: actor.id, scopeType: 'user', scopeId: actor.id, key: randomUUID() })).receipt;
    await pool.execute('UPDATE incident_categories SET active = FALSE WHERE id = ?', [category.insertId]);
    const inbox = await (await call('/ops/incidents?status=reported')).json();
    const report = inbox.find((item) => item.id === receipt.id);
    assert.equal(report.categoryName, 'Categoría histórica de prueba');
    assert.equal(report.reference, receipt.reference);
    assert.equal(report.status, 'reported');
    const closed = await (await call('/ops/incidents?status=closed')).json();
    assert.ok(!closed.some((item) => item.id === receipt.id));

    const superRole = roles.find((role) => role.code === 'SuperAdministrador');
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actor.id, superRole.id]);
    await pool.execute('UPDATE institution_memberships SET active = FALSE WHERE user_id = ?', [actor.id]);
    const global = await (await call('/auth/me')).json();
    assert.ok(global.roles.includes('SuperAdministrador'));
    assert.deepEqual(global.memberships, []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
