const { readRawConfig } = require('./env');

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} es obligatorio`);
  }
  return value.trim();
}

function requiredPort(value, name) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535`);
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535`);
  }
  return port;
}

function loadConfig(options) {
  const raw = readRawConfig(options);
  const user = requiredText(raw.dbUser, 'DB_USER');
  if (user.toLowerCase() === 'root') {
    throw new Error('DB_USER no puede ser root');
  }
  requiredText(raw.dbPassword, 'DB_PASSWORD');
  if (raw.jwtSecret !== undefined && raw.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }

  return Object.freeze({
    http: Object.freeze({ port: requiredPort(raw.port, 'PORT') }),
    database: Object.freeze({
      host: requiredText(raw.dbHost, 'DB_HOST'),
      port: requiredPort(raw.dbPort, 'DB_PORT'),
      database: requiredText(raw.dbName, 'DB_NAME'),
      user,
      password: raw.dbPassword,
    }),
    auth: Object.freeze({ jwtSecret: raw.jwtSecret, devMailboxDir: raw.devMailboxDir }),
  });
}

module.exports = { loadConfig };
