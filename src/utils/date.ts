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

// Lunes de la semana a la que pertenece la fecha.
export function startOfWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0 = domingo
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

// "julio 2026" para la cabecera.
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

// Abreviaturas para la tira semanal, empezando en lunes.
export const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

// Numero de dia del mes (sin cero inicial).
export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.split('-')[2]);
}

// Dia de la semana de una fecha ISO (0 = domingo ... 6 = sabado).
export function weekdayOfDate(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

// Convierte "HH:MM" a minutos desde medianoche (ej. "09:30" -> 570).
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convierte minutos desde medianoche a "HH:MM" (ej. 570 -> "09:30").
export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
  const minutes = String(clamped % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}
