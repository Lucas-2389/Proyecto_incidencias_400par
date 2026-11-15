const { randomUUID, createHash } = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { loadConfig } = require('../src/config');
const { loadEnvironment } = require('../src/config/env');
const { loadTestDatabaseConfig } = require('./integration-config');
const { createConnectionOptions } = require('../src/db/pool');
const { seedReference } = require('./seed-reference');

// All points and boundaries below are synthetic DEMO fixtures, pending field verification.
const demoDistricts = [
  { key: 'ayacucho', code: 'DEMO-AYA-CENTRO', name: 'Ayacucho', longitude: -74.22, latitude: -13.16, ring: '-74.24 -13.18,-74.18 -13.18,-74.18 -13.12,-74.24 -13.12,-74.24 -13.18' },
  { key: 'sjb', code: 'DEMO-SJB', name: 'San Juan Bautista', longitude: -74.21, latitude: -13.19, ring: '-74.24 -13.20,-74.18 -13.20,-74.18 -13.181,-74.24 -13.181,-74.24 -13.20' },
  { key: 'carmen-alto', code: 'DEMO-CA', name: 'Carmen Alto', longitude: -74.21, latitude: -13.215, ring: '-74.24 -13.23,-74.18 -13.23,-74.18 -13.201,-74.24 -13.201,-74.24 -13.23' },
  { key: 'jesus-nazareno', code: 'DEMO-JN', name: 'Jesús Nazareno', longitude: -74.21, latitude: -13.11, ring: '-74.24 -13.119,-74.18 -13.119,-74.18 -13.10,-74.24 -13.10,-74.24 -13.119' },
  { key: 'aacd', code: 'DEMO-AACD', name: 'Andrés Avelino Cáceres Dorregaray', longitude: -74.165, latitude: -13.15, ring: '-74.179 -13.18,-74.15 -13.18,-74.15 -13.12,-74.179 -13.12,-74.179 -13.18' },
];

const demoInstitutions = [
  { key: 'huamanga', type: 'municipalidad', name: 'DEMO Municipalidad/Serenazgo Ayacucho' },
  { key: 'sjb', type: 'municipalidad', name: 'DEMO Municipalidad de San Juan Bautista' },
  { key: 'carmen-alto', type: 'municipalidad', name: 'DEMO Municipalidad de Carmen Alto' },
  { key: 'jesus-nazareno', type: 'municipalidad', name: 'DEMO Municipalidad de Jesús Nazareno' },
  { key: 'aacd', type: 'municipalidad', name: 'DEMO Municipalidad de Andrés Avelino Cáceres Dorregaray' },
  { key: 'pnp', type: 'pnp', name: 'DEMO PNP Ayacucho' },
  { key: 'bomberos', type: 'bomberos', name: 'DEMO Bomberos Ayacucho' },
  { key: 'samu', type: 'samu', name: 'DEMO SAMU Ayacucho' },
];

const demoSites = [
  { key: 'mph-central', institution: 'huamanga', district: 'ayacucho', site: 'Municipalidad Provincial de Huamanga — Sede Central', operator: null },
  { key: 'serenazgo-huamanga', institution: 'huamanga', district: 'ayacucho', site: 'Base Serenazgo Huamanga', operator: 'operator-municipalidad', legacy: 'DEMO Base Serenazgo', unit: 'DEMO-MUN-01' },
  { key: 'serenazgo-sjb', institution: 'sjb', district: 'sjb', site: 'Base Serenazgo San Juan Bautista', operator: 'operator-serenazgo-sjb' },
  { key: 'serenazgo-carmen-alto', institution: 'carmen-alto', district: 'carmen-alto', site: 'Base Serenazgo Carmen Alto', operator: 'operator-serenazgo-carmen-alto' },
  { key: 'serenazgo-jesus-nazareno', institution: 'jesus-nazareno', district: 'jesus-nazareno', site: 'Base Serenazgo Jesús Nazareno', operator: 'operator-serenazgo-jesus-nazareno' },
  { key: 'serenazgo-aacd', institution: 'aacd', district: 'aacd', site: 'Base Serenazgo Andrés Avelino Cáceres Dorregaray', operator: 'operator-serenazgo-aacd' },
  { key: 'pnp-ayacucho', institution: 'pnp', district: 'ayacucho', site: 'Comisaría PNP Ayacucho A', operator: 'operator-pnp', legacy: 'DEMO Comisaría Centro', unit: 'DEMO-PNP-01' },
  { key: 'pnp-sjb', institution: 'pnp', district: 'sjb', site: 'Comisaría PNP San Juan Bautista A', operator: 'operator-pnp-sjb' },
  { key: 'pnp-carmen-alto', institution: 'pnp', district: 'carmen-alto', site: 'Comisaría PNP Carmen Alto B', operator: 'operator-pnp-carmen-alto' },
  { key: 'pnp-chacco', institution: 'pnp', district: 'jesus-nazareno', site: 'Comisaría PNP Chacco', operator: 'operator-pnp-chacco' },
  { key: 'pnp-aacd', institution: 'pnp', district: 'aacd', site: 'Comisaría PNP Andrés Avelino Cáceres', operator: 'operator-pnp-aacd' },
  // DEPINCRI's physical district and Bomberos 63's current premises remain unverified.
  { key: 'pnp-depincri', institution: 'pnp', district: 'ayacucho', site: 'DEPINCRI Ayacucho', operator: 'operator-pnp-depincri' },
  { key: 'pnp-familia', institution: 'pnp', district: 'ayacucho', site: 'Comisaría PNP Familia Ayacucho M', operator: 'operator-pnp-familia' },
  { key: 'bomberos-63', institution: 'bomberos', district: 'ayacucho', site: 'Compañía de Bomberos Ayacucho n.º 63', operator: 'operator-bomberos', legacy: 'DEMO Compañía Centro', unit: 'DEMO-BOM-01' },
  { key: 'bomberos-222', institution: 'bomberos', district: 'sjb', site: 'Compañía de Bomberos Salvador San Juan n.º 222', operator: 'operator-bomberos-222' },
  { key: 'samu-ayacucho', institution: 'samu', district: 'ayacucho', site: 'SAMU Ayacucho', operator: 'operator-samu', legacy: 'DEMO Base SAMU Centro', unit: 'DEMO-SAMU-01' },
];

function demoId(key) {
  const hash = createHash('sha256').update(`incidencias-demo:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function findOrCreate(connection, selectSql, selectParams, insertSql, insertParams, key = 'id') {
  const [rows] = await connection.execute(selectSql, selectParams);
  if (rows.length) return rows[0][key];
  const [result] = await connection.execute(insertSql, insertParams);
  return key === 'id' && result.insertId ? result.insertId : insertParams[0];
}

async function seedDemo(connection, password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('DEMO_PASSWORD debe tener al menos 12 caracteres');
  }
  const [[lock]] = await connection.query("SELECT GET_LOCK('incidencias_demo_seed', 30) AS acquired");
  if (lock.acquired !== 1) throw new Error('No se pudo obtener el bloqueo del seed DEMO');
  try {
    await seedReference(connection);
    return await seedDemoData(connection, password);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('incidencias_demo_seed')");
  }
}

async function seedDemoData(connection, password) {
  await connection.beginTransaction();
  try {
    const departmentId = await findOrCreate(connection,
      'SELECT id FROM departments WHERE code = ? AND is_demo = TRUE', ['DEMO-AYA'],
      'INSERT INTO departments (code, name, is_demo) VALUES (?, ?, TRUE)', ['DEMO-AYA', 'DEMO Ayacucho']);
    const provinceId = await findOrCreate(connection,
      'SELECT id FROM provinces WHERE code = ? AND is_demo = TRUE', ['DEMO-HUA'],
      'INSERT INTO provinces (department_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [departmentId, 'DEMO-HUA', 'DEMO Huamanga']);
    const districts = new Map();
    for (const district of demoDistricts) {
      const id = await findOrCreate(connection,
        'SELECT id FROM districts WHERE code = ? AND is_demo = TRUE', [district.code],
        'INSERT INTO districts (province_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [provinceId, district.code, `DEMO Distrito ${district.name}`]);
      const polygon = `MULTIPOLYGON(((${district.ring})))`;
      const [boundaries] = await connection.execute('SELECT id FROM district_boundaries WHERE district_id = ? AND is_demo = TRUE ORDER BY id', [id]);
      if (boundaries.length === 0) {
        await connection.execute("INSERT INTO district_boundaries (district_id, area, is_demo) VALUES (?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [id, polygon]);
      }
      districts.set(district.key, { ...district, id, polygon });
    }
    const districtId = districts.get('ayacucho').id;
    const polygon = districts.get('ayacucho').polygon;
    const sectorId = await findOrCreate(connection,
      'SELECT id FROM sectors WHERE code = ? AND is_demo = TRUE', ['DEMO-CENTRO'],
      'INSERT INTO sectors (district_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [districtId, 'DEMO-CENTRO', 'DEMO Sector Centro']);
    const [sectors] = await connection.execute('SELECT id FROM sector_boundaries WHERE sector_id = ? AND is_demo = TRUE', [sectorId]);
    if (sectors.length === 0) {
      await connection.execute("INSERT INTO sector_boundaries (sector_id, area, is_demo) VALUES (?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [sectorId, polygon]);
    }

    const [roleRows] = await connection.execute('SELECT id, code FROM roles');
    const roleIds = new Map(roleRows.map((row) => [row.code, row.id]));
    const hash = await bcrypt.hash(password, 12);
    async function demoUser(kind, role, institutionId = null, siteId = null) {
      const email = `${kind}@demo.invalid`;
      const id = await findOrCreate(connection,
        'SELECT id FROM users WHERE email = ?', [email],
        'INSERT INTO users (id, name, email, password_hash, accepted_terms_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))',
        [demoId(`user:${kind}`), `DEMO ${kind}`, email, hash]);
      await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleIds.get(role)]);
      if (institutionId) {
        const [memberships] = await connection.execute('SELECT id FROM institution_memberships WHERE user_id = ? AND institution_id = ? AND site_id = ? AND role_id = ?', [id, institutionId, siteId, roleIds.get(role)]);
        if (memberships.length === 0) {
          await connection.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)', [id, institutionId, siteId, roleIds.get(role)]);
        }
      }
      return id;
    }

    await demoUser('superadmin', 'SuperAdministrador');
    await demoUser('citizen', 'Ciudadano');
    const institutions = new Map();
    for (const item of demoInstitutions) {
      const id = await findOrCreate(connection,
        'SELECT id FROM institutions WHERE (id = ? OR name = ?) AND is_demo = TRUE', [demoId(`institution:${item.key}`), item.name],
        'INSERT INTO institutions (id, name, type, is_demo) VALUES (?, ?, ?, TRUE)', [demoId(`institution:${item.key}`), item.name, item.type]);
      institutions.set(item.key, { ...item, id });
    }
    const siteIds = new Map();
    for (const item of demoSites) {
      const institution = institutions.get(item.institution);
      const institutionId = institution.id;
      const district = districts.get(item.district);
      const name = `DEMO ${item.site}`;
      const point = `POINT(${district.longitude} ${district.latitude})`;
      const siteId = await findOrCreate(connection,
        'SELECT id FROM sites WHERE institution_id = ? AND (id = ? OR name IN (?, ?)) AND is_demo = TRUE',
        [institutionId, demoId(`site:${item.key}`), name, item.legacy ?? name],
        "INSERT INTO sites (id, institution_id, district_id, name, location, address, is_demo) VALUES (?, ?, ?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?, TRUE)",
        [demoId(`site:${item.key}`), institutionId, district.id, name, point, 'DEMO ubicación sintética provisional, pendiente de verificación física']);
      await connection.execute(
        "UPDATE sites SET name=?, district_id=?, location=ST_GeomFromText(?, 4326, 'axis-order=long-lat'), address=? WHERE id=? AND is_demo=TRUE",
        [name, district.id, point, 'DEMO ubicación sintética provisional, pendiente de verificación física', siteId]);
      siteIds.set(item.key, siteId);
      // Regional emergency fixtures cover all five synthetic districts.
      const coverage = ['samu', 'bomberos'].includes(institution.type)
        ? `MULTIPOLYGON(${demoDistricts.map((entry) => `((${entry.ring}))`).join(',')})` : district.polygon;
      const coverageName = `DEMO cobertura ${item.key}`;
      const [zones] = await connection.execute('SELECT id FROM site_coverage_zones WHERE site_id = ? AND is_demo = TRUE AND name IN (?, ?) ORDER BY id',
        [siteId, coverageName, item.legacy ? `DEMO cobertura ${institution.type}` : coverageName]);
      if (zones.length === 0) {
        await connection.execute("INSERT INTO site_coverage_zones (site_id, name, area, is_demo) VALUES (?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [siteId, coverageName, coverage]);
      } else {
        await connection.execute("UPDATE site_coverage_zones SET name=?, area=ST_GeomFromText(?, 4326, 'axis-order=long-lat') WHERE id=?", [coverageName, coverage, zones[0].id]);
      }
      if (item.legacy) await demoUser(`admin-${institution.type}`, 'AdministradorInstitucional', institutionId, siteId);
      if (!item.operator) continue;
      await demoUser(item.operator, 'Operador', institutionId, siteId);
      const unitCode = item.unit ?? `DEMO-${item.key.toUpperCase()}`;
      const unitType = { pnp: 'Patrullero', samu: 'Ambulancia', bomberos: 'Autobomba', municipalidad: 'Camioneta' }[institution.type];
      const [units] = await connection.execute('SELECT id FROM units WHERE institution_id = ? AND code = ?', [institutionId, unitCode]);
      if (units.length === 0) {
        await connection.execute('INSERT INTO units (id, institution_id, site_id, code, type, is_demo) VALUES (?, ?, ?, ?, ?, TRUE)', [demoId(`unit:${item.key}`), institutionId, siteId, unitCode, unitType]);
      }
      const [people] = await connection.execute('SELECT id FROM personnel WHERE institution_id = ? AND code = ?', [institutionId, `${unitCode}-P`]);
      if (people.length === 0) {
        await connection.execute('INSERT INTO personnel (id, institution_id, site_id, code, name, is_demo) VALUES (?, ?, ?, ?, ?, TRUE)', [demoId(`person:${item.key}`), institutionId, siteId, `${unitCode}-P`, `DEMO Personal ${item.site}`]);
      }
    }
    const demoIncidents = [
      ['DEMO-AY-001', 'fire', 'DEMO incendio ficticio para pruebas'],
      ['DEMO-AY-002', 'medical_emergency', 'DEMO emergencia médica ficticia'],
      ['DEMO-AY-003', 'traffic_accident', 'DEMO accidente ficticio con atención múltiple'],
    ];
    for (const [reference, code, description] of demoIncidents) {
      const [existing] = await connection.execute('SELECT id FROM incidents WHERE reference = ? AND is_demo = TRUE', [reference]);
      if (existing.length) continue;
      const [[category]] = await connection.execute('SELECT id FROM incident_categories WHERE code = ?', [code]);
      const id = randomUUID();
      await connection.execute("INSERT INTO incidents (id, reference, category_id, source, description, occurred_at, is_demo) VALUES (?, ?, ?, 'PHONE', ?, UTC_TIMESTAMP(3), TRUE)", [id, reference, category.id, description]);
      await connection.execute("INSERT INTO incident_locations (incident_id, location_point, district_id, sector_id) VALUES (?, ST_GeomFromText('POINT(-74.22 -13.16)', 4326, 'axis-order=long-lat'), ?, ?)", [id, districtId, sectorId]);
      await connection.execute("INSERT INTO incident_history (incident_id, event_type, new_value, note) VALUES (?, 'created', 'reported', 'DEMO: incidente ficticio')", [id]);
    }
    await connection.commit();
    return { institutions: institutions.size, sites: siteIds.size, districts: districts.size, incidents: demoIncidents.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  loadEnvironment();
  const target = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  if (target !== 'test' && target !== 'app') throw new Error('Indica --target=test o --target=app explícitamente');
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error('DEMO_PASSWORD debe tener al menos 12 caracteres');
  const database = target === 'test'
    ? loadTestDatabaseConfig()
    : createConnectionOptions(loadConfig().database);
  const connection = await mysql.createConnection(database);
  try {
    const result = await seedDemo(connection, password);
    console.log(`Seed DEMO verificado: ${result.institutions} instituciones, ${result.sites} sedes, ${result.districts} distritos, ${result.incidents} incidentes en ${database.database}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const safeMessage = /^(Indica --target|DB_|DEMO_PASSWORD)/.test(error.message) ? error.message : 'No se pudo cargar el seed DEMO';
    console.error(safeMessage);
    process.exitCode = 1;
  });
}

module.exports = { seedDemo, demoSites, demoDistricts, demoInstitutions };
