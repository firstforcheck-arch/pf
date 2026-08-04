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
  accountPlus: number;
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
`);

try {
  database.exec("ALTER TABLE chapters ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE users ADD COLUMN account_plus INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
}
try {
  database.exec("ALTER TABLE users ADD COLUMN last_seen TEXT NOT NULL DEFAULT ''");
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
const firstUser = database.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as { id: number } | undefined;
if (firstUser) {
  database.prepare("UPDATE users SET username = username || '_legacy' WHERE username = 'Phantom_Fighter' AND id <> ?").run(firstUser.id);
  database.prepare("UPDATE users SET username = 'Phantom_Fighter', role = 'admin', account_plus = 1 WHERE id = ?").run(firstUser.id);
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
`);
if (firstUser) {
  database.prepare(`
    INSERT OR IGNORE INTO works (
      id, slug, owner_id, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, published
    )
    SELECT 1, 'phantom-freedom', ?, title, description, notes, cover_url,
      cover_position_x, cover_position_y, cover_zoom, 1
    FROM book_settings WHERE id = 1
  `).run(firstUser.id);
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

export function createUser(username: string, passwordHash: string, role: PublicUser["role"]) {
  const result = database
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, passwordHash, role);
  return Number(result.lastInsertRowid);
}

export function findUserByUsername(username: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role, account_plus AS accountPlus, last_seen AS lastSeen FROM users WHERE username = ?")
    .get(username) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserByEmail(email: string) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, password_hash AS passwordHash, role, account_plus AS accountPlus, last_seen AS lastSeen FROM users WHERE email = ?")
    .get(email) as (PublicUser & { passwordHash: string }) | undefined;
}

export function findUserById(id: number) {
  return database
    .prepare("SELECT id, username, email, avatar_url AS avatarUrl, role, account_plus AS accountPlus, last_seen AS lastSeen FROM users WHERE id = ?")
    .get(id) as PublicUser | undefined;
}

export function getUsersForAdmin(adminId: number, username = "", email = "", accessLevel = "") {
  const usernameFilter = `%${username.trim()}%`;
  const emailFilter = `%${email.trim()}%`;
  const accountPlusFilter = accessLevel === "account-plus" ? 1 : accessLevel === "reader" ? 0 : null;
  return database.prepare(`
    SELECT id, username, email, avatar_url AS avatarUrl, role,
      account_plus AS accountPlus, last_seen AS lastSeen
    FROM users
    WHERE id <> ?
      AND (? = '%%' OR username LIKE ? COLLATE NOCASE)
      AND (? = '%%' OR COALESCE(email, '') LIKE ? COLLATE NOCASE)
      AND (? IS NULL OR account_plus = ?)
    ORDER BY username COLLATE NOCASE, id
  `).all(adminId, usernameFilter, usernameFilter, emailFilter, emailFilter, accountPlusFilter, accountPlusFilter) as unknown as PublicUser[];
}

export function countUsersForAdmin(adminId: number) {
  return (database.prepare("SELECT COUNT(*) AS count FROM users WHERE id <> ?")
    .get(adminId) as { count: number }).count;
}

export function touchUser(id: number) {
  database.prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

export function setUserAccountPlus(id: number, enabled: boolean) {
  database.prepare("UPDATE users SET account_plus = ? WHERE id = ? AND role <> 'admin'").run(enabled ? 1 : 0, id);
}

export function getPublicUserByUsername(username: string) {
  return database.prepare(`
    SELECT id, username, avatar_url AS avatarUrl, role, account_plus AS accountPlus, last_seen AS lastSeen
    FROM users WHERE username = ?
  `).get(username) as Omit<PublicUser, "email"> | undefined;
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
  const metrics = database.prepare(`
    SELECT work_id AS workId, COUNT(*) AS chapterCount,
      COALESCE(group_concat(content, char(10) || char(10)), '') AS content,
      (
        SELECT first_chapter.public_slug
        FROM chapters AS first_chapter
        WHERE first_chapter.work_id = chapters.work_id AND first_chapter.published = 1
        ORDER BY first_chapter.sort_order, first_chapter.id
        LIMIT 1
      ) AS firstChapterSlug
    FROM chapters
    WHERE published = 1 AND work_id IN (${placeholders})
    GROUP BY work_id
  `).all(...ids) as { workId: number; chapterCount: number; content: string; firstChapterSlug: string }[];
  const likes = database.prepare(`
    SELECT work_id AS workId, COUNT(*) AS likeCount
    FROM work_likes WHERE work_id IN (${placeholders}) GROUP BY work_id
  `).all(...ids) as { workId: number; likeCount: number }[];
  const likedIds = userId ? new Set((database.prepare(`SELECT work_id AS workId FROM work_likes WHERE user_id = ? AND work_id IN (${placeholders})`).all(userId, ...ids) as { workId: number }[]).map((row) => row.workId)) : new Set<number>();
  const followedIds = userId ? new Set((database.prepare(`SELECT work_id AS workId FROM work_followers WHERE user_id = ? AND work_id IN (${placeholders})`).all(userId, ...ids) as { workId: number }[]).map((row) => row.workId)) : new Set<number>();
  const metricById = new Map(metrics.map((row) => [row.workId, row]));
  const likesById = new Map(likes.map((row) => [row.workId, row.likeCount]));
  return works.map((work) => {
    const metric = metricById.get(work.id);
    const characters = metric?.content.replace(/\s+/g, " ").trim().length ?? 0;
    return {
      ...work,
      chapterCount: metric?.chapterCount ?? 0,
      firstChapterSlug: metric?.firstChapterSlug ?? null,
      totalPages: characters === 0 ? 0 : Math.ceil(characters / 1800),
      likeCount: likesById.get(work.id) ?? 0,
      liked: likedIds.has(work.id),
      following: followedIds.has(work.id),
    };
  });
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
