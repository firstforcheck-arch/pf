import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/admin-chapter";
import { requireAdmin } from "../auth.server";
import { deleteChapter, getAllChapters, getChapterForEditing, saveChapter } from "../database.server";
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

  const chapter = {
    ...current,
    slug: String(form.get("slug") ?? "").trim(),
    number: String(form.get("number") ?? "").trim(),
    title: String(form.get("title") ?? "").trim(),
    subtitle: String(form.get("subtitle") ?? "").trim(),
    content: String(form.get("content") ?? ""),
  };

  if (!chapter.slug || !chapter.number || !chapter.title) {
    return data({ error: "Адрес, номер и название обязательны." }, { status: 400 });
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
  const pages = countPages(content);
  const totalPages = countTotalPages([...otherChapterTexts, content]);
  return (
    <main className="admin-page">
      <Header />
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
          <div className="editor-form__row">
            <label>Номер<input name="number" defaultValue={chapter.number} required /></label>
            <label>Адрес<input name="slug" defaultValue={chapter.slug} required /></label>
          </div>
          <label>Название<input name="title" defaultValue={chapter.title} required /></label>
          <label>Краткое описание<textarea name="subtitle" rows={3} defaultValue={chapter.subtitle} /></label>
          <label>Текст главы<textarea className="editor-form__content" name="content" rows={28} value={content} onChange={(event) => setContent(event.currentTarget.value)} /></label>
          <p className="editor-hint">Разделяйте абзацы одной пустой строкой. Одна условная страница равна 1800 знакам с пробелами.</p>
          {actionData?.error && <p className="form-error">{actionData.error}</p>}
          <button type="submit">Сохранить изменения</button>
        </Form>
        <div className="danger-zone">
          <div>
            <b>Удаление главы</b>
            <p>Глава и весь её текст будут удалены без возможности восстановления.</p>
          </div>
          <button type="button" onClick={() => setDeleteDialogOpen(true)}>Удалить главу</button>
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
    </main>
  );
}
