// Utilidades de fecha. Se evita traer una libreria externa (date-fns, dayjs)
// para mantener el MVP ligero; si la app crece conviene migrar a una de esas.

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, amount: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + amount);
  return toISODate(d);
}

export function isToday(isoDate: string): boolean {
  return isoDate === toISODate(new Date());
}

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[d.getDay()];
  const monthName = MONTHS[d.getMonth()];
  return `${weekday} ${day} de ${monthName}`;
}

export function formatTimeLabel(time: string): string {
  return time;
}
