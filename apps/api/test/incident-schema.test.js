const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');
const { runMigrations, loadMigrations } = require('../src/db/migrations');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('migración clínica recupera DDL sin registro y rechaza esquemas incompatibles', async () => {
  const connection = await mysql.createConnection(loadTestDatabaseConfig());
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const table = `triage_${suffix}`;
  const ledger = `migrations_${suffix}`;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'triage-migration-'));
  const source = await fs.readFile(path.join(__dirname, '../migrations/012_medical_triage.sql'), 'utf8');
  const sql = source.replaceAll('incidents', table).replaceAll('migrate_012_medical_triage', `migrate_${suffix}`);
  let failRecording = true;
  let alterations = 0;
  const pool = {
    async getConnection() {
      return {
        async query(statement, values) {
          if (statement.startsWith('INSERT INTO schema_migrations') && failRecording) {
            failRecording = false;
            throw new Error('Fallo inducido antes de registrar migración');
          }
          if (statement.startsWith('CALL')) alterations += 1;
          return connection.query(statement.replaceAll('schema_migrations', ledger), values);
        },
        release() {},
      };
    },
  };
  try {
    await fs.writeFile(path.join(directory, '012_medical_triage.sql'), sql);
    await connection.query(`CREATE TABLE ${table} (id INT PRIMARY KEY, affected_people INT, subcategory_id BIGINT)`);
    await connection.query(`INSERT INTO ${table} VALUES (1, 3, 42)`);
    await assert.rejects(runMigrations(pool, { directory }), /Fallo inducido/);
    const [[legacy]] = await connection.query(`SELECT * FROM ${table} WHERE id = 1`);
    assert.deepEqual({ ...legacy }, { id: 1, affected_people: 3, subcategory_id: 42,
      is_conscious: null, is_breathing: null, has_bleeding: null });
    await connection.query(`UPDATE ${table} SET is_conscious=0, is_breathing=1, has_bleeding=1 WHERE id=1`);
    assert.deepEqual(await runMigrations(pool, { directory }), { applied: 1, total: 1 });
    assert.deepEqual(await runMigrations(pool, { directory }), { applied: 0, total: 1 });
    assert.equal(alterations, 2);
    const [[stored]] = await connection.query(`SELECT * FROM ${table} WHERE id=1`);
    assert.equal(stored.affected_people, 3);
    assert.equal(stored.subcategory_id, 42);
    assert.equal(stored.is_conscious, 0);
    assert.equal(stored.is_breathing, 1);
    assert.equal(stored.has_bleeding, 1);
    for (const column of ['is_conscious', 'is_breathing', 'has_bleeding']) {
      await assert.rejects(connection.query(`UPDATE ${table} SET ${column}=2 WHERE id=1`), /Check constraint/);
    }
    const [records] = await connection.query(`SELECT name, checksum FROM ${ledger}`);
    const [migration] = await loadMigrations(directory);
    assert.deepEqual(records.map((row) => ({ ...row })), [{ name: migration.name, checksum: migration.checksum }]);
    await connection.query(`DELETE FROM ${ledger}`);
    await connection.query(`ALTER TABLE ${table} MODIFY is_conscious INT NULL`);
    await assert.rejects(runMigrations(pool, { directory }), /esquema clinico parcial o incompatible/);
    const [[count]] = await connection.query(`SELECT COUNT(*) AS total FROM ${ledger}`);
    assert.equal(count.total, 0);
    await connection.query(`ALTER TABLE ${table} DROP CHECK chk_${table}_has_bleeding, DROP COLUMN has_bleeding`);
    await assert.rejects(runMigrations(pool, { directory }), /esquema clinico parcial o incompatible/);
  } finally {
    await connection.query(`DROP PROCEDURE IF EXISTS migrate_${suffix}`);
    await connection.query(`DROP TABLE IF EXISTS ${table}`);
    await connection.query(`DROP TABLE IF EXISTS ${ledger}`);
    await connection.end();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

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
