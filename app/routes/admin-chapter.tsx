import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/admin-chapter";
import { requireAdmin } from "../auth.server";
import { deleteChapter, getAllChapters, getChapterForEditing, saveChapter, setChapterPublished } from "../database.server";
import { Header } from "../components/header";
import { useState } from "react";
import { countPages, countTotalPages, formatPages } from "../text-metrics";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const chapter = getChapterForEditing(Number(params.chapterId));
  if (!chapter) throw new Response("Глава не найдена", { status: 404 });
  const otherChapterTexts = getAllChapters()
    .filter((item) => item.id !== chapter.id)
    .map((item) => item.content);
  return { chapter, otherChapterTexts };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const current = getChapterForEditing(Number(params.chapterId));
  if (!current) throw new Response("Глава не найдена", { status: 404 });

  const form = await request.formData();
  if (form.get("intent") === "delete") {
    deleteChapter(current.id);
    return redirect("/admin/chapters");
  }
  if (form.get("intent") === "toggle-publication") {
    setChapterPublished(current.id, current.published !== 1);
    return redirect(`/admin/chapters/${current.id}`);
  }

  const chapter = {
    ...current,
    title: String(form.get("title") ?? "").trim(),
    subtitle: String(form.get("subtitle") ?? "").trim(),
    content: String(form.get("content") ?? ""),
  };

  if (!chapter.title) {
    return data({ error: "Название обязательно." }, { status: 400 });
  }

  try {
    saveChapter(chapter);
  } catch {
    return data({ error: "Не удалось сохранить. Проверьте уникальность адреса главы." }, { status: 400 });
  }
  return redirect("/admin/chapters");
}

export default function AdminChapter({ loaderData, actionData }: Route.ComponentProps) {
  const { chapter, otherChapterTexts } = loaderData;
  const [content, setContent] = useState(chapter.content);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publicationDialogOpen, setPublicationDialogOpen] = useState(false);
  const pages = countPages(content);
  const totalPages = countTotalPages([...otherChapterTexts, content]);
  return (
    <main className="admin-page">
      <Header beforeAction={(
        <a className="header-button" href={`/chapters/${chapter.slug}`}>Читать</a>
      )} />
      <section className="admin-shell admin-shell--editor">
        <p className="eyebrow">Редактор</p>
        <h1>{chapter.title}</h1>
        <div className="editor-metrics" aria-live="polite">
          <div>
            <span>Объём этой главы</span>
            <b>{formatPages(pages)}</b>
          </div>
          <div>
            <span>Вся работа</span>
            <b>{formatPages(totalPages)}</b>
          </div>
          <small>{content.replace(/\s+/g, " ").trim().length.toLocaleString("ru-RU")} знаков в текущей главе · 1800 знаков на страницу</small>
        </div>
        <Form method="post" className="editor-form">
          <div className="chapter-position-note">Глава {chapter.number} · адрес /chapters/{chapter.slug}</div>
          <label>Название<input name="title" defaultValue={chapter.title} required /></label>
          <label>Краткое описание<textarea name="subtitle" rows={3} defaultValue={chapter.subtitle} /></label>
          <label>Текст главы<textarea className="editor-form__content" name="content" rows={28} value={content} onChange={(event) => setContent(event.currentTarget.value)} /></label>
          <p className="editor-hint">Разделяйте абзацы одной пустой строкой. Одна условная страница равна 1800 знакам с пробелами.</p>
          {actionData?.error && <p className="form-error">{actionData.error}</p>}
          <button type="submit">Сохранить изменения</button>
        </Form>
        <div className="chapter-controls">
          <div className={`publication-zone ${chapter.published === 1 ? "publication-zone--published" : ""}`}>
            <div>
              <b>Публикация главы</b>
              <p>{chapter.published === 1 ? "Глава опубликована" : "Глава скрыта"}</p>
            </div>
            <button type="button" onClick={() => setPublicationDialogOpen(true)}>
              {chapter.published === 1 ? "Скрыть" : "Опубликовать"}
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <b>Удаление главы</b>
              <p>Глава и весь её текст будут удалены без возможности восстановления.</p>
            </div>
            <button type="button" onClick={() => setDeleteDialogOpen(true)}>Удалить главу</button>
          </div>
        </div>
      </section>
      {deleteDialogOpen && (
        <div className="confirm-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDeleteDialogOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <p className="eyebrow">Удаление главы</p>
            <h2 id="delete-title">Вы уверены?</h2>
            <p>Это действие необратимо</p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setDeleteDialogOpen(false)}>Нет</button>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button type="submit">Да</button>
              </Form>
            </div>
          </section>
        </div>
      )}
      {publicationDialogOpen && (
        <div className="confirm-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPublicationDialogOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="publication-title">
            <p className="eyebrow">Публикация главы</p>
            <h2 id="publication-title">
              {chapter.published === 1 ? "Скрыть главу?" : "Опубликовать главу?"}
            </h2>
            <p>
              {chapter.published === 1
                ? "Глава исчезнет из публичного списка и станет недоступна для чтения."
                : "Глава появится в публичном списке и станет доступна читателям."}
            </p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setPublicationDialogOpen(false)}>Нет</button>
              <Form method="post" onSubmit={() => setPublicationDialogOpen(false)}>
                <input type="hidden" name="intent" value="toggle-publication" />
                <button type="submit">Да</button>
              </Form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
