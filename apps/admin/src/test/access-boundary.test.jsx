import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

afterEach(() => vi.unstubAllGlobals());

it('una URL privada redirige al login sin mostrar información institucional', () => {
  const Router = ({ children }) => <MemoryRouter initialEntries={['/incidentes']}>{children}</MemoryRouter>;
  render(<App Router={Router} />);
  expect(screen.getByRole('heading', { name: 'Centro de operaciones' })).toBeInTheDocument();
  expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
});

it('una cuenta ciudadana no obtiene panel institucional por iniciar sesión', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
    accessToken: 'test-token', refreshToken: 'test-refresh', user: { name: 'Ciudadano de prueba', roles: ['Ciudadano'] },
  }) })));
  const Router = ({ children }) => <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>;
  render(<App Router={Router} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: 'citizen@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-only-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByRole('heading', { name: 'Acceso no permitido' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
});
