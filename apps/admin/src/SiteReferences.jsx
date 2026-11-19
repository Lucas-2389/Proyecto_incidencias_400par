import { divIcon } from 'leaflet';
import { Marker, Popup, Tooltip } from 'react-leaflet';

export const entityOptions = [
  { type: 'municipalidad', label: 'Municipalidades', symbol: 'M', color: '#0f766e' },
  { type: 'pnp', label: 'PNP', symbol: 'PNP', color: '#166534' },
  { type: 'samu', label: 'SAMU', symbol: '+', color: '#1d4ed8' },
  { type: 'bomberos', label: 'Bomberos', symbol: 'B', color: '#b91c1c' },
];
const paths = {
  municipalidad: '<path d="m3 9 9-6 9 6H3Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18"/>',
  pnp: '<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z"/><path d="m12 7 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 10.5l3.5-.5L12 7Z"/>',
  samu: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  bomberos: '<path d="M12 2c-3 5-1 6-4 9-2 2-3 4-3 6a7 7 0 0 0 14 0c0-4-2-7-5-10 0 3-1 4-2 5-1-3 1-6 0-10Z"/>',
};
const icons = new Map();
function groupIcon(group) {
  const types = [...new Set(group.map(site => site.institutionType))].sort();
  const key = `${types.join(':')}:${group.length}`;
  if (!icons.has(key)) {
    const width = 38 + (types.length - 1) * 26;
    const html = types.map(type => {
      const entity = entityOptions.find(option => option.type === type);
      return `<span style="--site-color:${entity.color}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type]}</svg></span>`;
    }).join('');
    icons.set(key, divIcon({ className: 'site-reference-icon',
      html: `<div class="site-reference-stack">${html}${group.length > 1 ? `<b>${group.length}</b>` : ''}</div>`,
      iconSize: [width, 38], iconAnchor: [width / 2, 19], popupAnchor: [0, -18] }));
  }
  return icons.get(key);
}

export default function SiteReferences({ sites, enabled, provinceCode }) {
  const groups = new Map();
  sites.filter(site => enabled.includes(site.institutionType)
    && (!provinceCode || site.districtCode?.startsWith(provinceCode))
    && Number.isFinite(site.latitude) && Number.isFinite(site.longitude))
    .forEach(site => {
      const key = `${site.latitude.toFixed(6)}:${site.longitude.toFixed(6)}`;
      const group = groups.get(key) ?? [];
      group.push(site); groups.set(key, group);
    });
  return [...groups.entries()].map(([key, group]) => <Marker key={key} position={[group[0].latitude, group[0].longitude]}
    icon={groupIcon(group)} zIndexOffset={300} title={group.length > 1 ? `${group.length} sedes en esta ubicación` : group[0].name}>
      <Tooltip>{group.length > 1 ? `${group.length} sedes · Abre para consultar las entidades` : `${group[0].name}${group[0].isDemo ? ' · Simulación' : ''}`}</Tooltip>
      <Popup autoPan={false}><div className="site-reference-popup">{group.map(site => <section key={site.id}><strong>{site.name}</strong>
        <span>{site.institutionName}</span><span>{site.districtName}</span>
        <span>{site.isDemo ? 'Sede de simulación: ubicación de prueba' : 'Sede registrada: ubicación pendiente de validación oficial'}</span>
      </section>)}<small>Referencia visual. No indica disponibilidad ni asigna recursos.</small>
      </div></Popup>
    </Marker>);
}
