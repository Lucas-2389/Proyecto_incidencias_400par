const { HttpError } = require('../http/errors');
const { verifyAccessToken } = require('./tokens');

function requireAuthentication(pool, authConfig) {
  return async (req, _res, next) => {
    try {
      const header = req.get('authorization');
      const match = typeof header === 'string' && /^Bearer ([A-Za-z0-9._-]+)$/.exec(header);
      if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'Autenticación requerida');
      const user = await verifyAccessToken(pool, authConfig, match[1]);
      const [roleRows] = await pool.execute('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', [user.id]);
      const [memberships] = await pool.execute(
        `SELECT m.institution_id, m.site_id, r.code AS role
         FROM institution_memberships m
         JOIN roles r ON r.id = m.role_id
         JOIN institutions i ON i.id = m.institution_id AND i.active = TRUE
         WHERE m.user_id = ? AND m.active = TRUE`,
        [user.id],
      );
      req.auth = { user, roles: new Set(roleRows.map((row) => row.code)), memberships };
      next();
    } catch (error) { next(error); }
  };
}

function requireRoles(...allowed) {
  return (req, _res, next) => {
    if (!req.auth || !allowed.some((role) => req.auth.roles.has(role))) {
      return next(new HttpError(403, 'FORBIDDEN', 'Acceso no permitido'));
    }
    next();
  };
}

function hasInstitutionScope(auth, institutionId, siteId = null) {
  if (auth.roles.has('SuperAdministrador')) return true;
  return auth.memberships.some((membership) => {
    if (membership.institution_id !== institutionId) return false;
    if (membership.role === 'AdministradorInstitucional') return true;
    return membership.role === 'Operador' && membership.site_id !== null && (!siteId || membership.site_id === siteId);
  });
}

function requireInstitutionScope(institutionParam = 'institutionId', siteParam = 'siteId') {
  return (req, _res, next) => {
    if (!req.auth || !hasInstitutionScope(req.auth, req.params[institutionParam], req.params[siteParam])) {
      return next(new HttpError(403, 'FORBIDDEN', 'Acceso no permitido'));
    }
    next();
  };
}

async function hasIncidentScope(pool, auth, incidentId) {
  if (auth.roles.has('SuperAdministrador')) return true;
  const [incidents] = await pool.execute(
    'SELECT reporter_user_id, category_id, subcategory_id FROM incidents WHERE id = ?', [incidentId],
  );
  const incident = incidents[0];
  if (!incident) return false;
  if (incident.reporter_user_id === auth.user.id && auth.roles.has('Ciudadano')) return true;
  for (const membership of auth.memberships) {
    if (!['Operador', 'AdministradorInstitucional'].includes(membership.role)) continue;
    const siteFilter = membership.role === 'Operador' ? membership.site_id : null;
    if (membership.role === 'Operador' && !siteFilter) continue;
    const [rows] = await pool.execute(
      `SELECT s.id FROM sites s JOIN institutions inst ON inst.id = s.institution_id
       WHERE s.institution_id = ? AND s.active = TRUE AND (CAST(? AS CHAR(36)) IS NULL OR s.id = ?)
       AND (
         EXISTS (SELECT 1 FROM institution_assignments ia WHERE ia.incident_id = ? AND ia.site_id = s.id)
         OR EXISTS (
           SELECT 1 FROM incident_locations l
           JOIN site_coverage_zones z ON z.site_id = s.id AND z.active = TRUE
           JOIN routing_rules r ON r.institution_type = inst.type AND r.active = TRUE
           WHERE l.incident_id = ? AND r.category_id = ?
             AND (r.subcategory_id IS NULL OR r.subcategory_id = ?)
             AND ST_Contains(z.area, l.location_point)
         )
       ) LIMIT 1`,
      [membership.institution_id, siteFilter, siteFilter, incidentId, incidentId, incident.category_id, incident.subcategory_id],
    );
    if (rows.length) return true;
  }
  return false;
}

function requireIncidentScope(pool, incidentParam = 'id') {
  return async (req, _res, next) => {
    try {
      if (!req.auth || !await hasIncidentScope(pool, req.auth, req.params[incidentParam])) {
        throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      }
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { requireAuthentication, requireRoles, hasInstitutionScope, requireInstitutionScope, hasIncidentScope, requireIncidentScope };
