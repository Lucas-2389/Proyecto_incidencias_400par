import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const site = { id: 'site-1', institutionId: 'institution-1', name: 'DEMO Bomberos Ayacucho', location: { latitude: -13.16, longitude: -74.22 } };
const siteTwo = { id: 'site-2', institutionId: 'institution-2', name: 'DEMO SAMU Ayacucho', location: { latitude: -13.16, longitude: -74.22 } };
const incident = { id: 'incident-1', reference: 'DEMO-AY-001', status: 'reported', categoryId: 1,
  description: 'Incendio ficticio', source: 'PHONE', callerContact: '999 111 222',
  location: { latitude: -13.16, longitude: -74.22, reference: 'Mercado central' } };

function json(status, value) { return { status, ok: status >= 200 && status < 300, json: async () => value }; }

let assignment;
let assignmentList;
let state;
let notifications;
beforeEach(() => {
  assignment = null;
  assignmentList = [];
  state = 'reported';
  notifications = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = new URL(url, 'http://test.invalid').pathname.replace('/api/v1', '');
    if (path === '/auth/login') {
      const email = JSON.parse(options.body).email;
      const role = email.startsWith('super') ? 'SuperAdministrador' : email.startsWith('admin') ? 'AdministradorInstitucional' : 'Operador';
      return json(200, { accessToken: 'access', refreshToken: 'refresh', user: { id: 'operator-1', name: 'Operador DEMO', roles: [role] } });
    }
    if (path === '/ops/incidents' && !options.method) return json(200, [{ ...incident, status: state, priority: 'high' }]);
    if (path === '/notifications/mine') return json(200, [...notifications]);
    if (path === '/notifications/notice-1/read' && options.method === 'PATCH') {
      notifications = [];
      return json(200, { id: 'notice-1', readAt: new Date().toISOString() });
    }
    if (path === '/incidents/incident-1') return json(200, { ...incident, status: state });
    if (path === '/ops/incidents/incident-1/suggestions') return json(200, { suggestions: [site, siteTwo].map((item) => ({ siteId: item.id, siteName: item.name, institutionId: item.institutionId,
      institutionName: item.name, reason: 'Regla DEMO', institutionType: 'bomberos' })), exception: false });
    if (path === '/ops/incidents/incident-1/assignments' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assignment = { id: `assignment-${assignmentList.length + 1}`, incidentId: incident.id, ...body, status: 'assigned', assignedAt: new Date().toISOString() };
      assignmentList.push(assignment);
      state = 'assigned';
      return json(201, assignment);
    }
    if (path === '/ops/incidents/incident-1/assignments') return json(200, [...assignmentList]);
    if (path === '/ops/incidents/incident-1/status' && options.method === 'PATCH') {
      state = JSON.parse(options.body).status;
      assignmentList.find((item) => item.id === JSON.parse(options.body).assignmentId).status = state;
      return json(200, { id: incident.id, status: state });
    }
    if (path === '/ops/incidents/incident-1/history') return json(200, []);
    if (path === '/admin/sites') return json(200, [site, siteTwo]);
    if (path === '/admin/institutions') return json(200, [site, siteTwo].map((item) => ({ id: item.institutionId, name: item.name })));
    if (path === '/resources/units' || path === '/resources/personnel' || path === '/admin/users') return json(200, []);
    if (path === '/catalog/categories') return json(200, [{ id: 1, name: 'Incendio' }]);
    if (path === '/ops/stats') return json(200, { total: 1, byStatus: { reported: 1 }, averageAssignmentMinutes: null });
    return json(404, { message: `Ruta desconocida: ${path}` });
  }));
});

it('el panel muestra avisos y el contacto solo en el detalle autorizado', async () => {
  notifications = [{ id: 'notice-1', incidentId: incident.id, title: 'Nuevo reporte',
    message: 'El reporte DEMO-AY-001 requiere revisión.', createdAt: new Date().toISOString() }];
  render(<App Router={MemoryRouter} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'operator@demo.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos: 1 sin leer' }));
  fireEvent.click(screen.getByRole('button', { name: /Nuevo reporte/ }));
  await screen.findByRole('heading', { name: 'DEMO-AY-001' });
  expect(screen.getByRole('link', { name: /999 111 222.*Llamar/ })).toHaveAttribute('href', 'tel:999111222');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Avisos: 0 sin leer' })).toBeInTheDocument());
});
afterEach(() => { vi.unstubAllGlobals(); });

it('dashboard conserva el intervalo de consulta tras recibir estadísticas', async () => {
  render(<App Router={MemoryRouter} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'operator@demo.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByText('Promedio del ámbito');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const statsCalls = fetch.mock.calls.filter(([url]) => new URL(url, 'http://test.invalid').pathname.endsWith('/ops/stats'));
  expect(statsCalls.length).toBeLessThanOrEqual(2);
});

it('administrador institucional ve la bandeja sin la acción de registrar llamada', async () => {
  render(<App Router={MemoryRouter} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'admin@demo.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: 'Dashboard operativo' });
  fireEvent.click(screen.getByRole('link', { name: /Incidentes/ }));
  await screen.findByRole('heading', { name: 'Bandeja de incidentes' });
  expect(screen.queryByRole('button', { name: /Registrar llamada/ })).not.toBeInTheDocument();
});

it('operador hace login, abre bandeja, asigna sede y avanza estado sin ver administración', async () => {
  render(<App Router={MemoryRouter} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'operator@demo.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: 'Dashboard operativo' });
  expect(screen.queryByRole('link', { name: /Personal/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /Incidentes/ }));
  await screen.findByText('DEMO-AY-001');
  fireEvent.click(screen.getByRole('link', { name: 'Abrir →' }));
  await screen.findByRole('heading', { name: 'Derivación sugerida' });
  fireEvent.change(screen.getByLabelText('Sede responsable'), { target: { value: site.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await waitFor(() => expect(assignment?.siteId).toBe(site.id));
  const statusButton = await screen.findByRole('button', { name: 'Pasar a Unidad en camino' });
  fireEvent.click(statusButton);
  await waitFor(() => expect(state).toBe('en_route'));
  expect(screen.getByText('Cambio guardado.')).toBeInTheDocument();
});

it('superadministrador confirma dos instituciones sobre el mismo accidente', async () => {
  render(<App Router={MemoryRouter} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'super@demo.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: 'Dashboard operativo' });
  fireEvent.click(screen.getByRole('link', { name: /Incidentes/ }));
  await screen.findByText('DEMO-AY-001');
  fireEvent.click(screen.getByRole('link', { name: 'Abrir →' }));
  await screen.findByRole('heading', { name: 'Derivación sugerida' });
  fireEvent.change(screen.getByLabelText('Sede responsable'), { target: { value: site.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await waitFor(() => expect(assignmentList).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Sede responsable'), { target: { value: siteTwo.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }));
  await waitFor(() => expect(assignmentList).toHaveLength(2));
  expect(assignmentList.map((item) => item.institutionId)).toEqual([site.institutionId, siteTwo.institutionId]);
});
