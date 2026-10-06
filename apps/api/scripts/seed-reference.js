const mysql = require('mysql2/promise');
const { loadConfig } = require('../src/config');
const { loadTestDatabaseConfig } = require('./integration-config');

const roles = [
  ['SuperAdministrador', 'Superadministrador'],
  ['AdministradorInstitucional', 'Administrador institucional'],
  ['Operador', 'Operador institucional'],
  ['Ciudadano', 'Ciudadano'],
];

const categories = [
  ['fire', 'Incendio', 'emergency', false, ['bomberos']],
  ['traffic_accident', 'Accidente de tránsito', 'emergency', false, ['pnp', 'samu']],
  ['medical_emergency', 'Emergencia médica', 'emergency', false, ['samu']],
  ['flood', 'Inundación', 'emergency', false, ['municipalidad']],
  ['landslide', 'Deslizamiento', 'emergency', false, ['municipalidad']],
  ['earthquake_damage', 'Daños por sismo', 'emergency', false, ['municipalidad']],
  ['other_emergency', 'Otra emergencia', 'emergency', false, ['municipalidad']],
  ['robbery', 'Robo', 'security', false, ['pnp']],
  ['assault', 'Asalto', 'security', false, ['pnp']],
  ['aggression', 'Agresión', 'security', true, ['pnp']],
  ['fight', 'Pelea', 'security', false, ['pnp']],
  ['vandalism', 'Vandalismo', 'security', false, ['municipalidad']],
  ['harassment', 'Acoso', 'security', true, ['pnp']],
  ['violence', 'Violencia', 'security', true, ['pnp']],
  ['suspicious_activity', 'Actividad sospechosa', 'security', false, ['pnp']],
  ['other_security', 'Otro incidente de seguridad', 'security', false, ['pnp']],
];

async function seedReference(connection) {
  await connection.beginTransaction();
  try {
    for (const [code, name] of roles) {
      await connection.execute(
        'INSERT INTO roles (code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [code, name],
      );
    }
    for (const [code, name, family, isSensitive, targets] of categories) {
      await connection.execute(
        'INSERT INTO incident_categories (code, name, family, is_sensitive, is_demo) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE name = VALUES(name), family = VALUES(family), is_sensitive = VALUES(is_sensitive)',
        [code, name, family, isSensitive],
      );
      const [[category]] = await connection.execute('SELECT id FROM incident_categories WHERE code = ?', [code]);
      for (const institutionType of targets) {
        const [existing] = await connection.execute(
          'SELECT id FROM routing_rules WHERE category_id = ? AND subcategory_id IS NULL AND institution_type = ? AND is_demo = TRUE LIMIT 1',
          [category.id, institutionType],
        );
        if (existing.length === 0) {
          await connection.execute(
            'INSERT INTO routing_rules (category_id, institution_type, reason, is_demo) VALUES (?, ?, ?, TRUE)',
            [category.id, institutionType, `Regla DEMO: ${name} → ${institutionType}`],
          );
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return { roles: roles.length, categories: categories.length };
}

async function main() {
  const target = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  if (target !== 'test' && target !== 'app') throw new Error('Indica --target=test o --target=app explícitamente');
  const database = target === 'test' ? loadTestDatabaseConfig() : loadConfig().database;
  const connection = await mysql.createConnection(database);
  try {
    const result = await seedReference(connection);
    console.log(`Seed de referencia verificado: ${result.roles} roles, ${result.categories} categorías en ${database.database}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const safeMessage = /^(Indica --target|DB_)/.test(error.message) ? error.message : 'No se pudo cargar el seed de referencia';
    console.error(safeMessage);
    process.exitCode = 1;
  });
}

module.exports = { seedReference, roles, categories };
