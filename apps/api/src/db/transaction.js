const { HttpError } = require('../http/errors');

async function transaction(pool, action) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(422, 'VALIDATION_ERROR', 'Referencia inválida');
    throw error;
  } finally { connection.release(); }
}

module.exports = { transaction };
