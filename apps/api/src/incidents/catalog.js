const express = require('express');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles } = require('../auth/authorization');

const families = new Set(['emergency', 'security']);
const priorities = new Set(['low', 'normal', 'high', 'critical']);

function categoryInput(body, partial = false) {
  const input = requireObject(body);
  const result = {};
  if (!partial || input.code !== undefined) result.code = requireText(input.code, 'code', { max: 60 });
  if (!partial || input.name !== undefined) result.name = requireText(input.name, 'name', { max: 120 });
  if (!partial || input.family !== undefined) {
    result.family = requireText(input.family, 'family', { max: 30 });
    if (!families.has(result.family)) throw new HttpError(422, 'VALIDATION_ERROR', 'Familia inválida');
  }
  if (input.defaultPriority !== undefined) {
    result.defaultPriority = requireText(input.defaultPriority, 'defaultPriority', { max: 20 });
    if (!priorities.has(result.defaultPriority)) throw new HttpError(422, 'VALIDATION_ERROR', 'Prioridad inválida');
  }
  for (const [key, source] of [['isSensitive', 'isSensitive'], ['active', 'active']]) {
    if (input[source] !== undefined) {
      if (typeof input[source] !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${source}`);
      result[key] = input[source];
    }
  }
  if (partial && !Object.keys(result).length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
  return result;
}

const categoryColumns = 'id, code, name, family, is_sensitive AS isSensitive, default_priority AS defaultPriority, active, is_demo AS isDemo';
const subColumns = 'id, category_id AS categoryId, code, name, is_sensitive AS isSensitive, active, is_demo AS isDemo';
function normalize(row) { return { ...row, isSensitive: Boolean(row.isSensitive), active: Boolean(row.active), isDemo: Boolean(row.isDemo) }; }

async function find(pool, table, columns, id) {
  const [[row]] = await pool.execute(`SELECT ${columns} FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Categoría no encontrada');
  return normalize(row);
}

function parseId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(422, 'VALIDATION_ERROR', 'ID inválido');
  return Number(value);
}

function createCatalogRouter(pool, authConfig) {
  const router = express.Router();
  const admin = [requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador')];
  router.get('/categories', async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${categoryColumns} FROM incident_categories WHERE active = TRUE ORDER BY family, name`);
    res.json(rows.map(normalize));
  });
  router.get('/categories/:id/subcategories', async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${subColumns} FROM incident_subcategories WHERE category_id = ? AND active = TRUE ORDER BY name`, [parseId(req.params.id)]);
    res.json(rows.map(normalize));
  });
  router.post('/categories', ...admin, async (req, res) => {
    const input = categoryInput(req.body);
    try {
      const [result] = await pool.execute(
        'INSERT INTO incident_categories (code, name, family, is_sensitive, default_priority, active) VALUES (?, ?, ?, ?, ?, ?)',
        [input.code, input.name, input.family, input.isSensitive ?? false, input.defaultPriority ?? 'normal', input.active ?? true],
      );
      res.status(201).json(await find(pool, 'incident_categories', categoryColumns, result.insertId));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Código de categoría duplicado');
      throw error;
    }
  });
  router.patch('/categories/:id', ...admin, async (req, res) => {
    const id = parseId(req.params.id);
    await find(pool, 'incident_categories', categoryColumns, id);
    const input = categoryInput(req.body, true);
    const map = { code: 'code', name: 'name', family: 'family', isSensitive: 'is_sensitive', defaultPriority: 'default_priority', active: 'active' };
    const keys = Object.keys(input);
    try {
      await pool.execute(`UPDATE incident_categories SET ${keys.map((key) => `${map[key]} = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => input[key]), id]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Código de categoría duplicado');
      throw error;
    }
    res.json(await find(pool, 'incident_categories', categoryColumns, id));
  });
  router.post('/categories/:id/subcategories', ...admin, async (req, res) => {
    const categoryId = parseId(req.params.id);
    await find(pool, 'incident_categories', categoryColumns, categoryId);
    const input = requireObject(req.body);
    const code = requireText(input.code, 'code', { max: 60 });
    const name = requireText(input.name, 'name', { max: 120 });
    const isSensitive = input.isSensitive ?? false;
    if (typeof isSensitive !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Campo inválido: isSensitive');
    try {
      const [result] = await pool.execute('INSERT INTO incident_subcategories (category_id, code, name, is_sensitive) VALUES (?, ?, ?, ?)', [categoryId, code, name, isSensitive]);
      res.status(201).json(await find(pool, 'incident_subcategories', subColumns, result.insertId));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Código de subcategoría duplicado');
      throw error;
    }
  });
  router.patch('/subcategories/:id', ...admin, async (req, res) => {
    const id = parseId(req.params.id);
    await find(pool, 'incident_subcategories', subColumns, id);
    const input = requireObject(req.body);
    const update = {};
    if (input.name !== undefined) update.name = requireText(input.name, 'name', { max: 120 });
    if (input.active !== undefined) {
      if (typeof input.active !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
      update.active = input.active;
    }
    if (!Object.keys(update).length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
    const keys = Object.keys(update);
    await pool.execute(`UPDATE incident_subcategories SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => update[key]), id]);
    res.json(await find(pool, 'incident_subcategories', subColumns, id));
  });
  return router;
}

module.exports = { createCatalogRouter };
