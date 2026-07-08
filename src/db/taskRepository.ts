import type { SQLiteDatabase } from 'expo-sqlite';
import type { NewTaskInput, Subtask, SubtaskDraft, Task } from '../types';
import { weekdayOfDate } from '../utils/date';

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
  subtask_total: number;
  subtask_done: number;
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
    subtaskTotal: row.subtask_total,
    subtaskDone: row.subtask_done,
  };
}

// Columnas comunes de las consultas. `is_completed` se resuelve segun el tipo:
// - puntual: la columna is_completed de la tarea.
// - recurrente: si existe fila en task_completions para el dia consultado.
function selectColumns(dateParamName: string): string {
  return `
    t.id, t.title, t.date, t.start_time, t.duration_minutes, t.category_id,
    CASE WHEN t.recurrence_type = 'none' THEN t.is_completed
         ELSE EXISTS(SELECT 1 FROM task_completions c
                     WHERE c.task_id = t.id AND c.date = ${dateParamName})
    END AS is_completed,
    t.notes, t.reminder_minutes_before, t.recurrence_type,
    t.recurrence_days_of_week, t.recurrence_end_date,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_total,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = 1) AS subtask_done
  `;
}

// ¿Una tarea recurrente "cae" en esta fecha? (la consulta SQL ya filtro por
// rango de fechas; aqui solo se comprueba el dia de la semana).
function recurrenceMatchesDay(task: Task, date: string): boolean {
  const weekday = weekdayOfDate(date);
  switch (task.recurrenceType) {
    case 'daily':
      return true;
    case 'weekdays':
      return weekday >= 1 && weekday <= 5; // lunes a viernes
    case 'weekly':
      return weekday === weekdayOfDate(task.date);
    case 'custom': {
      if (!task.recurrenceDaysOfWeek) return false;
      try {
        const days: number[] = JSON.parse(task.recurrenceDaysOfWeek);
        return days.includes(weekday);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

// Tareas de un dia: las puntuales con esa fecha exacta + las recurrentes cuya
// serie ya empezo (date <= dia), no termino (end_date) y cuya regla incluye
// ese dia de la semana.
export async function getTasksForDate(db: SQLiteDatabase, date: string): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT ${selectColumns('$date')}
     FROM tasks t
     WHERE (t.recurrence_type = 'none' AND t.date = $date)
        OR (t.recurrence_type != 'none'
            AND t.date <= $date
            AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= $date))
     ORDER BY t.start_time ASC`,
    { $date: date }
  );
  return rows
    .map(mapRow)
    .filter((task) => task.recurrenceType === 'none' || recurrenceMatchesDay(task, date));
}

export async function getTaskById(db: SQLiteDatabase, id: number): Promise<Task | null> {
  const row = await db.getFirstAsync<TaskRow>(
    `SELECT ${selectColumns("''")}
     FROM tasks t WHERE t.id = ?`,
    id
  );
  return row ? mapRow(row) : null;
}

export async function createTask(db: SQLiteDatabase, input: NewTaskInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO tasks (title, date, start_time, duration_minutes, category_id, notes,
                        reminder_minutes_before,
                        recurrence_type, recurrence_days_of_week, recurrence_end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.title,
    input.date,
    input.startTime,
    input.durationMinutes,
    input.categoryId,
    input.notes ?? null,
    input.reminderMinutesBefore,
    input.recurrenceType,
    input.recurrenceDaysOfWeek ? JSON.stringify(input.recurrenceDaysOfWeek) : null,
    input.recurrenceEndDate ?? null
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
     SET title = ?, date = ?, start_time = ?, duration_minutes = ?, category_id = ?, notes = ?,
         reminder_minutes_before = ?,
         recurrence_type = ?, recurrence_days_of_week = ?, recurrence_end_date = ?
     WHERE id = ?`,
    input.title,
    input.date,
    input.startTime,
    input.durationMinutes,
    input.categoryId,
    input.notes ?? null,
    input.reminderMinutesBefore,
    input.recurrenceType,
    input.recurrenceDaysOfWeek ? JSON.stringify(input.recurrenceDaysOfWeek) : null,
    input.recurrenceEndDate ?? null,
    id
  );
}

// Marca/desmarca una tarea para un dia concreto. En recurrentes se guarda por
// ocurrencia; en puntuales se usa la columna is_completed.
export async function setTaskCompletedForDate(
  db: SQLiteDatabase,
  task: Task,
  date: string,
  isCompleted: boolean
): Promise<void> {
  if (task.recurrenceType === 'none') {
    await db.runAsync(
      'UPDATE tasks SET is_completed = ? WHERE id = ?',
      isCompleted ? 1 : 0,
      task.id
    );
  } else if (isCompleted) {
    await db.runAsync(
      'INSERT OR IGNORE INTO task_completions (task_id, date) VALUES (?, ?)',
      task.id,
      date
    );
  } else {
    await db.runAsync(
      'DELETE FROM task_completions WHERE task_id = ? AND date = ?',
      task.id,
      date
    );
  }
}

// Borra la tarea (si es recurrente, la serie completa) y sus datos asociados.
export async function deleteTask(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', id);
  await db.runAsync('DELETE FROM task_completions WHERE task_id = ?', id);
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

// --- Subtareas ---

interface SubtaskRow {
  id: number;
  task_id: number;
  title: string;
  is_done: number;
  position: number;
}

export async function getSubtasks(db: SQLiteDatabase, taskId: number): Promise<Subtask[]> {
  const rows = await db.getAllAsync<SubtaskRow>(
    'SELECT id, task_id, title, is_done, position FROM subtasks WHERE task_id = ? ORDER BY position ASC',
    taskId
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    isDone: row.is_done === 1,
    position: row.position,
  }));
}

// El formulario edita la checklist completa en memoria; al guardar se
// reemplaza entera (simple y suficiente para uso personal).
export async function replaceSubtasks(
  db: SQLiteDatabase,
  taskId: number,
  subtasks: SubtaskDraft[]
): Promise<void> {
  await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', taskId);
  for (let i = 0; i < subtasks.length; i++) {
    await db.runAsync(
      'INSERT INTO subtasks (task_id, title, is_done, position) VALUES (?, ?, ?, ?)',
      taskId,
      subtasks[i].title,
      subtasks[i].isDone ? 1 : 0,
      i
    );
  }
}
