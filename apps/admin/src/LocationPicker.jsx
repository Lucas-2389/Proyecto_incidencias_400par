import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { OSM_TILE_URL } from './config';
import 'leaflet/dist/leaflet.css';

function PickPoint({ onPick }) {
  useMapEvents({ click(event) { onPick(event.latlng.lat, event.latlng.lng); } });
  return null;
}

export default function LocationPicker({ latitude, longitude, onPick }) {
  const selected = latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const point = selected ? [Number(latitude), Number(longitude)] : [-13.16, -74.22];
  return <div><p>Haz clic en el mapa para ubicar la sede. Puedes elegir otro punto antes de guardar. El punto no define su jurisdicción.</p>
    <MapContainer center={point} zoom={14} style={{ height: 300, width: '100%' }}>
      <TileLayer url={OSM_TILE_URL} attribution="© OpenStreetMap contributors" />
      <PickPoint onPick={onPick} />
      {selected && <CircleMarker center={point} radius={9} pathOptions={{ color: '#0f766e' }} />}
    </MapContainer></div>;
}
