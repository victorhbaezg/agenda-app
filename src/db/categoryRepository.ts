import type { SQLiteDatabase } from 'expo-sqlite';
import type { Category } from '../types';

interface CategoryRow {
  id: number;
  name: string;
  color: string;
  icon: string;
}

function mapRow(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color, icon: row.icon };
}

export async function getCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT id, name, color, icon FROM categories ORDER BY id ASC'
  );
  return rows.map(mapRow);
}

export async function createCategory(
  db: SQLiteDatabase,
  name: string,
  color: string,
  icon: string
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
    name,
    color,
    icon
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: number,
  name: string,
  color: string,
  icon: string
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?',
    name,
    color,
    icon,
    id
  );
}

export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}
