import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const json = (status, value) => ({ status, ok: status >= 200 && status < 300, json: async () => value });
let role;
let profile;
let saveFailure;
let passwordFailure;
let readFailure;
let pendingSave;

beforeEach(() => {
  role = 'Operador';
  profile = { id: 'own-user', name: 'Operador de prueba', email: 'operator@example.invalid', phone: null,
    memberships: [{ institutionId: 'institution-1', institutionName: 'SAMU Ayacucho', siteId: 'site-1', siteName: 'Base Huamanga', role: 'Operador' },
      { institutionId: 'institution-2', institutionName: 'PNP Ayacucho', siteId: null, siteName: null, role: 'AdministradorInstitucional' }] };
  saveFailure = null;
  passwordFailure = null;
  readFailure = false;
  pendingSave = null;
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = new URL(url, 'http://test.invalid').pathname.replace('/api/v1', '');
    if (path === '/auth/login') return json(200, { accessToken: 'access', refreshToken: 'refresh', user: { id: profile.id, name: profile.name, roles: [role] } });
    if (path === '/auth/me' && options.method === 'PATCH') {
      if (pendingSave) return pendingSave;
      if (saveFailure) return json(422, { message: saveFailure });
      const body = JSON.parse(options.body);
      profile = { ...profile, name: body.name, phone: body.phone || null };
      return json(200, { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone });
    }
    if (path === '/auth/me') return readFailure ? json(500, { message: 'Perfil no disponible' }) : json(200, { ...profile, roles: [role] });
    if (path === '/auth/password/change') {
      if (passwordFailure === 'network') throw new TypeError('Failed to fetch');
      if (passwordFailure) return json(400, { code: 'INVALID_CURRENT_PASSWORD', message: passwordFailure });
      return json(204);
    }
    if (path === '/auth/logout') throw new TypeError('Sin conexión');
    if (path === '/notifications/mine' || path === '/ops/incidents') return json(200, []);
    if (path === '/ops/stats') return json(200, { total: 0 });
    return json(404, { message: 'Ruta no disponible' });
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function openProfile() {
  const Router = ({ children }) => <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>;
  render(<App Router={Router} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: profile.email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password-only' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  fireEvent.click(await screen.findByRole('button', { name: /Cuenta de/ }));
  fireEvent.click(screen.getByRole('link', { name: 'Mi perfil' }));
  await screen.findByLabelText('Nombre completo');
}

it.each(['Operador', 'AdministradorInstitucional', 'SuperAdministrador'])('%s guarda sus datos y cambia contraseña con nuevo ingreso', async (selectedRole) => {
  role = selectedRole;
  await openProfile();
  expect(screen.getByText('SAMU Ayacucho')).toBeInTheDocument();
  expect(screen.getByText('Base Huamanga')).toBeInTheDocument();
  expect(screen.getByText('Todas las sedes')).toBeInTheDocument();
  expect(screen.getByLabelText('Correo de la cuenta')).toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Nombre actualizado' } });
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '+51 999 111 222' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
  await screen.findByText('Datos personales guardados.');
  expect(screen.getByRole('button', { name: 'Cuenta de Nombre actualizado' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
  await waitFor(() => expect(profile.phone).toBeNull());
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'old-password' } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'new-password-123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'new-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar nueva contraseña' }));
  expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña', exact: true }));
  await screen.findByText('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: profile.email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'new-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('button', { name: 'Cuenta de Nombre actualizado' });
});

it('el menú se cierra con Escape y fuera y abre Seguridad directamente', async () => {
  await openProfile();
  const trigger = screen.getByRole('button', { name: /Cuenta de/ });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole('heading', { name: 'Mi perfil' }));
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('link', { name: 'Cambiar contraseña' }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveFocus());
});

it('conserva la edición rechazada y valida contraseña actual, longitud y confirmación', async () => {
  await openProfile();
  saveFailure = 'Teléfono inválido';
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: 'texto' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
  await screen.findByText('Teléfono inválido');
  expect(screen.getByLabelText('Teléfono (opcional)')).toHaveValue('texto');
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  expect(screen.getByText('Usa entre 12 y 128 caracteres.')).toBeInTheDocument();
  expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
  passwordFailure = 'La contraseña actual es incorrecta';
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'incorrect' } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'new-password-123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'new-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  await screen.findByText('La contraseña actual es incorrecta');
  expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('aria-invalid', 'true');
});

it('permite volver al ingreso tras una respuesta perdida sin reenviar el cambio', async () => {
  await openProfile();
  passwordFailure = 'network';
  for (const label of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'new-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  await screen.findByText(/No se pudo confirmar el cambio/);
  expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/auth/password/change'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Volver al ingreso' }));
  await screen.findByRole('button', { name: 'Ingresar' });
});

it.each([['Operador', 'Sin asignación institucional activa'], ['SuperAdministrador', 'Ámbito global']])('muestra el ámbito de %s sin membresías', async (selectedRole, label) => {
  role = selectedRole;
  profile.memberships = [];
  await openProfile();
  expect(screen.getByText(label)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cuenta de/ }));
  fireEvent.click(within(document.getElementById('account-options')).getByRole('button', { name: 'Cerrar sesión' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrar sesión' }));
  await screen.findByRole('button', { name: 'Ingresar' });
});

it('un error de lectura permite reintentar sin mostrar formulario vacío', async () => {
  readFailure = true;
  const Router = ({ children }) => <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>;
  render(<App Router={Router} />);
  fireEvent.change(screen.getByLabelText('Correo institucional'), { target: { value: profile.email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password-only' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  fireEvent.click(await screen.findByRole('button', { name: /Cuenta de/ }));
  fireEvent.click(screen.getByRole('link', { name: 'Mi perfil' }));
  await screen.findByText('Perfil no disponible');
  expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
  readFailure = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar lectura' }));
  await screen.findByLabelText('Nombre completo');
});

it('impide duplicar el guardado mientras conserva el progreso', async () => {
  await openProfile();
  let finish;
  pendingSave = new Promise((resolve) => { finish = resolve; });
  const save = screen.getByRole('button', { name: 'Guardar datos' });
  fireEvent.click(save);
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  fireEvent.submit(save.closest('form'));
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(1);
  await act(async () => finish(json(200, { ...profile, name: 'Guardado confirmado' })));
  await screen.findByText('Datos personales guardados.');
});
