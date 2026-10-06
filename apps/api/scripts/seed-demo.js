const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { loadConfig } = require('../src/config');
const { loadEnvironment } = require('../src/config/env');
const { loadTestDatabaseConfig } = require('./integration-config');
const { seedReference } = require('./seed-reference');

const demoSites = [
  { type: 'pnp', institution: 'DEMO PNP Ayacucho', site: 'DEMO Comisaría Centro', unit: 'DEMO-PNP-01', unitType: 'Patrullero', person: 'DEMO Agente PNP' },
  { type: 'samu', institution: 'DEMO SAMU Ayacucho', site: 'DEMO Base SAMU Centro', unit: 'DEMO-SAMU-01', unitType: 'Ambulancia', person: 'DEMO Paramédico SAMU' },
  { type: 'bomberos', institution: 'DEMO Bomberos Ayacucho', site: 'DEMO Compañía Centro', unit: 'DEMO-BOM-01', unitType: 'Autobomba', person: 'DEMO Bombero' },
  { type: 'municipalidad', institution: 'DEMO Municipalidad/Serenazgo Ayacucho', site: 'DEMO Base Serenazgo', unit: 'DEMO-MUN-01', unitType: 'Camioneta', person: 'DEMO Sereno' },
];

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
  await seedReference(connection);
  await connection.beginTransaction();
  try {
    const departmentId = await findOrCreate(connection,
      'SELECT id FROM departments WHERE code = ? AND is_demo = TRUE', ['DEMO-AYA'],
      'INSERT INTO departments (code, name, is_demo) VALUES (?, ?, TRUE)', ['DEMO-AYA', 'DEMO Ayacucho']);
    const provinceId = await findOrCreate(connection,
      'SELECT id FROM provinces WHERE code = ? AND is_demo = TRUE', ['DEMO-HUA'],
      'INSERT INTO provinces (department_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [departmentId, 'DEMO-HUA', 'DEMO Huamanga']);
    const districtId = await findOrCreate(connection,
      'SELECT id FROM districts WHERE code = ? AND is_demo = TRUE', ['DEMO-AYA-CENTRO'],
      'INSERT INTO districts (province_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [provinceId, 'DEMO-AYA-CENTRO', 'DEMO Distrito Ayacucho']);
    const sectorId = await findOrCreate(connection,
      'SELECT id FROM sectors WHERE code = ? AND is_demo = TRUE', ['DEMO-CENTRO'],
      'INSERT INTO sectors (district_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [districtId, 'DEMO-CENTRO', 'DEMO Sector Centro']);
    const polygon = 'MULTIPOLYGON(((-74.24 -13.18,-74.18 -13.18,-74.18 -13.12,-74.24 -13.12,-74.24 -13.18)))';
    const [boundaries] = await connection.execute('SELECT id FROM district_boundaries WHERE district_id = ? AND is_demo = TRUE', [districtId]);
    if (boundaries.length === 0) {
      await connection.execute("INSERT INTO district_boundaries (district_id, area, is_demo) VALUES (?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [districtId, polygon]);
    }
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
        [randomUUID(), `DEMO ${kind}`, email, hash]);
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
    const siteIds = new Map();
    for (const item of demoSites) {
      const institutionId = await findOrCreate(connection,
        'SELECT id FROM institutions WHERE name = ? AND is_demo = TRUE', [item.institution],
        'INSERT INTO institutions (id, name, type, is_demo) VALUES (?, ?, ?, TRUE)', [randomUUID(), item.institution, item.type]);
      const siteId = await findOrCreate(connection,
        'SELECT id FROM sites WHERE institution_id = ? AND name = ? AND is_demo = TRUE', [institutionId, item.site],
        "INSERT INTO sites (id, institution_id, district_id, name, location, is_demo) VALUES (?, ?, ?, ?, ST_GeomFromText('POINT(-74.22 -13.16)', 4326, 'axis-order=long-lat'), TRUE)",
        [randomUUID(), institutionId, districtId, item.site]);
      siteIds.set(item.type, siteId);
      const [zones] = await connection.execute('SELECT id FROM site_coverage_zones WHERE site_id = ? AND is_demo = TRUE', [siteId]);
      if (zones.length === 0) {
        await connection.execute("INSERT INTO site_coverage_zones (site_id, name, area, is_demo) VALUES (?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [siteId, `DEMO cobertura ${item.type}`, polygon]);
      }
      await demoUser(`admin-${item.type}`, 'AdministradorInstitucional', institutionId, siteId);
      await demoUser(`operator-${item.type}`, 'Operador', institutionId, siteId);
      const [units] = await connection.execute('SELECT id FROM units WHERE institution_id = ? AND code = ?', [institutionId, item.unit]);
      if (units.length === 0) {
        await connection.execute('INSERT INTO units (id, institution_id, site_id, code, type, is_demo) VALUES (?, ?, ?, ?, ?, TRUE)', [randomUUID(), institutionId, siteId, item.unit, item.unitType]);
      }
      const [people] = await connection.execute('SELECT id FROM personnel WHERE institution_id = ? AND code = ?', [institutionId, `${item.unit}-P`]);
      if (people.length === 0) {
        await connection.execute('INSERT INTO personnel (id, institution_id, site_id, code, name, is_demo) VALUES (?, ?, ?, ?, ?, TRUE)', [randomUUID(), institutionId, siteId, `${item.unit}-P`, item.person]);
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
    return { institutions: siteIds.size, incidents: demoIncidents.length };
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
  const database = target === 'test' ? loadTestDatabaseConfig() : loadConfig().database;
  const connection = await mysql.createConnection(database);
  try {
    const result = await seedDemo(connection, password);
    console.log(`Seed DEMO verificado: ${result.institutions} instituciones, ${result.incidents} incidentes en ${database.database}`);
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

module.exports = { seedDemo, demoSites };
