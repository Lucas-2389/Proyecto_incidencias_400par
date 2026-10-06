const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { hashPassword } = require('./password');

function validateRegistration(body) {
  const input = requireObject(body);
  const name = requireText(input.name, 'name', { max: 150 });
  const email = requireText(input.email, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Correo inválido');
  }
  if (input.acceptedTerms !== true) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Debe aceptar los términos');
  }
  return { name, email, password: input.password };
}

async function registerCitizen(pool, body) {
  const input = validateRegistration(body);
  const passwordHash = await hashPassword(input.password);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[role]] = await connection.execute('SELECT id FROM roles WHERE code = ?', ['Ciudadano']);
    if (!role) throw new Error('Falta el rol Ciudadano en la base');
    const id = randomUUID();
    await connection.execute(
      'INSERT INTO users (id, name, email, password_hash, accepted_terms_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))',
      [id, input.name, input.email, passwordHash],
    );
    await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, role.id]);
    await connection.commit();
    return { id, name: input.name, email: input.email, role: 'Ciudadano' };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'CONFLICT', 'No se pudo registrar la cuenta');
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { validateRegistration, registerCitizen };
