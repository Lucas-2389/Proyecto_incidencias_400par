import { useState } from 'react';
import { useSession } from '../session';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, Pill, useRemote } from '../ui';

function ResourceTable({ kind, title }) {
  const { api } = useSession();
  const records = useRemote(`/resources/${kind}`);
  const sites = useRemote('/admin/sites');
  const [siteId, setSiteId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const site = (sites.data ?? []).find((item) => item.id === siteId);
  async function create(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      await api.request(`/resources/${kind}`, { method: 'POST', body: JSON.stringify({ institutionId: site.institutionId,
        siteId, code, ...(kind === 'units' ? { type } : { name }) }) });
      setCode(''); setName(''); setType(''); setNotice(`${title} guardado.`); await records.reload();
    } catch (issue) { setError(issue.message); }
  }
  async function deactivate(id) {
    setError(''); setNotice('');
    try { await api.request(`/resources/${kind}/${id}`, { method: 'DELETE' }); setNotice('Registro desactivado.'); await records.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function edit(item) {
    const value = window.prompt(kind === 'units' ? 'Nuevo tipo de unidad' : 'Nuevo nombre', kind === 'units' ? item.type : item.name);
    if (!value || value.trim() === (kind === 'units' ? item.type : item.name)) return;
    try { await api.request(`/resources/${kind}/${item.id}`, { method: 'PATCH', body: JSON.stringify(kind === 'units' ? { type: value.trim() } : { name: value.trim() }) }); await records.reload(); }
    catch (issue) { setError(issue.message); }
  }
  return <Panel title={title} eyebrow="Recursos institucionales"><Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice>
    <form className="form-grid compact" onSubmit={create}><Field label="Sede"><select required value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Seleccionar</option>{(sites.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Código"><input required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      {kind === 'units' ? <Field label="Tipo"><input required value={type} onChange={(e) => setType(e.target.value)} /></Field>
        : <Field label="Nombre"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>}
      <button className="button primary">Agregar</button></form>
    <ErrorBoundaryContent error={records.error} loading={records.loading}>{records.data?.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>{kind === 'units' ? 'Tipo' : 'Nombre'}</th><th>Sede</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {records.data.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{kind === 'units' ? item.type : item.name}</td><td>{(sites.data ?? []).find((entry) => entry.id === item.siteId)?.name ?? '—'}</td><td><Pill>{kind === 'units' ? item.status : item.active ? 'activo' : 'inactivo'}</Pill></td><td><button className="text-button" onClick={() => edit(item)}>Editar</button> <button className="text-button danger" onClick={() => deactivate(item.id)}>Desactivar</button></td></tr>)}
    </tbody></table></div> : <Empty />}</ErrorBoundaryContent></Panel>;
}

export function Resources({ kind }) { return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Administración</span><h1>{kind === 'units' ? 'Unidades' : 'Personal'}</h1><p>Recursos disponibles en tu institución y sede.</p></div><ResourceTable kind={kind} title={kind === 'units' ? 'Flota institucional' : 'Personal de atención'} /></div>; }

export function Organization() {
  const { api, session } = useSession();
  const institutions = useRemote('/admin/institutions');
  const sites = useRemote('/admin/sites');
  const [name, setName] = useState('');
  const [type, setType] = useState('pnp');
  const [institutionId, setInstitutionId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState('');
  async function createInstitution(event) {
    event.preventDefault(); setError('');
    try { await api.request('/admin/institutions', { method: 'POST', body: JSON.stringify({ name, type }) }); setName(''); await institutions.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function renameInstitution(item) {
    const value = window.prompt('Nuevo nombre de institución', item.name);
    if (!value || value === item.name) return;
    try { await api.request(`/admin/institutions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: value }) }); await institutions.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function createSite(event) {
    event.preventDefault(); setError('');
    try { await api.request('/admin/sites', { method: 'POST', body: JSON.stringify({ institutionId, name: siteName,
      location: { latitude: Number(latitude), longitude: Number(longitude) } }) }); setSiteName(''); await sites.reload(); }
    catch (issue) { setError(issue.message); }
  }
  async function renameSite(item) {
    const value = window.prompt('Nuevo nombre de sede', item.name);
    if (!value || value === item.name) return;
    try { await api.request(`/admin/sites/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: value }) }); await sites.reload(); }
    catch (issue) { setError(issue.message); }
  }
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Organización</span><h1>Instituciones y sedes</h1><p>Consulta el ámbito institucional configurado.</p></div>
    <Notice kind="error">{error}</Notice>
    <Panel title="Instituciones" eyebrow="Ámbito"><div className="cards">{(institutions.data ?? []).map((item) => <div className="mini-card" key={item.id}><strong>{item.name}</strong><small>{item.type} · {item.active ? 'Activa' : 'Inactiva'}</small>{session?.user?.roles?.includes('SuperAdministrador') && <button className="text-button" onClick={() => renameInstitution(item)}>Editar nombre</button>}</div>)}</div>
      {session?.user?.roles?.includes('SuperAdministrador') && <form className="form-grid compact" onSubmit={createInstitution}><Field label="Nombre"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value)}>{['pnp', 'samu', 'bomberos', 'municipalidad', 'otra'].map((value) => <option key={value}>{value}</option>)}</select></Field><button className="button primary">Agregar institución</button></form>}</Panel>
    <Panel title="Sedes" eyebrow="Cobertura"><div className="cards">{(sites.data ?? []).map((item) => <div className="mini-card" key={item.id}><strong>{item.name}</strong><small>{item.location.latitude}, {item.location.longitude}</small><button className="text-button" onClick={() => renameSite(item)}>Editar nombre</button></div>)}</div>
      <form className="form-grid compact" onSubmit={createSite}><Field label="Institución"><select required value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}><option value="">Seleccionar</option>{(institutions.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Nombre de sede"><input required value={siteName} onChange={(e) => setSiteName(e.target.value)} /></Field><Field label="Latitud"><input required type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></Field><Field label="Longitud"><input required type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></Field><button className="button primary">Agregar sede</button></form></Panel>
  </div>;
}
