const jwt = require('jsonwebtoken');
const { requireJwtSecret } = require('../auth/tokens');
const { HttpError } = require('../http/errors');

const lifetimeSeconds = 24 * 60 * 60;

function issueGuestEvidenceToken(receipt, authConfig) {
  const expires = Math.floor(new Date(receipt.createdAt).getTime() / 1000) + lifetimeSeconds;
  if (expires <= Math.floor(Date.now() / 1000)) return undefined;
  return jwt.sign({ purpose: 'guest-evidence-upload', exp: expires }, requireJwtSecret(authConfig), {
    algorithm: 'HS256', subject: receipt.id, issuer: 'incidencias', audience: 'incidencias-guest-evidence',
  });
}

function guestEvidenceAuthorization(authConfig) {
  return (req, _res, next) => {
    try {
      const token = req.get('X-Evidence-Token');
      if (!token || token.length > 2048) throw new Error('Invalid token');
      const payload = jwt.verify(token, requireJwtSecret(authConfig), {
        algorithms: ['HS256'], issuer: 'incidencias', audience: 'incidencias-guest-evidence',
      });
      if (payload.purpose !== 'guest-evidence-upload' || payload.sub !== req.params.id) throw new Error('Invalid scope');
      req.guestEvidence = true;
      next();
    } catch {
      next(new HttpError(401, 'INVALID_EVIDENCE_PERMISSION', 'El permiso para enviar la foto no es válido o venció'));
    }
  };
}

module.exports = { issueGuestEvidenceToken, guestEvidenceAuthorization };
