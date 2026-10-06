const express = require('express');
const { createHash, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication } = require('../auth/authorization');

function createNotificationsRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig));
  router.get('/mine', async (req, res) => {
    const unread = req.query.unread;
    if (unread !== undefined && !['true', 'false'].includes(unread)) throw new HttpError(422, 'VALIDATION_ERROR', 'Filtro inválido');
    const [rows] = await pool.execute(
      `SELECT id, incident_id AS incidentId, alert_id AS alertId, type, title, message,
       read_at AS readAt, created_at AS createdAt FROM notifications
       WHERE user_id = ? AND (? = 'false' OR read_at IS NULL)
       ORDER BY created_at DESC, id DESC LIMIT 100`, [req.auth.user.id, unread ?? 'false'],
    );
    res.json(rows.map((row) => ({ ...row, readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString() })));
  });
  router.patch('/:id/read', async (req, res) => {
    const [result] = await pool.execute(
      'UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3)) WHERE id = ? AND user_id = ?',
      [req.params.id, req.auth.user.id],
    );
    if (!result.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Notificación no encontrada');
    const [[row]] = await pool.execute('SELECT id, read_at AS readAt FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ id: row.id, readAt: new Date(row.readAt).toISOString() });
  });
  router.post('/devices', async (req, res) => {
    const input = requireObject(req.body);
    const token = requireText(input.token, 'token', { min: 20, max: 4096 });
    const hash = createHash('sha256').update(token).digest('hex');
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO push_device_tokens (id, user_id, token_hash, token)
       VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), active = TRUE, token = VALUES(token)`,
      [id, req.auth.user.id, hash, token],
    );
    const [[row]] = await pool.execute('SELECT id FROM push_device_tokens WHERE token_hash = ? AND user_id = ?',
      [hash, req.auth.user.id]);
    res.status(201).json({ id: row.id, status: 'registered' });
  });
  router.delete('/devices/:id', async (req, res) => {
    const [result] = await pool.execute('UPDATE push_device_tokens SET active = FALSE WHERE id = ? AND user_id = ?',
      [req.params.id, req.auth.user.id]);
    if (!result.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Dispositivo no encontrado');
    res.status(204).end();
  });
  return router;
}

module.exports = { createNotificationsRouter };
