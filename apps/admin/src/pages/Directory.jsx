import { useState } from 'react';
import { useSession } from '../session';
import { Empty, Field, Notice, Panel, useRemote } from '../ui';

export default function Directory() {
  const { api } = useSession();
  const entries = useRemote('/admin/directory');
  const institutions = useRemote('/admin/institutions');
  const districts = useRemote('/territory/districts');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [scope, setScope] = useState('local');
  const [districtId, setDistrictId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    try { await api.request('/admin/directory', { method: 'POST', body: JSON.stringify({ name, phone, scope,
      districtId: scope === 'local' ? Number(districtId) : null,
      institutionId: scope === 'local' ? institutionId : null }) });
      setName(''); setPhone(''); setNotice('Contacto agregado.'); await entries.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function update(entry) {
    const value = window.prompt('Nuevo número de teléfono', entry.phone);
    if (!value || value === entry.phone) return;
    try { await api.request(`/admin/directory/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ phone: value }) }); await entries.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function deactivate(entry) {
    if (!window.confirm(`¿Desactivar el contacto ${entry.name}? Dejará de estar disponible en el directorio.`)) return;
    try { await api.request(`/admin/directory/${entry.id}`, { method: 'DELETE' }); await entries.reload(); }
    catch (issue) { setError(issue.message); }
  }
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Servicios</span><h1>Directorio de emergencias</h1><p>Contactos nacionales y locales disponibles para la ciudadanía.</p></div>
    <Panel title="Agregar contacto" eyebrow="Administración"><Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice><form className="form-grid compact" onSubmit={submit}>
      <Field label="Nombre"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Teléfono"><input required value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="Ámbito"><select value={scope} onChange={(e) => setScope(e.target.value)}><option value="local">Local</option><option value="national">Nacional</option></select></Field>
      {scope === 'local' && <><Field label="Distrito" hint="Elige el distrito donde se atiende este número."><select required value={districtId} disabled={districts.loading || !!districts.error} onChange={(e) => setDistrictId(e.target.value)}><option value="">Seleccionar distrito</option>{(districts.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Notice kind="error">{districts.error ? 'No se pudieron cargar los distritos. Actualiza la página para volver a intentarlo.' : ''}</Notice>
        <Field label="Institución"><select required value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}><option value="">Seleccionar</option>{(institutions.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></>}
      <button className="button primary">Guardar contacto</button></form></Panel>
    <Panel title="Contactos" eyebrow="Entradas activas"><div className="cards">{entries.data?.length ? entries.data.map((entry) => <article className="mini-card" key={entry.id}><strong>{entry.name}</strong><a href={`tel:${entry.phone}`}>{entry.phone}</a><small>{entry.scope === 'national' ? 'Todo el país' : (districts.data ?? []).find(item => item.id === entry.districtId)?.name ?? 'Distrito no disponible'} · {entry.active ? 'Activo' : 'Inactivo'}</small><div className="actions"><button className="text-button" onClick={() => update(entry)}>Corregir teléfono</button><button className="text-button danger" disabled={!entry.active} onClick={() => deactivate(entry)}>Desactivar</button></div></article>) : <Empty />}</div></Panel>
  </div>;
}
