export const statusLabels = {
  reported: 'Reportado',
  verifying: 'En verificación',
  assigned: 'Asignado',
  en_route: 'Unidad en camino',
  attending: 'En atención',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export const sourceLabels = { MOBILE_APP: 'Aplicación móvil', GUEST_WEB: 'Reporte web', PHONE: 'Llamada' };
export const priorityLabels = { low: 'Baja', normal: 'Normal', high: 'Alta', critical: 'Crítica' };
export const verificationLabels = {
  pending: 'Pendiente', verified: 'Verificado', unverifiable: 'No verificable',
  false: 'Falso', duplicate: 'Duplicado',
};

export const unitLabels = { available: 'Disponible', assigned: 'Asignada', en_route: 'En camino', attending: 'En atención', unavailable: 'No disponible', maintenance: 'En mantenimiento', inactive: 'Inactiva' };
export const institutionLabels = { pnp: 'Policía Nacional (PNP)', samu: 'Atención médica (SAMU)', bomberos: 'Bomberos', municipalidad: 'Municipalidad / Serenazgo', otra: 'Otra institución' };
export const entityLabels = { incident: 'Incidente', institution: 'Institución', site: 'Sede', unit: 'Unidad', personnel: 'Personal', user: 'Usuario', directory: 'Contacto', alert: 'Alerta', institution_assignment: 'Asignación' };
const eventLabels = { created: 'Reporte recibido', assigned: 'Recursos asignados', 'assignment.status': 'Estado de la atención', 'incident.status': 'Estado del incidente', verification: 'Verificación del reporte', 'incident.verification': 'Verificación del reporte', priority: 'Prioridad actualizada', create: 'Registro creado', update: 'Registro actualizado', delete: 'Registro desactivado' };
export function readableEvent(value) {
  if (eventLabels[value]) return eventLabels[value];
  if (value === 'status.changed') return 'Estado del incidente actualizado';
  if (value === 'verification.changed') return 'Verificación actualizada';
  if (value === 'access.denied') return 'Acceso no permitido';
  const action = { post: 'Registro creado', patch: 'Registro actualizado', delete: 'Registro desactivado' }[value?.split('.').at(-1)];
  return action ?? 'Cambio registrado';
}
export function readableValue(value) { return statusLabels[value] ?? verificationLabels[value] ?? priorityLabels[value] ?? (value ? 'Dato actualizado' : 'Sin registro anterior'); }
