// Public reference cartography only. Does not connect to or modify MySQL.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const source = 'https://geosinpad.indeci.gob.pe/indeci/rest/services/LimitesAdministrativos/limitesAdministrativos/MapServer/0/query';

async function main() {
  const query = new URLSearchParams({ where: "UBI_DEP='05'", outFields: 'UBI_DIST,NOMBPROV,NOMBDIST,UBI_PROV',
    outSR: '4326', f: 'geojson', maxAllowableOffset: '0.0003', geometryPrecision: '5', orderByFields: 'UBI_DIST', resultRecordCount: '1000' });
  const response = await fetch(`${source}?${query}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Descarga HTTP ${response.status}`);
  const original = await response.text();
  const data = JSON.parse(original);
  if (data.exceededTransferLimit || data.error || !data.features?.length) throw new Error('Fuente incompleta');
  const codes = new Set();
  const features = data.features.map(({ properties: p, geometry }) => {
    if (!/^05\d{4}$/.test(p.UBI_DIST) || codes.has(p.UBI_DIST) || !['Polygon', 'MultiPolygon'].includes(geometry?.type)) throw new Error('Distrito inválido');
    codes.add(p.UBI_DIST);
    const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
    if (!points.length || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < -76 || x > -72 || y < -16 || y > -11)) throw new Error('Coordenadas inválidas');
    return { type: 'Feature', properties: { id: `regional-${p.UBI_DIST}`, code: p.UBI_DIST,
      name: p.NOMBDIST, provinceCode: p.UBI_PROV, provinceName: p.NOMBPROV }, geometry,
      bbox: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] };
  });
  const provinces = new Set(features.map(f => f.properties.provinceCode));
  if (provinces.size !== 11) throw new Error('Faltan provincias de Ayacucho');
  const result = { type: 'FeatureCollection', scope: 'ayacucho-reference', publisher: 'INDECI / servicio de límites administrativos',
    source: `${source}?${query}`, downloadedAt: new Date().toISOString(), referenceOnly: true,
    simplificationDegrees: 0.0003, sourceSha256: crypto.createHash('sha256').update(original).digest('hex'), features };
  await fs.writeFile(path.join(__dirname, '../data/ayacucho-reference.geojson'), JSON.stringify(result));
  console.log(`Referencia descargada: ${features.length} distritos, ${provinces.size} provincias. No se modificó MySQL.`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
