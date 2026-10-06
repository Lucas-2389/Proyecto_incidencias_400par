const express = require('express');
const { createHash, randomUUID } = require('node:crypto');
const multer = require('multer');
const sharp = require('sharp');
const { HttpError } = require('../http/errors');
const { requireAuthentication, requireIncidentScope } = require('../auth/authorization');

const maxPhotoBytes = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxPhotoBytes, files: 1 } });
const formats = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Fotografía demasiado grande'));
    return next(new HttpError(422, 'VALIDATION_ERROR', 'Carga de fotografía inválida'));
  });
}

async function cleanPhoto(file) {
  if (!file || !Object.values(formats).includes(file.mimetype)) throw new HttpError(422, 'VALIDATION_ERROR', 'Fotografía inválida');
  try {
    const image = sharp(file.buffer, { failOn: 'error', limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    if (formats[metadata.format] !== file.mimetype || !metadata.width || !metadata.height
      || metadata.width > 10000 || metadata.height > 10000) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Fotografía inválida');
    }
    const bytes = await image.rotate().toFormat(metadata.format).toBuffer();
    if (bytes.length > maxPhotoBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Fotografía demasiado grande');
    return { bytes, mediaType: file.mimetype, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, 'VALIDATION_ERROR', 'Fotografía inválida');
  }
}

function createEvidenceRouter(pool, authConfig, evidenceStore) {
  const router = express.Router();
  const protect = [requireAuthentication(pool, authConfig), requireIncidentScope(pool)];
  router.post('/:id/evidence', ...protect, uploadPhoto, async (req, res) => {
    if (!evidenceStore) throw new HttpError(503, 'EVIDENCE_UNAVAILABLE', 'Fotografías no disponibles');
    const photo = await cleanPhoto(req.file);
    const connection = await pool.getConnection();
    let key;
    let saved;
    try {
      await connection.beginTransaction();
      const [[incident]] = await connection.execute('SELECT id FROM incidents WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
      const [[count]] = await connection.execute('SELECT COUNT(*) AS total FROM evidence WHERE incident_id = ?', [incident.id]);
      if (count.total >= 3) throw new HttpError(409, 'CONFLICT', 'Límite de fotografías alcanzado');
      key = await evidenceStore.put(photo.bytes, photo.mediaType);
      const id = randomUUID();
      await connection.execute(
        'INSERT INTO evidence (id, incident_id, uploader_user_id, object_key, media_type, byte_size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, incident.id, req.auth.user.id, key, photo.mediaType, photo.bytes.length, photo.sha256],
      );
      const [[row]] = await connection.execute('SELECT id, media_type AS mediaType, created_at AS uploadedAt FROM evidence WHERE id = ?', [id]);
      saved = { id: row.id, mediaType: row.mediaType, uploadedAt: new Date(row.uploadedAt).toISOString() };
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (key) await evidenceStore.remove(key).catch(() => {});
      throw error;
    } finally { connection.release(); }
    res.status(201).json(saved);
  });
  router.get('/:id/evidence/:evidenceId', ...protect, async (req, res) => {
    if (!evidenceStore) throw new HttpError(503, 'EVIDENCE_UNAVAILABLE', 'Fotografías no disponibles');
    const [[row]] = await pool.execute(
      'SELECT id, object_key AS objectKey, media_type AS mediaType FROM evidence WHERE id = ? AND incident_id = ?',
      [req.params.evidenceId, req.params.id],
    );
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Fotografía no encontrada');
    let bytes;
    try { bytes = await evidenceStore.read(row.objectKey); }
    catch { throw new HttpError(503, 'EVIDENCE_UNAVAILABLE', 'Fotografía no disponible'); }
    await pool.execute(
      `INSERT INTO audit_logs (actor_user_id, correlation_id, action, entity_type, entity_id)
       VALUES (?, ?, 'evidence.read', 'evidence', ?)`, [req.auth.user.id, req.correlationId, row.id],
    );
    res.set('Content-Type', row.mediaType);
    res.set('Content-Disposition', 'attachment');
    res.send(bytes);
  });
  return router;
}

module.exports = { createEvidenceRouter, cleanPhoto, maxPhotoBytes };
