import { useState } from 'react';
import { useSession } from '../session';
import { queryString } from '../api/client';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, useRemote } from '../ui';
import DistrictField from '../DistrictField';

const emptyContact = { name: '', phone: '', scope: 'local', districtId: '', institutionId: '', siteId: '' };

export default function Directory() {
  const { api, session } = useSession();
  const [districtId, setDistrictId] = useState('');
  const entries = useRemote(`/admin/directory${queryString({ districtId })}`);
  const institutions = useRemote('/admin/institutions');
  const sites = useRemote('/admin/sites');
  const [values, setValues] = useState(emptyContact);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  function update(key, value) {
    setValues((current) => ({ ...current, [key]: value,
      ...(key === 'institutionId' ? { siteId: '' } : {}),
      ...(key === 'scope' ? { districtId: '', institutionId: '', siteId: '' } : {}) }));
  }
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api.request(`/admin/directory${editing ? `/${editing}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({
        name: values.name, phone: values.phone, scope: values.scope,
        districtId: values.scope === 'local' ? Number(values.districtId) : null,
        institutionId: values.scope === 'local' ? values.institutionId : null,
        siteId: values.scope === 'local' ? values.siteId || null : null,
      }) });
      setValues(emptyContact); setEditing(null); setNotice(editing ? 'Contacto actualizado.' : 'Contacto agregado.');
      await entries.reload();
    } catch (issue) { setError(issue.message); }
    finally { setSaving(false); }
  }
  async function deactivate(entry) {
    if (!window.confirm(`¿Desactivar el contacto ${entry.name}? Dejará de estar disponible en el directorio.`)) return;
    setError('');
    try { await api.request(`/admin/directory/${entry.id}`, { method: 'DELETE' }); setNotice('Contacto desactivado.'); await entries.reload(); }
    catch (issue) { setError(issue.message); }
  }
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Servicios</span><h1>Contactos de emergencia</h1><p>Publica los teléfonos nacionales y locales que la ciudadanía consulta desde la app.</p></div>
    <Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice>
    <Panel title={editing ? 'Editar contacto' : 'Agregar contacto'}>
      <form className="form-grid compact" onSubmit={submit}>
        <Field label="Nombre"><input required maxLength={150} value={values.name} onChange={(event) => update('name', event.target.value)} /></Field>
        <Field label="Teléfono"><input required type="tel" value={values.phone} onChange={(event) => update('phone', event.target.value)} /></Field>
        <Field label="Ámbito"><select value={values.scope} onChange={(event) => update('scope', event.target.value)}><option value="local">Local</option>
          {session.user.roles.includes('SuperAdministrador') && <option value="national">Nacional</option>}
        </select></Field>
        {values.scope === 'local' && <>
          <DistrictField required label="Distrito del contacto" value={values.districtId} onChange={(value) => update('districtId', value)} />
          <Field label="Institución"><select required value={values.institutionId} disabled={institutions.loading} onChange={(event) => update('institutionId', event.target.value)}><option value="">Seleccionar</option>
            {(institutions.data ?? []).map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
          </select></Field>
          <Field label="Sede (opcional)"><select value={values.siteId} disabled={sites.loading} onChange={(event) => update('siteId', event.target.value)}><option value="">Contacto institucional</option>
            {(sites.data ?? []).filter((site) => site.institutionId === values.institutionId).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select></Field>
        </>}
        <button className="button primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar contacto'}</button>
        {editing && <button type="button" className="button ghost" disabled={saving} onClick={() => { setEditing(null); setValues(emptyContact); }}>Cancelar edición</button>}
      </form>
    </Panel>
    <Panel title="Contactos publicados">
      <DistrictField value={districtId} onChange={setDistrictId} />
      <ErrorBoundaryContent loading={entries.loading} error={entries.error}>
        {entries.data?.length ? <div className="cards">{entries.data.map((entry) => <article className="mini-card" key={entry.id}>
          <strong>{entry.name}</strong><a href={`tel:${entry.phone}`}>{entry.phone}</a>
          <span>{entry.scope === 'national' ? 'Todo el país' : entry.districtName ?? 'Distrito no disponible'}</span>
          <small>{[entry.institutionName, entry.siteName, entry.active ? 'Activo' : 'Inactivo'].filter(Boolean).join(' · ')}</small>
          <div className="actions"><button className="text-button" onClick={() => { setEditing(entry.id); setValues({ name: entry.name, phone: entry.phone, scope: entry.scope,
            districtId: entry.districtId ?? '', institutionId: entry.institutionId ?? '', siteId: entry.siteId ?? '' }); }}>Editar contacto</button>
            <button className="text-button danger" disabled={!entry.active} onClick={() => deactivate(entry)}>Desactivar</button></div>
        </article>)}</div> : <Empty />}
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}
