const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const contractPath = path.resolve(__dirname, '../../../packages/contracts/openapi.yaml');
const requiredRoles = [
  'SuperAdministrador',
  'AdministradorInstitucional',
  'Operador',
  'Ciudadano',
];

function checkOpenApi(source = fs.readFileSync(contractPath, 'utf8')) {
  const document = YAML.parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) {
    throw new Error('El contrato OpenAPI contiene YAML inválido o claves repetidas');
  }
  const contract = document.toJS();
  if (contract.openapi !== '3.0.3' || !contract.paths || !contract.components) {
    throw new Error('El contrato OpenAPI carece de sus secciones obligatorias');
  }
  if (JSON.stringify(contract['x-access-roles']) !== JSON.stringify(requiredRoles)) {
    throw new Error('La matriz de acceso debe enumerar los cuatro roles');
  }
  return contract;
}

if (require.main === module) {
  try {
    const contract = checkOpenApi();
    console.log(`OpenAPI válido: ${Object.keys(contract.paths).length} rutas, 4 roles`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkOpenApi };
