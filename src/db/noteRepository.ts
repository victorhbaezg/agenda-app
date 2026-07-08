import type { SQLiteDatabase } from 'expo-sqlite';
import type { Note } from '../types';

interface NoteRow {
  id: number;
  content: string;
  category_id: number | null;
  is_pinned: number;
  created_at: string;
  archived_at: string | null;
}

function mapRow(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    categoryId: row.category_id,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

// Notas activas: fijadas primero, luego las mas recientes.
export async function getActiveNotes(db: SQLiteDatabase): Promise<Note[]> {
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes
     WHERE archived_at IS NULL
     ORDER BY is_pinned DESC, created_at DESC, id DESC`
  );
  return rows.map(mapRow);
}

export async function getArchivedNotes(db: SQLiteDatabase): Promise<Note[]> {
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes
     WHERE archived_at IS NOT NULL
     ORDER BY archived_at DESC, id DESC`
  );
  return rows.map(mapRow);
}

// Cantidad de notas sin planear (para el badge en la pantalla Hoy).
export async function countActiveNotes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM notes WHERE archived_at IS NULL'
  );
  return row?.total ?? 0;
}

export async function createNote(
  db: SQLiteDatabase,
  content: string,
  categoryId: number | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO notes (content, category_id) VALUES (?, ?)',
    content,
    categoryId
  );
  return result.lastInsertRowId;
}

export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  content: string,
  categoryId: number | null
): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET content = ?, category_id = ? WHERE id = ?',
    content,
    categoryId,
    id
  );
}

export async function setNotePinned(
  db: SQLiteDatabase,
  id: number,
  pinned: boolean
): Promise<void> {
  await db.runAsync('UPDATE notes SET is_pinned = ? WHERE id = ?', pinned ? 1 : 0, id);
}

// Archivar en vez de borrar: se usa al convertir la nota en tarea
// o cuando el usuario la descarta pero quiere conservarla.
export async function archiveNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    "UPDATE notes SET archived_at = datetime('now'), is_pinned = 0 WHERE id = ?",
    id
  );
}

export async function unarchiveNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE notes SET archived_at = NULL WHERE id = ?', id);
}

export async function deleteNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
