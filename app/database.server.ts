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
};

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
`);

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
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content
    FROM chapters WHERE published = 1 ORDER BY id
  `).all() as unknown as ChapterRecord[];
}

export function getAllChapters() {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content
    FROM chapters ORDER BY id
  `).all() as unknown as ChapterRecord[];
}

export function getChapter(slug: string) {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content
    FROM chapters WHERE slug = ? AND published = 1
  `).get(slug) as ChapterRecord | undefined;
}

export function getChapterForEditing(id: number) {
  return database.prepare(`
    SELECT id, slug, number, title, subtitle, reading_time AS readingTime, content
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
