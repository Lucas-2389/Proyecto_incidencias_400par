import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import History from '../pages/History';
import Organization from '../pages/Organization';
import Directory from '../pages/Directory';
import Dashboard from '../pages/Dashboard';

const { api, session } = vi.hoisted(() => ({ api: { request: vi.fn() }, session: { user: { roles: ['SuperAdministrador'] } } }));
vi.mock('../session', () => ({ useSession: () => ({ api, session }) }));
const districts = ['Ayacucho', 'Carmen Alto', 'San Juan Bautista', 'Jesús Nazareno', 'Andrés Avelino Cáceres Dorregaray']
  .map((name, index) => ({ id: index + 1, name }));
const event = { id: 100, action: 'directory.update', recordType: 'directory', entityName: 'Central de emergencias',
  actorName: 'María Operadora', institutionName: 'Municipalidad', siteName: 'Base central', districtName: 'Ayacucho',
  createdAt: '2026-11-17T12:00:00Z', beforeData: { phone: '066111111' }, afterData: { phone: '066222222' } };
let sites;
let users;
let contacts;
let failUser;

beforeEach(() => {
  session.user.roles = ['SuperAdministrador'];
  sites = []; users = []; contacts = [];
  failUser = false;
  api.request.mockReset().mockImplementation(async (path, options = {}) => {
    const uri = new URL(path, 'http://test');
    if (uri.pathname === '/territory/districts') return districts;
    if (uri.pathname === '/admin/institutions') return [{ id: 'institution', name: 'Municipalidad', type: 'municipalidad', active: true }];
    if (uri.pathname === '/admin/sites') {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body);
        const site = { ...body, id: 'created-site', districtName: 'Ayacucho', active: true, territoryStatus: 'resolved' };
        sites.push(site); return site;
      }
      return structuredClone(sites);
    }
    if (uri.pathname === '/admin/users') {
      if (options.method === 'POST') {
        if (failUser) throw Object.assign(new Error('Correo ya registrado'), { status: 409 });
        const { password, ...body } = JSON.parse(options.body);
        users.push({ ...body, id: 'new-user', status: 'active' });
        return users.at(-1);
      }
      return structuredClone(users);
    }
    if (uri.pathname.startsWith('/admin/directory')) {
      if (options.method) return { id: 'contact', ...JSON.parse(options.body ?? '{}') };
      return contacts;
    }
    if (uri.pathname === '/admin/audit') {
      options.onResponse?.({ headers: new Headers({ 'X-Audit-Snapshot': '100', 'X-Has-More': 'true' }) });
      return [event];
    }
    if (uri.pathname === '/ops/stats') return { total: 2, averageAssignmentMinutes: 3.5 };
    if (uri.pathname === '/ops/incidents') return Array.from({ length: 7 }, (_, index) => ({
      id: `recent-${index}`, categoryName: `Prueba reciente ${index}`, reference: `INC-${index}`, status: 'reported', priority: 'normal',
    }));
    throw new Error(`Ruta inesperada ${path}`);
  });
});
afterEach(cleanup);

it('historial muestra persona, registro, diferencias y conserva la instantánea al paginar', async () => {
  render(<MemoryRouter><History /></MemoryRouter>);
  await screen.findByText(/María Operadora/);
  fireEvent.click(screen.getByText('Ver cambio'));
  expect(screen.getByText('066111111')).toBeInTheDocument();
  expect(screen.getByText(/066222222/)).toBeInTheDocument();
  expect(screen.getByText('3.5 min')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(api.request.mock.calls.some(([path]) => path.includes('offset=25') && path.includes('snapshotId=100'))).toBe(true));
  fireEvent.change(screen.getByLabelText('Buscar en eventos'), { target: { value: 'María' } });
  await waitFor(() => expect(api.request.mock.calls.some(([path]) => path.includes('q=Mar%C3%ADa') && path.includes('offset=0') && !path.includes('snapshotId'))).toBe(true));
});

it('crear usuario se recupera sobre la sede confirmada sin crear otra sede', async () => {
  render(<MemoryRouter><Organization /></MemoryRouter>);
  await screen.findAllByRole('option', { name: 'Ayacucho' });
  fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'institution' } });
  fireEvent.change(screen.getByLabelText('Nombre de sede'), { target: { value: 'Base nueva' } });
  fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-13.16' } });
  fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-74.22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar sede' }));
  await screen.findByRole('heading', { name: /Usuarios con acceso · Base nueva/ });
  fireEvent.change(screen.getByLabelText('Nombre del usuario'), { target: { value: 'Operadora nueva' } });
  fireEvent.change(screen.getByLabelText('Correo de acceso'), { target: { value: 'nueva@example.invalid' } });
  fireEvent.change(screen.getByLabelText(/Contraseña inicial/), { target: { value: 'password-test-long' } });
  failUser = true;
  fireEvent.click(screen.getByRole('button', { name: 'Crear usuario para esta sede' }));
  await screen.findByText(/Sede creada. Usuario pendiente/);
  failUser = false;
  fireEvent.click(screen.getByRole('button', { name: 'Crear usuario para esta sede' }));
  await screen.findByText('Operadora nueva');
  expect(api.request.mock.calls.filter(([path, options]) => path === '/admin/sites' && options?.method === 'POST')).toHaveLength(1);
  const writes = api.request.mock.calls.filter(([path, options]) => path === '/admin/users' && options?.method === 'POST');
  expect(JSON.parse(writes.at(-1)[1].body)).toMatchObject({ siteId: 'created-site', institutionId: 'institution', role: 'Operador' });
});

it('contactos permiten corregir los datos publicados desde el formulario', async () => {
  contacts = [{ id: 'contact', name: 'Base local', phone: '066111111', scope: 'local', districtId: 1,
    institutionId: 'institution', districtName: 'Ayacucho', active: true }];
  render(<MemoryRouter><Directory /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar contacto' }));
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '066333333' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('Contacto actualizado.');
  expect(api.request.mock.calls.some(([path, options]) => path === '/admin/directory/contact' && options?.method === 'PATCH' && JSON.parse(options.body).phone === '066333333')).toBe(true);
});

it('una respuesta anterior no sustituye los resultados del filtro actual', async () => {
  let resolveOld;
  const original = api.request.getMockImplementation();
  api.request.mockImplementation((path, options) => {
    if (path.startsWith('/admin/audit') && !path.includes('q=')) return new Promise((resolve) => { resolveOld = resolve; });
    return original(path, options);
  });
  render(<MemoryRouter><History /></MemoryRouter>);
  await screen.findByRole('option', { name: 'Andrés Avelino Cáceres Dorregaray' });
  fireEvent.change(screen.getByLabelText('Buscar en eventos'), { target: { value: 'María' } });
  await screen.findByText(/María Operadora/);
  await act(async () => resolveOld([{ ...event, actorName: 'Respuesta anterior' }]));
  expect(screen.queryByText(/Respuesta anterior/)).not.toBeInTheDocument();
});

it('Dashboard aplica el mismo distrito a métricas y a seis incidentes recientes', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText('Prueba reciente 0');
  expect(screen.queryByText('Prueba reciente 6')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Distrito'), { target: { value: '3' } });
  await waitFor(() => {
    expect(api.request.mock.calls.some(([path]) => path.startsWith('/ops/stats?') && path.includes('districtId=3'))).toBe(true);
    expect(api.request.mock.calls.some(([path]) => path.startsWith('/ops/incidents?') && path.includes('districtId=3'))).toBe(true);
  });
});

it('el administrador institucional administra operadores desde su sede', async () => {
  session.user.roles = ['AdministradorInstitucional'];
  sites = [{ id: 'existing-site', institutionId: 'institution', name: 'Base central', districtId: 1,
    districtName: 'Ayacucho', territoryStatus: 'resolved', active: true, location: { latitude: -13.16, longitude: -74.22 } }];
  render(<MemoryRouter initialEntries={['/instituciones?siteId=existing-site']}><Organization /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Crear usuario para esta sede' });
  expect(screen.getByText('Distrito confirmado por ubicación · Activa')).toBeInTheDocument();
  expect(screen.getByLabelText('Rol').options).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Agregar institución' })).not.toBeInTheDocument();
});

it('una confirmación de usuario perdida se recupera sin duplicar el alta', async () => {
  sites = [{ id: 'existing-site', institutionId: 'institution', name: 'Base central', districtId: 1,
    active: true, location: { latitude: -13.16, longitude: -74.22 } }];
  const original = api.request.getMockImplementation();
  api.request.mockImplementation(async (path, options = {}) => {
    const result = await original(path, options);
    if (path === '/admin/users' && options.method === 'POST') throw new TypeError('Respuesta perdida');
    return result;
  });
  render(<MemoryRouter initialEntries={['/instituciones?siteId=existing-site']}><Organization /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Crear usuario para esta sede' });
  fireEvent.change(screen.getByLabelText('Nombre del usuario'), { target: { value: 'Operadora recuperada' } });
  fireEvent.change(screen.getByLabelText('Correo de acceso'), { target: { value: 'recuperada@example.invalid' } });
  fireEvent.change(screen.getByLabelText(/Contraseña inicial/), { target: { value: 'password-test-long' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear usuario para esta sede' }));
  fireEvent.click(screen.getByRole('button', { name: /Creando usuario/ }));
  await screen.findByText('Usuario creado. Se recuperó la confirmación del servidor.');
  expect(api.request.mock.calls.filter(([path, options]) => path === '/admin/users' && options?.method === 'POST')).toHaveLength(1);
});
