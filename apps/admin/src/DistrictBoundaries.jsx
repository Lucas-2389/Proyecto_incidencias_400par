import { GeoJSON } from 'react-leaflet';

export default function DistrictBoundaries({ collection, districtId }) {
  return (collection?.features ?? []).map((feature) => <GeoJSON key={`${feature.properties.id}:${String(feature.properties.id) === String(districtId)}`} data={feature}
    style={{ color: String(feature.properties.id) === String(districtId) ? '#0f766e' : '#64748b',
      weight: String(feature.properties.id) === String(districtId) ? 3 : 1, fillOpacity: String(feature.properties.id) === String(districtId) ? 0.12 : 0.02 }}
    onEachFeature={(data, layer) => {
      const label = document.createElement('span');
      label.textContent = data.properties.name;
      layer.bindTooltip(label, { sticky: true, className: 'district-map-tooltip', direction: 'top', offset: [0, -6], opacity: 0.88 });
      const selected = String(data.properties.id) === String(districtId);
      layer.on({
        mouseover: () => layer.setStyle({ color: '#0f766e', weight: 2, fillColor: '#14b8a6', fillOpacity: 0.12 }),
        mouseout: () => layer.setStyle({ color: selected ? '#0f766e' : '#64748b',
          weight: selected ? 3 : 1, fillColor: selected ? '#0f766e' : '#64748b', fillOpacity: selected ? 0.12 : 0.02 }),
      });
    }} />);
}
