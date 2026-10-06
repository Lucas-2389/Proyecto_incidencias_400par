function classifyDatabaseError(error) {
  switch (error && error.code) {
    case 'ER_ACCESS_DENIED_ERROR': return 'authentication';
    case 'ECONNREFUSED':
    case 'ENOTFOUND': return 'unavailable';
    case 'ETIMEDOUT':
    case 'PROTOCOL_SEQUENCE_TIMEOUT': return 'timeout';
    case 'POOL_CONNLIMIT': return 'pool_exhausted';
    default: return 'unknown';
  }
}

function logDatabaseFailure(logger, { correlationId, error, durationMs }) {
  logger.error(JSON.stringify({
    event: 'database_health_failed',
    correlationId,
    category: classifyDatabaseError(error),
    durationMs: Math.max(0, Math.round(durationMs)),
  }));
}

module.exports = { logDatabaseFailure };
