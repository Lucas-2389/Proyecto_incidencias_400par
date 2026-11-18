const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const mysql = require('mysql2/promise');
const { loadConfig } = require('../src/config');
const { createConnectionOptions } = require('../src/db/pool');
const { loadTestDatabaseConfig } = require('./integration-config');
const { resolvePoint, metropolitanScope } = require('../src/territory/router');

const packagePath = path.join(__dirname, '../data/ayacucho-metropolitan.geojson');
const legacyCodes = {
  '050101': 'DEMO-AYA-CENTRO', '050104': 'DEMO-CA', '050110': 'DEMO-SJB',
  '050115': 'DEMO-JN', '050116': 'DEMO-AACD',
};
const references = {
  incident_locations: 'incident_id', sites: 'id', sectors: 'id', directory_entries: 'id', alerts: 'id', audit_logs: 'id',
};

function json(value) { return typeof value === 'string' ? JSON.parse(value) : value; }

async function validatePackage(connection, data) {
  const expected = Object.keys(legacyCodes);
  if (data.type !== 'FeatureCollection' || data.features?.length !== expected.length
    || new Set(data.features.map((feature) => feature.properties.code)).size !== expected.length
    || !data.source || !data.sourceSha256 || !data.sourceUpdatedAt) throw new Error('Paquete territorial incompleto');
  for (const feature of data.features) {
    if (!expected.includes(feature.properties.code) || feature.geometry?.type !== 'MultiPolygon') throw new Error('Distrito territorial inválido');
    const [[row]] = await connection.execute('SELECT ST_IsValid(ST_GeomFromGeoJSON(?, 1, 4326)) AS valid', [JSON.stringify(feature.geometry)]);
    if (!row.valid) throw new Error(`Geometría inválida para ${feature.properties.code}`);
  }
}

async function snapshot(connection, districtIds, previousVersionId) {
  const [districts] = await connection.query('SELECT * FROM districts WHERE id IN (?)', [districtIds.length ? districtIds : [0]]);
  const [boundaries] = await connection.query('SELECT id, district_id, ST_AsGeoJSON(area) AS geometry, is_demo FROM district_boundaries WHERE district_id IN (?)', [districtIds.length ? districtIds : [0]]);
  const [scopeDistricts] = await connection.execute('SELECT district_id FROM territory_scope_districts WHERE scope = ?', [metropolitanScope]);
  const [aliases] = await connection.query('SELECT * FROM district_aliases WHERE legacy_id IN (?) OR district_id IN (?)', [districtIds.length ? districtIds : [0], districtIds.length ? districtIds : [0]]);
  const rows = {};
  for (const [table, key] of Object.entries(references)) {
    const locationFields = ['incident_locations', 'sites'].includes(table) ? ', territory_status, territory_version_id' : '';
    const sectorFields = table === 'incident_locations' ? ', sector_id' : '';
    [rows[table]] = await connection.query(`SELECT ${key}, district_id${locationFields}${sectorFields} FROM ${table} FOR UPDATE`);
  }
  return { districts, boundaries, scopeDistricts, aliases, rows, previousVersionId };
}

async function canonicalCatalog(connection, data, report) {
  await connection.execute('DELETE FROM territory_scope_districts WHERE scope = ?', [metropolitanScope]);
  await connection.execute("INSERT INTO departments (code, name) VALUES ('05', 'Ayacucho') ON DUPLICATE KEY UPDATE code = code");
  const [[department]] = await connection.execute("SELECT id FROM departments WHERE code = '05'");
  await connection.execute("INSERT INTO provinces (department_id, code, name) VALUES (?, '0501', 'Huamanga') ON DUPLICATE KEY UPDATE code = code", [department.id]);
  const [[province]] = await connection.execute("SELECT id FROM provinces WHERE code = '0501' AND department_id = ?", [department.id]);
  if (!province) throw new Error('Provincia Huamanga con departamento incompatible');
  const ids = [];
  for (const feature of data.features) {
    const code = feature.properties.code;
    const [[existing]] = await connection.execute('SELECT id FROM districts WHERE code = ?', [code]);
    const [[legacy]] = await connection.execute(
      `SELECT d.id FROM districts d JOIN provinces p ON p.id = d.province_id
       WHERE d.code = ? AND d.is_demo = TRUE AND p.code = 'DEMO-HUA'`, [legacyCodes[code]],
    );
    let districtId = existing?.id ?? legacy?.id;
    if (!districtId) {
      const [result] = await connection.execute('INSERT INTO districts (province_id, code, name) VALUES (?, ?, ?)', [province.id, code, feature.properties.name]);
      districtId = result.insertId;
    } else {
      await connection.execute('UPDATE districts SET province_id = ?, code = ?, name = ?, is_demo = FALSE WHERE id = ?', [province.id, code, feature.properties.name, districtId]);
    }
    if (legacy && legacy.id !== districtId) {
      await connection.execute('INSERT INTO district_aliases (legacy_id, district_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE district_id = VALUES(district_id)', [legacy.id, districtId]);
      for (const table of Object.keys(references)) {
        await connection.execute(`UPDATE ${table} SET district_id = ? WHERE district_id = ?`, [districtId, legacy.id]);
      }
      await connection.execute('DELETE FROM district_boundaries WHERE district_id = ?', [legacy.id]);
      report.aliases.push({ from: legacy.id, to: districtId });
    }
    await connection.execute('DELETE FROM district_boundaries WHERE district_id = ?', [districtId]);
    await connection.execute('INSERT INTO district_boundaries (district_id, area) VALUES (?, ST_GeomFromGeoJSON(?, 1, 4326))', [districtId, JSON.stringify(feature.geometry)]);
    await connection.execute('INSERT IGNORE INTO territory_scope_districts (scope, district_id) VALUES (?, ?)', [metropolitanScope, districtId]);
    ids.push(districtId);
  }
  return ids;
}

async function classifyLocations(connection, versionId, report, onlyNew = null) {
  for (const [table, key, location] of [['incident_locations', 'incident_id', 'location_point'], ['sites', 'id', 'location']]) {
    const [rows] = await connection.query(`SELECT ${key} AS id, district_id AS districtId,
      ST_X(${location}) AS latitude, ST_Y(${location}) AS longitude FROM ${table} FOR UPDATE`);
    for (const row of rows) {
      if (onlyNew?.[table]?.has(row.id)) continue;
      const result = await resolvePoint(connection, row.latitude, row.longitude);
      let status = result.status;
      let districtId = result.district?.id ?? null;
      if (table === 'sites' && row.districtId && districtId && row.districtId !== districtId) {
        status = 'district_mismatch';
        districtId = null;
      }
      const extra = table === 'incident_locations' ? ', sector_id = ?' : '';
      const parameters = [districtId, status, versionId];
      if (table === 'incident_locations') parameters.push(result.sector?.id ?? null);
      await connection.execute(`UPDATE ${table} SET district_id = ?, territory_status = ?, territory_version_id = ?${extra} WHERE ${key} = ?`, [...parameters, row.id]);
      report.classifications[status] = (report.classifications[status] ?? 0) + 1;
      if (row.districtId !== districtId) report.changed += 1;
      if (status !== 'resolved') report.pending.push({ type: table, id: row.id, previousDistrictId: row.districtId, status });
    }
  }
}

async function rollbackVersion(connection, version, report) {
  const before = json(version.before_state);
  const [current] = await connection.execute('SELECT district_id FROM territory_scope_districts WHERE scope = ?', [metropolitanScope]);
  const involved = [...new Set([...current.map((row) => row.district_id), ...before.districts.map((row) => row.id)])];
  if (involved.length) {
    await connection.query('DELETE FROM district_boundaries WHERE district_id IN (?)', [involved]);
    await connection.query('DELETE FROM district_aliases WHERE legacy_id IN (?) OR district_id IN (?)', [involved, involved]);
  }
  // Release canonical codes before restoring legacy names, preserving all FK identities.
  for (const row of before.districts) {
    await connection.execute('UPDATE districts SET code = ? WHERE id = ?', [`rollback-${row.id}`, row.id]);
  }
  for (const row of before.districts) {
    await connection.execute('UPDATE districts SET province_id = ?, code = ?, name = ?, is_demo = ? WHERE id = ?', [row.province_id, row.code, row.name, row.is_demo, row.id]);
  }
  for (const row of before.boundaries) {
    await connection.execute('INSERT INTO district_boundaries (id, district_id, area, is_demo) VALUES (?, ?, ST_GeomFromGeoJSON(?, 1, 4326), ?)', [row.id, row.district_id, JSON.stringify(json(row.geometry)), row.is_demo]);
  }
  await connection.execute('DELETE FROM territory_scope_districts WHERE scope = ?', [metropolitanScope]);
  for (const row of before.scopeDistricts) await connection.execute('INSERT INTO territory_scope_districts (scope, district_id) VALUES (?, ?)', [metropolitanScope, row.district_id]);
  for (const row of before.aliases) await connection.execute('INSERT INTO district_aliases (legacy_id, district_id) VALUES (?, ?)', [row.legacy_id, row.district_id]);
  const restored = {};
  for (const [table, key] of Object.entries(references)) {
    restored[table] = new Set();
    for (const row of before.rows[table]) {
      const columns = Object.keys(row).filter((column) => column !== key);
      await connection.execute(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE ${key} = ?`, [...columns.map((column) => row[column]), row[key]]);
      restored[table].add(row[key]);
    }
  }
  await classifyLocations(connection, before.previousVersionId, report, restored);
  await connection.execute('UPDATE territory_state SET version_id = ? WHERE scope = ?', [before.previousVersionId, metropolitanScope]);
  report.restoredVersion = before.previousVersionId;
}

async function loadMetropolitanTerritory(pool, { data = JSON.parse(fs.readFileSync(packagePath, 'utf8')), dryRun = false, rollback = false, beforeCommit } = {}) {
  const connection = await pool.getConnection();
  const report = { scope: metropolitanScope, dryRun, aliases: [], classifications: {}, changed: 0, pending: [] };
  try {
    await connection.beginTransaction();
    const [[state]] = await connection.execute('SELECT version_id AS versionId FROM territory_state WHERE scope = ? FOR UPDATE', [metropolitanScope]);
    if (!state) throw new Error('Aplica las migraciones territoriales antes de cargar');
    if (rollback) {
      if (!state.versionId) throw new Error('No hay versión territorial para revertir');
      const [[version]] = await connection.execute('SELECT * FROM territory_versions WHERE id = ?', [state.versionId]);
      await rollbackVersion(connection, version, report);
    } else {
      await validatePackage(connection, data);
      const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const [[active]] = await connection.execute('SELECT checksum FROM territory_versions WHERE id = ?', [state.versionId]);
      if (active?.checksum === checksum) {
        await connection.rollback();
        return { ...report, version: state.versionId, unchanged: true };
      }
      const codes = [...Object.keys(legacyCodes), ...Object.values(legacyCodes)];
      const [districts] = await connection.query('SELECT id FROM districts WHERE code IN (?) FOR UPDATE', [codes]);
      const before = await snapshot(connection, districts.map((row) => row.id), state.versionId);
      const id = randomUUID();
      const { features, ...metadata } = data;
      await connection.execute('INSERT INTO territory_versions (id, scope, checksum, metadata, before_state, report) VALUES (?, ?, ?, ?, ?, ?)',
        [id, metropolitanScope, checksum, JSON.stringify(metadata), JSON.stringify(before), JSON.stringify(report)]);
      report.districtIds = await canonicalCatalog(connection, data, report);
      await classifyLocations(connection, id, report);
      await connection.execute('UPDATE territory_versions SET report = ? WHERE id = ?', [JSON.stringify(report), id]);
      await connection.execute('UPDATE territory_state SET version_id = ? WHERE scope = ?', [id, metropolitanScope]);
      report.version = id;
    }
    if (beforeCommit) await beforeCommit(connection, report);
    if (dryRun) await connection.rollback();
    else await connection.commit();
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function main() {
  const target = process.argv.find((argument) => argument.startsWith('--target='))?.split('=')[1];
  if (!['test', 'app'].includes(target)) throw new Error('Indica --target=test o --target=app explícitamente');
  const apply = process.argv.includes('--apply');
  const database = target === 'test' ? loadTestDatabaseConfig() : createConnectionOptions(loadConfig().database);
  const pool = mysql.createPool({ ...database, connectionLimit: 2 });
  try { console.log(JSON.stringify(await loadMetropolitanTerritory(pool, { dryRun: !apply, rollback: process.argv.includes('--rollback') }), null, 2)); }
  finally { await pool.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { loadMetropolitanTerritory, validatePackage };
