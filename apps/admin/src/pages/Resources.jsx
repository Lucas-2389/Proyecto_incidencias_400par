import { useEffect, useRef, useState } from 'react';
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
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const actionPending = useRef(false);
  useEffect(() => { const timer = setInterval(() => records.reload(), 15000); return () => clearInterval(timer); }, [records.reload]);
  const site = (sites.data ?? []).find((item) => item.id === siteId);
  async function create(event) {
    event.preventDefault(); if (actionPending.current) return; if (!editing && notice.startsWith('✓')) { setCode(''); setName(''); setType(''); setNotice(''); return; } setError(''); setNotice('');
    if (!site) return setError('Selecciona una sede disponible antes de guardar.');
    actionPending.current = true; setSaving(true);
    try {
      await api.request(`/resources/${kind}${editing ? `/${editing}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ institutionId: site.institutionId,
        siteId, code, ...(kind === 'units' ? { type } : { name }) }) });
      setEditing(null); setNotice('✓ Cambios guardados correctamente. Puedes seguir trabajando.'); await records.reload();
    } catch (issue) { setError(issue.message); }
    finally { actionPending.current = false; setSaving(false); }
  }
  async function deactivate(id) {
    if (actionPending.current) return;
    actionPending.current = true; setSaving(true);
    setError(''); setNotice('');
    try { await api.request(`/resources/${kind}/${id}`, { method: 'DELETE' }); setDeleting(null); setNotice('✓ Registro desactivado.'); await records.reload(); }
    catch (issue) { setError(issue.message); }
    finally { actionPending.current = false; setSaving(false); }
  }
  function edit(item) {
    setDeleting(null);
    setEditing(item.id); setSiteId(item.siteId); setCode(item.code); setType(item.type ?? ''); setName(item.name ?? ''); setError(''); setNotice('Editando el registro: modifica los campos y pulsa Guardar cambios.');
  }
  return <Panel title={title} eyebrow="Recursos institucionales"><Notice kind="error">{error}</Notice><Notice kind="success">{notice}</Notice>
    <Notice kind="error">{records.data ? records.error : ''}</Notice>
    <form className="form-grid compact" onChange={() => setNotice('')} onSubmit={create}><Field label="Sede"><select required value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Seleccionar</option>{(sites.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Identificación del recurso" hint={kind === 'units' ? 'Usa la placa o un nombre interno, por ejemplo: Ambulancia 01.' : 'Usa el código de personal de tu institución.'}><input required placeholder={kind === 'units' ? 'Ej. Ambulancia 01' : 'Ej. Personal 01'} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      {kind === 'units' ? <Field label="Tipo"><input required value={type} onChange={(e) => setType(e.target.value)} /></Field>
        : <Field label="Nombre"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>}
      <button className={`button ${notice.startsWith('✓') ? 'saved' : 'primary'}`} disabled={saving || sites.loading || !site}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : notice.startsWith('✓') ? '✓ Guardado · Crear otro' : kind === 'units' ? 'Agregar unidad' : 'Agregar persona'}</button>
      <button type="button" className="button ghost" onClick={() => { setEditing(null); setCode(''); setName(''); setType(''); setNotice('Formulario listo para un nuevo registro.'); }}>Nuevo / cancelar edición</button></form>
    {deleting && <Notice kind="warn">¿Desactivar este recurso? Dejará de estar disponible para nuevas asignaciones. <button className="button danger" disabled={saving} onClick={() => deactivate(deleting)}>Confirmar desactivación</button> <button className="button ghost" disabled={saving} onClick={() => setDeleting(null)}>Cancelar</button></Notice>}
    <div className="notice info" role="status">{kind === 'units' ? `${(records.data ?? []).filter(item => item.status === 'available').length} disponibles · ${(records.data ?? []).filter(item => ['assigned', 'en_route', 'attending', 'returning'].includes(item.status)).length} en servicio · ${(records.data ?? []).length} unidades en tu ámbito` : `${(records.data ?? []).filter(item => item.active).length} personas activas`} · Actualización cada 15 segundos <button type="button" className="text-button" onClick={() => records.reload()}>Actualizar ahora</button></div><ErrorBoundaryContent error={!records.data ? records.error : ''} loading={records.loading && !records.data}>{records.data?.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>{kind === 'units' ? 'Tipo' : 'Nombre'}</th><th>Sede</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {records.data.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{kind === 'units' ? item.type : item.name}</td><td>{(sites.data ?? []).find((entry) => entry.id === item.siteId)?.name ?? 'Sede no disponible'}</td><td><Pill>{kind === 'units' ? unitLabels[item.status] ?? 'Estado por confirmar' : item.active ? 'Activo' : 'Inactivo'}</Pill></td><td><button className="text-button" onClick={() => edit(item)}>Editar</button> <button className="text-button danger" disabled={item.active === false || item.status === 'out_of_service'} onClick={() => setDeleting(item.id)}>Desactivar</button></td></tr>)}
    </tbody></table></div> : <Empty />}</ErrorBoundaryContent></Panel>;
}

export function Resources({ kind }) { return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Administración</span><h1>{kind === 'units' ? 'Unidades' : 'Personal'}</h1><p>Recursos disponibles en tu institución y sede.</p></div><ResourceTable key={kind} kind={kind} title={kind === 'units' ? 'Flota institucional' : 'Personal de atención'} /></div>; }

export { default as Organization } from './Organization';
