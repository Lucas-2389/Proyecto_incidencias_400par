const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireJwtSecret, signAccessToken, newRefreshToken, hashToken, accessSeconds } = require('./tokens');

function readRefresh(body) {
  const input = requireObject(body);
  return requireText(input.refreshToken, 'refreshToken', { min: 40, max: 256 });
}

async function refreshSession(pool, authConfig, body) {
  requireJwtSecret(authConfig);
  const currentHash = hashToken(readRefresh(body));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT rt.id AS token_id, u.id, u.name, u.email, u.status, u.credential_version
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > UTC_TIMESTAMP(3)
       FOR UPDATE`,
      [currentHash],
    );
    const user = rows[0];
    if (!user || user.status !== 'active') {
      throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida');
    }
    await connection.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE id = ?', [user.token_id]);
    const next = newRefreshToken();
    await connection.execute(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 DAY))',
      [next.id, user.id, next.hash],
    );
    const accessToken = signAccessToken(user, authConfig);
    await connection.commit();
    return { accessToken, refreshToken: next.value, tokenType: 'Bearer', expiresIn: accessSeconds };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function logout(pool, body) {
  const currentHash = hashToken(readRefresh(body));
  await pool.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND revoked_at IS NULL', [currentHash]);
}

module.exports = { refreshSession, logout };
