const { readFileSync } = require('node:fs');
const path = require('node:path');
const regional = JSON.parse(readFileSync(path.join(__dirname, '../../data/ayacucho-reference.geojson'), 'utf8'));

// Documentary map references only. This does not extend operational coverage.
async function referenceDistrictContains(connection, code, latitude, longitude) {
  const feature = regional.features.find(item => item.properties.code === code);
  if (!feature) return false;
  const [[row]] = await connection.execute(
    `SELECT ST_Contains(ST_GeomFromGeoJSON(?, 1, 4326),
      ST_GeomFromText(?, 4326, 'axis-order=long-lat')) AS inside`,
    [JSON.stringify(feature.geometry), `POINT(${longitude} ${latitude})`],
  );
  return Boolean(row.inside);
}

module.exports = { referenceDistrictContains };
