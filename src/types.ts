// Tipos compartidos de la app.
// La recurrencia (recurrenceType, etc.) ya existe en el modelo de datos
// para que la Fase 3 no necesite migrar la base de datos, pero en la
// Fase 1 todas las tareas se crean con recurrenceType = 'none'.

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

export interface Task {
  id: number;
  title: string;
  date: string; // formato YYYY-MM-DD
  startTime: string; // formato HH:MM (24h)
  durationMinutes: number;
  categoryId: number | null;
  isCompleted: boolean;
  notes: string | null;
  reminderMinutesBefore: number | null;
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: string | null; // JSON de numeros 0-6 (0 = domingo)
  recurrenceEndDate: string | null;
}

export interface NewTaskInput {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  categoryId: number | null;
  notes?: string | null;
}
