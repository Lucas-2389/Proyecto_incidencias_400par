const dayMilliseconds = 86400000;

export function mapPeriod(from, to, defaultRange) {
  if (!from && !to) return { range: defaultRange, error: '' };
  if (!from || !to) return { error: 'Completa ambas fechas o déjalas vacías para consultar los últimos 7 días.' };
  const start = new Date(`${from}T00:00:00-05:00`);
  const lastDay = new Date(`${to}T00:00:00-05:00`);
  const end = new Date(lastDay.getTime() + dayMilliseconds);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || lastDay < start) {
    return { error: 'Selecciona un intervalo de fechas válido.' };
  }
  if (end - start > 90 * dayMilliseconds) return { error: 'El intervalo máximo es de 90 días.' };
  return { range: { from: start.toISOString(), to: end.toISOString() }, error: '' };
}
