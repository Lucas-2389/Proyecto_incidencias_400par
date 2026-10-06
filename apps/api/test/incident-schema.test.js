const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('incidentes usan referencia e idempotencia únicas y ubicación SRID 4326', async () => {
  const connection = await mysql.createConnection(loadTestDatabaseConfig());
  try {
    await connection.beginTransaction();
    const suffix = randomUUID().slice(0, 8);
    const [category] = await connection.execute('INSERT INTO incident_categories (code, name, family) VALUES (?, ?, ?)', [`test_${suffix}`, 'Prueba', 'emergency']);
    const incidentId = randomUUID();
    const reference = `TEST-${suffix}`;
    const insert = 'INSERT INTO incidents (id, reference, category_id, source, description, occurred_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))';
    await connection.execute(insert, [incidentId, reference, category.insertId, 'MOBILE_APP', 'Prueba de esquema']);
    await assert.rejects(connection.execute(insert, [randomUUID(), reference, category.insertId, 'MOBILE_APP', 'Duplicado']), /Duplicate entry/);
    await connection.execute("INSERT INTO incident_locations (incident_id, location_point) VALUES (?, ST_GeomFromText('POINT(-74.22 -13.16)', 4326, 'axis-order=long-lat'))", [incidentId]);
    const [[point]] = await connection.execute('SELECT ST_SRID(location_point) AS srid FROM incident_locations WHERE incident_id = ?', [incidentId]);
    assert.equal(point.srid, 4326);
    await connection.execute('INSERT INTO client_requests (scope_type, scope_id, idempotency_key, request_hash, incident_id) VALUES (?, ?, ?, ?, ?)', ['guest', 'guest', `key-${suffix}`, 'a'.repeat(64), incidentId]);
    await assert.rejects(connection.execute('INSERT INTO client_requests (scope_type, scope_id, idempotency_key, request_hash, incident_id) VALUES (?, ?, ?, ?, ?)', ['guest', 'guest', `key-${suffix}`, 'b'.repeat(64), incidentId]), /Duplicate entry/);
  } finally {
    try { await connection.rollback(); } finally { await connection.end(); }
  }
});
