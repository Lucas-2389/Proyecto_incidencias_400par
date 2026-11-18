import { useState } from 'react';
import { useSession } from '../session';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, Pill, useRemote } from '../ui';
import { unitLabels } from '../incidentLabels';

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
  const [saving, setSaving] = useState(false);
  const site = (sites.data ?? []).find((item) => item.id === siteId);
  async function create(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!site) return setError('Selecciona una sede disponible antes de guardar.');
    setSaving(true);
    try {
      await api.request(`/resources/${kind}`, { method: 'POST', body: JSON.stringify({ institutionId: site.institutionId,
        siteId, code, ...(kind === 'units' ? { type } : { name }) }) });
      setCode(''); setName(''); setType(''); setNotice(`${title} guardado.`); await records.reload();
    } catch (issue) { setError(issue.message); }
    finally { setSaving(false); }
  }
  async function deactivate(id) {
    if (!window.confirm('¿Desactivar este recurso? Dejará de estar disponible para nuevas asignaciones.')) return;
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
      <Field label="Identificación del recurso" hint={kind === 'units' ? 'Usa la placa o un nombre interno, por ejemplo: Ambulancia 01.' : 'Usa el código de personal de tu institución.'}><input required placeholder={kind === 'units' ? 'Ej. Ambulancia 01' : 'Ej. Personal 01'} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      {kind === 'units' ? <Field label="Tipo"><input required value={type} onChange={(e) => setType(e.target.value)} /></Field>
        : <Field label="Nombre"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>}
      <button className="button primary" disabled={saving || sites.loading || !site}>{saving ? 'Guardando…' : kind === 'units' ? 'Agregar unidad' : 'Agregar persona'}</button></form>
    <ErrorBoundaryContent error={records.error} loading={records.loading}>{records.data?.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>{kind === 'units' ? 'Tipo' : 'Nombre'}</th><th>Sede</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {records.data.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{kind === 'units' ? item.type : item.name}</td><td>{(sites.data ?? []).find((entry) => entry.id === item.siteId)?.name ?? 'Sede no disponible'}</td><td><Pill>{kind === 'units' ? unitLabels[item.status] ?? 'Estado por confirmar' : item.active ? 'Activo' : 'Inactivo'}</Pill></td><td><button className="text-button" onClick={() => edit(item)}>Editar</button> <button className="text-button danger" disabled={item.active === false || item.status === 'inactive'} onClick={() => deactivate(item.id)}>Desactivar</button></td></tr>)}
    </tbody></table></div> : <Empty />}</ErrorBoundaryContent></Panel>;
}

export function Resources({ kind }) { return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Administración</span><h1>{kind === 'units' ? 'Unidades' : 'Personal'}</h1><p>Recursos disponibles en tu institución y sede.</p></div><ResourceTable kind={kind} title={kind === 'units' ? 'Flota institucional' : 'Personal de atención'} /></div>; }

export { default as Organization } from './Organization';
