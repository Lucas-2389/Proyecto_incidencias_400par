const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { optionalPhone } = require('../http/phone');
const { hashPassword, verifyPassword } = require('./password');

async function readProfile(pool, userId, auth = null) {
  const [[user]] = await pool.execute('SELECT id, name, email, phone FROM users WHERE id = ? AND status = ?', [userId, 'active']);
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida');
  if (!auth || !['Operador', 'AdministradorInstitucional', 'SuperAdministrador'].some((role) => auth.roles.has(role))) return user;
  const [memberships] = await pool.execute(
    `SELECT m.institution_id AS institutionId, i.name AS institutionName,
     m.site_id AS siteId, s.name AS siteName, r.code AS role
     FROM institution_memberships m
     JOIN institutions i ON i.id = m.institution_id AND i.active = TRUE
     JOIN roles r ON r.id = m.role_id
     LEFT JOIN sites s ON s.id = m.site_id AND s.institution_id = m.institution_id
     WHERE m.user_id = ? AND m.active = TRUE
     ORDER BY i.name, s.name, r.code`, [userId],
  );
  return { ...user, roles: [...auth.roles], memberships };
}

async function updateProfile(pool, userId, body) {
  const input = requireObject(body);
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !['name', 'phone'].includes(key))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Solo puedes editar nombre y teléfono');
  }
  const values = [];
  const fields = [];
  if (Object.hasOwn(input, 'name')) {
    fields.push('name = ?');
    values.push(requireText(input.name, 'name', { max: 150 }));
  }
  if (Object.hasOwn(input, 'phone')) {
    fields.push('phone = ?');
    values.push(optionalPhone(input.phone));
  }
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND status = 'active'`, [...values, userId]);
  return readProfile(pool, userId);
}

async function changePassword(pool, userId, body) {
  const input = requireObject(body);
  if (typeof input.currentPassword !== 'string' || !input.currentPassword) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Escribe tu contraseña actual');
  }
  const hash = await hashPassword(input.newPassword);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.execute('SELECT password_hash, status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!user || user.status !== 'active') throw new HttpError(401, 'UNAUTHORIZED', 'Sesión inválida');
    if (!await verifyPassword(input.currentPassword, user.password_hash)) {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual es incorrecta');
    }
    await connection.execute('UPDATE users SET password_hash = ?, credential_version = credential_version + 1 WHERE id = ?', [hash, userId]);
    await connection.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await connection.execute('UPDATE password_reset_tokens SET consumed_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND consumed_at IS NULL', [userId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { readProfile, updateProfile, changePassword };
