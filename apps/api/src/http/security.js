function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  // Tile providers require a Referer; cross-origin requests reveal only the origin.
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function cors(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('Origin');
    if (!origin || allowed.size === 0) return next();
    res.vary('Origin');
    if (!allowed.has(origin)) {
      res.set('Cache-Control', 'no-store');
      return res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED', message: 'Origen no permitido' });
    }
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Evidence-Token');
    res.set('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
}

module.exports = { securityHeaders, cors };
