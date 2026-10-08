async function startServer({ app, port, closePool, logger = console }) {
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(port, '0.0.0.0', () => resolve(listening));
    listening.once('error', reject);
  });

  let closing;
  function shutdown() {
    if (!closing) {
      closing = (async () => {
        try {
          await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
          });
          await closePool();
        } finally {
          process.off('SIGINT', onSignal);
          process.off('SIGTERM', onSignal);
        }
      })();
    }
    return closing;
  }

  function onSignal() {
    shutdown().catch(() => {
      logger.error(JSON.stringify({ event: 'shutdown_failed' }));
      process.exitCode = 1;
    });
  }

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  return { server, shutdown };
}

module.exports = { startServer };
