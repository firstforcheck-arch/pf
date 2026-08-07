import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { countPages } from "./text-metrics";

export type PublicUser = {
  id: number;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: "admin" | "reader";
  sessionVersion: number;
  lastSeen: string;
};
export type WorkRecord = BookSettings & {
  id: number;
  slug: string;
  ownerId: number;
  owner: Pick<PublicUser, "id" | "username" | "avatarUrl">;
  published: number;
  createdAt: string;
};
export type WorkCardRecord = WorkRecord & {
  chapterCount: number;
  firstChapterSlug: string | null;
  totalPages: number;
  likeCount: number;
  liked: boolean;
  following: boolean;
  tags: TagRecord[];
};
export type TagRecord = {
  id: number;
  slug: string;
  name: string;
  description: string;
  nameRu: string;
  nameUk: string;
  descriptionRu: string;
  descriptionUk: string;
  sourceLanguage: "ru" | "uk";
  workCount: number;
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

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(join(dataDirectory, "phantom-freedom.sqlite"));
database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
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
  CREATE TABLE IF NOT EXISTS security_rate_limits (
    key TEXT PRIMARY KEY,
    window_started INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  );
`);

try {
  database.exec("ALTER TABLE chapters ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE users ADD COLUMN last_seen TEXT NOT NULL DEFAULT ''");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
database.exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE last_seen = ''");
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
database.exec(`
  CREATE TABLE IF NOT EXISTS works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    cover_url TEXT,
    cover_position_x REAL NOT NULL DEFAULT 50,
    cover_position_y REAL NOT NULL DEFAULT 50,
    cover_zoom REAL NOT NULL DEFAULT 1,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name_key TEXT,
    description TEXT NOT NULL DEFAULT '',
    name_ru TEXT,
    name_uk TEXT,
    description_ru TEXT,
    description_uk TEXT,
    name_ru_key TEXT,
    name_uk_key TEXT,
    source_language TEXT NOT NULL DEFAULT 'ru',
    translation_complete INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS work_tags (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (work_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS work_tags_tag_idx ON work_tags(tag_id, work_id);
`);
try {
  database.exec("ALTER TABLE work_tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
database.exec("UPDATE work_tags SET sort_order = rowid WHERE sort_order = 0");
try {
  database.exec("ALTER TABLE tags ADD COLUMN name_key TEXT");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
for (const statement of [
  "ALTER TABLE tags ADD COLUMN name_ru TEXT",
  "ALTER TABLE tags ADD COLUMN name_uk TEXT",
  "ALTER TABLE tags ADD COLUMN description_ru TEXT",
  "ALTER TABLE tags ADD COLUMN description_uk TEXT",
  "ALTER TABLE tags ADD COLUMN name_ru_key TEXT",
  "ALTER TABLE tags ADD COLUMN name_uk_key TEXT",
  "ALTER TABLE tags ADD COLUMN source_language TEXT NOT NULL DEFAULT 'ru'",
  "ALTER TABLE tags ADD COLUMN translation_complete INTEGER NOT NULL DEFAULT 0",
]) {
  try {
    database.exec(statement);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
  }
}
const storedTags = database.prepare("SELECT id, name FROM tags ORDER BY id").all() as { id: number; name: string }[];
const tagIdByKey = new Map<string, number>();
for (const tag of storedTags) {
  const nameKey = normalizeTagName(tag.name);
  const existingId = tagIdByKey.get(nameKey);
  if (existingId) {
    database.prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id, sort_order) SELECT work_id, ?, sort_order FROM work_tags WHERE tag_id = ?").run(existingId, tag.id);
    database.prepare("DELETE FROM tags WHERE id = ?").run(tag.id);
  } else {
    tagIdByKey.set(nameKey, tag.id);
    database.prepare(`UPDATE tags SET name_key = ?,
      name_ru = COALESCE(NULLIF(name_ru, ''), name), name_uk = COALESCE(NULLIF(name_uk, ''), name),
      description_ru = COALESCE(description_ru, description), description_uk = COALESCE(description_uk, description),
      name_ru_key = COALESCE(NULLIF(name_ru_key, ''), ?), name_uk_key = COALESCE(NULLIF(name_uk_key, ''), ?)
      WHERE id = ?`).run(nameKey, nameKey, nameKey, tag.id);
  }
}
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS tags_name_key_idx ON tags(name_key)");
const initialWorkOwner = database.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() as { id: number } | undefined;
if (initialWorkOwner) {
  database.prepare(`
    INSERT OR IGNORE INTO works (
      id, slug, owner_id, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, published
    )
    SELECT 1, 'phantom-freedom', ?, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, 1
    FROM book_settings WHERE id = 1
  `).run(initialWorkOwner.id);
}
try {
  database.exec("ALTER TABLE chapters ADD COLUMN work_id INTEGER REFERENCES works(id) ON DELETE CASCADE");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE chapters ADD COLUMN published_before_work_hide INTEGER");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
database.exec("UPDATE chapters SET work_id = 1 WHERE work_id IS NULL AND EXISTS (SELECT 1 FROM works WHERE id = 1)");
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
database.exec(`
  CREATE TABLE IF NOT EXISTS work_followers (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (work_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS work_likes (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (work_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS work_views (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    visitor_key TEXT NOT NULL,
    viewed_on TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (work_id, visitor_key, viewed_on)
  );
  CREATE INDEX IF NOT EXISTS work_views_date_idx ON work_views(work_id, viewed_on);
  CREATE TABLE IF NOT EXISTS chapter_views (
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    visitor_key TEXT NOT NULL,
    viewed_on TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chapter_id, visitor_key, viewed_on)
  );
  CREATE INDEX IF NOT EXISTS chapter_views_work_date_idx ON chapter_views(work_id, viewed_on, chapter_id);
  CREATE TABLE IF NOT EXISTS chapter_progress (
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    visitor_key TEXT NOT NULL,
    threshold INTEGER NOT NULL CHECK(threshold IN (25, 50, 75, 100)),
    reached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chapter_id, visitor_key, threshold)
  );
  CREATE INDEX IF NOT EXISTS chapter_progress_chapter_idx ON chapter_progress(chapter_id, threshold);
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, chapter_id)
  );
  CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON notifications(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS messages_dialog_idx
    ON messages(sender_id, recipient_id, created_at, id);
  CREATE TABLE IF NOT EXISTS message_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS message_notifications_user_created_idx
    ON message_notifications(user_id, created_at DESC);
`);
for (const statement of [
  "ALTER TABLE messages ADD COLUMN image_url TEXT",
  "ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL",
  "ALTER TABLE messages ADD COLUMN edited_at TEXT",
]) {
  try {
    database.exec(statement);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
  }
}
normalizeChapterOrder();

export function countUsers() {
  return (database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}

export function createUser(username: string, passwordHash: string) {
  const result = database
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, passwordHash, "reader");
  return Number(result.lastInsertRowid);
}

export function findUserByUsername(username: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role, session_version AS sessionVersion, last_seen AS lastSeen FROM users WHERE username = ?")
    .get(username) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserByEmail(email: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role, session_version AS sessionVersion, last_seen AS lastSeen FROM users WHERE email = ?")
    .get(email) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserById(id: number) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, role, session_version AS sessionVersion, last_seen AS lastSeen FROM users WHERE id = ?")
    .get(id) as PublicUser | undefined;
}

export function getUsersForAdmin(adminId: number, username = "", email = "", limit = 10, offset = 0) {
  const usernameFilter = `%${username.trim()}%`;
  const emailFilter = `%${email.trim()}%`;
  return database.prepare(`
    SELECT id, username, email, avatar_url AS avatarUrl, role, session_version AS sessionVersion, last_seen AS lastSeen
    FROM users
    WHERE id <> ?
      AND (? = '%%' OR username LIKE ? COLLATE NOCASE)
      AND (? = '%%' OR COALESCE(email, '') LIKE ? COLLATE NOCASE)
    ORDER BY username COLLATE NOCASE, id
    LIMIT ? OFFSET ?
  `).all(adminId, usernameFilter, usernameFilter, emailFilter, emailFilter, limit, offset) as unknown as PublicUser[];
}

export function countUsersForAdmin(adminId: number, username = "", email = "") {
  const usernameFilter = `%${username.trim()}%`;
  const emailFilter = `%${email.trim()}%`;
  return (database.prepare(`SELECT COUNT(*) AS count FROM users WHERE id <> ?
    AND (? = '%%' OR username LIKE ? COLLATE NOCASE)
    AND (? = '%%' OR COALESCE(email, '') LIKE ? COLLATE NOCASE)`)
    .get(adminId, usernameFilter, usernameFilter, emailFilter, emailFilter) as { count: number }).count;
}

export function touchUser(id: number) {
  database.prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

export function getPublicUserByUsername(username: string) {
  return database.prepare(`
    SELECT id, username, avatar_url AS avatarUrl, role, session_version AS sessionVersion, last_seen AS lastSeen
    FROM users WHERE username = ?
  `).get(username) as Omit<PublicUser, "email"> | undefined;
}

export function updateUserProfile(id: number, username: string, email: string | null, avatarUrl: string | null) {
  database.prepare("UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?")
    .run(username, email, avatarUrl, id);
}

export function updateUserPassword(id: number, passwordHash: string) {
  database.prepare("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?").run(passwordHash, id);
}

export function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const row = database.prepare(`INSERT INTO security_rate_limits (key, window_started, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET
      request_count = CASE WHEN window_started <= ? THEN 1 ELSE request_count + 1 END,
      window_started = CASE WHEN window_started <= ? THEN excluded.window_started ELSE window_started END
    RETURNING window_started AS windowStarted, request_count AS requestCount`)
    .get(key, now, now - windowSeconds, now - windowSeconds) as { windowStarted: number; requestCount: number };
  return { allowed: row.requestCount <= limit, retryAfter: Math.max(1, row.windowStarted + windowSeconds - now) };
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

export function updateComment(commentId: number, chapterId: number, userId: number, content: string) {
  return database.prepare("UPDATE comments SET content = ? WHERE id = ? AND chapter_id = ? AND user_id = ?")
    .run(content, commentId, chapterId, userId).changes > 0;
}

export function deleteComment(commentId: number, chapterId: number, userId: number, canModerate = false) {
  return database.prepare("DELETE FROM comments WHERE id = ? AND chapter_id = ? AND (? = 1 OR user_id = ?)")
    .run(commentId, chapterId, canModerate ? 1 : 0, userId).changes > 0;
}

export function isFollowingWork(userId: number, workId: number) {
  return Boolean(database.prepare("SELECT 1 FROM work_followers WHERE user_id = ? AND work_id = ?").get(userId, workId));
}

export function setWorkFollowing(userId: number, workId: number, following: boolean) {
  if (following) {
    database.prepare("INSERT OR IGNORE INTO work_followers (work_id, user_id) VALUES (?, ?)").run(workId, userId);
  } else {
    database.prepare("DELETE FROM work_followers WHERE work_id = ? AND user_id = ?").run(workId, userId);
  }
}

export function isLikingWork(userId: number, workId: number) {
  return Boolean(database.prepare("SELECT 1 FROM work_likes WHERE user_id = ? AND work_id = ?").get(userId, workId));
}

export function setWorkLiked(userId: number, workId: number, liked: boolean) {
  if (liked) {
    database.prepare("INSERT OR IGNORE INTO work_likes (work_id, user_id) VALUES (?, ?)").run(workId, userId);
  } else {
    database.prepare("DELETE FROM work_likes WHERE work_id = ? AND user_id = ?").run(workId, userId);
  }
}

export function getWorkEngagement(workId: number, userId?: number) {
  const likeCount = (database.prepare("SELECT COUNT(*) AS count FROM work_likes WHERE work_id = ?").get(workId) as { count: number }).count;
  return {
    likeCount,
    liked: userId ? isLikingWork(userId, workId) : false,
    following: userId ? isFollowingWork(userId, workId) : false,
  };
}

export type AnalyticsTimeframe = "day" | "week" | "month";

export function recordWorkView(workId: number, visitorKey: string) {
  database.prepare("INSERT OR IGNORE INTO work_views (work_id, visitor_key) SELECT id, ? FROM works WHERE id = ? AND published = 1")
    .run(visitorKey, workId);
}

export function recordChapterView(chapterId: number, workId: number, visitorKey: string) {
  database.prepare(`INSERT OR IGNORE INTO chapter_views (chapter_id, work_id, visitor_key)
    SELECT chapters.id, chapters.work_id, ? FROM chapters JOIN works ON works.id = chapters.work_id
    WHERE chapters.id = ? AND chapters.work_id = ? AND chapters.published = 1 AND works.published = 1`)
    .run(visitorKey, chapterId, workId);
}

export function recordChapterProgress(chapterId: number, workId: number, visitorKey: string, threshold: number) {
  if (![25, 50, 75, 100].includes(threshold)) return;
  database.prepare(`INSERT OR IGNORE INTO chapter_progress (chapter_id, work_id, visitor_key, threshold)
    SELECT chapters.id, chapters.work_id, ?, ? FROM chapters JOIN works ON works.id = chapters.work_id
    WHERE chapters.id = ? AND chapters.work_id = ? AND chapters.published = 1 AND works.published = 1`)
    .run(visitorKey, threshold, chapterId, workId);
}

function analyticsPeriodStart(timeframe: AnalyticsTimeframe) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  if (timeframe === "day") now.setUTCDate(now.getUTCDate() - 13);
  if (timeframe === "week") {
    const day = now.getUTCDay() || 7;
    now.setUTCDate(now.getUTCDate() - day + 1 - 11 * 7);
  }
  if (timeframe === "month") now.setUTCMonth(now.getUTCMonth() - 11, 1);
  return now.toISOString().slice(0, 10);
}

function analyticsBucket(date: string, timeframe: AnalyticsTimeframe) {
  const value = new Date(`${date}T00:00:00Z`);
  if (timeframe === "day") return date;
  if (timeframe === "month") return date.slice(0, 7);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

export function analyticsBuckets(timeframe: AnalyticsTimeframe) {
  const start = new Date(`${analyticsPeriodStart(timeframe)}T00:00:00Z`);
  return Array.from({ length: timeframe === "day" ? 14 : 12 }, (_, index) => {
    const date = new Date(start);
    if (timeframe === "day") date.setUTCDate(start.getUTCDate() + index);
    if (timeframe === "week") date.setUTCDate(start.getUTCDate() + index * 7);
    if (timeframe === "month") date.setUTCMonth(start.getUTCMonth() + index);
    return timeframe === "month" ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
  });
}

export function getAnalyticsWorks(user: PublicUser) {
  const works = user.role === "admin" ? getAllWorks() : getWorksByOwner(user.id, true);
  const totalViews = database.prepare("SELECT COUNT(DISTINCT visitor_key) AS count FROM work_views WHERE work_id = ?");
  const followers = database.prepare("SELECT COUNT(*) AS count FROM work_followers WHERE work_id = ?");
  const likes = database.prepare("SELECT COUNT(*) AS count FROM work_likes WHERE work_id = ?");
  return works.map((work) => ({
    ...work,
    viewCount: Number((totalViews.get(work.id) as { count: number }).count),
    followerCount: Number((followers.get(work.id) as { count: number }).count),
    likeCount: Number((likes.get(work.id) as { count: number }).count),
  }));
}

export function getWorkAnalytics(workId: number, timeframe: AnalyticsTimeframe) {
  const chapters = getAllChapters(workId);
  const buckets = analyticsBuckets(timeframe);
  const rows = database.prepare(`SELECT chapter_id AS chapterId, viewed_on AS viewedOn, COUNT(*) AS count
    FROM chapter_views WHERE work_id = ? AND viewed_on >= ? GROUP BY chapter_id, viewed_on`)
    .all(workId, analyticsPeriodStart(timeframe)) as Array<{ chapterId: number; viewedOn: string; count: number }>;
  const bySeries = new Map<number, Map<string, number>>();
  rows.forEach((row) => {
    const values = bySeries.get(row.chapterId) ?? new Map<string, number>();
    const bucket = analyticsBucket(row.viewedOn, timeframe);
    values.set(bucket, (values.get(bucket) ?? 0) + Number(row.count));
    bySeries.set(row.chapterId, values);
  });
  const viewCount = Number((database.prepare("SELECT COUNT(DISTINCT visitor_key) AS count FROM work_views WHERE work_id = ?").get(workId) as { count: number }).count);
  const followerCount = Number((database.prepare("SELECT COUNT(*) AS count FROM work_followers WHERE work_id = ?").get(workId) as { count: number }).count);
  const likeCount = Number((database.prepare("SELECT COUNT(*) AS count FROM work_likes WHERE work_id = ?").get(workId) as { count: number }).count);
  return { buckets, viewCount, followerCount, likeCount, chapters, series: chapters.map((chapter) => ({ id: chapter.id, name: chapter.title, values: buckets.map((bucket) => bySeries.get(chapter.id)?.get(bucket) ?? 0) })) };
}

export function getChapterAnalytics(chapterId: number, workId: number, timeframe: AnalyticsTimeframe) {
  const buckets = analyticsBuckets(timeframe);
  const rows = database.prepare(`SELECT viewed_on AS viewedOn, COUNT(*) AS count FROM chapter_views
    WHERE chapter_id = ? AND work_id = ? AND viewed_on >= ? GROUP BY viewed_on`)
    .all(chapterId, workId, analyticsPeriodStart(timeframe)) as Array<{ viewedOn: string; count: number }>;
  const values = new Map<string, number>();
  rows.forEach((row) => {
    const bucket = analyticsBucket(row.viewedOn, timeframe);
    values.set(bucket, (values.get(bucket) ?? 0) + Number(row.count));
  });
  const totalViews = Number((database.prepare("SELECT COUNT(DISTINCT visitor_key) AS count FROM chapter_views WHERE chapter_id = ?").get(chapterId) as { count: number }).count);
  const progressRows = database.prepare("SELECT threshold, COUNT(*) AS count FROM chapter_progress WHERE chapter_id = ? GROUP BY threshold")
    .all(chapterId) as Array<{ threshold: number; count: number }>;
  const counts = new Map(progressRows.map((row) => [Number(row.threshold), Number(row.count)]));
  return { buckets, totalViews, values: buckets.map((bucket) => values.get(bucket) ?? 0), progress: [25, 50, 75, 100].map((threshold) => ({ threshold, count: counts.get(threshold) ?? 0, percentage: totalViews ? Math.round(((counts.get(threshold) ?? 0) / totalViews) * 1000) / 10 : 0 })) };
}

export function getChapterById(workId: number, chapterId: number) {
  return database
    .prepare("SELECT * FROM chapters WHERE id = ? AND work_id = ?")
    .get(chapterId, workId) as ChapterRecord | undefined;
}

export function createChapterNotifications(workId: number, chapterId: number) {
  database.prepare(`
    INSERT OR IGNORE INTO notifications (user_id, work_id, chapter_id)
    SELECT user_id, work_id, ? FROM work_followers WHERE work_id = ?
  `).run(chapterId, workId);
  return database.prepare(`
    SELECT users.id AS userId, users.email
    FROM work_followers
    JOIN users ON users.id = work_followers.user_id
    WHERE work_followers.work_id = ?
  `).all(workId) as { userId: number; email: string | null }[];
}

export function getUserNotifications(userId: number, limit = 8) {
  return database.prepare(`
    SELECT 'chapter' AS type, notifications.id, notifications.read_at AS readAt, notifications.created_at AS createdAt,
      works.slug AS workSlug, works.title AS workTitle,
      chapters.public_slug AS chapterSlug, chapters.title AS chapterTitle,
      NULL AS senderUsername, NULL AS messagePreview
    FROM notifications
    JOIN works ON works.id = notifications.work_id
    JOIN chapters ON chapters.id = notifications.chapter_id
    WHERE notifications.user_id = ?
    UNION ALL
    SELECT 'message' AS type, message_notifications.id, message_notifications.read_at AS readAt,
      message_notifications.created_at AS createdAt, NULL, NULL, NULL, NULL,
      users.username AS senderUsername,
      COALESCE(NULLIF(substr(messages.content, 1, 100), ''), 'Изображение') AS messagePreview
    FROM message_notifications
    JOIN messages ON messages.id = message_notifications.message_id
    JOIN users ON users.id = messages.sender_id
    WHERE message_notifications.user_id = ?
    ORDER BY 4 DESC, 2 DESC
    LIMIT ?
  `).all(userId, userId, limit) as Array<{
    type: "chapter" | "message";
    id: number;
    readAt: string | null;
    createdAt: string;
    workSlug: string | null;
    workTitle: string | null;
    chapterSlug: string | null;
    chapterTitle: string | null;
    senderUsername: string | null;
    messagePreview: string | null;
  }>;
}

export function getUnreadNotificationCount(userId: number) {
  const chapterCount = (database.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId) as { count: number }).count;
  const messageCount = (database.prepare("SELECT COUNT(*) AS count FROM message_notifications WHERE user_id = ? AND read_at IS NULL").get(userId) as { count: number }).count;
  return chapterCount + messageCount;
}

export function markNotificationsRead(userId: number) {
  database.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL").run(userId);
  database.prepare("UPDATE message_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL").run(userId);
}

export function getDialogMessages(userId: number, peerId: number) {
  return database.prepare(`
    SELECT current_message.id, current_message.sender_id AS senderId, current_message.recipient_id AS recipientId,
      current_message.content, current_message.image_url AS imageUrl, current_message.reply_to_id AS replyToId,
      current_message.edited_at AS editedAt, current_message.created_at AS createdAt,
      replied.content AS replyContent, replied.image_url AS replyImageUrl,
      replied_users.username AS replyUsername
    FROM messages AS current_message
    LEFT JOIN messages AS replied ON replied.id = current_message.reply_to_id
    LEFT JOIN users AS replied_users ON replied_users.id = replied.sender_id
    WHERE (current_message.sender_id = ? AND current_message.recipient_id = ?)
      OR (current_message.sender_id = ? AND current_message.recipient_id = ?)
    ORDER BY current_message.created_at, current_message.id
    LIMIT 500
  `).all(userId, peerId, peerId, userId) as Array<{
    id: number;
    senderId: number;
    recipientId: number;
    content: string;
    imageUrl: string | null;
    replyToId: number | null;
    editedAt: string | null;
    createdAt: string;
    replyContent: string | null;
    replyImageUrl: string | null;
    replyUsername: string | null;
  }>;
}

export function createMessage(senderId: number, recipientId: number, content: string, imageUrl: string | null, replyToId: number | null, notifyRecipient = true) {
  if (replyToId) {
    const reply = database.prepare(`
      SELECT 1 FROM messages WHERE id = ? AND
        ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
    `).get(replyToId, senderId, recipientId, recipientId, senderId);
    if (!reply) replyToId = null;
  }
  const result = database.prepare("INSERT INTO messages (sender_id, recipient_id, content, image_url, reply_to_id) VALUES (?, ?, ?, ?, ?)")
    .run(senderId, recipientId, content, imageUrl, replyToId);
  const messageId = Number(result.lastInsertRowid);
  if (notifyRecipient) {
    database.prepare("INSERT INTO message_notifications (user_id, message_id) VALUES (?, ?)").run(recipientId, messageId);
  }
  return messageId;
}

export function markDialogNotificationsRead(userId: number, peerId: number) {
  database.prepare(`
    UPDATE message_notifications SET read_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND read_at IS NULL AND message_id IN (
      SELECT id FROM messages WHERE sender_id = ? AND recipient_id = ?
    )
  `).run(userId, peerId, userId);
}

export function editMessage(messageId: number, senderId: number, content: string) {
  return database.prepare("UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND sender_id = ?")
    .run(content, messageId, senderId).changes > 0;
}

export function deleteMessage(messageId: number, senderId: number) {
  return database.prepare("DELETE FROM messages WHERE id = ? AND sender_id = ?")
    .run(messageId, senderId).changes > 0;
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

const workSelect = `
  SELECT works.id, works.slug, works.owner_id AS ownerId, works.title, works.description, works.notes,
    works.cover_url AS coverUrl, works.cover_position_x AS coverPositionX,
    works.cover_position_y AS coverPositionY, works.cover_zoom AS coverZoom,
    works.published, works.created_at AS createdAt,
    users.id AS userId, users.username, users.avatar_url AS avatarUrl
  FROM works JOIN users ON users.id = works.owner_id
`;

function mapWork(row: any) {
  const { userId, username, avatarUrl, ...work } = row;
  return { ...work, owner: { id: userId, username, avatarUrl } } as WorkRecord;
}

export function getPublishedWorks(limit?: number) {
  const query = `${workSelect} WHERE works.published = 1 ORDER BY works.created_at DESC, works.id DESC${limit ? " LIMIT ?" : ""}`;
  return ((limit ? database.prepare(query).all(limit) : database.prepare(query).all()) as any[])
    .map(mapWork);
}

export function enrichWorkCards(works: WorkRecord[], userId?: number): WorkCardRecord[] {
  if (works.length === 0) return [];
  const placeholders = works.map(() => "?").join(", ");
  const ids = works.map((work) => work.id);
  const chapterMetrics = database.prepare(`
    SELECT work_id AS workId, content, public_slug AS publicSlug
    FROM chapters
    WHERE published = 1 AND work_id IN (${placeholders})
    ORDER BY work_id, sort_order, id
  `).all(...ids) as { workId: number; content: string; publicSlug: string }[];
  const likes = database.prepare(`
    SELECT work_id AS workId, COUNT(*) AS likeCount
    FROM work_likes WHERE work_id IN (${placeholders}) GROUP BY work_id
  `).all(...ids) as { workId: number; likeCount: number }[];
  const tagRows = database.prepare(`
    SELECT work_tags.work_id AS workId, tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage,
      (SELECT COUNT(*) FROM work_tags AS tag_usage WHERE tag_usage.tag_id = tags.id) AS workCount
    FROM work_tags JOIN tags ON tags.id = work_tags.tag_id
    WHERE work_tags.work_id IN (${placeholders})
    ORDER BY work_tags.work_id, work_tags.sort_order, work_tags.created_at, tags.name COLLATE NOCASE
  `).all(...ids) as (TagRecord & { workId: number })[];
  const likedIds = userId ? new Set((database.prepare(`SELECT work_id AS workId FROM work_likes WHERE user_id = ? AND work_id IN (${placeholders})`).all(userId, ...ids) as { workId: number }[]).map((row) => row.workId)) : new Set<number>();
  const followedIds = userId ? new Set((database.prepare(`SELECT work_id AS workId FROM work_followers WHERE user_id = ? AND work_id IN (${placeholders})`).all(userId, ...ids) as { workId: number }[]).map((row) => row.workId)) : new Set<number>();
  const metricById = new Map<number, { chapterCount: number; totalPages: number; firstChapterSlug: string }>();
  for (const chapter of chapterMetrics) {
    const metric = metricById.get(chapter.workId);
    if (metric) {
      metric.chapterCount += 1;
      metric.totalPages += countPages(chapter.content);
    } else {
      metricById.set(chapter.workId, {
        chapterCount: 1,
        totalPages: countPages(chapter.content),
        firstChapterSlug: chapter.publicSlug,
      });
    }
  }
  const likesById = new Map(likes.map((row) => [row.workId, row.likeCount]));
  const tagsById = new Map<number, TagRecord[]>();
  for (const { workId, ...tag } of tagRows) tagsById.set(workId, [...(tagsById.get(workId) ?? []), tag]);
  return works.map((work) => {
    const metric = metricById.get(work.id);
    return {
      ...work,
      chapterCount: metric?.chapterCount ?? 0,
      firstChapterSlug: metric?.firstChapterSlug ?? null,
      totalPages: metric?.totalPages ?? 0,
      likeCount: likesById.get(work.id) ?? 0,
      liked: likedIds.has(work.id),
      following: followedIds.has(work.id),
      tags: tagsById.get(work.id) ?? [],
    };
  });
}

function mapTag(row: any): TagRecord {
  return {
    id: row.id, slug: row.slug,
    name: row.nameRu || row.name, description: row.descriptionRu ?? row.description,
    nameRu: row.nameRu || row.name, nameUk: row.nameUk || row.name,
    descriptionRu: row.descriptionRu ?? row.description, descriptionUk: row.descriptionUk ?? row.description,
    sourceLanguage: row.sourceLanguage === "uk" ? "uk" : "ru",
    workCount: Number(row.workCount ?? 0),
  };
}

export function getAllTags() {
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, COUNT(work_tags.work_id) AS workCount
    FROM tags LEFT JOIN work_tags ON work_tags.tag_id = tags.id
    GROUP BY tags.id ORDER BY tags.name COLLATE NOCASE
  `).all() as any[]).map(mapTag);
}

function getFilteredTagsForAdmin(nameQuery = "", descriptionQuery = "", sort: "popular" | "unpopular" | "newest" = "popular") {
  const rows = database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, tags.created_at AS createdAt,
      COUNT(work_tags.work_id) AS workCount
    FROM tags LEFT JOIN work_tags ON work_tags.tag_id = tags.id
    GROUP BY tags.id
  `).all() as Array<Record<string, unknown> & { createdAt: string }>;
  const normalizedName = normalizeTagName(nameQuery);
  const normalizedDescription = normalizeTagName(descriptionQuery);
  return rows
    .filter((row) => !normalizedName || normalizeTagName(String(row.nameRu ?? row.name)).includes(normalizedName) || normalizeTagName(String(row.nameUk ?? row.name)).includes(normalizedName))
    .filter((row) => !normalizedDescription || normalizeTagName(String(row.descriptionRu ?? row.description ?? "")).includes(normalizedDescription) || normalizeTagName(String(row.descriptionUk ?? row.description ?? "")).includes(normalizedDescription))
    .sort((left, right) => {
      if (sort === "newest") return right.createdAt.localeCompare(left.createdAt) || Number(right.id) - Number(left.id);
      const difference = Number(left.workCount) - Number(right.workCount);
      if (difference) return sort === "unpopular" ? difference : -difference;
      return String(left.nameRu ?? left.name).localeCompare(String(right.nameRu ?? right.name), "ru");
    });
}

export function getTagsForAdmin(limit: number, offset: number, nameQuery = "", descriptionQuery = "", sort: "popular" | "unpopular" | "newest" = "popular") {
  return getFilteredTagsForAdmin(nameQuery, descriptionQuery, sort).slice(offset, offset + limit).map(mapTag);
}

export function countTags(nameQuery = "", descriptionQuery = "") {
  return getFilteredTagsForAdmin(nameQuery, descriptionQuery).length;
}

export function updateTagManually(id: number, input: { nameRu: string; nameUk: string; descriptionRu: string; descriptionUk: string }) {
  const nameRu = input.nameRu.trim().replace(/\s+/g, " ");
  const nameUk = input.nameUk.trim().replace(/\s+/g, " ");
  const descriptionRu = input.descriptionRu.trim();
  const descriptionUk = input.descriptionUk.trim();
  if (!nameRu || !nameUk) return { error: "Укажите название метки на обоих языках." } as const;
  if (nameRu.length > 60 || nameUk.length > 60) return { error: "Название метки не должно превышать 60 символов." } as const;
  if (descriptionRu.length > 500 || descriptionUk.length > 500) return { error: "Описание метки не должно превышать 500 символов." } as const;
  const nameRuKey = normalizeTagName(nameRu);
  const nameUkKey = normalizeTagName(nameUk);
  const duplicate = database.prepare(`SELECT id FROM tags WHERE id <> ? AND
    (name_ru_key IN (?, ?) OR name_uk_key IN (?, ?)) LIMIT 1`)
    .get(id, nameRuKey, nameUkKey, nameRuKey, nameUkKey);
  if (duplicate) return { error: "Метка с таким названием уже существует." } as const;
  const result = database.prepare(`UPDATE tags SET name = ?, name_key = ?, description = ?,
    name_ru = ?, name_uk = ?, description_ru = ?, description_uk = ?,
    name_ru_key = ?, name_uk_key = ?, source_language = 'ru', translation_complete = 1 WHERE id = ?`)
    .run(nameRu, nameRuKey, descriptionRu, nameRu, nameUk, descriptionRu, descriptionUk, nameRuKey, nameUkKey, id);
  return result.changes ? { ok: true } as const : { error: "Метка не найдена." } as const;
}

export function deleteTag(id: number) {
  return database.prepare("DELETE FROM tags WHERE id = ?").run(id).changes > 0;
}

export function searchTags(query: string, limit = 20, excludedIds: number[] = []) {
  const normalizedQuery = normalizeTagName(query);
  const validExcludedIds = [...new Set(excludedIds.filter(Number.isInteger))];
  const exclusion = validExcludedIds.length ? `AND tags.id NOT IN (${validExcludedIds.map(() => "?").join(", ")})` : "";
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, COUNT(work_tags.work_id) AS workCount
    FROM tags LEFT JOIN work_tags ON work_tags.tag_id = tags.id
    WHERE (? = '' OR instr(tags.name_ru_key, ?) > 0 OR instr(tags.name_uk_key, ?) > 0)
      ${exclusion}
    GROUP BY tags.id
    ORDER BY CASE WHEN tags.name_ru_key = ? OR tags.name_uk_key = ? THEN 0
      WHEN tags.name_ru_key LIKE ? OR tags.name_uk_key LIKE ? THEN 1 ELSE 2 END,
      workCount DESC, tags.name COLLATE NOCASE
    LIMIT ?
  `).all(normalizedQuery, normalizedQuery, normalizedQuery, ...validExcludedIds,
    normalizedQuery, normalizedQuery, `${normalizedQuery}%`, `${normalizedQuery}%`, limit) as any[]).map(mapTag);
}

export function getPopularPublishedTags(limit = 100) {
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, COUNT(DISTINCT works.id) AS workCount
    FROM tags JOIN work_tags ON work_tags.tag_id = tags.id
    JOIN works ON works.id = work_tags.work_id AND works.published = 1
    GROUP BY tags.id ORDER BY workCount DESC, tags.name COLLATE NOCASE LIMIT ?
  `).all(limit) as any[]).map(mapTag);
}

export function searchPublishedTags(query: string, limit = 20, excludedSlugs: string[] = []) {
  const normalizedQuery = normalizeTagName(query);
  const validExcludedSlugs = [...new Set(excludedSlugs.filter(Boolean))];
  const exclusion = validExcludedSlugs.length ? `AND tags.slug NOT IN (${validExcludedSlugs.map(() => "?").join(", ")})` : "";
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, COUNT(DISTINCT works.id) AS workCount
    FROM tags JOIN work_tags ON work_tags.tag_id = tags.id
    JOIN works ON works.id = work_tags.work_id AND works.published = 1
    WHERE (? = '' OR instr(tags.name_ru_key, ?) > 0 OR instr(tags.name_uk_key, ?) > 0)
      ${exclusion}
    GROUP BY tags.id
    ORDER BY CASE WHEN tags.name_ru_key = ? OR tags.name_uk_key = ? THEN 0
      WHEN tags.name_ru_key LIKE ? OR tags.name_uk_key LIKE ? THEN 1 ELSE 2 END,
      workCount DESC, tags.name COLLATE NOCASE LIMIT ?
  `).all(normalizedQuery, normalizedQuery, normalizedQuery, ...validExcludedSlugs,
    normalizedQuery, normalizedQuery, `${normalizedQuery}%`, `${normalizedQuery}%`, limit) as any[]).map(mapTag);
}

export function getPublishedTagsBySlugs(slugs: string[]) {
  const validSlugs = [...new Set(slugs.filter(Boolean))];
  if (!validSlugs.length) return [];
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage, COUNT(DISTINCT works.id) AS workCount
    FROM tags JOIN work_tags ON work_tags.tag_id = tags.id
    JOIN works ON works.id = work_tags.work_id AND works.published = 1
    WHERE tags.slug IN (${validSlugs.map(() => "?").join(", ")})
    GROUP BY tags.id ORDER BY tags.name COLLATE NOCASE
  `).all(...validSlugs) as any[]).map(mapTag);
}

export function getWorkTags(workId: number) {
  return (database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage,
      (SELECT COUNT(*) FROM work_tags WHERE work_tags.tag_id = tags.id) AS workCount
    FROM tags JOIN work_tags ON work_tags.tag_id = tags.id
    WHERE work_tags.work_id = ? ORDER BY work_tags.sort_order, work_tags.created_at, tags.name COLLATE NOCASE
  `).all(workId) as any[]).map(mapTag);
}

export function createTag(input: { name: string; description: string; translatedName: string; translatedDescription: string; sourceLanguage: "ru" | "uk" }) {
  const { name, description, translatedName, translatedDescription, sourceLanguage } = input;
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const normalizedTranslation = translatedName.trim().replace(/\s+/g, " ");
  const nameRu = sourceLanguage === "ru" ? normalizedName : normalizedTranslation;
  const nameUk = sourceLanguage === "uk" ? normalizedName : normalizedTranslation;
  const descriptionRu = sourceLanguage === "ru" ? description.trim() : translatedDescription.trim();
  const descriptionUk = sourceLanguage === "uk" ? description.trim() : translatedDescription.trim();
  const nameKey = normalizeTagName(normalizedName);
  const nameRuKey = normalizeTagName(nameRu);
  const nameUkKey = normalizeTagName(nameUk);
  const normalizedDescription = description.trim();
  if (!normalizedName) return { error: "Введите название метки." } as const;
  if (normalizedName.length > 60) return { error: "Название метки не должно превышать 60 символов." } as const;
  if (normalizedDescription.length > 500) return { error: "Описание метки не должно превышать 500 символов." } as const;
  const existing = database.prepare(`SELECT id FROM tags WHERE name_ru_key IN (?, ?) OR name_uk_key IN (?, ?)`)
    .get(nameRuKey, nameUkKey, nameRuKey, nameUkKey);
  if (existing) return { error: "Такая метка уже существует." } as const;
  try {
    const result = database.prepare(`INSERT INTO tags (
      slug, name, name_key, description, name_ru, name_uk, description_ru, description_uk,
      name_ru_key, name_uk_key, source_language, translation_complete
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(randomUUID(), normalizedName, nameKey, normalizedDescription, nameRu, nameUk,
        descriptionRu, descriptionUk, nameRuKey, nameUkKey, sourceLanguage);
    return { tag: getAllTags().find((tag) => tag.id === Number(result.lastInsertRowid))! } as const;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) return { error: "Такая метка уже существует." } as const;
    throw error;
  }
}

export function getTagsPendingTranslation(limit = 20) {
  return database.prepare(`SELECT id, name, description, source_language AS sourceLanguage
    FROM tags WHERE translation_complete = 0 ORDER BY id LIMIT ?`).all(limit) as Array<{
      id: number; name: string; description: string; sourceLanguage: "ru" | "uk";
    }>;
}

export function saveTagTranslation(id: number, translatedName: string, translatedDescription: string, sourceLanguage: "ru" | "uk") {
  const tag = database.prepare("SELECT name, description FROM tags WHERE id = ?").get(id) as { name: string; description: string } | undefined;
  if (!tag) return;
  const nameRu = sourceLanguage === "ru" ? tag.name : translatedName.trim();
  const nameUk = sourceLanguage === "uk" ? tag.name : translatedName.trim();
  const descriptionRu = sourceLanguage === "ru" ? tag.description : translatedDescription.trim();
  const descriptionUk = sourceLanguage === "uk" ? tag.description : translatedDescription.trim();
  database.prepare(`UPDATE tags SET name_ru = ?, name_uk = ?, description_ru = ?, description_uk = ?,
    name_ru_key = ?, name_uk_key = ?, translation_complete = 1 WHERE id = ?`)
    .run(nameRu, nameUk, descriptionRu, descriptionUk, normalizeTagName(nameRu), normalizeTagName(nameUk), id);
}

export function setWorkTags(workId: number, tagIds: number[]) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM work_tags WHERE work_id = ?").run(workId);
    const insert = database.prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id, sort_order) SELECT ?, id, ? FROM tags WHERE id = ?");
    [...new Set(tagIds)].forEach((tagId, index) => insert.run(workId, index + 1, tagId));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getTagBySlug(slug: string) {
  const row = database.prepare(`
    SELECT tags.id, tags.slug, tags.name, tags.description,
      tags.name_ru AS nameRu, tags.name_uk AS nameUk,
      tags.description_ru AS descriptionRu, tags.description_uk AS descriptionUk,
      tags.source_language AS sourceLanguage,
      COUNT(CASE WHEN works.published = 1 THEN 1 END) AS workCount
    FROM tags LEFT JOIN work_tags ON work_tags.tag_id = tags.id
    LEFT JOIN works ON works.id = work_tags.work_id
    WHERE tags.slug = ? GROUP BY tags.id
  `).get(slug);
  return row ? mapTag(row) : undefined;
}

export function getPublishedWorksByTag(tagId: number) {
  return (database.prepare(`${workSelect} JOIN work_tags ON work_tags.work_id = works.id
    WHERE works.published = 1 AND work_tags.tag_id = ? ORDER BY works.created_at DESC, works.id DESC`).all(tagId) as any[]).map(mapWork);
}

export function getAllWorks() {
  return (database.prepare(`${workSelect} ORDER BY works.created_at DESC, works.id DESC`).all() as any[]).map(mapWork);
}

export function getWorksByOwner(ownerId: number, includeHidden = false) {
  return (database.prepare(`${workSelect} WHERE works.owner_id = ? ${includeHidden ? "" : "AND works.published = 1"} ORDER BY works.created_at DESC, works.id DESC`).all(ownerId) as any[])
    .map(mapWork);
}

export function getWorkBySlug(slug: string, includeHidden = false) {
  const row = database.prepare(`${workSelect} WHERE works.slug = ? ${includeHidden ? "" : "AND works.published = 1"}`).get(slug);
  return row ? mapWork(row) : undefined;
}

export function getWorkById(id: number) {
  const row = database.prepare(`${workSelect} WHERE works.id = ?`).get(id);
  return row ? mapWork(row) : undefined;
}

export function canManageWork(user: PublicUser, workId: number) {
  if (user.role === "admin") return true;
  return Boolean(database.prepare("SELECT 1 FROM works WHERE id = ? AND owner_id = ?").get(workId, user.id));
}

export function createWork(ownerId: number) {
  const slug = randomUUID();
  const result = database.prepare(`
    INSERT INTO works (slug, owner_id, title, description, published)
    VALUES (?, ?, 'Новая работа', '', 0)
  `).run(slug, ownerId);
  return Number(result.lastInsertRowid);
}

export function ensureInitialWork(ownerId: number) {
  database.prepare(`
    INSERT OR IGNORE INTO works (
      id, slug, owner_id, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, published
    )
    SELECT 1, 'phantom-freedom', ?, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, 1
    FROM book_settings WHERE id = 1
  `).run(ownerId);
  database.prepare("UPDATE chapters SET work_id = 1 WHERE work_id IS NULL").run();
}

export function saveWork(id: number, settings: BookSettings) {
  database.prepare(`
    UPDATE works SET title = ?, description = ?, notes = ?, cover_url = ?,
      cover_position_x = ?, cover_position_y = ?, cover_zoom = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    settings.title, settings.description, settings.notes, settings.coverUrl,
    settings.coverPositionX, settings.coverPositionY, settings.coverZoom, id,
  );
}

export function setWorkPublished(id: number, published: boolean) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const work = database.prepare("SELECT published FROM works WHERE id = ?")
      .get(id) as { published: number } | undefined;
    if (!work || work.published === (published ? 1 : 0)) {
      database.exec("COMMIT");
      return;
    }

    if (published) {
      database.prepare(`
        UPDATE chapters
        SET published = COALESCE(published_before_work_hide, published),
            published_before_work_hide = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE work_id = ?
      `).run(id);
    } else {
      database.prepare(`
        UPDATE chapters
        SET published_before_work_hide = published,
            published = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE work_id = ?
      `).run(id);
    }

    database.prepare("UPDATE works SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(published ? 1 : 0, id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function deleteWork(id: number) {
  database.prepare("DELETE FROM works WHERE id = ?").run(id);
}

export function getPublishedChapters(workId: number) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE work_id = ? AND published = 1 ORDER BY sort_order, id
  `).all(workId) as unknown as ChapterRecord[];
}

export function getAllChapters(workId: number) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE work_id = ? ORDER BY sort_order, id
  `).all(workId) as unknown as ChapterRecord[];
}

export function getChapter(workId: number, publicSlug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE work_id = ? AND public_slug = ? AND published = 1
  `).get(workId, publicSlug) as ChapterRecord | undefined;
}

export function getChapterBySlug(workId: number, slug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE work_id = ? AND slug = ?
  `).get(workId, slug) as ChapterRecord | undefined;
}

export function getChapterByPublicSlug(workId: number, publicSlug: string) {
  return database.prepare(`
    SELECT id, slug, public_slug AS publicSlug, number, title, subtitle, reading_time AS readingTime, content, sort_order AS sortOrder, published
    FROM chapters WHERE work_id = ? AND public_slug = ?
  `).get(workId, publicSlug) as ChapterRecord | undefined;
}

export const getChapterForEditing = getChapterBySlug;

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

export function createChapter(workId: number) {
  const next = database.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder
    FROM chapters WHERE work_id = ?
  `).get(workId) as { sortOrder: number };
  const position = next.sortOrder;
  const slug = randomUUID();
  const publicSlug = randomUUID();
  database.prepare(`
    INSERT INTO chapters (work_id, slug, public_slug, number, title, subtitle, content, sort_order, published)
    VALUES (?, ?, ?, ?, 'Новая глава', '', '', ?, 0)
  `).run(workId, slug, publicSlug, String(position), position);
  return slug;
}

export function deleteChapter(workId: number, id: number) {
  database.prepare("DELETE FROM chapters WHERE id = ? AND work_id = ?").run(id, workId);
  normalizeChapterOrder(workId);
}

export function reorderChapters(workId: number, ids: number[]) {
  const existing = getAllChapters(workId).map((chapter) => chapter.id);
  if (ids.length !== existing.length || !existing.every((id) => ids.includes(id))) {
    throw new Error("Invalid chapter order");
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const update = database.prepare("UPDATE chapters SET sort_order = ?, number = ? WHERE id = ? AND work_id = ?");
    ids.forEach((id, index) => update.run(index + 1, String(index + 1), id, workId));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function normalizeChapterOrder(workId = 1) {
  const ids = (database.prepare("SELECT id FROM chapters WHERE work_id = ? ORDER BY sort_order, id").all(workId) as { id: number }[])
    .map((row) => row.id);
  if (ids.length > 0) reorderChapters(workId, ids);
}
