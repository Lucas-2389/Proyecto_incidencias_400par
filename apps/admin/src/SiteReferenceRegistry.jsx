import { useState } from 'react';
import { useSession } from './session';
import { Field, Notice, Panel, useRemote } from './ui';
import { institutionLabels } from './incidentLabels';

function ReviewLocation({ reference, onSaved }) {
  const { api } = useSession();
  const [values, setValues] = useState({ latitude: '', longitude: '', source: '', method: 'institutional_map', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(reference.name);
  const [address, setAddress] = useState(reference.address ?? '');
  async function edit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.request(`/admin/site-references/${reference.id}/details`, { method: 'PATCH', body: JSON.stringify({ name, address }) }); await onSaved(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`¿Eliminar la referencia «${reference.name}»? Se retirará del mapa. Las sedes operativas y sus reportes se conservan.`)) return;
    setBusy(true); setError('');
    try { await api.request(`/admin/site-references/${reference.id}`, { method: 'DELETE' }); await onSaved(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault(); if (busy) return;
    if (values.latitude.trim() === '' || values.longitude.trim() === '') return setError('Completa las coordenadas respaldadas por la evidencia.');
    setBusy(true); setError('');
    try {
      await api.request(`/admin/site-references/${reference.id}`, { method: 'PATCH', body: JSON.stringify({ ...values,
        latitude: Number(values.latitude), longitude: Number(values.longitude) }) });
      await onSaved();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function clear() {
    if (busy) return; setBusy(true); setError('');
    try { await api.request(`/admin/site-references/${reference.id}`, { method: 'PATCH', body: JSON.stringify({ clear: true }) }); await onSaved(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <details><summary>Revisar ubicación</summary><p>Comprueba el edificio y su fuente antes de guardar. La revisión no acredita demarcación legal, disponibilidad ni habilita despachos.</p>
    <details><summary>Editar nombre y dirección</summary><form onSubmit={edit} className="form-grid compact">
      <Field label="Nombre de referencia"><input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Dirección de referencia"><input required maxLength={300} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <button className="button primary" disabled={busy}>Guardar datos de referencia</button>
    </form></details>
    <button type="button" className="button ghost" disabled={busy} onClick={remove}>Eliminar referencia</button>
    <form className="form-grid compact" onSubmit={save} aria-label={`Revisar ubicación de ${reference.name}`}>
      <Field label="Latitud verificada"><input required type="number" step="any" min="-16" max="-11" value={values.latitude} onChange={e => update('latitude', e.target.value)} /></Field>
      <Field label="Longitud verificada"><input required type="number" step="any" min="-76" max="-72" value={values.longitude} onChange={e => update('longitude', e.target.value)} /></Field>
      <Field label="Método de revisión"><select value={values.method} onChange={e => update('method', e.target.value)}><option value="institutional_map">Mapa publicado por la institución</option><option value="field_review">Revisión de campo documentada</option><option value="user_report">Corrección indicada por un usuario</option></select></Field>
      <Field label="Enlace de la evidencia"><input required type="url" maxLength={1000} value={values.source} onChange={e => update('source', e.target.value)} /></Field>
      <Field label="Qué se verificó"><textarea required maxLength={2000} value={values.notes} onChange={e => update('notes', e.target.value)} /></Field>
      <label className="check"><input type="checkbox" required /> Revisé el punto del edificio y su evidencia.</label>
      <button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar revisión de ubicación'}</button>
    </form><Notice kind="error">{error}</Notice>
    {reference.status === 'location_reviewed' && <details><summary>Retirar punto del mapa</summary><p>La referencia quedará pendiente otra vez; no se borra el registro.</p><button type="button" className="button ghost" disabled={busy} onClick={clear}>Confirmar retiro de ubicación</button></details>}
  </details>;
}

export default function SiteReferenceRegistry() {
  const { session } = useSession();
  const references = useRemote('/admin/site-references');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(12);
  const normalizeText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matching = (references.data ?? []).filter(reference => (!status || reference.status === status)
    && normalizeText(`${reference.name} ${reference.address} ${reference.districtCode}`).includes(normalizeText(search.trim())));
  return <Panel title="Referencias institucionales" eyebrow="Validación de sedes">
    <p>Estos registros documentales están separados de las sedes operativas. Una dirección sin coordenadas revisadas no aparece como marcador ni permite asignar personal.</p>
    <div className="form-grid compact">
      <Field label="Buscar municipalidad o dirección"><input type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(12); }} placeholder="Nombre, dirección o UBIGEO" /></Field>
      <Field label="Estado de ubicación"><select value={status} onChange={event => { setStatus(event.target.value); setLimit(12); }}><option value="">Todas las referencias</option><option value="location_reviewed">Ubicaciones revisadas</option><option value="pending_location">Ubicaciones pendientes</option></select></Field>
    </div>
    {references.data && <p>{matching.length} referencias coinciden · {references.data.filter(reference => reference.status === 'location_reviewed').length} ubicaciones revisadas en el registro.</p>}
    <Notice kind="success">{notice}</Notice>
    {references.loading && !references.data && <p>Cargando referencias…</p>}
    <Notice kind="error">{references.error}</Notice>
    {references.error && <button className="button ghost" onClick={references.reload}>Reintentar referencias</button>}
    <div className="reference-registry">{matching.slice(0, limit).map(reference => <article key={reference.id} className="reference-record">
      <header><strong>{reference.name}</strong><span className={`reference-status ${reference.status === 'location_reviewed' ? 'reviewed' : ''}`}>{reference.status === 'location_reviewed' ? 'Ubicación revisada' : 'Ubicación pendiente'}</span></header>
      <p>{institutionLabels[reference.institutionType]} · UBIGEO declarado {reference.districtCode}</p>
      <p>{reference.address || 'Dirección pendiente'}</p><p>{reference.notes}</p>
      {reference.verificationMethod === 'user_report' && <p>Ubicación indicada por un usuario; sin confirmación institucional independiente.</p>}
      <div className="reference-sources">{reference.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">Consultar fuente {index + 1} ↗</a>)}</div>
      {reference.reviewedAt && <p>Revisión registrada: {new Date(reference.reviewedAt).toLocaleDateString('es-PE')} · No implica operación vigente.</p>}
      {session?.user?.roles?.includes('SuperAdministrador') && <ReviewLocation reference={reference} onSaved={async () => { await references.reload(); setNotice('Revisión guardada. El mapa tomará el cambio al actualizar o abrirlo de nuevo.'); }} />}
    </article>)}</div>
    {matching.length > limit && <button className="button secondary" onClick={() => setLimit(current => current + 12)}>Ver más referencias ({matching.length - limit} restantes)</button>}
    {references.data?.length > 0 && matching.length === 0 && <p>No hay referencias que coincidan con esta búsqueda.</p>}
    {references.data?.length === 0 && <p>No hay referencias documentales registradas.</p>}
  </Panel>;
}
