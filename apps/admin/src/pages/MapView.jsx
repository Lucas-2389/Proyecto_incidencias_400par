import { useState } from 'react';
import { divIcon } from 'leaflet';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import { currentRange, OSM_TILE_URL } from '../config';
import { queryString } from '../api/client';
import { statusLabels } from '../incidentLabels';
import { ErrorBoundaryContent, Field, Panel, useRemote } from '../ui';
import 'leaflet/dist/leaflet.css';
import '../leaflet-icons';

const markerStyles = {
  fire: ['fire', 'fire'],
  traffic_accident: ['car', 'traffic'],
  medical_emergency: ['medical', 'medical'],
  flood: ['waves', 'water'],
  landslide: ['mountain', 'terrain'],
  earthquake_damage: ['quake', 'terrain'],
  robbery: ['shield', 'security'],
  assault: ['shield', 'security'],
  aggression: ['people', 'security'],
  violence: ['people', 'security'],
  harassment: ['people', 'security'],
  suspicious_activity: ['eye', 'security'],
  fight: ['people', 'security'],
  vandalism: ['broken', 'security'],
};
const shortGroupNames = {
  fire: 'incendios', traffic_accident: 'accidentes', medical_emergency: 'emergencias médicas',
  flood: 'inundaciones', landslide: 'deslizamientos', earthquake_damage: 'daños por sismo',
  robbery: 'robos', assault: 'asaltos', aggression: 'agresiones', violence: 'casos de violencia',
  harassment: 'casos de acoso', suspicious_activity: 'avisos sospechosos', fight: 'peleas', vandalism: 'vandalismos',
};
// All SVG fragments are fixed application assets; catalog text never enters marker HTML.
const glyphPaths = {
  fire: '<path d="M12 2c-2 4-1 6-4 8-2 2-3 4-3 7a7 7 0 0 0 14 0c0-4-2-7-5-10 .2 3-1 4-2 5-.5-3 1-6 0-10Z" fill="currentColor" stroke="none"/>',
  car: '<path d="M5 17h14l-1.5-7h-11L5 17ZM7 10l1.5-4h7l1.5 4M5 17v2h3v-2m8 0v2h3v-2M8 14h1m6 0h1"/>',
  medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  waves: '<path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  mountain: '<path d="m2 20 7-12 4 6 3-4 6 10H2Zm8-8 2-3 2 3m3 4 2-2"/>',
  quake: '<path d="M3 20V9l9-6 9 6v11H3Zm8-11 2 3-3 2 3 2-1 4"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Zm0 5v6m0 4h.01"/>',
  people: '<circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><path d="M3 19v-2c0-3 2-5 5-5s5 2 5 5v2H3Zm10 0h8v-2c0-3-2-5-5-5-.7 0-1.3.1-1.9.4"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  broken: '<path d="M4 4h16v16H4V4Zm8 0-2 6 3 2-3 4 2 4m-8-8h6m4 0h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 7v4m0 3h.01"/>',
};
const markerIcons = new Map();

function appearance(category) {
  const [glyph, tone] = markerStyles[category?.code] ?? (category?.family === 'security' ? ['shield', 'security'] : ['alert', 'other']);
  return { glyph, tone };
}

function glyphSvg(glyph) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphPaths[glyph] ?? glyphPaths.alert}</svg>`;
}

function iconFor(category, count = 1, mixed = false) {
  const look = appearance(category);
  const glyph = mixed ? 'layers' : look.glyph;
  const tone = mixed ? 'mixed' : look.tone;
  const key = `${tone}:${glyph}:${count}`;
  if (!markerIcons.has(key)) {
    markerIcons.set(key, divIcon({
      className: 'incident-map-icon',
      html: `<span class="incident-map-symbol incident-map-symbol--${tone}" aria-hidden="true"><span class="incident-map-glyph">${glyphSvg(glyph)}</span>${count > 1 ? `<b class="incident-map-count">${count}</b>` : ''}</span>`,
      iconSize: [60, 68],
      iconAnchor: [30, 62],
      popupAnchor: [0, -55],
    }));
  }
  return markerIcons.get(key);
}

function ZoomWatcher({ onZoomChange }) {
  useMapEvents({ zoomend(event) { onZoomChange(event.target.getZoom()); } });
  return null;
}

function groupNearby(incidents, zoom) {
  const pixelsPerDegree = 256 * 2 ** zoom / 360;
  return incidents.reduce((groups, incident) => {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    const existing = groups.find((group) => {
      const first = group[0];
      const x = (Number(first.longitude) - longitude) * pixelsPerDegree;
      const y = (Number(first.latitude) - latitude) * pixelsPerDegree / Math.cos(latitude * Math.PI / 180);
      return Math.hypot(x, y) < 70;
    });
    if (existing) existing.push(incident);
    else groups.push([incident]);
    return groups;
  }, []);
}

export default function MapView() {
  const [mode, setMode] = useState('operational');
  const [zoom, setZoom] = useState(12);
  const initial = currentRange();
  const [from, setFrom] = useState(initial.from.slice(0, 10));
  const [to, setTo] = useState(initial.to.slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const categories = useRemote('/catalog/categories');
  const filters = queryString({ from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z`, categoryId, districtId });
  const map = useRemote(`/ops/map${filters}`);
  const heatmap = useRemote(`/public/heatmap${filters}`);
  const source = mode === 'operational' ? map : heatmap;
  const categoryById = new Map((categories.data ?? []).map((item) => [item.id, item]));
  const incidents = map.data?.incidents ?? [];
  const markerGroups = groupNearby(incidents, zoom);
  const counts = [...incidents.reduce((grouped, incident) => {
    grouped.set(incident.categoryId, (grouped.get(incident.categoryId) ?? 0) + 1);
    return grouped;
  }, new Map())].sort((a, b) => b[1] - a[1]);
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Territorio</span><h1>Mapa de incidencias</h1><p>Ubicaciones autorizadas y concentraciones públicas agregadas.</p></div>
    <Panel title="Explorar territorio" eyebrow="Ayacucho piloto" action={<div className="segmented"><button className={mode === 'operational' ? 'active' : ''} onClick={() => setMode('operational')}>Operativo</button><button className={mode === 'heatmap' ? 'active' : ''} onClick={() => setMode('heatmap')}>Mapa de calor</button></div>}>
      <div className="filters"><Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Categoría"><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Todas</option>{(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Distrito ID"><input inputMode="numeric" value={districtId} onChange={(e) => setDistrictId(e.target.value)} placeholder="Todos" /></Field></div>
      <ErrorBoundaryContent loading={source.loading} error={source.error}>
        {mode === 'operational' && <div className="map-summary" role="status">
          <strong>{incidents.length} reporte{incidents.length === 1 ? '' : 's'} visible{incidents.length === 1 ? '' : 's'}</strong>
          <span>{incidents.filter((item) => !['resolved', 'closed'].includes(item.status)).length} en seguimiento</span>
          <span>{map.data?.sites?.length ?? 0} sedes en el mapa</span>
        </div>}
        <div className="map-frame"><MapContainer
          center={[-13.16, -74.22]}
          zoom={12}
          minZoom={5}
          maxZoom={20}
          scrollWheelZoom
          doubleClickZoom
          touchZoom
          worldCopyJump
          className="map-canvas"
        >
          <ZoomWatcher onZoomChange={setZoom} />
          <TileLayer
            url={OSM_TILE_URL}
            attribution="&copy; OpenStreetMap contributors"
            maxNativeZoom={19}
            maxZoom={20}
            keepBuffer={4}
          />
          {mode === 'operational' && <>{markerGroups.map((group) => {
            const first = group[0];
            const category = categoryById.get(first.categoryId);
            const multiple = group.length > 1;
            const types = [...new Set(group.map((item) => item.categoryId))];
            const mixed = types.length > 1;
            const label = mixed ? `${group.length} reportes · ${types.length} tipos`
              : multiple ? `${group.length} ${shortGroupNames[category?.code] ?? 'reportes'}` : category?.name ?? 'Incidente';
            const samePoint = group.every((item) => item.latitude === first.latitude && item.longitude === first.longitude);
            return <Marker key={first.id} position={[first.latitude, first.longitude]} icon={iconFor(category, group.length, mixed)}
              title={multiple ? `${label}. ${samePoint ? 'Abre para verlos' : 'Acerca el mapa para separar puntos cercanos'}` : `${label}: ${first.reference}`}>
              <Tooltip permanent={multiple || zoom >= 16} className="incident-map-label" direction="bottom" offset={[0, 12]}>{label}</Tooltip>
              <Popup><div className="incident-map-popup">
                {multiple && <strong>{group.length} reportes en esta zona</strong>}
                {group.map((item) => <div className="incident-map-popup-item" key={item.id}>
                  <span className="eyebrow">{categoryById.get(item.categoryId)?.name ?? 'Incidente'}</span>
                  <strong>{item.reference}</strong><span>{statusLabels[item.status] ?? item.status}</span>
                  <Link to={`/incidentes/${item.id}`}>Ver detalle →</Link>
                </div>)}
              </div></Popup>
            </Marker>;
          })}
            {(map.data?.sites ?? []).map((item) => <Circle key={item.id} center={[item.latitude, item.longitude]} radius={120} pathOptions={{ color: '#0f766e', fillColor: '#0f766e' }}><Popup>{item.name}</Popup></Circle>)}</>}
          {mode === 'heatmap' && (heatmap.data ?? []).map((cell) => <Circle key={cell.cellId} center={[cell.latitude, cell.longitude]} radius={cell.cellSizeDegrees * 50000} pathOptions={{ color: '#e07443', fillColor: '#e07443', fillOpacity: 0.4 }}><Popup>{cell.count} reportes agregados</Popup></Circle>)}
        </MapContainer></div>
        {mode === 'operational' && <div className="map-legend" aria-label="Tipos de reportes visibles">
          {counts.map(([id, count]) => {
            const category = categoryById.get(id);
            const { glyph, tone } = appearance(category);
            const active = categoryId === String(id);
            return <button type="button" className={`map-legend-item${active ? ' active' : ''}`} key={id}
              aria-pressed={active} title={active ? 'Mostrar todas las categorías' : `Mostrar solo ${category?.name ?? 'esta categoría'}`}
              onClick={() => setCategoryId(active ? '' : String(id))}>
              <span className={`map-legend-symbol map-legend-symbol--${tone}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: glyphSvg(glyph) }} />
              <span>{category?.name ?? 'Incidente'}</span><strong>{count}</strong></button>;
          })}
          {!counts.length && <span>Sin reportes para estos filtros.</span>}
        </div>}
        {mode === 'operational' && counts.length > 0 && <p className="map-legend-help">Toca un tipo para filtrarlo. Acerca el mapa para separar reportes cercanos.</p>}
        <p className="map-note">© OpenStreetMap contributors · {mode === 'operational' ? 'Puntos exactos limitados a tu ámbito.' : 'Celdas con al menos 3 reportes; centro de celda, sin ubicación exacta.'}</p>
      </ErrorBoundaryContent>
    </Panel></div>;
}
