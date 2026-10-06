function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

function requestLogger(logger, now = () => Date.now()) {
  return (req, res, next) => {
    const started = now();
    res.once('finish', () => {
      logger.info(JSON.stringify({
        event: 'http_request',
        correlationId: req.correlationId,
        method: req.method,
        status: res.statusCode,
        durationMs: Math.max(0, now() - started),
      }));
    });
    next();
  };
}

module.exports = { noStore, requestLogger };
