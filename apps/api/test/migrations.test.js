const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runMigrations, splitStatements } = require('../src/db/migrations');

function fakePool() {
  const applied = new Map();
  const executed = [];
  let releases = 0;
  return {
    executed,
    applied,
    get releases() { return releases; },
    async getConnection() {
      return {
        async query(sql, values = []) {
          executed.push(sql);
          if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }]];
          if (sql.startsWith('SELECT name, checksum')) {
            return [[...applied].map(([name, checksum]) => ({ name, checksum }))];
          }
          if (sql.startsWith('INSERT INTO schema_migrations')) {
            applied.set(values[0], values[1]);
          }
          return [[]];
        },
        release() { releases += 1; },
      };
    },
  };
}

test('separa sentencias por marcador explícito', () => {
  assert.deepEqual(splitStatements('-- statement\nCREATE TABLE a (id INT);\n-- statement\nCREATE TABLE b (id INT);'), [
    'CREATE TABLE a (id INT);',
    'CREATE TABLE b (id INT);',
  ]);
});

test('aplica una vez y rechaza checksum alterado', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'incidencias-migrations-'));
  const file = path.join(directory, '001_example.sql');
  const pool = fakePool();
  try {
    await fs.writeFile(file, '-- statement\nCREATE TABLE example (id INT);\n');
    assert.deepEqual(await runMigrations(pool, { directory }), { applied: 1, total: 1 });
    assert.deepEqual(await runMigrations(pool, { directory }), { applied: 0, total: 1 });
    assert.equal(pool.executed.filter((sql) => sql.startsWith('CREATE TABLE example')).length, 1);
    await fs.writeFile(file, '-- statement\nCREATE TABLE example (id BIGINT);\n');
    await assert.rejects(runMigrations(pool, { directory }), /Checksum distinto/);
    assert.equal(pool.releases, 3);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
