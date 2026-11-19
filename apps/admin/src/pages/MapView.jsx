import { useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import SiteReferences, { entityOptions } from '../SiteReferences';
import { currentRange, OSM_TILE_URL, DISTRICT_BOUNDARIES } from '../config';
import DistrictField from '../DistrictField';
import DistrictBoundaries from '../DistrictBoundaries';
import { queryString } from '../api/client';
import { statusLabels } from '../incidentLabels';
import { ErrorBoundaryContent, Field, Notice, Panel, friendlyDate, useRemote } from '../ui';
import { mapPeriod } from '../mapPeriod';
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

function MapNavigator({ request }) {
  const map = useMap();
  useEffect(() => {
    if (!request) return;
    if (request.bounds) map.fitBounds(request.bounds, { padding: [28, 28], maxZoom: 15, animate: false });
    else map.setView(request.center, request.zoom, { animate: false });
  }, [map, request]);
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
  const [defaultRange, setDefaultRange] = useState(() => currentRange(7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [revision, setRevision] = useState(0);
  const categories = useRemote('/catalog/categories');
  const boundaries = useRemote(DISTRICT_BOUNDARIES);
  const regional = useRemote('/territory/ayacucho/reference-boundaries');
  const references = useRemote('/ops/map/sites');
  const [includeDemoSites, setIncludeDemoSites] = useState(false);
  const referenceSites = useMemo(() => (references.data?.sites ?? []).filter(site => includeDemoSites || !site.isDemo), [references.data, includeDemoSites]);
  const [enabledEntities, setEnabledEntities] = useState([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);
  const [referenceSiteId, setReferenceSiteId] = useState('');
  const provinces = useMemo(() => [...new Map((regional.data?.features ?? []).map(feature =>
    [feature.properties.provinceCode, feature.properties.provinceName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [regional.data]);
  const visibleBoundaries = useMemo(() => {
    if (!showBoundaries) return null;
    if (!regional.data) return boundaries.data;
    const operationalIds = new Map((boundaries.data?.features ?? []).map(feature => [feature.properties.code, feature.properties.id]));
    return { ...regional.data, features: regional.data.features.filter(feature => !provinceCode || feature.properties.provinceCode === provinceCode)
      .map(feature => ({ ...feature, properties: { ...feature.properties, id: operationalIds.get(feature.properties.code) ?? feature.properties.id } })) };
  }, [regional.data, boundaries.data, provinceCode, showBoundaries]);
  const period = mapPeriod(from, to, defaultRange);
  const filters = period.range && queryString({ ...period.range, categoryId, districtId });
  const referenceFilters = period.range && queryString({ ...period.range, districtId });
  const baseMap = useRemote(referenceFilters ? `/ops/map${referenceFilters}` : null, [revision]);
  const activeCategoryIds = new Set((baseMap.data?.incidents ?? []).map(item => String(item.categoryId)));
  const referenceSite = referenceSites.find(site => site.id === referenceSiteId);
  function chooseCategory(value) { setCategoryId(value); setShowReports(true); }
  function centerZone() {
    const features = districtId ? (boundaries.data?.features ?? []).filter(feature => String(feature.properties.id) === districtId)
      : (regional.data?.features ?? []).filter(feature => !provinceCode || feature.properties.provinceCode === provinceCode);
    const boxes = features.map(feature => feature.bbox).filter(Boolean);
    if (!boxes.length) return;
    setFocusRequest({ bounds: [[Math.min(...boxes.map(box => box[1])), Math.min(...boxes.map(box => box[0]))],
      [Math.max(...boxes.map(box => box[3])), Math.max(...boxes.map(box => box[2]))]] });
  }
  function centerSite() {
    if (!referenceSite) return;
    setEnabledEntities(current => current.includes(referenceSite.institutionType) ? current : [...current, referenceSite.institutionType]);
    setFocusRequest({ center: [referenceSite.latitude, referenceSite.longitude], zoom: 16 });
  }
  function update() {
    if (!from && !to) setDefaultRange(currentRange(7));
    setRevision((value) => value + 1);
  }
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Territorio</span><h1>Mapa de incidencias</h1><p>Reportes autorizados y referencias de sedes en Ayacucho.</p></div>
    <Panel title="Explorar territorio" eyebrow="Ayacucho piloto">
      <div className="map-filters">
        <Field label="Tipo de incidente"><select value={categoryId} onChange={(event) => chooseCategory(event.target.value)} disabled={categories.loading || !baseMap.data}>
          <option value="">Todos los tipos</option>{(categories.data ?? []).filter(item => activeCategoryIds.has(String(item.id)) || String(item.id) === categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></Field>
        <DistrictField value={districtId} onChange={setDistrictId} />
        <Field label="Desde (opcional)"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="Hasta (opcional)"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
      <div className="map-reference-controls" role="group" aria-label="Capas de referencia">
        <strong>Elige qué mostrar</strong>
        <div className="map-reference-buttons">
          <button type="button" className={`button ${showReports ? 'primary' : 'ghost'}`} aria-pressed={showReports} onClick={() => setShowReports(!showReports)}>Reportes</button>
          <button type="button" className={`button ${showBoundaries ? 'primary' : 'ghost'}`} aria-pressed={showBoundaries} onClick={() => setShowBoundaries(!showBoundaries)}>Límites distritales</button>
          {entityOptions.map(entity => <button type="button" key={entity.type}
          className={`button ${enabledEntities.includes(entity.type) ? 'primary' : 'ghost'}`} aria-pressed={enabledEntities.includes(entity.type)}
          onClick={() => setEnabledEntities(current => current.includes(entity.type) ? current.filter(type => type !== entity.type) : [...current, entity.type])}>
          {entity.label} · {referenceSites.filter(site => site.institutionType === entity.type && (!provinceCode || site.districtCode?.startsWith(provinceCode))).length}
        </button>)}<button type="button" className="button ghost" onClick={() => setEnabledEntities([])}>Ocultar sedes</button>
          <button type="button" className="button ghost" onClick={() => { setEnabledEntities([]); setShowReports(false); setShowBoundaries(false); }}>Limpiar capas</button>
        </div>
        <div className="map-position-controls"><Field label="Provincia de referencia"><select value={provinceCode} onChange={event => { setProvinceCode(event.target.value); setReferenceSiteId(''); }}>
          <option value="">Toda la región Ayacucho</option>{provinces.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select></Field><button type="button" className="button secondary" disabled={!regional.data && !boundaries.data} onClick={centerZone}>Centrar zona</button>
          <Field label="Sede para centrar"><select value={referenceSiteId} onChange={event => setReferenceSiteId(event.target.value)}><option value="">Elegir una sede registrada</option>
            {referenceSites.filter(site => !provinceCode || site.districtCode?.startsWith(provinceCode)).map(site => <option key={site.id} value={site.id}>{site.name}{site.isDemo ? ' · Simulación' : ''}</option>)}
          </select></Field><button type="button" className="button secondary" disabled={!referenceSite} onClick={centerSite}>Ver sede</button>
        </div>
        <p className="map-note">Activa solo lo que necesites. Acerca el mapa con el cursor sobre el lugar que quieres explorar; cambiar una capa no mueve la vista.</p>
        <details className="map-source-details"><summary>Información de las referencias</summary>
          <label className="check"><input type="checkbox" checked={includeDemoSites} onChange={event => { setIncludeDemoSites(event.target.checked); setReferenceSiteId(''); }} /> Incluir sedes de simulación</label>
          <p className="map-note">Sedes registradas, incluidos ejemplos de simulación; no es un directorio oficial completo. La provincia filtra estas referencias, sin ampliar el acceso a reportes.</p>
          {regional.data && <p className="map-note">Región: {regional.data.features.length} distritos · {provinces.length} provincias · Fuente INDECI · Cartografía referencial, sin valor de demarcación legal.</p>}
        </details>
        {!references.loading && !references.error && !referenceSites.length && <Notice>No hay sedes sin indicador de simulación registradas para mostrar. Registra y valida las ubicaciones institucionales antes de utilizarlas como referencias reales.</Notice>}
        {regional.error && <Notice kind="error">No se pudo cargar la referencia regional. <button type="button" onClick={regional.reload}>Reintentar referencia regional</button></Notice>}
        {references.error && <Notice kind="error">No se pudieron cargar las sedes. <button type="button" onClick={references.reload}>Reintentar sedes</button></Notice>}
      </div>
      <div className="map-filter-footer">
        {period.range && <p className="map-note">{!from && !to ? 'Últimos 7 días' : 'Periodo personalizado'} · {friendlyDate(period.range.from)} — {friendlyDate(new Date(new Date(period.range.to).getTime() - 1))} · Hora de Perú</p>}
        <button className="button ghost" onClick={update} disabled={Boolean(period.error)}>Actualizar</button>
      </div>
      {boundaries.error && <Notice kind="error">No se pudieron cargar los límites. <button className="text-button" onClick={boundaries.reload}>Reintentar límites</button></Notice>}
      {categories.error && <Notice kind="error">{categories.error} <button className="text-button" onClick={categories.reload}>Reintentar tipos</button></Notice>}
      <Notice kind="error">{period.error}</Notice>
      {period.range && <>
        <OperationalMap filters={filters} revision={revision} categories={categories.data ?? []} categoryId={categoryId} setCategoryId={chooseCategory} boundaries={visibleBoundaries} districtId={districtId}
          sites={referenceSites} enabledEntities={enabledEntities} provinceCode={provinceCode} baseMap={baseMap} showReports={showReports} focusRequest={focusRequest} />
      </>}
    </Panel>
  </div>;
}

function OperationalMap({ filters, revision, categories, categoryId, setCategoryId, boundaries, districtId, sites, enabledEntities, provinceCode, baseMap, showReports, focusRequest }) {
  const [zoom, setZoom] = useState(12);
  const filteredMap = useRemote(categoryId ? `/ops/map${filters}` : null, [revision]);
  const map = categoryId ? filteredMap : baseMap;
  const mapData = map.data ?? baseMap.data;
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const incidents = (mapData?.incidents ?? []).filter(item => !categoryId || String(item.categoryId) === categoryId);
  const visibleIncidents = showReports ? incidents : [];
  const markerGroups = groupNearby(visibleIncidents, zoom);
  const counts = [...(baseMap.data?.incidents ?? []).reduce((grouped, incident) => {
    grouped.set(incident.categoryId, (grouped.get(incident.categoryId) ?? 0) + 1);
    return grouped;
  }, new Map())].sort((a, b) => b[1] - a[1]);
  return <>
      <ErrorBoundaryContent loading={map.loading && !mapData} error={!mapData ? map.error : ''}>
        <div className="map-refresh-status" role="status">{map.loading ? 'Actualizando reportes…' : map.error ? 'No se pudo actualizar. Se conserva la última consulta.' : 'Mapa actualizado'}</div>
        {map.error && mapData && <Notice kind="error">{map.error} <button type="button" onClick={map.reload}>Reintentar reportes</button></Notice>}
        <div className="map-summary" role="status">
          <strong>{visibleIncidents.length} reporte{visibleIncidents.length === 1 ? '' : 's'} visible{visibleIncidents.length === 1 ? '' : 's'}</strong>
          <span>{incidents.length} disponibles en la consulta</span>
          <span>{sites.filter(site => enabledEntities.includes(site.institutionType) && (!provinceCode || site.districtCode?.startsWith(provinceCode))).length} sedes activadas</span>
        </div>
        <div className="map-frame"><MapContainer
          center={[-13.16, -74.22]}
          zoom={12}
          minZoom={5}
          maxZoom={20}
          scrollWheelZoom
          doubleClickZoom
          touchZoom
          className="map-canvas"
        >
          <ZoomWatcher onZoomChange={setZoom} />
          <MapNavigator request={focusRequest} />
          <DistrictBoundaries collection={boundaries} districtId={districtId} />
          <TileLayer
            url={OSM_TILE_URL}
            attribution="&copy; OpenStreetMap contributors"
            maxNativeZoom={19}
            maxZoom={20}
            keepBuffer={4}
          />
          <>{markerGroups.map((group) => {
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
              <Tooltip className="incident-map-label" direction="bottom" offset={[0, 12]}>{label}</Tooltip>
              <Popup autoPan={false}><div className="incident-map-popup">
                {multiple && <strong>{group.length} reportes en esta zona</strong>}
                {group.map((item) => <div className="incident-map-popup-item" key={item.id}>
                  <span className="eyebrow">{categoryById.get(item.categoryId)?.name ?? 'Incidente'}</span>
                  <strong>{item.reference}</strong><span>{statusLabels[item.status] ?? item.status}</span>
                  <Link to={`/incidentes/${item.id}`}>Ver detalle →</Link>
                </div>)}
              </div></Popup>
            </Marker>;
          })}
            <SiteReferences sites={sites} enabled={enabledEntities} provinceCode={provinceCode} /></>
        </MapContainer>{!showReports && !enabledEntities.length && !boundaries && <div className="map-empty-hint">Activa Reportes, una entidad o Límites distritales para comenzar.</div>}</div>
        <div className="map-legend" aria-label="Tipos de reportes visibles">
          <button type="button" className={`map-legend-item${!categoryId ? ' active' : ''}`} aria-pressed={!categoryId} onClick={() => setCategoryId('')}>Todos los tipos</button>
          {categories.filter(category => counts.some(([id, count]) => String(id) === String(category.id) && count > 0)).map(category => {
            const id = category.id;
            const count = counts.find(([categoryId]) => categoryId === id)?.[1] ?? 0;
            const { glyph, tone } = appearance(category);
            const active = categoryId === String(id);
            return <button type="button" className={`map-legend-item${active ? ' active' : ''}`} key={id}
              aria-pressed={active} title={active ? 'Mostrar todas las categorías' : `Mostrar solo ${category?.name ?? 'esta categoría'}`}
              onClick={() => setCategoryId(active ? '' : String(id))}>
              <span className={`map-legend-symbol map-legend-symbol--${tone}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: glyphSvg(glyph) }} />
              <span>{category?.name ?? 'Incidente'}</span><strong>{count}</strong></button>;
          })}
        </div>
        <p className="map-legend-help">{counts.length ? 'Toca un tipo para filtrarlo. Acerca el mapa para separar reportes cercanos.' : 'Sin reportes para estos filtros. Puedes elegir otro tipo o volver a Todos los tipos.'}</p>
        <p className="map-note">© OpenStreetMap contributors · Límites referenciales: INDECI / INEI · Puntos de incidentes limitados a tu ámbito.</p>
      </ErrorBoundaryContent>
    </>;
}
