const { randomUUID } = require('node:crypto');

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function correlationId(req, res, next) {
  req.correlationId = randomUUID();
  res.set('X-Correlation-Id', req.correlationId);
  next();
}

function notFound(_req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado'));
}

function errorHandler(error, req, res, _next) {
  const invalidJson = error instanceof SyntaxError && error.status === 400 && 'body' in error;
  const status = invalidJson ? 400 : error instanceof HttpError ? error.status : 500;
  const code = invalidJson ? 'VALIDATION_ERROR' : error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = invalidJson ? 'JSON inválido' : error instanceof HttpError ? error.message : 'Error interno';
  res.status(status).json({ code, message, correlationId: req.correlationId });
}

module.exports = { HttpError, correlationId, notFound, errorHandler };
