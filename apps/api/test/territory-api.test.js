const assert = require('node:assert/strict');
const test = require('node:test');
const mysql = require('mysql2/promise');
const { createApp } = require('../src/app');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

integration('jerarquía DEMO y resolución GIS dentro, borde, fuera e inválida', async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 2 });
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig: {}, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/territory`;
    const get = async (path) => fetch(base + path);
    const departments = await (await get('/departments')).json();
    const department = departments.find((item) => item.code === 'DEMO-AYA');
    assert.ok(department);
    assert.equal(department.isDemo, true);
    const provinces = await (await get(`/provinces?departmentId=${department.id}`)).json();
    assert.equal(provinces[0].code, 'DEMO-HUA');
    const districts = await (await get(`/districts?provinceId=${provinces[0].id}`)).json();
    assert.equal(districts[0].code, 'DEMO-AYA-CENTRO');
    const sectors = await (await get(`/sectors?districtId=${districts[0].id}`)).json();
    assert.equal(sectors[0].code, 'DEMO-CENTRO');
    const inside = await (await get('/resolve?latitude=-13.16&longitude=-74.22')).json();
    assert.equal(inside.district.id, districts[0].id);
    assert.equal(inside.sector.id, sectors[0].id);
    const border = await (await get('/resolve?latitude=-13.18&longitude=-74.22')).json();
    assert.equal(border.district.id, districts[0].id);
    const outside = await (await get('/resolve?latitude=-12&longitude=-72')).json();
    assert.equal(outside.district, null);
    assert.equal(outside.sector, null);
    assert.equal((await get('/resolve?latitude=91&longitude=0')).status, 422);
    assert.equal((await get('/resolve?latitude=0&longitude=-181')).status, 422);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
