// Tipos compartidos de la app.

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
  date: string; // formato YYYY-MM-DD (para recurrentes: fecha de inicio de la serie)
  startTime: string; // formato HH:MM (24h)
  durationMinutes: number;
  categoryId: number | null;
  // Para tareas recurrentes, isCompleted se refiere al dia consultado
  // (se guarda por ocurrencia en la tabla task_completions).
  isCompleted: boolean;
  notes: string | null;
  reminderMinutesBefore: number | null;
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: string | null; // JSON de numeros 0-6 (0 = domingo)
  recurrenceEndDate: string | null;
  // Contadores de subtareas (calculados en la consulta).
  subtaskTotal: number;
  subtaskDone: number;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  isDone: boolean;
  position: number;
}

// Subtarea en edicion dentro del formulario (aun sin id si es nueva).
export interface SubtaskDraft {
  title: string;
  isDone: boolean;
}

export interface NewTaskInput {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  categoryId: number | null;
  notes?: string | null;
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: number[] | null; // solo para type 'custom'
  recurrenceEndDate?: string | null;
}
