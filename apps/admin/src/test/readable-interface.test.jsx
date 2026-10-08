import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Resources } from '../pages/Resources';
import History from '../pages/History';

const { api } = vi.hoisted(() => ({ api: { request: vi.fn(async path => {
  if (path === '/admin/sites') return [{ id: 'site-1', institutionId: 'institution-1', name: 'Base central' }];
  if (path === '/admin/institutions') return [{ id: 'institution-1', name: 'Municipalidad de prueba' }];
  if (path.startsWith('/resources/')) return [{ id: 'unit-1', siteId: 'site-1', code: 'AMB-01', type: 'Ambulancia', status: 'available' }];
  if (path.startsWith('/ops/stats')) return { total: 0 };
  return [];
}) } }));
vi.mock('../session', () => ({ useSession: () => ({ api }) }));

it('traduce disponibilidad y cancelar desactivación no envía una petición', async () => {
  render(<Resources kind="units" />);
  await screen.findByText('Disponible');
  expect(screen.getByRole('button', { name: 'Agregar unidad' })).toBeDisabled();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const before = api.request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
  expect(confirm).toHaveBeenCalled();
  expect(api.request.mock.calls.length).toBe(before);
  confirm.mockRestore();
});

it('filtra auditoría por nombres de institución sin pedir UUID al usuario', async () => {
  render(<History />);
  await screen.findByRole('option', { name: 'Municipalidad de prueba' });
  fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'institution-1' } });
  expect(screen.getByLabelText('Institución')).toHaveValue('institution-1');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByLabelText('Institución')).toHaveValue('');
});
