import { useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { currentRange, OSM_TILE_URL } from '../config';
import { queryString } from '../api/client';
import { ErrorBoundaryContent, Field, Panel, useRemote } from '../ui';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  const [mode, setMode] = useState('operational');
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
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Territorio</span><h1>Mapa de incidencias</h1><p>Ubicaciones autorizadas y concentraciones públicas agregadas.</p></div>
    <Panel title="Explorar territorio" eyebrow="Ayacucho piloto" action={<div className="segmented"><button className={mode === 'operational' ? 'active' : ''} onClick={() => setMode('operational')}>Operativo</button><button className={mode === 'heatmap' ? 'active' : ''} onClick={() => setMode('heatmap')}>Mapa de calor</button></div>}>
      <div className="filters"><Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Categoría"><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Todas</option>{(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Distrito ID"><input inputMode="numeric" value={districtId} onChange={(e) => setDistrictId(e.target.value)} placeholder="Todos" /></Field></div>
      <ErrorBoundaryContent loading={source.loading} error={source.error}>
        <div className="map-frame"><MapContainer center={[-13.16, -74.22]} zoom={12} scrollWheelZoom={false} className="map-canvas"><TileLayer url={OSM_TILE_URL} attribution="&copy; OpenStreetMap contributors" />
          {mode === 'operational' && <>{(map.data?.incidents ?? []).map((item) => <Marker key={item.id} position={[item.latitude, item.longitude]}><Popup><strong>{item.reference}</strong><br />{item.status}</Popup></Marker>)}
            {(map.data?.sites ?? []).map((item) => <Circle key={item.id} center={[item.latitude, item.longitude]} radius={120} pathOptions={{ color: '#0f766e', fillColor: '#0f766e' }}><Popup>{item.name}</Popup></Circle>)}</>}
          {mode === 'heatmap' && (heatmap.data ?? []).map((cell) => <Circle key={cell.cellId} center={[cell.latitude, cell.longitude]} radius={cell.cellSizeDegrees * 50000} pathOptions={{ color: '#e07443', fillColor: '#e07443', fillOpacity: 0.4 }}><Popup>{cell.count} reportes agregados</Popup></Circle>)}
        </MapContainer></div>
        <p className="map-note">© OpenStreetMap contributors · {mode === 'operational' ? 'Puntos exactos limitados a tu ámbito.' : 'Celdas con al menos 3 reportes; centro de celda, sin ubicación exacta.'}</p>
      </ErrorBoundaryContent>
    </Panel></div>;
}
