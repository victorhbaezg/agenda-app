import type { SQLiteDatabase } from 'expo-sqlite';

// Categorias por defecto que se insertan la primera vez que se abre la app.
const DEFAULT_CATEGORIES: Array<{ name: string; color: string; icon: string }> = [
  { name: 'Trabajo', color: '#4C6EF5', icon: 'briefcase' },
  { name: 'Personal', color: '#12B886', icon: 'person' },
  { name: 'Salud', color: '#FA5252', icon: 'heart' },
  { name: 'Estudio', color: '#F59F00', icon: 'book' },
];

// Se ejecuta una sola vez (o cuando cambia PRAGMA user_version) al iniciar
// la app. Crea el esquema completo, incluyendo columnas que hoy no se usan
// desde la UI (recordatorios, recurrencia) para no tener que migrar despues.
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const DATABASE_VERSION = 2;
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        reminder_minutes_before INTEGER,
        recurrence_type TEXT NOT NULL DEFAULT 'none',
        recurrence_days_of_week TEXT,
        recurrence_end_date TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
    `);

    const existingCategories = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM categories'
    );

    if (existingCategories.length === 0) {
      for (const category of DEFAULT_CATEGORIES) {
        await db.runAsync(
          'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
          category.name,
          category.color,
          category.icon
        );
      }
    }

    currentVersion = 1;
  }

  if (currentVersion === 1) {
    // v2 (Fase 3):
    // - task_completions: marca de completado POR DIA para tareas recurrentes
    //   (una tarea diaria completada hoy no debe aparecer completada manana).
    // - subtasks: checklist dentro de una tarea.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS task_completions (
        task_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        PRIMARY KEY (task_id, date)
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        is_done INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence_type);
    `);

    currentVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
