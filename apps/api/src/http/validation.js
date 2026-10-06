const { HttpError } = require('./errors');

function invalid(field) {
  throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${field}`);
}

function requireObject(value, field = 'body') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  return value;
}

function requireText(value, field, { min = 1, max = 2000 } = {}) {
  if (typeof value !== 'string') invalid(field);
  const text = value.trim();
  if (text.length < min || text.length > max) invalid(field);
  return text;
}

function requireInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(field);
  return value;
}

module.exports = { requireObject, requireText, requireInteger };
