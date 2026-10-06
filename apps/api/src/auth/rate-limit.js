const { createHash } = require('node:crypto');
const { HttpError } = require('../http/errors');

function createRateLimit(pool, action, { limit, windowSeconds = 900, now = () => Date.now() } = {}) {
  return async (req, _res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const origin = `${req.ip || 'unknown'}:${email}`;
      const bucketHash = createHash('sha256').update(origin).digest('hex');
      const windowStart = Math.floor(now() / 1000 / windowSeconds) * windowSeconds;
      await pool.execute(
        'INSERT INTO rate_limit_counters (action, bucket_hash, window_start, hits) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1',
        [action, bucketHash, windowStart],
      );
      const [[counter]] = await pool.execute(
        'SELECT hits FROM rate_limit_counters WHERE action = ? AND bucket_hash = ? AND window_start = ?',
        [action, bucketHash, windowStart],
      );
      if (counter.hits > limit) {
        throw new HttpError(429, 'RATE_LIMITED', 'Demasiadas solicitudes');
      }
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { createRateLimit };
