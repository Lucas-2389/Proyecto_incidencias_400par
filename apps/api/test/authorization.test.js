const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const express = require('express');
const mysql = require('mysql2/promise');
const { correlationId, errorHandler } = require('../src/http/errors');
const { requireAuthentication, requireRoles, requireInstitutionScope, requireIncidentScope } = require('../src/auth/authorization');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('middleware rechaza token ausente y acceso cruzado por rol, sede y jurisdicción', async () => {
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const email = `operator-${randomUUID()}@example.invalid`;
  const password = 'test-only-secret-value';
  const user = await registerCitizen(pool, { name: 'Operador de prueba', email, password, acceptedTerms: true });
  const [roles] = await pool.execute("SELECT id FROM roles WHERE code = 'Operador'");
  const [sites] = await pool.execute("SELECT s.id, s.institution_id, i.type FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.is_demo = TRUE");
  const pnp = sites.find((site) => site.type === 'pnp');
  const bomberos = sites.find((site) => site.type === 'bomberos');
  assert.ok(pnp && bomberos);
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, roles[0].id]);
  await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [user.id, pnp.institution_id, pnp.id, roles[0].id]);
  const session = await login(pool, authConfig, { email, password });
  const [incidentRows] = await pool.execute("SELECT i.id, c.code FROM incidents i JOIN incident_categories c ON c.id = i.category_id WHERE i.is_demo = TRUE");
  const traffic = incidentRows.find((item) => item.code === 'traffic_accident');
  const fire = incidentRows.find((item) => item.code === 'fire');
  assert.ok(traffic && fire);

  const app = express();
  app.use(correlationId);
  app.get('/role', requireAuthentication(pool, authConfig), requireRoles('Operador'), (_req, res) => res.json({ ok: true }));
  app.get('/scope/:institutionId/:siteId', requireAuthentication(pool, authConfig), requireRoles('Operador'), requireInstitutionScope(), (_req, res) => res.json({ ok: true }));
  app.get('/incident/:id', requireAuthentication(pool, authConfig), requireRoles('Operador'), requireIncidentScope(pool), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = (path, withToken = true) => fetch(base + path, { headers: withToken ? { authorization: `Bearer ${session.accessToken}` } : {} });
    assert.equal((await get('/role', false)).status, 401);
    assert.equal((await get('/role')).status, 200);
    assert.equal((await get(`/scope/${pnp.institution_id}/${pnp.id}`)).status, 200);
    assert.equal((await get(`/scope/${bomberos.institution_id}/${bomberos.id}`)).status, 403);
    assert.equal((await get(`/incident/${traffic.id}`)).status, 200);
    assert.equal((await get(`/incident/${fire.id}`)).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
