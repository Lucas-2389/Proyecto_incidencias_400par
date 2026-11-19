const paths = {
  '/': 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  '/incidentes': 'M8 3h8v3H8z M6 5H4v16h16V5h-2 M8 11h8 M8 16h6',
  '/mapa': 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5z M9 3v16 M15 5v16',
  '/instituciones': 'm3 9 9-6 9 6H3z M5 11v8 M10 11v8 M14 11v8 M19 11v8 M3 21h18',
  '/unidades': 'M3 6h12v12H3z M15 10h4l3 4v4h-7 M5 18v2h3v-2 M17 18v2h3v-2',
  '/personal': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
  '/directorio': 'M5 3h14v18H5z M2 7h5 M2 12h5 M2 17h5 M10 7h5 M10 12h5 M10 17h3',
  '/historial': 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
};
export default function NavigationIcon({ path }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[path] || paths['/']} /></svg>;
}
