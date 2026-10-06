async function checkDatabase(pool) {
  await pool.query({ sql: 'SELECT 1', timeout: 3000 });
}

module.exports = { checkDatabase };
