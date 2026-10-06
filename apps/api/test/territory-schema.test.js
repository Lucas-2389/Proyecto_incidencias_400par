const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('territorio y cobertura usan FK y consultas espaciales reales', async () => {
  const connection = await mysql.createConnection(loadTestDatabaseConfig());
  try {
    await connection.beginTransaction();
    const code = randomUUID().slice(0, 8);
    const [department] = await connection.execute('INSERT INTO departments (code, name, is_demo) VALUES (?, ?, TRUE)', [`D${code}`, 'DEMO departamento']);
    const [province] = await connection.execute('INSERT INTO provinces (department_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [department.insertId, `P${code}`, 'DEMO provincia']);
    const [district] = await connection.execute('INSERT INTO districts (province_id, code, name, is_demo) VALUES (?, ?, ?, TRUE)', [province.insertId, `I${code}`, 'DEMO distrito']);
    const polygon = 'MULTIPOLYGON(((0 0,1 0,1 1,0 1,0 0)))';
    await connection.execute("INSERT INTO district_boundaries (district_id, area, is_demo) VALUES (?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [district.insertId, polygon]);
    const institutionId = randomUUID();
    const siteId = randomUUID();
    await connection.execute('INSERT INTO institutions (id, name, type, is_demo) VALUES (?, ?, ?, TRUE)', [institutionId, 'DEMO Bomberos', 'bomberos']);
    await connection.execute("INSERT INTO sites (id, institution_id, district_id, name, location, is_demo) VALUES (?, ?, ?, ?, ST_GeomFromText('POINT(0.5 0.5)', 4326, 'axis-order=long-lat'), TRUE)", [siteId, institutionId, district.insertId, 'DEMO sede']);
    await connection.execute("INSERT INTO site_coverage_zones (site_id, name, area, is_demo) VALUES (?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), TRUE)", [siteId, 'DEMO cobertura', polygon]);
    const [rows] = await connection.query("SELECT ST_Contains(area, ST_GeomFromText('POINT(0.5 0.5)', 4326, 'axis-order=long-lat')) AS inside, ST_Contains(area, ST_GeomFromText('POINT(2 2)', 4326, 'axis-order=long-lat')) AS outside FROM site_coverage_zones WHERE site_id = ?", [siteId]);
    assert.equal(rows[0].inside, 1);
    assert.equal(rows[0].outside, 0);
    await assert.rejects(connection.execute("INSERT INTO sites (id, institution_id, name, location) VALUES (?, ?, ?, ST_GeomFromText('POINT(0 0)', 4326, 'axis-order=long-lat'))", [randomUUID(), randomUUID(), 'inválida']), /foreign key constraint/i);
  } finally {
    try { await connection.rollback(); } finally { await connection.end(); }
  }
});
