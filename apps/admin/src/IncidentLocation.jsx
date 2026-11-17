import { useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import { OSM_TILE_URL } from './config';
import { Notice } from './ui';
import './leaflet-icons';
import 'leaflet/dist/leaflet.css';

export default function IncidentLocation({ location }) {
  const [tileError, setTileError] = useState(false);
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const valid = location?.latitude != null && location?.longitude != null
    && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!valid) return <p>Ubicación no disponible.</p>;
  return <div className="incident-location">
    {location.reference && <p>{location.reference}</p>}
    <p className="coordinates">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
    <Notice kind="warn">{tileError && 'No se pudo cargar la cartografía. La ubicación del reporte se muestra en las coordenadas.'}</Notice>
    <MapContainer key={`${latitude},${longitude}`} center={[latitude, longitude]} zoom={16} scrollWheelZoom={false} className="incident-minimap">
      <TileLayer url={OSM_TILE_URL} attribution="&copy; OpenStreetMap contributors" eventHandlers={{ tileerror: () => setTileError(true) }} />
      <Marker position={[latitude, longitude]}><Tooltip>Ubicación del reporte</Tooltip></Marker>
    </MapContainer>
  </div>;
}
