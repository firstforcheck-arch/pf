import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type PublicUser = { id: number; email: string; role: "admin" | "reader" };
export type ChapterRecord = {
  id: number;
  slug: string;
  number: string;
  title: string;
  subtitle: string;
  readingTime: string;
  content: string;
  sortOrder: number;
  published: number;
};
export type BookSettings = { title: string; description: string; notes: string };

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(join(dataDirectory, "phantom-freedom.sqlite"));
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('admin', 'reader')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    reading_time TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS book_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    title TEXT NOT NULL,
    description TEXT NOT NULL
  );
  INSERT OR IGNORE INTO book_settings (id, title, description)
  VALUES (1, 'Phantom Freedom', 'История о свободе, памяти и цене решений, которые продолжают преследовать нас даже тогда, когда прошлое кажется окончательно забытым.');
`);

try {
  database.exec("ALTER TABLE chapters ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
database.exec("UPDATE chapters SET sort_order = id WHERE sort_order = 0");

const chapterCount = database.prepare("SELECT COUNT(*) AS count FROM chapters").get() as { count: number };
if (chapterCount.count === 0) {
  const insert = database.prepare(`
    INSERT INTO chapters (slug, number, title, subtitle, reading_time, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run("1", "I", "Глава первая", "Начало истории.", "8 мин", "Текст первой главы появится здесь.");
  insert.run("2", "II", "Глава вторая", "История продолжается.", "10 мин", "Текст второй главы появится здесь.");
  insert.run("3", "III", "Глава третья", "Новый поворот.", "12 мин", "Текст третьей главы появится здесь.");
}
normalizeChapterOrder();

export function countUsers() {
  return (database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}

export function createUser(email: string, passwordHash: string, role: PublicUser["role"]) {
  const result = database
    .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)")
    .run(email, passwordHash, role);
  return Number(result.lastInsertRowid);
}

export function findUserByEmail(email: string) {
  return database
    .prepare("SELECT id, email, password_hash AS passwordHash, role FROM users WHERE email = ?")
    .get(email) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserById(id: number) {
  return database
    .prepare("SELECT id, email, role FROM users WHERE id = ?")
    .get(id) as PublicUser | undefined;
}

export function getPublishedChapters() {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE published = 1 ORDER BY sort_order, id
  `).all() as unknown as ChapterRecord[];
}

export function getAllChapters() {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters ORDER BY sort_order, id
  `).all() as unknown as ChapterRecord[];
}

export function getChapter(slug: string) {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE slug = ? AND published = 1
  `).get(slug) as ChapterRecord | undefined;
}

export function getChapterForEditing(id: number) {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE id = ?
  `).get(id) as ChapterRecord | undefined;
}

export function saveChapter(chapter: ChapterRecord) {
  database.prepare(`
    UPDATE chapters
    SET slug = ?, number = ?, title = ?, subtitle = ?, reading_time = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(chapter.slug, chapter.number, chapter.title, chapter.subtitle, chapter.readingTime, chapter.content, chapter.id);
}

export function setChapterPublished(id: number, published: boolean) {
  database.prepare("UPDATE chapters SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(published ? 1 : 0, id);
}

export function getBookSettings() {
  return database.prepare("SELECT title, description, notes FROM book_settings WHERE id = 1").get() as BookSettings;
}

export function saveBookSettings(settings: BookSettings) {
  database.prepare("UPDATE book_settings SET title = ?, description = ?, notes = ? WHERE id = 1")
    .run(settings.title, settings.description, settings.notes);
}

export function createChapter() {
  const next = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder
    FROM chapters
  `).get() as { sortOrder: number };
  const position = next.sortOrder;
  const result = database.prepare(`
    INSERT INTO chapters (slug, number, title, subtitle, content, sort_order)
    VALUES (?, ?, 'Новая глава', '', '', ?)
  `).run(String(position), String(position), position);
  return Number(result.lastInsertRowid);
}

export function deleteChapter(id: number) {
  database.prepare("DELETE FROM chapters WHERE id = ?").run(id);
  normalizeChapterOrder();
}

export function reorderChapters(ids: number[]) {
  const existing = getAllChapters().map((chapter) => chapter.id);
  if (ids.length !== existing.length || !existing.every((id) => ids.includes(id))) {
    throw new Error("Invalid chapter order");
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const update = database.prepare("UPDATE chapters SET sort_order = ? WHERE id = ?");
    const temporarySlug = database.prepare("UPDATE chapters SET slug = ? WHERE id = ?");
    ids.forEach((id, index) => {
      update.run(index + 1, id);
      temporarySlug.run(`__moving_${id}`, id);
    });
    const finalize = database.prepare("UPDATE chapters SET slug = ?, number = ? WHERE id = ?");
    ids.forEach((id, index) => finalize.run(String(index + 1), String(index + 1), id));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function normalizeChapterOrder() {
  const ids = (database.prepare("SELECT id FROM chapters ORDER BY sort_order, id").all() as { id: number }[])
    .map((row) => row.id);
  if (ids.length > 0) reorderChapters(ids);
}
