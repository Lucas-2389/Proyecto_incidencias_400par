const { requireText } = require('./validation');
const { HttpError } = require('./errors');

function optionalPhone(value, field = 'phone') {
  if (value == null || value === '') return null;
  const phone = requireText(value, field, { max: 20 });
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Teléfono de contacto inválido');
  }
  return phone;
}

module.exports = { optionalPhone };
