const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { hasInstitutionScope } = require('../auth/authorization');

function nullableText(value, field, max) {
  return value === null ? null : requireText(value, field, { max });
}

function scopeInput(body, { partial = false } = {}) {
  const input = requireObject(body);
  const result = {};
  if (!partial || input.institutionId !== undefined) result.institutionId = requireText(input.institutionId, 'institutionId', { max: 36 });
  if (!partial || input.siteId !== undefined) result.siteId = requireText(input.siteId, 'siteId', { max: 36 });
  if (!partial || input.code !== undefined) result.code = requireText(input.code, 'code', { max: 50 });
  return { input, result };
}

async function assertSiteScope(pool, auth, institutionId, siteId) {
  if (!hasInstitutionScope(auth, institutionId, siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
  const [[site]] = await pool.execute(
    `SELECT s.id FROM sites s JOIN institutions i ON i.id = s.institution_id
     WHERE s.id = ? AND s.institution_id = ? AND s.active = TRUE AND i.active = TRUE`, [siteId, institutionId],
  );
  if (!site) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inactiva o fuera de institución');
}

async function findResource(pool, table, id, columns) {
  const [rows] = await pool.execute(`SELECT ${columns} FROM ${table} WHERE id = ?`, [id]);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado');
  return rows[0];
}

function listScope(auth) {
  return auth.roles.has('SuperAdministrador') ? { join: '', params: [] } : {
    join: `JOIN institution_memberships m ON m.institution_id = r.institution_id
           AND m.user_id = ? AND m.active = TRUE
           JOIN roles role ON role.id = m.role_id
           AND ((role.code = 'AdministradorInstitucional' AND (m.site_id IS NULL OR m.site_id = r.site_id))
             OR (role.code = 'Operador' AND m.site_id = r.site_id))`,
    params: [auth.user.id],
  };
}

function queryScope(req) {
  for (const key of ['institutionId', 'siteId']) {
    if (req.query[key] !== undefined && (typeof req.query[key] !== 'string' || req.query[key].length > 36)) {
      throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${key}`);
    }
  }
  return [req.query.institutionId ?? null, req.query.institutionId ?? null, req.query.siteId ?? null, req.query.siteId ?? null];
}

function duplicateError(error) {
  if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Código ya registrado en la institución');
  throw error;
}

module.exports = { nullableText, scopeInput, assertSiteScope, findResource, listScope, queryScope, duplicateError };
