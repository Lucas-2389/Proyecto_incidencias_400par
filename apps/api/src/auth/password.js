const bcrypt = require('bcrypt');
const { HttpError } = require('../http/errors');

const minimumLength = 12;
const maximumLength = 128;
const cost = 12;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < minimumLength || password.length > maximumLength) {
    throw new HttpError(422, 'VALIDATION_ERROR', `La contraseña debe tener entre ${minimumLength} y ${maximumLength} caracteres`);
  }
  return password;
}

async function hashPassword(password) {
  return bcrypt.hash(validatePassword(password), cost);
}

async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string') return false;
  return bcrypt.compare(password, hash);
}

module.exports = { validatePassword, hashPassword, verifyPassword };
