const express = require('express');
const { HttpError } = require('../http/errors');
const { requireAuthentication, requireRoles, requireIncidentScope, hasInstitutionScope } = require('../auth/authorization');

async function applicableRules(pool, categoryId, subcategoryId) {
  const [rules] = await pool.execute(
    `SELECT id, institution_type AS institutionType, subcategory_id AS subcategoryId,
     priority, reason FROM routing_rules
     WHERE category_id = ? AND active = TRUE AND (subcategory_id IS NULL OR subcategory_id = ?)
     ORDER BY (subcategory_id IS NOT NULL) DESC, priority ASC, id ASC`,
    [categoryId, subcategoryId],
  );
  const byType = new Map();
  for (const rule of rules) if (!byType.has(rule.institutionType)) byType.set(rule.institutionType, rule);
  return [...byType.values()];
}

async function suggestSites(pool, incidentId, auth) {
  const [[incident]] = await pool.execute(
    'SELECT id, category_id AS categoryId, subcategory_id AS subcategoryId FROM incidents WHERE id = ?', [incidentId],
  );
  if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
  const rules = await applicableRules(pool, incident.categoryId, incident.subcategoryId);
  const suggestions = [];
  for (const rule of rules) {
    const [sites] = await pool.execute(
      `SELECT DISTINCT s.id AS siteId, s.name AS siteName, i.id AS institutionId,
       i.name AS institutionName, i.type AS institutionType
       FROM sites s JOIN institutions i ON i.id = s.institution_id AND i.active = TRUE
       JOIN site_coverage_zones z ON z.site_id = s.id AND z.active = TRUE
       JOIN incident_locations l ON l.incident_id = ?
       WHERE s.active = TRUE AND i.type = ? AND ST_Intersects(z.area, l.location_point)
       ORDER BY s.name`, [incidentId, rule.institutionType],
    );
    for (const site of sites) {
      if (!hasInstitutionScope(auth, site.institutionId, site.siteId)) continue;
      suggestions.push({ ...site, ruleId: rule.id, priority: rule.priority, reason: rule.reason });
    }
  }
  return { incidentId, suggestions, exception: suggestions.length === 0 };
}

function createSuggestionsRouter(pool, authConfig) {
  const router = express.Router();
  router.get('/:id/suggestions', requireAuthentication(pool, authConfig),
    requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'),
    requireIncidentScope(pool), async (req, res) => {
      res.json(await suggestSites(pool, req.params.id, req.auth));
    });
  return router;
}

module.exports = { applicableRules, suggestSites, createSuggestionsRouter };
