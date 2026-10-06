const { checkDatabase } = require('../db/diagnostic');

function createHealthService(pool) {
  return {
    checkDatabase: () => checkDatabase(pool),
  };
}

module.exports = { createHealthService };
