const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const districtNames = {
  '050101': 'Ayacucho',
  '050104': 'Carmen Alto',
  '050110': 'San Juan Bautista',
  '050115': 'Jesús Nazareno',
  '050116': 'Andrés Avelino Cáceres Dorregaray',
};

// GeoPackage binary header followed by the OGC two-dimensional WKB geometry.
function readGeometry(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.toString('ascii', 0, 2) !== 'GP') throw new Error('Cabecera GeoPackage inválida');
  const envelopeSize = [0, 32, 48, 48, 64][(buffer[3] >> 1) & 7];
  if (envelopeSize === undefined) throw new Error('Envolvente GeoPackage inválida');
  let offset = 8 + envelopeSize;
  function geometry() {
    const littleEndian = buffer[offset++] === 1;
    function integer() {
      const result = littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
      offset += 4;
      return result;
    }
    function number() {
      const result = littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
      offset += 8;
      return result;
    }
    const type = integer();
    const count = integer();
    if (type === 6) return { type: 'MultiPolygon', coordinates: Array.from({ length: count }, () => geometry().coordinates) };
    if (type !== 3) throw new Error(`Geometría WKB no admitida: ${type}`);
    return { type: 'Polygon', coordinates: Array.from({ length: count }, () => {
      const points = integer();
      return Array.from({ length: points }, () => [number(), number()]);
    }) };
  }
  const result = geometry();
  if (offset !== buffer.length) throw new Error('Longitud WKB inconsistente');
  return result;
}

function extract(sourcePath, archivePath) {
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const metadata = database.prepare("SELECT last_change FROM gpkg_contents WHERE table_name = 'DISTRITO'").get();
    const rows = database.prepare('SELECT ubigeo, nombdist, fuente, geom FROM DISTRITO WHERE ubigeo IN (?,?,?,?,?) ORDER BY ubigeo')
      .all(...Object.keys(districtNames));
    if (rows.length !== 5) throw new Error('La fuente debe contener los cinco distritos metropolitanos');
    const features = rows.map((row) => {
      const geometry = readGeometry(row.geom);
      const points = geometry.coordinates.flat(2);
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw new Error(`Anillo inválido: ${row.ubigeo}`);
        }
      }
      if (points.some(([longitude, latitude]) => longitude < -75 || longitude > -73 || latitude < -14 || latitude > -12)) {
        throw new Error(`Extensión inesperada: ${row.ubigeo}`);
      }
      const bbox = [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1])),
        Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1]))];
      return { type: 'Feature', bbox, properties: { code: row.ubigeo, name: districtNames[row.ubigeo], sourceName: row.nombdist, source: row.fuente }, geometry };
    });
    return {
      type: 'FeatureCollection', scope: 'ayacucho-metropolitan',
      source: 'https://ide.inei.gob.pe/files/Distrito.rar', publisher: 'INEI',
      sourceUpdatedAt: metadata.last_change, portalVersion: '2023', referenceOnly: true,
      downloadedAt: new Date().toISOString(),
      sourceSha256: createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex'),
      geopackageSha256: createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
      features,
    };
  } finally { database.close(); }
}

if (require.main === module) {
  const [sourcePath, archivePath] = process.argv.slice(2);
  if (!sourcePath || !archivePath) throw new Error('Indica la ruta del GeoPackage y del archivo RAR original');
  const output = path.join(__dirname, '../data/ayacucho-metropolitan.geojson');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(extract(sourcePath, archivePath)) + '\n');
  console.log(`Cinco distritos extraídos en ${output}`);
}

module.exports = { extract };
