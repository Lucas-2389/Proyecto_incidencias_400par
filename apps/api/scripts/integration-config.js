const { loadConfig } = require('../src/config');
const { loadEnvironment } = require('../src/config/env');

function loadTestDatabaseConfig({ env = process.env } = {}) {
  loadEnvironment({ env });
  const runtime = loadConfig({ env }).database;
  const name = env.DB_TEST_NAME;

  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*_test$/.test(name)) {
    throw new Error('DB_TEST_NAME debe nombrar una base aislada terminada en _test');
  }
  if (name === runtime.database) {
    throw new Error('DB_TEST_NAME no puede ser DB_NAME');
  }

  return Object.freeze({ ...runtime, database: name });
}

module.exports = { loadTestDatabaseConfig };
