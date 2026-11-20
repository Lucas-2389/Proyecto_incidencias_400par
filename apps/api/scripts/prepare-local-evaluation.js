// Explicit local-only setup: references remain pending; incidents are synthetic.
const mysql = require('mysql2/promise');
const { randomUUID } = require('node:crypto');
const { loadConfig } = require('../src/config');
const { createConnectionOptions } = require('../src/db/pool');
const { resolvePoint } = require('../src/territory/router');
const candidates = require('../data/ayacucho-site-candidates.json');
const scenarios = [
  ['flood', 'high', 'Acumulación de agua en vía pública', 'Lluvia intensa deja agua acumulada y bloquea parcialmente una vía cercana a una zona comercial. Revisar el reporte, priorizar y coordinar apoyo municipal.'],
  ['landslide', 'high', 'Material suelto en una vía', 'Se informa caída de tierra y piedras sobre un carril. No se confirma daño a personas. Verificar el acceso y evaluar intervención municipal.'],
  ['fire', 'critical', 'Humo en un local comercial', 'Un aviso describe humo saliendo de un local y personas alejándose. Verificar la información y practicar derivación a Bomberos, sin despacho real.'],
  ['medical_emergency', 'critical', 'Persona con posible dificultad respiratoria', 'Un testigo describe dificultad respiratoria en un espacio público. Practicar triage y derivación a SAMU. No hay paciente ni llamada real.'],
  ['traffic_accident', 'high', 'Colisión simulada entre vehículos', 'Se describe una colisión con circulación interrumpida y posibles lesionados sin confirmar. Evaluar coordinación entre PNP, SAMU y Bomberos.'],
  ['robbery', 'normal', 'Aviso de sustracción de pertenencias', 'Se recibe un reporte ficticio de sustracción en una zona comercial, sin identidad de víctimas ni personas señaladas. Practicar revisión y ámbito PNP.'],
  ['fire', 'normal', 'Aviso de humo que requiere comprobación', 'Un aviso incompleto describe humo sin identificar su origen. Practicar inicio de verificación y registrar el motivo de una conclusión no verificable.'],
  ['flood', 'normal', 'Segundo aviso de acumulación de agua', 'Un segundo aviso ficticio puede corresponder al primer caso. Revisar ubicación y detalles antes de decidir si corresponde marcar duplicado.'],
];
async function main() {
  const config = loadConfig();
  if (process.argv.includes('--apply-local') === false || config.http.appEnv !== 'development'
    || !['127.0.0.1', 'localhost'].includes(config.database.host) || config.database.database !== 'incidencias'
    || config.database.user !== 'incidencias_app') throw new Error('Solo se permite --apply-local sobre incidencias local con incidencias_app en development');
  const pool = mysql.createPool(createConnectionOptions(config.database));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let references = 0, incidents = 0;
    for (const candidate of candidates) {
      const [[existing]] = await connection.execute('SELECT id FROM site_references WHERE id=?', [candidate.id]);
      if (existing) continue;
      await connection.execute(`INSERT INTO site_references (id,name,institution_type,district_code,address,sources,notes)
        VALUES (?,?,?,?,?,?,?)`, [candidate.id,candidate.name,candidate.institutionType,candidate.districtCode,
        candidate.address,JSON.stringify(candidate.sources),candidate.notes]);
      references++;
    }
    const territory = await resolvePoint(connection, -13.16, -74.22);
    if (!territory.district) throw new Error('La ubicación de evaluación necesita cartografía local cargada');
    const [[version]] = await connection.execute("SELECT version_id AS id FROM territory_state WHERE scope='ayacucho-metropolitan'");
    for (const [index, [code, priority, title, description]] of scenarios.entries()) {
      const reference = `EVAL-AY-${String(index + 1).padStart(3, '0')}`;
      const [[existing]] = await connection.execute('SELECT id FROM incidents WHERE reference=?', [reference]);
      if (existing) continue;
      const [[category]] = await connection.execute('SELECT id FROM incident_categories WHERE code=? AND active=TRUE', [code]);
      if (!category) throw new Error(`Categoría de evaluación ausente: ${code}`);
      const id = randomUUID();
      await connection.execute(`INSERT INTO incidents (id,reference,category_id,source,description,priority,occurred_at,is_demo)
        VALUES (?,?,?,'PHONE',?,?,UTC_TIMESTAMP(3),TRUE)`, [id,reference,category.id,`SIMULACIÓN DE EVALUACIÓN — ${title}. ${description}`,priority]);
      await connection.execute(`INSERT INTO incident_locations (incident_id,location_point,district_id,sector_id,reference_text,territory_status,territory_version_id)
        VALUES (?,ST_GeomFromText('POINT(-74.22 -13.16)',4326,'axis-order=long-lat'),?,?,?,?,?)`,
      [id,territory.district.id,territory.sector?.id ?? null,'Punto aproximado compartido para evaluar agrupación; no corresponde a una emergencia real',territory.status,version?.id ?? null]);
      await connection.execute("INSERT INTO incident_history (incident_id,event_type,new_value,note) VALUES (?,'created','reported','Simulación local de evaluación, sin notificaciones ni despacho real')", [id]);
      incidents++;
    }
    await connection.commit();
    console.log(JSON.stringify({ addedPendingReferences: references, addedSimulatedIncidents: incidents, notificationsSent: 0, target: 'local' }));
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { scenarios };
