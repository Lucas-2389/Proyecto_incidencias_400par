const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { loadConfig } = require('../src/config');
const { createConnectionOptions } = require('../src/db/pool');
const { transaction } = require('../src/db/transaction');
const { writeAudit } = require('../src/audit/write');
const { referenceDistrictContains } = require('../src/institutions/reference-geometry');
const dataset = require('../data/ayacucho-municipalities.json');

function assertLocal(config) {
  if (config.http.appEnv !== 'development' || !['127.0.0.1', 'localhost'].includes(config.database.host)
    || config.database.database !== 'incidencias' || config.database.user !== 'incidencias_app') {
    throw new Error('La importación requiere incidencias local con incidencias_app y APP_ENV=development');
  }
}

async function planReferences(connection) {
  const plan = [];
  for (const item of dataset.municipalities) {
    const published = Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
    const inside = published && !item.locationHold && await referenceDistrictContains(connection, item.districtCode, item.latitude, item.longitude);
    plan.push({ ...item, locationStatus: item.locationHold ? 'building_review_required' : inside ? 'published_inside_district' : published ? 'district_mismatch' : 'missing_coordinates' });
  }
  return plan;
}

async function main() {
  const config = loadConfig(); assertLocal(config);
  const apply = process.argv.includes('--apply-local');
  const email = process.argv.find(arg => arg.startsWith('--reviewer-email='))?.slice('--reviewer-email='.length);
  const pool = mysql.createPool(createConnectionOptions(config.database));
  try {
    const plan = await planReferences(pool);
    const summary = { municipalities: plan.length, publishedInsideDistrict: plan.filter(row => row.locationStatus === 'published_inside_district').length,
      publishedOutsideDeclaredDistrict: plan.filter(row => row.locationStatus === 'district_mismatch').length,
      missingCoordinates: plan.filter(row => row.locationStatus === 'missing_coordinates').length,
      buildingReviewRequired: plan.filter(row => row.locationStatus === 'building_review_required').length,
      created: 0, updated: 0, preservedReviewed: 0, applied: apply, target: 'local', notificationsSent: 0 };
    if (!apply) { console.log(JSON.stringify(summary)); return; }
    if (!email) throw new Error('Indica --reviewer-email de un superadministrador local para la auditoría');
    const [[reviewer]] = await pool.execute(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id
      JOIN roles r ON r.id=ur.role_id WHERE u.email=? AND u.status='active' AND r.code='SuperAdministrador'`, [email]);
    if (!reviewer) throw new Error('El revisor debe ser un superadministrador local activo');
    await transaction(pool, async connection => {
      for (const item of plan) {
        const [[before]] = await connection.execute('SELECT * FROM site_references WHERE id=? FOR UPDATE', [item.id]);
        // Preserve human reviews and avoid changing or re-auditing an identical import.
        if (before?.reviewed_at) { summary.preservedReviewed++; continue; }
        const valid = item.locationStatus === 'published_inside_district';
        const sources = [...new Set([...item.sources, ...(item.mapUrl ? [item.mapUrl] : []), ...(item.additionalEvidence ?? [])])];
        const notes = item.notes + (item.locationHold ? ` REVISIÓN PENDIENTE: ${item.locationHold}` : item.locationStatus === 'district_mismatch'
          ? ' PUNTO EN CONFLICTO: el enlace publicado no coincide con el interior del distrito según la cartografía regional; se mantiene sin marcador.'
          : valid ? ' Contraste interior con cartografía regional INDECI: referencia documental, sin ampliar cobertura operativa.' : '');
        if (before && before.name === item.name && before.address === item.address && before.notes === notes) continue;
        if (!before) await connection.execute(`INSERT INTO site_references
          (id,name,institution_type,district_code,address,sources,notes) VALUES (?,?,?,?,?,?,?)`,
        [item.id,item.name,'municipalidad',item.districtCode,item.address,JSON.stringify(sources),notes]);
        else await connection.execute('UPDATE site_references SET name=?,address=?,sources=?,notes=? WHERE id=?',
          [item.name,item.address,JSON.stringify(sources),notes,item.id]);
        if (valid) await connection.execute(`UPDATE site_references SET latitude=?,longitude=?,verification_method='institutional_map',
          location_source=?,reviewed_at=UTC_TIMESTAMP(3),reviewed_by=? WHERE id=?`,
        [item.latitude,item.longitude,item.sourceUrl,reviewer.id,item.id]);
        await writeAudit(connection, { auth: { user: reviewer }, correlationId: randomUUID() }, 'site_reference',
          'site_reference.import', { id: item.id, name: item.name, districtCode: item.districtCode, address: item.address,
            latitude: valid ? item.latitude : null, longitude: valid ? item.longitude : null,
            status: valid ? 'location_reviewed' : 'pending_location', locationSource: valid ? item.sourceUrl : null },
          before ? { id: before.id, name: before.name, address: before.address, status: 'pending_location' } : null);
        summary[before ? 'updated' : 'created']++;
      }
    });
    console.log(JSON.stringify(summary));
  } finally { await pool.end(); }
}

if (require.main === module) main().catch(error => {
  console.error(error.code || 'No se pudo importar; revise configuración local, migración 015 y revisor autorizado'); process.exitCode = 1;
});
module.exports = { assertLocal, planReferences };
