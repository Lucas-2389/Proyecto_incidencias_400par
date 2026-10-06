const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const migrationFilePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const lockName = 'incidencias_schema_migrations';

function splitStatements(sql) {
  return sql
    .split(/^-- statement\s*$/m)
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('-- migration'));
}

async function loadMigrations(directory) {
  const names = (await fs.readdir(directory))
    .filter((name) => migrationFilePattern.test(name))
    .sort();
  const migrations = [];
  for (const name of names) {
    const content = await fs.readFile(path.join(directory, name), 'utf8');
    const statements = splitStatements(content);
    if (statements.length === 0) {
      throw new Error(`Migración vacía: ${name}`);
    }
    migrations.push({
      name,
      checksum: crypto.createHash('sha256').update(content).digest('hex'),
      statements,
    });
  }
  return migrations;
}

async function runMigrations(pool, { directory }) {
  const migrations = await loadMigrations(directory);
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[row]] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (row.acquired !== 1) {
      throw new Error('No se pudo obtener el bloqueo de migraciones');
    }
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(128) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const [appliedRows] = await connection.query('SELECT name, checksum FROM schema_migrations');
    const applied = new Map(appliedRows.map((entry) => [entry.name, entry.checksum]));
    let count = 0;
    for (const migration of migrations) {
      const previous = applied.get(migration.name);
      if (previous !== undefined) {
        if (previous !== migration.checksum) {
          throw new Error(`Checksum distinto en migración aplicada: ${migration.name}`);
        }
        continue;
      }
      for (const statement of migration.statements) {
        await connection.query(statement);
      }
      await connection.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [migration.name, migration.checksum]);
      count += 1;
    }
    return { applied: count, total: migrations.length };
  } finally {
    try {
      if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
      connection.release();
    }
  }
}

module.exports = { loadMigrations, runMigrations, splitStatements };
