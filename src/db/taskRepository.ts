import type { SQLiteDatabase } from 'expo-sqlite';
import type { NewTaskInput, Task } from '../types';

interface TaskRow {
  id: number;
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  category_id: number | null;
  is_completed: number;
  notes: string | null;
  reminder_minutes_before: number | null;
  recurrence_type: Task['recurrenceType'];
  recurrence_days_of_week: string | null;
  recurrence_end_date: string | null;
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id,
    isCompleted: row.is_completed === 1,
    notes: row.notes,
    reminderMinutesBefore: row.reminder_minutes_before,
    recurrenceType: row.recurrence_type,
    recurrenceDaysOfWeek: row.recurrence_days_of_week,
    recurrenceEndDate: row.recurrence_end_date,
  };
}

// Fase 1: solo tareas puntuales (recurrence_type = 'none'), por eso basta con
// filtrar por coincidencia exacta de fecha. La expansion de tareas recurrentes
// se añade en la Fase 3 sin tener que cambiar el esquema.
export async function getTasksForDate(db: SQLiteDatabase, date: string): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT id, title, date, start_time, duration_minutes, category_id,
            is_completed, notes, reminder_minutes_before, recurrence_type,
            recurrence_days_of_week, recurrence_end_date
     FROM tasks
     WHERE date = ?
     ORDER BY start_time ASC`,
    date
  );
  return rows.map(mapRow);
}

export async function getTaskById(db: SQLiteDatabase, id: number): Promise<Task | null> {
  const row = await db.getFirstAsync<TaskRow>(
    `SELECT id, title, date, start_time, duration_minutes, category_id,
            is_completed, notes, reminder_minutes_before, recurrence_type,
            recurrence_days_of_week, recurrence_end_date
     FROM tasks WHERE id = ?`,
    id
  );
  return row ? mapRow(row) : null;
}

export async function createTask(db: SQLiteDatabase, input: NewTaskInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO tasks (title, date, start_time, duration_minutes, category_id, notes, recurrence_type)
     VALUES (?, ?, ?, ?, ?, ?, 'none')`,
    input.title,
    input.date,
    input.startTime,
    input.durationMinutes,
    input.categoryId,
    input.notes ?? null
  );
  return result.lastInsertRowId;
}

export async function updateTask(
  db: SQLiteDatabase,
  id: number,
  input: NewTaskInput
): Promise<void> {
  await db.runAsync(
    `UPDATE tasks
     SET title = ?, date = ?, start_time = ?, duration_minutes = ?, category_id = ?, notes = ?
     WHERE id = ?`,
    input.title,
    input.date,
    input.startTime,
    input.durationMinutes,
    input.categoryId,
    input.notes ?? null,
    id
  );
}

export async function setTaskCompleted(
  db: SQLiteDatabase,
  id: number,
  isCompleted: boolean
): Promise<void> {
  await db.runAsync('UPDATE tasks SET is_completed = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function deleteTask(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}
