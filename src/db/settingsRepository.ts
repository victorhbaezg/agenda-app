import type { SQLiteDatabase } from 'expo-sqlite';

// Ajustes simples clave-valor. Por ahora solo el interruptor global
// de recordatorios; sirve de base para futuros ajustes (Fase 5).

async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

// Interruptor global de recordatorios. Encendido por defecto: si nunca se
// ha guardado el ajuste, se considera activado.
export async function getRemindersEnabled(db: SQLiteDatabase): Promise<boolean> {
  const value = await getSetting(db, 'reminders_enabled');
  return value !== '0';
}

export async function setRemindersEnabled(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await setSetting(db, 'reminders_enabled', enabled ? '1' : '0');
}
