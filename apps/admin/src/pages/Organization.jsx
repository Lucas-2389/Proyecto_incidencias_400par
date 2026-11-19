import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../session';
import { queryString } from '../api/client';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, Pill, useRemote } from '../ui';
import { institutionLabels } from '../incidentLabels';
import DistrictField from '../DistrictField';
const LocationPicker = lazy(() => import('../LocationPicker'));

const territorialLabels = { pending: 'Distrito pendiente', resolved: 'Distrito confirmado por ubicación',
  outside_coverage: 'Ubicación fuera de los límites cargados', boundary: 'En límite compartido',
  overlap: 'Ubicación en solapamiento', district_mismatch: 'Revisar distrito y ubicación' };

function SiteForm({ site, institutions, onSaved }) {
  const { api } = useSession();
  const [values, setValues] = useState({ institutionId: site?.institutionId ?? '', name: site?.name ?? '',
    districtId: site?.districtId ?? '', address: site?.address ?? '', contactPhone: site?.contactPhone ?? '',
    latitude: site?.location?.latitude ?? '', longitude: site?.location?.longitude ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (values.latitude === '' || values.longitude === '' || !Number.isFinite(Number(values.latitude)) || !Number.isFinite(Number(values.longitude))) {
      setError('Selecciona la ubicación de la sede en el mapa o completa sus coordenadas.');
      return;
    }
    setSaving(true); setError('');
    try {
      const result = await api.request(`/admin/sites${site ? `/${site.id}` : ''}`, { method: site ? 'PATCH' : 'POST', body: JSON.stringify({
        institutionId: values.institutionId, name: values.name, address: values.address || null, contactPhone: values.contactPhone || null,
        districtId: values.districtId ? Number(values.districtId) : null,
        location: { latitude: Number(values.latitude), longitude: Number(values.longitude) },
      }) });
      await onSaved(result);
      if (!site) setValues((current) => ({ ...current, name: '', address: '', contactPhone: '', latitude: '', longitude: '' }));
    } catch (issue) { setError(issue.message); }
    finally { setSaving(false); }
  }
  return <form className="form-grid compact" onSubmit={save}>
    <Notice kind="error">{error}</Notice>
    <Field label="Institución"><select required disabled={Boolean(site)} value={values.institutionId} onChange={(event) => update('institutionId', event.target.value)}><option value="">Seleccionar</option>
      {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
    </select></Field>
    <Field label="Nombre de sede"><input required maxLength={200} value={values.name} onChange={(event) => update('name', event.target.value)} /></Field>
    <DistrictField value={values.districtId} onChange={(value) => update('districtId', value)} emptyLabel="Detectar por ubicación" />
    <Field label="Dirección"><input value={values.address} onChange={(event) => update('address', event.target.value)} /></Field>
    <Field label="Teléfono de sede"><input type="tel" value={values.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} /></Field>
    <div className="site-location-picker"><button type="button" className="button secondary" onClick={() => setShowMap(!showMap)}>{showMap ? 'Ocultar mapa de ubicación' : 'Elegir ubicación de la sede en el mapa'}</button>
      <p>{values.latitude !== '' && values.longitude !== '' ? 'Punto seleccionado. Puedes ajustarlo antes de guardar.' : 'Selecciona el edificio de la sede. Este punto no cambia su jurisdicción.'}</p>
      {showMap && <Suspense fallback={<p>Cargando selector de ubicación…</p>}><LocationPicker latitude={values.latitude} longitude={values.longitude} onPick={(latitude, longitude) => setValues(current => ({ ...current, latitude, longitude }))} /></Suspense>}
      <details><summary>Coordenadas (opcional para ingreso manual)</summary>
        <Field label="Latitud"><input type="number" step="any" min="-90" max="90" value={values.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field>
        <Field label="Longitud"><input type="number" step="any" min="-180" max="180" value={values.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field>
      </details>
    </div>
    <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : site ? 'Guardar sede' : 'Agregar sede'}</button>
  </form>;
}

function UserRow({ user, onSaved }) {
  const { api, session } = useSession();
  const [name, setName] = useState(user.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const canEdit = session.user.roles.includes('SuperAdministrador') || user.role === 'Operador';
  async function update(body) {
    if (pending) return;
    setPending(true); setError('');
    try { await api.request(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(body) }); await onSaved(); }
    catch (issue) { setError(issue.message); }
    finally { setPending(false); }
  }
  return <article className="mini-card">
    <strong>{user.name}</strong><span>{user.email}</span><small>{user.role === 'Operador' ? 'Operador' : 'Administrador institucional'} · {user.siteName}</small>
    <Pill>{user.status === 'active' ? 'Activo' : 'Inactivo'}</Pill>
    {canEdit && <><form onSubmit={(event) => { event.preventDefault(); update({ name }); }}><Field label={`Nombre de ${user.name}`}><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <button className="text-button" disabled={pending || name === user.name}>Guardar nombre</button></form>
      <button className="text-button" disabled={pending} onClick={() => update({ status: user.status === 'active' ? 'inactive' : 'active' })}>{user.status === 'active' ? 'Desactivar acceso' : 'Activar acceso'}</button></>}
    <Notice kind="error">{error}</Notice>
  </article>;
}

function SiteUsers({ site, createdNow }) {
  const { api, session } = useSession();
  const users = useRemote(`/admin/users${queryString({ institutionId: site.institutionId, siteId: site.id })}`);
  const [values, setValues] = useState({ name: '', email: '', password: '', role: 'Operador' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  async function create(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    const knownEmails = new Set((users.data ?? []).map((user) => user.email));
    try {
      await api.request('/admin/users', { method: 'POST', body: JSON.stringify({ ...values, institutionId: site.institutionId, siteId: site.id }) });
      setValues({ name: '', email: '', password: '', role: 'Operador' });
      setNotice('Usuario creado. Ya puede iniciar sesión con su correo y contraseña.');
      await users.reload();
    } catch (issue) {
      let recovered = false;
      if (!issue.status) {
        try {
          const current = await api.request(`/admin/users${queryString({ siteId: site.id })}`);
          recovered = current.some((user) => user.email === values.email.trim().toLowerCase() && !knownEmails.has(user.email) && user.name === values.name.trim() && user.role === values.role);
        } catch { recovered = false; }
      }
      if (recovered) { setValues({ name: '', email: '', password: '', role: 'Operador' }); setNotice('Usuario creado. Se recuperó la confirmación del servidor.'); await users.reload(); }
      else setError(`${createdNow ? 'Sede creada. Usuario pendiente. ' : ''}${issue.message}`);
    } finally { setSaving(false); }
  }
  return <Panel title={`Usuarios con acceso · ${site.name}`}>
    <Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice>
    <ErrorBoundaryContent loading={users.loading} error={users.error}>{users.data?.length ? <div className="cards">{users.data.map((user) => <UserRow key={`${user.id}-${user.role}`} user={user} onSaved={users.reload} />)}</div> : <Empty>Esta sede todavía no tiene usuarios con acceso.</Empty>}</ErrorBoundaryContent>
    <form className="form-grid compact" onSubmit={create}>
      <Field label="Nombre del usuario"><input required maxLength={150} value={values.name} onChange={(event) => update('name', event.target.value)} /></Field>
      <Field label="Correo de acceso"><input required type="email" value={values.email} onChange={(event) => update('email', event.target.value)} /></Field>
      <Field label="Contraseña inicial" hint="Entre 12 y 128 caracteres."><input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={values.password} onChange={(event) => update('password', event.target.value)} /></Field>
      <Field label="Rol"><select value={values.role} onChange={(event) => update('role', event.target.value)}><option value="Operador">Operador</option>
        {session.user.roles.includes('SuperAdministrador') && <option value="AdministradorInstitucional">Administrador institucional</option>}
      </select></Field>
      <button className="button primary" disabled={saving || site.active === false}>{saving ? 'Creando usuario…' : 'Crear usuario para esta sede'}</button>
    </form>
  </Panel>;
}

export default function Organization() {
  const { api, session } = useSession();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('siteId') ?? '');
  const [createdId, setCreatedId] = useState('');
  const [createdSite, setCreatedSite] = useState(null);
  const [districtId, setDistrictId] = useState('');
  const institutions = useRemote('/admin/institutions');
  const sites = useRemote(`/admin/sites${queryString({ districtId })}`);
  const [name, setName] = useState('');
  const [type, setType] = useState('pnp');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState(null);
  const [institutionName, setInstitutionName] = useState('');
  const selected = (sites.data ?? []).find((site) => site.id === selectedId) ?? (createdSite?.id === selectedId ? createdSite : null);
  async function createInstitution(event) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try { await api.request('/admin/institutions', { method: 'POST', body: JSON.stringify({ name, type }) }); setName(''); setNotice('Institución creada correctamente. Ahora puedes agregar su sede.'); await institutions.reload(); }
    catch (issue) { setError(issue.message); }
    finally { setSaving(false); }
  }
  async function rename(event) {
    event.preventDefault();
    if (saving || !editingInstitution) return;
    setSaving(true); setError('');
    try { await api.request(`/admin/institutions/${editingInstitution}`, { method: 'PATCH', body: JSON.stringify({ name: institutionName }) }); setEditingInstitution(null); setNotice('Nombre de institución actualizado.'); await institutions.reload(); }
    catch (issue) { setError(issue.message); }
    finally { setSaving(false); }
  }
  async function siteSaved(site) {
    setDistrictId(''); setCreatedId(site.id); setSelectedId(site.id);
    setCreatedSite(site);
    setNotice('Sede creada. Puedes crear su usuario de acceso.');
    await sites.reload();
  }
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Organización</span><h1>Instituciones y sedes</h1><p>Administra las sedes y las cuentas individuales de su personal.</p></div>
    <Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice>
    <DistrictField value={districtId} onChange={(value) => { setDistrictId(value); setSelectedId(''); }} />
    <ErrorBoundaryContent loading={(institutions.loading && !institutions.data) || (sites.loading && !sites.data)} error={institutions.error || sites.error}>
      {(institutions.data ?? []).map((institution) => <Panel key={institution.id} title={institution.name} action={session.user.roles.includes('SuperAdministrador') && <button className="text-button" onClick={() => { setEditingInstitution(institution.id); setInstitutionName(institution.name); }}>Editar nombre</button>}>
        {editingInstitution === institution.id && <form className="form-grid compact" onSubmit={rename} aria-label="Editar institución">
          <Field label="Nuevo nombre de institución"><input required maxLength={200} value={institutionName} onChange={event => setInstitutionName(event.target.value)} /></Field>
          <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar nombre de institución'}</button>
          <button type="button" className="button ghost" disabled={saving} onClick={() => setEditingInstitution(null)}>Cancelar edición de institución</button>
        </form>}
        <p>{institutionLabels[institution.type] ?? institution.type} · {institution.active ? 'Activa' : 'Inactiva'}</p>
        <div className="cards">{(sites.data ?? []).filter((site) => site.institutionId === institution.id).map((site) => <article className="mini-card" key={site.id}>
          <strong>{site.name}</strong><span>{site.districtName || 'Distrito pendiente'}</span>
          <small>{territorialLabels[site.territoryStatus] ?? 'Distrito pendiente'} · {site.active ? 'Activa' : 'Inactiva'}</small>
          <button className="button secondary" onClick={() => setSelectedId(site.id)}>Usuarios con acceso</button>
          <details><summary>Editar sede</summary><SiteForm site={site} institutions={institutions.data ?? []} onSaved={async () => { setNotice('Sede actualizada.'); await sites.reload(); }} /></details>
        </article>)}</div>
      </Panel>)}
    </ErrorBoundaryContent>
    {selected && <SiteUsers key={selected.id} site={selected} createdNow={createdId === selected.id} />}
    <Panel title="Agregar sede"><SiteForm institutions={institutions.data ?? []} onSaved={siteSaved} /></Panel>
    {session.user.roles.includes('SuperAdministrador') && <Panel title="Agregar institución"><form className="form-grid compact" onSubmit={createInstitution}>
      <Field label="Nombre de institución"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Tipo de institución"><select value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(institutionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <button className="button primary" disabled={saving}>Agregar institución</button>
    </form></Panel>}
  </div>;
}
