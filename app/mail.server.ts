import type { ChapterRecord } from "./database.server";
import { getBookSettings, getNotificationRecipients } from "./database.server";

async function sendMail(to: string | string[], subject: string, html: string, bcc?: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.warn("Email skipped: RESEND_API_KEY and MAIL_FROM are not configured.");
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, bcc, subject, html }),
    });
    if (!response.ok) console.error("Email delivery failed:", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Email delivery failed:", error);
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail(
    email,
    "Восстановление пароля — Phantom Freedom",
    `<p>Вы запросили восстановление пароля.</p><p><a href="${link}">Установить новый пароль</a></p><p>Ссылка действует один час.</p>`,
  );
}

export async function sendNewChapterNotification(chapter: ChapterRecord) {
  const recipients = getNotificationRecipients().map(({ email }) => email);
  if (recipients.length === 0) return;
  const sender = process.env.MAIL_FROM ?? "notifications@invalid.local";
  const book = getBookSettings();
  const baseUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  for (let index = 0; index < recipients.length; index += 50) {
    await sendMail(
      sender,
      `Новая глава «${chapter.title}» — ${book.title}`,
      `<p>Опубликована новая глава: <strong>${escapeHtml(chapter.title)}</strong>.</p><p><a href="${baseUrl}/chapters/${encodeURIComponent(chapter.publicSlug)}">Читать главу</a></p>`,
      recipients.slice(index, index + 50),
    );
  }
}
