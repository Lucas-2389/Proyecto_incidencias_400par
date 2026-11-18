export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const OSM_TILE_URL = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const METROPOLITAN_DISTRICTS = '/territory/districts?scope=ayacucho-metropolitan';
export const DISTRICT_BOUNDARIES = '/territory/districts/boundaries?scope=ayacucho-metropolitan';

export function currentRange(days = 7) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}
