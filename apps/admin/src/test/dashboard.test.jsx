import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

const { api } = vi.hoisted(() => ({ api: { request: vi.fn(async path => path.startsWith('/ops/stats')
  ? { total: 7, byStatus: {}, averageAssignmentMinutes: null } : []) } }));
vi.mock('../session', () => ({ useSession: () => ({ api }) }));

it('las estadísticas se cargan una vez y no reinician la consulta al renderizar', async () => {
  const view = render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByText('7');
  view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText('Cargando datos…')).not.toBeInTheDocument());
  expect(api.request.mock.calls.filter(([url]) => url.startsWith('/ops/stats'))).toHaveLength(1);
});
