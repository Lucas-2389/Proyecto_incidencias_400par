import { useEffect } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

export default function DistrictBoundaries({ collection, districtId }) {
  const map = useMap();
  useEffect(() => {
    const features = (collection?.features ?? []).filter((feature) => !districtId || String(feature.properties.id) === String(districtId));
    if (!features.length) return;
    const boxes = features.map((feature) => feature.bbox);
    map.fitBounds([
      [Math.min(...boxes.map((box) => box[1])), Math.min(...boxes.map((box) => box[0]))],
      [Math.max(...boxes.map((box) => box[3])), Math.max(...boxes.map((box) => box[2]))],
    ], { padding: [24, 24] });
  }, [map, collection, districtId]);
  return (collection?.features ?? []).map((feature) => <GeoJSON key={feature.properties.id} data={feature}
    style={{ color: String(feature.properties.id) === String(districtId) ? '#0f766e' : '#64748b',
      weight: String(feature.properties.id) === String(districtId) ? 3 : 1, fillOpacity: String(feature.properties.id) === String(districtId) ? 0.12 : 0.02 }}
    onEachFeature={(data, layer) => {
      const label = document.createElement('span');
      label.textContent = data.properties.name;
      layer.bindTooltip(label);
    }} />);
}
