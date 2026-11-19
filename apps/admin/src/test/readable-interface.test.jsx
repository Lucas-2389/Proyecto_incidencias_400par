import { expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Resources } from '../pages/Resources';
import History from '../pages/History';

const { api } = vi.hoisted(() => ({ api: { request: vi.fn() } }));
let units;
beforeEach(() => {
  units = [{ id: 'unit-1', institutionId: 'institution-1', siteId: 'site-1', code: 'AMB-01', type: 'Ambulancia', status: 'available' }];
  api.request.mockReset().mockImplementation(async (path, options) => {
  if (options?.method) {
    const body = JSON.parse(options.body || '{}');
    if (options.method === 'PATCH') units[0] = { ...units[0], ...body };
    if (options.method === 'POST') units.push({ ...body, id: 'new-unit', status: 'available' });
    if (options.method === 'DELETE') units[0].status = 'out_of_service';
    return {};
  }
  if (path === '/admin/sites') return [{ id: 'site-1', institutionId: 'institution-1', name: 'Base central' }];
  if (path === '/admin/institutions') return [{ id: 'institution-1', name: 'Municipalidad de prueba' }];
  if (path.startsWith('/resources/units')) return structuredClone(units);
  if (path.startsWith('/resources/personnel')) return [];
  if (path.startsWith('/ops/stats')) return { total: 0 };
  return [];
  });
});
vi.mock('../session', () => ({ useSession: () => ({ api }) }));

it('traduce disponibilidad y cancelar desactivación no envía una petición', async () => {
  render(<Resources kind="units" />);
  await screen.findByText('Disponible');
  expect(screen.getByRole('button', { name: 'Agregar unidad' })).toBeDisabled();
  const before = api.request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
  expect(screen.getByRole('button', { name: 'Confirmar desactivación' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
  expect(api.request.mock.calls.length).toBe(before);
});

it('edita un recurso dentro del formulario y confirma antes de desactivarlo', async () => {
  render(<Resources kind="units" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Ambulancia de soporte avanzado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/✓ Cambios guardados/);
  expect(screen.getByText('Ambulancia de soporte avanzado')).toBeInTheDocument();
  expect(api.request.mock.calls.some(([path, options]) => path === '/resources/units/unit-1' && options?.method === 'PATCH')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
  expect(api.request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }));
  await screen.findByText('Fuera de servicio');
});

it('no duplica un alta al pulsar Guardado y separa los formularios de unidades y personal', async () => {
  const view = render(<Resources kind="units" />);
  await screen.findByRole('option', { name: 'Base central' });
  fireEvent.change(screen.getByLabelText('Sede'), { target: { value: 'site-1' } });
  fireEvent.change(screen.getByLabelText(/Identificación del recurso/), { target: { value: 'AMB-02' } });
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Ambulancia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar unidad' }));
  const saved = await screen.findByRole('button', { name: /Guardado · Crear otro/ });
  fireEvent.click(saved);
  expect(api.request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  await waitFor(() => expect(screen.getByLabelText(/Identificación del recurso/)).toHaveValue(''));
  view.rerender(<Resources kind="personnel" />);
  expect(screen.getByLabelText('Sede')).toHaveValue('');
  expect(screen.getByLabelText('Nombre')).toHaveValue('');
});

it('filtra auditoría por nombres de institución sin pedir UUID al usuario', async () => {
  render(<History />);
  await screen.findByRole('option', { name: 'Municipalidad de prueba' });
  fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'institution-1' } });
  expect(screen.getByLabelText('Institución')).toHaveValue('institution-1');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByLabelText('Institución')).toHaveValue('');
});
