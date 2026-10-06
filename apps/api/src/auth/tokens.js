const { createHash, randomBytes, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('../http/errors');

const accessSeconds = 15 * 60;

function requireJwtSecret(authConfig) {
  const secret = authConfig?.jwtSecret;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Autenticación no disponible');
  }
  return secret;
}

function signAccessToken(user, authConfig) {
  return jwt.sign(
    { ver: user.credential_version },
    requireJwtSecret(authConfig),
    { algorithm: 'HS256', subject: user.id, issuer: 'incidencias', audience: 'incidencias-api', expiresIn: accessSeconds },
  );
}

function newRefreshToken() {
  const value = randomBytes(32).toString('base64url');
  return { id: randomUUID(), value, hash: createHash('sha256').update(value).digest('hex') };
}

function hashToken(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function verifyAccessToken(pool, authConfig, token) {
  let payload;
  try {
    payload = jwt.verify(token, requireJwtSecret(authConfig), {
      algorithms: ['HS256'], issuer: 'incidencias', audience: 'incidencias-api',
    });
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Autenticación requerida');
  }
  const [rows] = await pool.execute('SELECT id, name, email, status, credential_version FROM users WHERE id = ?', [payload.sub]);
  const user = rows[0];
  if (!user || user.status !== 'active' || payload.ver !== user.credential_version) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Autenticación requerida');
  }
  return user;
}

module.exports = { accessSeconds, requireJwtSecret, signAccessToken, newRefreshToken, hashToken, verifyAccessToken };
