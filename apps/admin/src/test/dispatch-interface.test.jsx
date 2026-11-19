import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { IncidentDetail } from '../pages/Incidents';
import MapView from '../pages/MapView';
import IncidentLocation from '../IncidentLocation';
import { mapPeriod } from '../mapPeriod';
import { useIncidentOperations } from '../useIncidentOperations';

const { api, map } = vi.hoisted(() => ({ api: { request: vi.fn() }, map: { fitBounds: vi.fn(), setView: vi.fn() } }));
vi.mock('../session', () => ({ useSession: () => ({ api }) }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }) => <div role="img" aria-label="Mapa" data-center={center.join(',')}>{children}</div>,
  Marker: ({ children }) => <div>{children}</div>, Popup: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>, Circle: () => null,
  TileLayer: ({ eventHandlers }) => <button onClick={() => eventHandlers?.tileerror()}>Simular fallo cartográfico</button>,
  useMapEvents: () => ({}),
  useMap: () => map,
  GeoJSON: ({ data }) => <span data-testid="district-boundary">{data.properties.name}</span>,
}));

let incident;
let assignments;
let history;
let writeError;
let readError;
const sites = [
  { id: 'site-a', institutionId: 'institution-a', name: 'Base Bomberos', active: true },
  { id: 'site-b', institutionId: 'institution-b', name: 'Base SAMU', active: true },
];
const defaultRange = { from: '2026-11-09T20:00:00.000Z', to: '2026-11-16T20:00:00.000Z' };
const metropolitanDistricts = ['Ayacucho', 'Carmen Alto', 'San Juan Bautista', 'Jesús Nazareno', 'Andrés Avelino Cáceres Dorregaray']
  .map((name, index) => ({ id: index + 7, name }));

beforeEach(() => {
  map.fitBounds.mockClear(); map.setView.mockClear();
  incident = { id: 'incident-1', reference: 'DEMO-001', categoryId: 1, subcategoryId: 2, status: 'reported', priority: 'high',
    source: 'PHONE', description: 'La persona principal se encuentra cerca del mercado.',
    isConscious: false, isBreathing: true, hasBleeding: null, affectedPeople: 0,
    location: { latitude: -13.16, longitude: -74.22, reference: 'Mercado' } };
  assignments = [];
  history = [];
  writeError = null;
  readError = null;
  api.request.mockReset().mockImplementation(async (path, options = {}) => {
    if (options.method) {
      if (writeError) throw writeError;
      const body = JSON.parse(options.body);
      if (path.endsWith('/assignments')) {
        assignments.push({ id: `assignment-${assignments.length}`, ...body, status: 'assigned', assignedAt: '2026-11-16T12:00:00Z' });
        incident.status = 'assigned';
      } else if (path.endsWith('/verification')) {
        incident.priority = body.priority ?? incident.priority;
        incident.verificationStatus = body.verificationStatus;
      } else if (path.endsWith('/status')) {
        if (body.assignmentId) assignments.find((item) => item.id === body.assignmentId).status = body.status;
        else incident.status = body.status;
      }
      return {};
    }
    if (readError && path.startsWith('/incidents/')) throw readError;
    if (path.startsWith('/incidents/')) return structuredClone({ ...incident, id: path.split('/')[2] });
    if (path.endsWith('/assignments')) return structuredClone(assignments);
    if (path.endsWith('/history')) return structuredClone(history);
    if (path.endsWith('/suggestions')) return { suggestions: sites.map((site) => ({ siteId: site.id, siteName: site.name, institutionName: site.name })) };
    if (path.includes('/operators?')) return [{ id: 'operator-a', name: 'Ana Operadora' }];
    if (path === '/admin/sites') return sites;
    if (path.startsWith('/resources/units')) return [
      { id: 'unit-free', siteId: 'site-a', code: 'Unidad libre', type: 'Rescate', status: 'available' },
      { id: 'unit-busy', siteId: 'site-a', code: 'Unidad ocupada', type: 'Rescate', status: 'assigned' },
    ];
    if (path.startsWith('/resources/personnel')) return [
      { id: 'person-free', siteId: 'site-a', name: 'Personal libre', active: true, available: true },
      { id: 'person-busy', siteId: 'site-a', name: 'Personal ocupado', active: true, available: false },
    ];
    if (path === '/admin/institutions') return [{ id: 'institution-a', name: 'Bomberos' }, { id: 'institution-b', name: 'SAMU' }];
    if (path === '/catalog/categories') return [{ id: 1, name: 'Accidente', code: 'traffic_accident' }];
    if (path.endsWith('/subcategories')) return [{ id: 2, name: 'Lesiones múltiples' }];
    if (path.startsWith('/territory/districts/boundaries')) return { type: 'FeatureCollection', features: metropolitanDistricts.map((district) => (
      { type: 'Feature', properties: district, bbox: [-74.3, -13.2, -74.2, -13.1], geometry: { type: 'MultiPolygon', coordinates: [] } }
    )) };
    if (path.startsWith('/territory/districts?')) return metropolitanDistricts;
    if (path === '/territory/ayacucho/reference-boundaries') return { type: 'FeatureCollection', features: metropolitanDistricts.map(district => ({
      type: 'Feature', properties: { ...district, code: `05010${district.id}`, provinceCode: '0501', provinceName: 'Huamanga' },
      bbox: [-74.3, -13.2, -74.2, -13.1], geometry: { type: 'MultiPolygon', coordinates: [] },
    })) };
    if (path === '/ops/map/sites') return { sites: [{ id: 'muni', name: 'Municipalidad de prueba', institutionType: 'municipalidad',
      districtCode: '050101', districtName: 'Ayacucho', isDemo: true, latitude: -13.16, longitude: -74.22 }] };
    if (path.startsWith('/ops/map')) return { incidents: [{ id: 'incident-1', reference: 'DEMO-001', categoryId: 1, latitude: -13.16, longitude: -74.22, status: 'reported' }], sites: [] };
    throw new Error(`Ruta inesperada ${path}`);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('conserva el mapa y los controles mientras se actualiza un filtro de categoría', async () => {
  const original = api.request.getMockImplementation();
  let finish;
  api.request.mockImplementation((path, options) => {
    if (path.startsWith('/ops/map?') && new URL(path, 'http://test').searchParams.get('categoryId')) {
      return new Promise(resolve => { finish = resolve; });
    }
    return original(path, options);
  });
  render(<MemoryRouter><MapView /></MemoryRouter>);
  const initialMap = await screen.findByRole('img', { name: 'Mapa' });
  fireEvent.change(screen.getByLabelText('Tipo de incidente'), { target: { value: '1' } });
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(screen.getByRole('img', { name: 'Mapa' })).toBe(initialMap);
  expect(screen.getByText('Actualizando reportes…')).toBeInTheDocument();
  await act(async () => finish({ incidents: [], sites: [] }));
  expect(screen.getByRole('img', { name: 'Mapa' })).toBe(initialMap);
  fireEvent.click(screen.getByRole('button', { name: 'Todos los tipos', exact: true }));
  await waitFor(() => expect(screen.getByLabelText('Tipo de incidente')).toHaveValue(''));
});

it('muestra sedes solo al activar su entidad y permite ocultarlas', async () => {
  render(<MemoryRouter><MapView /></MemoryRouter>);
  await screen.findByRole('img', { name: 'Mapa' });
  expect(screen.getByText(/No hay sedes sin indicador de simulación/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Información de las referencias'));
  fireEvent.click(screen.getByLabelText('Incluir sedes de simulación'));
  const municipality = screen.getByRole('button', { name: /Municipalidades · 1/ });
  expect(municipality).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByText('Sede de simulación: ubicación de prueba')).not.toBeInTheDocument();
  fireEvent.click(municipality);
  expect(screen.getByText('Sede de simulación: ubicación de prueba')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar sedes' }));
  expect(municipality).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByText('Sede de simulación: ubicación de prueba')).not.toBeInTheDocument();
});

it('ofrece solo tipos con reportes y mantiene los otros tipos activos al filtrar', async () => {
  const original = api.request.getMockImplementation();
  api.request.mockImplementation((path, options) => {
    if (path === '/catalog/categories') return Promise.resolve([
      { id: 1, name: 'Accidente', code: 'traffic_accident' },
      { id: 2, name: 'Inundación', code: 'flood' },
      { id: 3, name: 'Sin reportes', code: 'fire' },
    ]);
    if (path.startsWith('/ops/map?') && !path.includes('categoryId=')) return Promise.resolve({ incidents: [
      { id: 'a', categoryId: 1, latitude: -13.16, longitude: -74.22 },
      { id: 'b', categoryId: 2, latitude: -13.15, longitude: -74.21 },
    ] });
    return original(path, options);
  });
  render(<MemoryRouter><MapView /></MemoryRouter>);
  const legend = await screen.findByLabelText('Tipos de reportes visibles');
  await within(legend).findByRole('button', { name: /Inundación/ });
  expect(within(legend).queryByRole('button', { name: /Sin reportes/ })).not.toBeInTheDocument();
  const mapElement = screen.getByRole('img', { name: 'Mapa' });
  fireEvent.click(within(legend).getByRole('button', { name: /Inundación/ }));
  await waitFor(() => expect(screen.getByLabelText('Tipo de incidente')).toHaveValue('2'));
  expect(within(legend).getByRole('button', { name: /Accidente/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Mapa' })).toBe(mapElement);
});

it('selecciona recursos libres y conserva la elección del operador de la nueva interfaz', async () => {
  renderDetail();
  fireEvent.change(await screen.findByLabelText('Sede responsable'), { target: { value: 'site-a' } });
  fireEvent.click(screen.getByRole('button', { name: 'Elegir unidades y personal' }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /Unidad libre/ })).toBeEnabled());
  expect(screen.getByRole('checkbox', { name: /Unidad ocupada/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Personal ocupado/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Unidad libre/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Personal libre/ }));
  fireEvent.change(screen.getByLabelText('Operador'), { target: { value: 'operator-a' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await waitFor(() => expect(api.request.mock.calls.some(([path, options]) => path.endsWith('/assignments') && options?.method === 'POST')).toBe(true));
  const [, options] = api.request.mock.calls.find(([path, options]) => path.endsWith('/assignments') && options?.method === 'POST');
  expect(JSON.parse(options.body)).toMatchObject({ unitIds: ['unit-free'], personnelIds: ['person-free'], operatorUserId: 'operator-a' });
});

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/incidentes/incident-1']}><Link to="/incidentes/incident-2">Otro incidente</Link><Routes><Route path="/incidentes/:id" element={<IncidentDetail />} /></Routes></MemoryRouter>);
}

async function openControl() {
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir control' }));
}

it('distribuye ubicación junto a información y control compacto después de fotografías', async () => {
  renderDetail();
  const report = (await screen.findByRole('heading', { name: 'Reporte' })).closest('section');
  const location = screen.getByRole('heading', { name: 'Ubicación del reporte' }).closest('section');
  expect(report.parentElement).toBe(location.parentElement);
  expect(within(report).getByRole('region', { name: 'Triage rápido' })).toBeInTheDocument();
  expect(within(report).queryByRole('heading', { name: 'Ubicación del reporte' })).not.toBeInTheDocument();
  const photos = screen.getByRole('heading', { name: 'Fotografías' }).closest('section');
  const control = screen.getByRole('region', { name: 'Control · Verificar y priorizar' });
  expect(photos.nextElementSibling).toBe(control);
  expect(within(control).getByRole('button', { name: 'Abrir control' })).toHaveAttribute('aria-expanded', 'false');
  expect(within(control).queryByRole('button', { name: 'Guardar verificación' })).not.toBeInTheDocument();
});

it('muestra la prioridad actual y guarda su cambio junto con el motivo', async () => {
  incident.verificationStatus = 'unverifiable';
  renderDetail();
  expect(await screen.findByText('Prioridad alta')).toBeInTheDocument();
  await openControl();
  expect(screen.getByLabelText('Prioridad')).toHaveValue('high');
  fireEvent.change(screen.getByLabelText('Prioridad'), { target: { value: 'critical' } });
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Empeoramiento confirmado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar verificación' }));
  expect(await screen.findByText('Prioridad crítica')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Abrir control' })).toHaveAttribute('aria-expanded', 'false');
  const request = api.request.mock.calls.find(([path, options]) => path.endsWith('/verification') && options?.method === 'PATCH');
  expect(JSON.parse(request[1].body)).toEqual({ verificationStatus: 'unverifiable', priority: 'critical', reason: 'Empeoramiento confirmado' });
});

it('muestra triage con negativos, cero, desconocidos, subtipo y ubicación', async () => {
  renderDetail();
  const triage = await screen.findByRole('region', { name: 'Triage rápido' });
  expect(within(triage).getByText('No')).toBeInTheDocument();
  expect(within(triage).getByText('Sí')).toBeInTheDocument();
  expect(within(triage).getByText('No informado')).toBeInTheDocument();
  expect(within(triage).getByText('0')).toBeInTheDocument();
  expect(await within(triage).findByText('Lesiones múltiples')).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: 'Mapa' })).toHaveAttribute('data-center', '-13.16,-74.22');
  expect(screen.getByText(incident.description)).toBeInTheDocument();
});

it('conserva reportes históricos y subtipos ausentes del catálogo', async () => {
  incident.subcategoryId = 999;
  incident.isBreathing = false;
  incident.hasBleeding = false;
  renderDetail();
  expect(await screen.findByText('Subtipo no disponible')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Triage rápido' })).getAllByText('No')).toHaveLength(3);
  cleanup();
  for (const key of ['subcategoryId', 'affectedPeople', 'isConscious', 'isBreathing', 'hasBleeding']) delete incident[key];
  renderDetail();
  expect(await screen.findByText('Triage no informado.')).toBeInTheDocument();
});

it('admite coordenadas cero, cambio de punto y fallo cartográfico', () => {
  const view = render(<IncidentLocation location={{ latitude: 0, longitude: 0 }} />);
  expect(screen.getByRole('img', { name: 'Mapa' })).toHaveAttribute('data-center', '0,0');
  view.rerender(<IncidentLocation location={{ latitude: -13, longitude: -74 }} />);
  expect(screen.getByRole('img', { name: 'Mapa' })).toHaveAttribute('data-center', '-13,-74');
  fireEvent.click(screen.getByText('Simular fallo cartográfico'));
  expect(screen.getByText(/No se pudo cargar la cartografía/)).toBeInTheDocument();
  expect(screen.getByText('-13.000000, -74.000000')).toBeInTheDocument();
  view.rerender(<IncidentLocation location={{ latitude: 91, longitude: 0 }} />);
  expect(screen.queryByRole('img', { name: 'Mapa' })).not.toBeInTheDocument();
  expect(screen.getByText('Ubicación no disponible.')).toBeInTheDocument();
});

it('despacha directamente con operador y conserva dos instituciones independientes', async () => {
  renderDetail();
  const select = await screen.findByLabelText('Sede responsable');
  fireEvent.change(select, { target: { value: 'site-a' } });
  await screen.findByRole('option', { name: 'Ana Operadora' });
  fireEvent.change(screen.getByLabelText('Operador'), { target: { value: 'operator-a' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await screen.findByRole('article', { name: 'Asignación de Base Bomberos' });
  const post = api.request.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post[1].body)).toEqual({ institutionId: 'institution-a', siteId: 'site-a', operatorUserId: 'operator-a', reason: null });
  expect(api.request.mock.calls.some(([path]) => path.startsWith('/resources/') || path === '/admin/users')).toBe(false);
  fireEvent.change(select, { target: { value: 'site-b' } });
  expect(screen.getByLabelText('Operador')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  const samu = await screen.findByRole('article', { name: 'Asignación de Base SAMU' });
  const fire = screen.getByRole('article', { name: 'Asignación de Base Bomberos' });
  fireEvent.click(within(fire).getByRole('button', { name: 'Pasar a Unidad en camino' }));
  await within(fire).findByText('Unidad en camino');
  expect(within(samu).getByText('Asignado')).toBeInTheDocument();
  expect(within(samu).getByText('Operador pendiente')).toBeInTheDocument();
});

it('ordena cerradas, contextualiza historial y muestra global de una vista parcial', async () => {
  incident.status = 'assigned';
  assignments = [{ id: 'closed', institutionId: 'institution-a', siteId: 'site-a', operatorUserId: 'old', status: 'closed', assignedAt: '2026-11-15T12:00:00Z', closedAt: '2026-11-16T12:00:00Z' },
    { id: 'active', institutionId: 'institution-b', siteId: 'site-b', status: 'attending', assignedAt: '2026-11-16T12:00:00Z' }];
  history = [{ id: 1, assignmentId: 'active', eventType: 'assignment.status', previousValue: 'en_route', newValue: 'attending' },
    { id: 2, assignmentId: 'hidden', eventType: 'assignment.status', newValue: 'closed' }];
  renderDetail();
  await screen.findByText('Operador no disponible');
  expect(screen.getAllByRole('article').map((item) => item.getAttribute('aria-label'))).toEqual(['Asignación de Base SAMU', 'Asignación de Base Bomberos']);
  expect(screen.getByText('Asignado')).toBeInTheDocument();
  expect(within(screen.getByRole('list')).getByText('SAMU · Base SAMU')).toBeInTheDocument();
  expect(screen.getByText('Atención institucional')).toBeInTheDocument();
  expect(screen.queryByText('hidden')).not.toBeInTheDocument();
});

it('repliega control al confirmar y conserva resultado y despacho al reabrir', async () => {
  renderDetail();
  await openControl();
  const reason = await screen.findByLabelText('Motivo');
  fireEvent.change(reason, { target: { value: 'Confirmación telefónica' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar verificación' }));
  expect(await screen.findByRole('button', { name: 'Abrir control' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Cambio guardado.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar asignación' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir control' }));
  expect(screen.getByLabelText('Motivo')).toHaveValue('Confirmación telefónica');
  writeError = new Error('Motivo rechazado');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar verificación' }));
  await screen.findByText('Motivo rechazado');
  expect(screen.getByRole('button', { name: 'Replegar control' })).toHaveAttribute('aria-expanded', 'true');
  writeError = null;
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar verificación' }));
  await screen.findByRole('button', { name: 'Abrir control' });
  fireEvent.click(screen.getByRole('link', { name: 'Otro incidente' }));
  expect(await screen.findByRole('button', { name: 'Abrir control' })).toHaveAttribute('aria-expanded', 'false');
});

it('recupera 409 sin borrar la edición y evita duplicar una escritura pendiente', async () => {
  renderDetail();
  await openControl();
  const reason = await screen.findByLabelText('Motivo');
  fireEvent.change(reason, { target: { value: 'Mi nota' } });
  let reject;
  const original = api.request.getMockImplementation();
  api.request.mockImplementation((path, options) => options?.method ? new Promise((resolve, failure) => { reject = failure; }) : original(path, options));
  const button = screen.getByRole('button', { name: 'Guardar verificación' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(api.request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
  await act(async () => reject(Object.assign(new Error('Estado anterior'), { status: 409 })));
  await screen.findByText(/La atención cambió/);
  expect(reason).toHaveValue('Mi nota');
});

it('distingue escritura confirmada de recarga fallida y reintenta solo la lectura', async () => {
  renderDetail();
  await openControl();
  fireEvent.change(await screen.findByLabelText('Motivo'), { target: { value: 'Verificado' } });
  readError = new Error('Sin conexión');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar verificación' }));
  await screen.findByText(/No se pudo actualizar el reporte/);
  expect(screen.getByText('Cambio guardado.')).toBeInTheDocument();
  readError = null;
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  await waitFor(() => expect(screen.queryByText(/No se pudo actualizar el reporte/)).not.toBeInTheDocument());
  expect(api.request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
});

it('presenta filtros de mapa ordenados y transmite tipo y distrito', async () => {
  render(<MemoryRouter><MapView /></MemoryRouter>);
  await screen.findByRole('option', { name: 'Ayacucho' });
  expect(screen.getAllByRole('combobox').map((select) => select.closest('label').textContent)).toEqual([expect.stringContaining('Tipo de incidente'), expect.stringContaining('Distrito'), expect.stringContaining('Provincia de referencia'), expect.stringContaining('Sede para centrar')]);
  expect(screen.getByLabelText('Desde (opcional)')).toHaveValue('');
  expect(screen.getByLabelText('Hasta (opcional)')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Tipo de incidente'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Distrito'), { target: { value: '7' } });
  await waitFor(() => expect(api.request.mock.calls.some(([path]) => path.startsWith('/ops/map') && path.includes('categoryId=1') && path.includes('districtId=7'))).toBe(true));
  expect(api.request.mock.calls.some(([path]) => path.includes('heatmap'))).toBe(false);
  expect(screen.getByRole('link', { name: 'Ver detalle →' })).toHaveAttribute('href', '/incidentes/incident-1');
});

it('recupera los cinco contornos y permite seleccionar un distrito sin reportes', async () => {
  const original = api.request.getMockImplementation();
  let failed = true;
  api.request.mockImplementation((path, options) => {
    if (path.startsWith('/territory/districts/boundaries') && failed) return Promise.reject(new Error('Sin cartografía'));
    if (path.startsWith('/ops/map')) return Promise.resolve({ incidents: [], sites: [] });
    return original(path, options);
  });
  render(<MemoryRouter><MapView /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Reintentar límites' });
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Límites distritales', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar límites' }));
  await waitFor(() => expect(screen.getAllByTestId('district-boundary')).toHaveLength(5));
  const selector = screen.getByRole('combobox', { name: 'Distrito' });
  selector.focus();
  expect(selector).toHaveFocus();
  for (const district of metropolitanDistricts) {
    expect(within(selector).getByRole('option', { name: district.name })).toBeInTheDocument();
  }
  fireEvent.change(selector, { target: { value: '11' } });
  await screen.findByText(/^Sin reportes para estos filtros\./);
  expect(screen.getAllByTestId('district-boundary')).toHaveLength(5);
  expect(map.fitBounds).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Centrar zona' }));
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  fireEvent.change(selector, { target: { value: '' } });
  await waitFor(() => expect(api.request.mock.calls.filter(([path]) => path.startsWith('/ops/map')).at(-1)[0]).not.toContain('districtId='));
});

it('usa días de Perú completos y valida fechas opcionales y límite', () => {
  expect(mapPeriod('', '', defaultRange).range).toBe(defaultRange);
  expect(mapPeriod('2026-11-16', '2026-11-16', defaultRange).range).toEqual({ from: '2026-11-16T05:00:00.000Z', to: '2026-11-17T05:00:00.000Z' });
  expect(mapPeriod('2026-01-01', '2026-03-31', defaultRange).error).toBe('');
  expect(mapPeriod('2026-01-01', '2026-04-01', defaultRange).error).toMatch(/90 días/);
  expect(mapPeriod('2026-11-16', '', defaultRange).error).toMatch(/ambas fechas/);
  expect(mapPeriod('2026-11-17', '2026-11-16', defaultRange).error).toMatch(/válido/);
});

it('recupera un catálogo territorial fallido y evita consultas de fechas incompletas', async () => {
  const original = api.request.getMockImplementation();
  let failDistricts = true;
  api.request.mockImplementation((path, options) => {
    if (path.startsWith('/territory/districts?') && failDistricts) return Promise.reject(new Error('Catálogo temporalmente no disponible'));
    return original(path, options);
  });
  render(<MemoryRouter><MapView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar distritos' }));
  failDistricts = false;
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar distritos' }));
  await screen.findByRole('option', { name: 'Ayacucho' });
  const calls = api.request.mock.calls.filter(([path]) => path.startsWith('/ops/map')).length;
  fireEvent.change(screen.getByLabelText('Desde (opcional)'), { target: { value: '2026-11-16' } });
  await screen.findByText(/Completa ambas fechas/);
  expect(api.request.mock.calls.filter(([path]) => path.startsWith('/ops/map'))).toHaveLength(calls);
  fireEvent.change(screen.getByLabelText('Hasta (opcional)'), { target: { value: '2026-11-16' } });
  await waitFor(() => expect(api.request.mock.calls.filter(([path]) => path.startsWith('/ops/map'))).toHaveLength(calls + 1));
  const lastCall = api.request.mock.calls.filter(([path]) => path.startsWith('/ops/map')).at(-1)[0];
  expect(new URL(lastCall, 'http://test.invalid').searchParams.get('to')).toBe('2026-11-17T05:00:00.000Z');
});

it('descarta operadores tardíos de una sede anterior y exige motivo de corrección', async () => {
  const original = api.request.getMockImplementation();
  let resolvePrevious;
  api.request.mockImplementation((path, options) => {
    if (path.endsWith('/suggestions')) return Promise.resolve({ suggestions: [{ siteId: 'site-a', siteName: 'Base Bomberos' }] });
    if (path.endsWith('operators?siteId=site-a')) return new Promise((resolve) => { resolvePrevious = resolve; });
    if (path.endsWith('operators?siteId=site-b')) return Promise.resolve([{ id: 'operator-b', name: 'Beatriz SAMU' }]);
    return original(path, options);
  });
  renderDetail();
  const site = await screen.findByLabelText('Sede responsable');
  fireEvent.change(site, { target: { value: 'site-a' } });
  await waitFor(() => expect(resolvePrevious).toBeTypeOf('function'));
  fireEvent.change(site, { target: { value: 'site-b' } });
  await screen.findByRole('option', { name: 'Beatriz SAMU' });
  await act(async () => { resolvePrevious([{ id: 'operator-a', name: 'Operador anterior' }]); });
  expect(screen.queryByRole('option', { name: 'Operador anterior' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Motivo de corrección'), { target: { value: 'Apoyo médico requerido' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await screen.findByRole('article', { name: 'Asignación de Base SAMU' });
  expect(JSON.parse(api.request.mock.calls.find(([, options]) => options?.method === 'POST')[1].body).reason).toBe('Apoyo médico requerido');
});

it('pausa el seguimiento oculto, actualiza al volver y limpia el temporizador', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const view = renderHook(() => useIncidentOperations('incident-1'));
  await act(async () => {});
  expect(view.result.current.detail.status).toBe('reported');
  incident.status = 'attending';
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(view.result.current.detail.status).toBe('attending');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const before = api.request.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(api.request.mock.calls).toHaveLength(before);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(api.request.mock.calls.length).toBe(before + 3);
  view.unmount();
  const after = api.request.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(api.request.mock.calls).toHaveLength(after);
});

it('descarta una lectura anterior tras una recarga forzada', async () => {
  let resolveOld;
  api.request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = renderHook(() => useIncidentOperations('incident-1'));
  incident.status = 'assigned';
  await act(async () => { await view.result.current.reload({ force: true }); });
  await act(async () => { resolveOld({ ...incident, status: 'reported' }); });
  expect(view.result.current.detail.status).toBe('assigned');
});

it('el historial describe creación y duplicado con sus datos pertinentes', async () => {
  history = [
    { id: 1, eventType: 'created', newValue: 'reported', createdAt: '2026-11-16T12:00:00Z' },
    { id: 2, eventType: 'duplicate.linked', newValue: 'private-id', linkedIncidentReference: 'INC-PRINCIPAL', createdAt: '2026-11-16T12:01:00Z' },
    { id: 3, eventType: 'legacy.note', createdAt: '2026-11-16T12:02:00Z' },
  ];
  renderDetail();
  await screen.findByText('Reporte principal INC-PRINCIPAL');
  const timeline = screen.getByRole('heading', { name: 'Historial' }).closest('section');
  expect(within(timeline).getByText('Reporte recibido')).toBeInTheDocument();
  expect(within(timeline).queryByText(/Dato actualizado|→/)).not.toBeInTheDocument();
  expect(within(timeline).getByText('Evento no reconocido')).toBeInTheDocument();
});
