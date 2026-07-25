import { useEffect, useState } from "react";
import { Form, Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/admin-chapters";
import { requireAdmin } from "../auth.server";
import {
  createChapter,
  getAllChapters,
  getBookSettings,
  reorderChapters,
  saveBookSettings,
} from "../database.server";
import { Header } from "../components/header";
import { countPages, countTotalPages, formatChapters, formatPages } from "../text-metrics";

export function meta() {
  return [{ title: "Редактор — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const chapters = getAllChapters();
  return {
    book: getBookSettings(),
    chapters: chapters.map((chapter) => ({ ...chapter, pages: countPages(chapter.content) })),
    totalPages: countTotalPages(chapters.map((chapter) => chapter.content)),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "save-book") {
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (!title) return { ok: false, error: "Название не может быть пустым." };
    saveBookSettings({ title, description, notes: getBookSettings().notes });
    return { ok: true };
  }

  if (intent === "save-notes") {
    const current = getBookSettings();
    saveBookSettings({ ...current, notes: String(form.get("notes") ?? "").trim() });
    return { ok: true };
  }

  if (intent === "create-chapter") {
    return redirect(`/admin/chapters/${createChapter()}`);
  }

  if (intent === "reorder") {
    const order = JSON.parse(String(form.get("order") ?? "[]")) as number[];
    reorderChapters(order);
    return { ok: true };
  }

  return { ok: false };
}

export default function AdminChapters({ loaderData, actionData }: Route.ComponentProps) {
  const reorderFetcher = useFetcher();
  const [chapters, setChapters] = useState(loaderData.chapters);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  useEffect(() => setChapters(loaderData.chapters), [loaderData.chapters]);

  function moveChapter(targetId: number) {
    if (draggedId === null || draggedId === targetId) return;
    const next = [...chapters];
    const from = next.findIndex((chapter) => chapter.id === draggedId);
    const to = next.findIndex((chapter) => chapter.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setChapters(next);
    setDraggedId(null);
    reorderFetcher.submit(
      { intent: "reorder", order: JSON.stringify(next.map((chapter) => chapter.id)) },
      { method: "post" },
    );
  }

  return (
    <main className="admin-page">
      <Header />
      <section className="admin-shell">
        <div className="admin-section">
          <p className="eyebrow">Основная информация</p>
          <h1>Шапка работы</h1>
          <Form method="post" className="editor-form book-header-form">
            <input type="hidden" name="intent" value="save-book" />
            <label>Название<input name="title" defaultValue={loaderData.book.title} required /></label>
            <label>Описание<textarea name="description" rows={5} defaultValue={loaderData.book.description} /></label>
            {actionData?.error && <p className="form-error">{actionData.error}</p>}
            <button type="submit">Сохранить шапку</button>
          </Form>
        </div>

        <div className="admin-section">
          <p className="eyebrow">Дополнительная информация</p>
          <h1>Примечания</h1>
          <Form method="post" className="editor-form book-header-form">
            <input type="hidden" name="intent" value="save-notes" />
            <label>Текст примечания<textarea name="notes" rows={7} defaultValue={loaderData.book.notes} /></label>
            <button type="submit">Сохранить примечания</button>
          </Form>
        </div>

        <div className="admin-section">
          <p className="eyebrow">Управление содержанием</p>
          <h1>Главы</h1>
          <div className="admin-summary">
            <span>Общий объём текста</span>
            <div className="admin-summary__values">
              <strong>{formatChapters(loaderData.chapters.length)}</strong>
              <b>{formatPages(loaderData.totalPages)}</b>
            </div>
            <small>Расчёт: 1800 символов на страницу</small>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="create-chapter" />
            <button className="add-chapter-button" type="submit">
              <span>+</span>
              Добавить главу
            </button>
          </Form>
          <div className="admin-list">
            {chapters.map((chapter) => (
              <div
                className={`admin-list__item ${draggedId === chapter.id ? "admin-list__item--dragging" : ""}`}
                key={chapter.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveChapter(chapter.id)}
              >
                <button
                  className="drag-handle"
                  type="button"
                  draggable
                  aria-label={`Переместить главу ${chapter.title}`}
                  onDragStart={() => setDraggedId(chapter.id)}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <span>⠿</span>
                </button>
                <span>{chapter.number}</span>
                <Link to={`/admin/chapters/${chapter.id}`}>{chapter.title}</Link>
                <strong className={`publication-badge ${chapter.published === 1 ? "publication-badge--yes" : ""}`}>
                  Опубликована: {chapter.published === 1 ? "Да" : "Нет"}
                </strong>
                <em>{formatPages(chapter.pages)}</em>
                <Link className="admin-list__edit" to={`/admin/chapters/${chapter.id}`}>Редактировать →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
