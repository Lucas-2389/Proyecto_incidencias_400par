const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { verifyPassword } = require('./password');
const { requireJwtSecret, signAccessToken, newRefreshToken, accessSeconds } = require('./tokens');

function validateLogin(body) {
  const input = requireObject(body);
  const email = requireText(input.email, 'email', { max: 254 }).toLowerCase();
  if (typeof input.password !== 'string' || input.password.length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Credenciales inválidas');
  }
  return { email, password: input.password };
}

async function login(pool, authConfig, body) {
  requireJwtSecret(authConfig);
  const input = validateLogin(body);
  const [rows] = await pool.execute('SELECT id, name, email, password_hash, status, credential_version FROM users WHERE email = ?', [input.email]);
  const user = rows[0];
  const valid = user && await verifyPassword(input.password, user.password_hash);
  if (!valid || user.status !== 'active') {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas');
  }
  const [roleRows] = await pool.execute('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', [user.id]);
  const refresh = newRefreshToken();
  const accessToken = signAccessToken(user, authConfig);
  await pool.execute(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 DAY))',
    [refresh.id, user.id, refresh.hash],
  );
  return {
    accessToken,
    refreshToken: refresh.value,
    tokenType: 'Bearer',
    expiresIn: accessSeconds,
    user: { id: user.id, name: user.name, email: user.email, roles: roleRows.map((role) => role.code) },
  };
}

module.exports = { validateLogin, login };
