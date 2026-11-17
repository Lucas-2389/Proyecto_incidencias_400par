import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../session';
import { roleLabels } from '../AccountMenu';
import { ErrorBoundaryContent, Field, Notice, Panel } from '../ui';

function PasswordField({ id, label, value, onChange, error, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <Field label={label}><input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required value={value}
      onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /></Field>
    <button type="button" className="text-button" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLocaleLowerCase('es')}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button>
    {error && <span id={`${id}-error`} className="field-error">{error}</span>}
  </div>;
}

export default function Profile() {
  const { api, session, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordError, setPasswordError] = useState('');
  const [changing, setChanging] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const security = useRef(null);
  const alive = useRef(false);
  const savePending = useRef(false);
  const changePending = useRef(false);
  const userId = session.user.id;

  const isCurrent = () => alive.current && api.getSession()?.user?.id === userId;
  async function load() {
    setLoading(true);
    setReadError('');
    try {
      const result = await api.request('/auth/me');
      if (!isCurrent()) return;
      setProfile(result);
      setName(result.name);
      setPhone(result.phone ?? '');
    } catch (error) {
      if (isCurrent()) setReadError(error.message);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [api, userId]);
  useEffect(() => {
    if (profile && location.hash === '#seguridad') {
      security.current?.scrollIntoView?.({ block: 'start' });
      security.current?.focus();
    }
  }, [profile, location.hash]);

  function signOut() {
    void logout();
    navigate('/login', { replace: true });
  }
  async function save(event) {
    event.preventDefault();
    if (savePending.current) return;
    setSaved(false);
    setSaveError('');
    if (!name.trim()) { setSaveError('Escribe tu nombre completo.'); return; }
    savePending.current = true;
    setSaving(true);
    try {
      const result = await api.request('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      if (!isCurrent()) return;
      api.updateOwnProfile(result);
      setProfile((previous) => ({ ...previous, ...result }));
      setName(result.name);
      setPhone(result.phone ?? '');
      setSaved(true);
    } catch (error) {
      if (isCurrent()) setSaveError(error.message);
    } finally {
      savePending.current = false;
      if (isCurrent()) setSaving(false);
    }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (changePending.current) return;
    const errors = {};
    if (!currentPassword) errors.current = 'Escribe tu contraseña actual.';
    if (newPassword.length < 12 || newPassword.length > 128) errors.new = 'Usa entre 12 y 128 caracteres.';
    if (newPassword !== confirmation) errors.confirmation = 'Las contraseñas no coinciden.';
    setPasswordErrors(errors);
    setPasswordError('');
    setUncertain(false);
    if (Object.keys(errors).length) return;
    changePending.current = true;
    setChanging(true);
    try {
      await api.request('/auth/password/change', { method: 'POST', retryAuth: false, body: JSON.stringify({ currentPassword, newPassword }) });
      if (!isCurrent()) return;
      void logout('password-changed');
      navigate('/login', { replace: true });
    } catch (error) {
      if (!isCurrent()) return;
      if (error.code === 'INVALID_CURRENT_PASSWORD') setPasswordErrors({ current: error.message });
      else if (error.status === 401) signOut();
      else if (!error.status || error.status >= 500) {
        setUncertain(true);
        setPasswordError('No se pudo confirmar el cambio de contraseña. Vuelve a iniciar sesión para comprobar tu acceso.');
      } else setPasswordError(error.message);
    } finally {
      changePending.current = false;
      if (isCurrent()) setChanging(false);
    }
  }
  return <div className="page-stack profile-page">
    <div className="page-intro"><span className="eyebrow">Cuenta institucional</span><h1>Mi perfil</h1><p>Gestiona tus datos personales y la seguridad de tu cuenta.</p></div>
    <ErrorBoundaryContent loading={loading} error={readError}>
      {profile && <>
        <div className="profile-grid">
          <Panel title="Datos personales">
            <form className="stack" onSubmit={save}>
              <Field label="Nombre completo"><input required maxLength={150} autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} disabled={saving} aria-describedby={saveError ? 'profile-save-error' : undefined} /></Field>
              <Field label="Correo de la cuenta"><input type="email" value={profile.email} readOnly autoComplete="email" /></Field>
              <Field label="Teléfono (opcional)"><input type="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(event) => { setPhone(event.target.value); setSaved(false); }} disabled={saving} aria-describedby={saveError ? 'profile-save-error' : undefined} /></Field>
              <div id="profile-save-error"><Notice kind="error">{saveError}</Notice></div>
              <Notice kind="success">{saved ? 'Datos personales guardados.' : ''}</Notice>
              <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button>
            </form>
          </Panel>
          <Panel title="Información institucional">
            <p className="profile-roles">{(profile.roles ?? session.user.roles).map((role) => roleLabels[role] ?? role).join(' · ')}</p>
            {profile.memberships?.length ? <ul className="membership-list">{profile.memberships.map((membership) => <li key={`${membership.institutionId}-${membership.siteId}-${membership.role}`}>
              <strong>{membership.institutionName}</strong><span>{membership.siteId ? membership.siteName ?? 'Sede no disponible' : 'Todas las sedes'}</span><small>{roleLabels[membership.role] ?? membership.role}</small>
            </li>)}</ul> : <p>{(profile.roles ?? session.user.roles).includes('SuperAdministrador') ? 'Ámbito global' : 'Sin asignación institucional activa'}</p>}
          </Panel>
        </div>
        <section id="seguridad" ref={security} tabIndex={-1} className="profile-security" aria-label="Seguridad">
          <Panel title="Seguridad">
            <h3>Cambiar contraseña</h3><p>Usa entre 12 y 128 caracteres. Al confirmar el cambio, deberás iniciar sesión nuevamente en tus dispositivos.</p>
            <form className="stack" onSubmit={changePassword} noValidate>
              <fieldset className="password-fields" disabled={changing}>
                <PasswordField id="current-password" label="Contraseña actual" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} error={passwordErrors.current} />
                <PasswordField id="new-password" label="Nueva contraseña" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} error={passwordErrors.new} />
                <PasswordField id="confirm-password" label="Confirmar nueva contraseña" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} error={passwordErrors.confirmation} />
              </fieldset>
              <Notice kind="error">{passwordError}</Notice>
              <div className="profile-actions"><button className="button primary" disabled={changing || uncertain}>{changing ? 'Actualizando…' : 'Cambiar contraseña'}</button>{uncertain && <button className="button ghost" type="button" onClick={signOut}>Volver al ingreso</button>}</div>
            </form>
          </Panel>
        </section>
        <div className="profile-actions"><button className="button ghost" onClick={signOut}>Cerrar sesión</button></div>
      </>}
    </ErrorBoundaryContent>
    {readError && <button className="button ghost" onClick={load}>Reintentar lectura</button>}
  </div>;
}
