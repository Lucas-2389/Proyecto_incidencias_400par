const { loadConfig } = require('../src/config');
const { getPool, closePool } = require('../src/db/pool');

async function main() {
  const { database } = loadConfig();
  let connection;
  try {
    connection = await getPool(database).getConnection();
    const [[user]] = await connection.query('SELECT CURRENT_USER() AS currentUser');
    const [[selected]] = await connection.query('SELECT DATABASE() AS databaseName');
    const [[version]] = await connection.query('SELECT VERSION() AS serverVersion');
    const [status] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    const tlsActive = Boolean(status[0]?.Value);
    if (user.currentUser.split('@')[0] !== database.user || selected.databaseName !== database.database || (database.ssl && !tlsActive)) {
      throw new Error('La identidad, la base o TLS no coincide con la configuración');
    }
    console.log(JSON.stringify({
      currentUser: user.currentUser,
      database: selected.databaseName,
      version: version.serverVersion,
      tlsActive,
    }));
  } finally {
    connection?.release();
    await closePool();
  }
}

main().catch(() => {
  console.error('No se pudo verificar la conexión MySQL; revise DB_*, acceso de red y certificado CA');
  process.exitCode = 1;
});
