import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type PublicUser = {
  id: number;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: "admin" | "reader";
};
export type CommentRecord = {
  id: number;
  content: string;
  createdAt: string;
  user: Pick<PublicUser, "id" | "username" | "avatarUrl">;
};
export type ChapterRecord = {
  id: number;
  slug: string;
  publicSlug: string;
  number: string;
  title: string;
  subtitle: string;
  readingTime: string;
  content: string;
  sortOrder: number;
  published: number;
};
export type BookSettings = {
  title: string;
  description: string;
  notes: string;
  coverUrl: string | null;
  coverPositionX: number;
  coverPositionY: number;
  coverZoom: number;
};

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(join(dataDirectory, "phantom-freedom.sqlite"));
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    avatar_url TEXT,
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
    published INTEGER NOT NULL DEFAULT 0,
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

const userColumns = database.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userColumns.some((column) => column.name === "username")) {
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE");
  try {
    database.exec(`
      ALTER TABLE users RENAME TO users_legacy;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT UNIQUE COLLATE NOCASE,
        avatar_url TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('admin', 'reader')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      SELECT id,
        CASE
          WHEN instr(email, '@') > 1 AND (
            SELECT COUNT(*) FROM users_legacy AS other
            WHERE lower(substr(other.email, 1, instr(other.email, '@') - 1))
              = lower(substr(users_legacy.email, 1, instr(users_legacy.email, '@') - 1))
          ) = 1 THEN substr(email, 1, instr(email, '@') - 1)
          WHEN instr(email, '@') > 1 THEN substr(email, 1, instr(email, '@') - 1) || '_' || id
          ELSE 'user_' || id
        END,
        email, password_hash, role, created_at
      FROM users_legacy;
      DROP TABLE users_legacy;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

database.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS comments_chapter_created_idx ON comments(chapter_id, created_at);
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
`);

try {
  database.exec("ALTER TABLE chapters ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE chapters ADD COLUMN public_slug TEXT");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN cover_url TEXT");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN cover_position_x REAL NOT NULL DEFAULT 50");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN cover_position_y REAL NOT NULL DEFAULT 50");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE book_settings ADD COLUMN cover_zoom REAL NOT NULL DEFAULT 1");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
database.exec("UPDATE chapters SET sort_order = id WHERE sort_order = 0");

const chapterCount = database.prepare("SELECT COUNT(*) AS count FROM chapters").get() as { count: number };
if (chapterCount.count === 0) {
  const insert = database.prepare(`
    INSERT INTO chapters (slug, public_slug, number, title, subtitle, reading_time, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run("1", randomUUID(), "I", "Глава первая", "Начало истории.", "8 мин", "Текст первой главы появится здесь.");
  insert.run("2", randomUUID(), "II", "Глава вторая", "История продолжается.", "10 мин", "Текст второй главы появится здесь.");
  insert.run("3", randomUUID(), "III", "Глава третья", "Новый поворот.", "12 мин", "Текст третьей главы появится здесь.");
}
const chaptersWithoutPublicSlug = database.prepare("SELECT id FROM chapters WHERE public_slug IS NULL OR public_slug = ''").all() as { id: number }[];
const setPublicSlug = database.prepare("UPDATE chapters SET public_slug = ? WHERE id = ?");
chaptersWithoutPublicSlug.forEach(({ id }) => setPublicSlug.run(randomUUID(), id));
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS chapters_public_slug_idx ON chapters(public_slug)");
normalizeChapterOrder();

export function countUsers() {
  return (database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}

export function createUser(username: string, passwordHash: string, role: PublicUser["role"]) {
  const result = database
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, passwordHash, role);
  return Number(result.lastInsertRowid);
}

export function findUserByUsername(username: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role FROM users WHERE username = ?")
    .get(username) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserByEmail(email: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role FROM users WHERE email = ?")
    .get(email) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserById(id: number) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, role FROM users WHERE id = ?")
    .get(id) as PublicUser | undefined;
}

export function updateUserProfile(id: number, username: string, email: string | null, avatarUrl: string | null) {
  database.prepare("UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?")
    .run(username, email, avatarUrl, id);
}

export function updateUserPassword(id: number, passwordHash: string) {
  database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function getChapterComments(chapterId: number) {
  const rows = database.prepare(`
    SELECT comments.id, comments.content, comments.created_at AS createdAt,
      users.id AS userId, users.username, users.avatar_url AS avatarUrl
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.chapter_id = ?
    ORDER BY comments.created_at, comments.id
  `).all(chapterId) as unknown as Array<{
    id: number; content: string; createdAt: string; userId: number; username: string; avatarUrl: string | null;
  }>;
  return rows.map(({ userId, username, avatarUrl, ...comment }) => ({
    ...comment,
    user: { id: userId, username, avatarUrl },
  })) as CommentRecord[];
}

export function createComment(chapterId: number, userId: number, content: string) {
  database.prepare("INSERT INTO comments (chapter_id, user_id, content) VALUES (?, ?, ?)")
    .run(chapterId, userId, content);
}

export function deleteComment(commentId: number, chapterId: number) {
  database.prepare("DELETE FROM comments WHERE id = ? AND chapter_id = ?").run(commentId, chapterId);
}

export function getNotificationRecipients() {
  return database.prepare("SELECT email FROM users WHERE email IS NOT NULL AND email <> ''")
    .all() as { email: string }[];
}

export function createPasswordResetToken(userId: number, tokenHash: string, expiresAt: string) {
  database.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < CURRENT_TIMESTAMP").run(userId);
  database.prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(userId, tokenHash, expiresAt);
}

export function consumePasswordResetToken(tokenHash: string) {
  const token = database.prepare(`
    SELECT id, user_id AS userId FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
  `).get(tokenHash) as { id: number; userId: number } | undefined;
  if (!token) return null;
  database.prepare("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(token.id);
  return token.userId;
}

export function getPublishedChapters() {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE published = 1 ORDER BY sort_order, id
  `).all() as unknown as ChapterRecord[];
}

export function getAllChapters() {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters ORDER BY sort_order, id
  `).all() as unknown as ChapterRecord[];
}

export function getChapter(publicSlug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE public_slug = ? AND published = 1
  `).get(publicSlug) as ChapterRecord | undefined;
}

export function getChapterBySlug(slug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE slug = ?
  `).get(slug) as ChapterRecord | undefined;
}

export function getChapterByPublicSlug(publicSlug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE public_slug = ?
  `).get(publicSlug) as ChapterRecord | undefined;
}

export function getChapterForEditing(slug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE slug = ?
  `).get(slug) as ChapterRecord | undefined;
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
  return database.prepare(`
    SELECT title, description, notes, cover_url AS coverUrl,
      cover_position_x AS coverPositionX, cover_position_y AS coverPositionY,
      cover_zoom AS coverZoom
    FROM book_settings WHERE id = 1
  `).get() as BookSettings;
}

export function saveBookSettings(settings: BookSettings) {
  database.prepare(`
    UPDATE book_settings
    SET title = ?, description = ?, notes = ?, cover_url = ?, cover_position_x = ?, cover_position_y = ?, cover_zoom = ?
    WHERE id = 1
  `).run(
    settings.title,
    settings.description,
    settings.notes,
    settings.coverUrl,
    settings.coverPositionX,
    settings.coverPositionY,
    settings.coverZoom,
  );
}

export function createChapter() {
  const next = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder
    FROM chapters
  `).get() as { sortOrder: number };
  const position = next.sortOrder;
  const nextSlug = database.prepare(`
    SELECT COALESCE(MAX(CAST(slug AS INTEGER)), 0) + 1 AS slug
    FROM chapters
    WHERE slug GLOB '[0-9]*'
  `).get() as { slug: number };
  const slug = String(nextSlug.slug);
  const publicSlug = randomUUID();
  database.prepare(`
    INSERT INTO chapters (slug, public_slug, number, title, subtitle, content, sort_order, published)
    VALUES (?, ?, ?, 'Новая глава', '', '', ?, 0)
  `).run(slug, publicSlug, String(position), position);
  return slug;
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
