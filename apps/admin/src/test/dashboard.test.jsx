import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

const { api } = vi.hoisted(() => ({ api: { request: vi.fn(async path => path.startsWith('/ops/stats')
  ? { total: 7, byStatus: {}, averageAssignmentMinutes: null } : []) } }));
vi.mock('../session', () => ({ useSession: () => ({ api }) }));

beforeEach(() => {
  api.request.mockReset().mockImplementation(async path => path.startsWith('/ops/stats')
    ? { total: 7, byStatus: {}, averageAssignmentMinutes: null } : []);
});

it('las estadísticas se cargan una vez y no reinician la consulta al renderizar', async () => {
  const view = render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText('7');
  view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText('Cargando datos…')).not.toBeInTheDocument());
  expect(api.request.mock.calls.filter(([url]) => url.startsWith('/ops/stats'))).toHaveLength(1);
});

it('muestra seis enlaces completos con categoría, referencia y prioridades consistentes', async () => {
  api.request.mockImplementation(async path => path.startsWith('/ops/stats') ? {} :
    ['low', 'normal', 'high', 'critical', null, 'unexpected', 'high'].map((priority, index) => ({
      id: `report-${index}`, reference: `REF-${index}`, categoryName: index === 4 ? null : 'Accidente de tránsito', status: 'reported', priority,
    })));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  const links = await screen.findAllByRole('link', { name: /REF-/ });
  expect(links).toHaveLength(6);
  expect(links[0]).toHaveAttribute('href', '/incidentes/report-0');
  for (const priority of ['low', 'normal', 'high', 'critical']) expect(document.querySelector(`.priority-badge--${priority}`)).toBeInTheDocument();
  expect(screen.getAllByText('Por confirmar')).toHaveLength(2);
  expect(screen.getByText('Categoría no disponible')).toBeInTheDocument();
  expect(screen.queryByText(/Ver reporte/)).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Acción' })).not.toBeInTheDocument();
});

it('distingue vacío de un fallo de lectura', async () => {
  const view = render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText('No hay incidentes recientes.');
  view.unmount();
  api.request.mockImplementation(async path => {
    if (path.startsWith('/ops/stats')) return {};
    throw new Error('Consulta no disponible');
  });
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText('Consulta no disponible');
  expect(screen.queryByText('No hay incidentes recientes.')).not.toBeInTheDocument();
});

it('el clic en el estado dentro del bloque abre el detalle', async () => {
  api.request.mockImplementation(async path => path.startsWith('/ops/stats') ? {} : [{ id: 'own-incident', reference: 'REF-1', categoryName: 'Incendio', status: 'reported', priority: 'high' }]);
  render(<MemoryRouter><Routes><Route path="/" element={<Dashboard />} /><Route path="/incidentes/own-incident" element={<h1>Detalle del incidente seleccionado</h1>} /></Routes></MemoryRouter>);
  const link = await screen.findByRole('link', { name: /Incendio.*REF-1/ });
  link.focus();
  expect(link).toHaveFocus();
  fireEvent.click(link.querySelector('.pill'));
  await screen.findByRole('heading', { name: 'Detalle del incidente seleccionado' });
});
