const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { hashPassword } = require('./password');

function tokenHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function requestPasswordReset(pool, mailbox, body) {
  if (!mailbox) throw new HttpError(503, 'RECOVERY_UNAVAILABLE', 'Recuperación no disponible');
  const input = requireObject(body);
  const email = requireText(input.email, 'email', { max: 254 }).toLowerCase();
  const [rows] = await pool.execute('SELECT id, email, status FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (user && user.status === 'active') {
    const token = randomBytes(32).toString('base64url');
    await pool.execute(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE))',
      [randomUUID(), user.id, tokenHash(token)],
    );
    await mailbox.sendPasswordReset(user.email, token);
  }
  return { status: 'accepted' };
}

async function confirmPasswordReset(pool, body) {
  const input = requireObject(body);
  const token = requireText(input.token, 'token', { min: 40, max: 256 });
  const passwordHash = await hashPassword(input.password);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
       FOR UPDATE`,
      [tokenHash(token)],
    );
    const reset = rows[0];
    if (!reset) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Enlace de recuperación inválido o vencido');
    await connection.execute('UPDATE users SET password_hash = ?, credential_version = credential_version + 1 WHERE id = ?', [passwordHash, reset.user_id]);
    await connection.execute('UPDATE password_reset_tokens SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?', [reset.id]);
    await connection.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL', [reset.user_id]);
    await connection.commit();
    return { status: 'ok' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { requestPasswordReset, confirmPasswordReset };
