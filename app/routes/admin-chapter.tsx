import { data, Form, Link, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/admin-chapter";
import { requireAdmin } from "../auth.server";
import { deleteChapter, getAllChapters, getChapterForEditing, saveChapter, setChapterPublished } from "../database.server";
import { Header } from "../components/header";
import { useState } from "react";
import { countPages, countTotalPages, formatPages } from "../text-metrics";
import { useLocalization } from "../localization";
import { sendNewChapterNotification } from "../mail.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const chapter = getChapterForEditing(params.chapterId);
  if (!chapter) throw new Response("Глава не найдена", { status: 404 });
  const otherChapterTexts = getAllChapters()
    .filter((item) => item.id !== chapter.id)
    .map((item) => item.content);
  return { chapter, otherChapterTexts };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const current = getChapterForEditing(params.chapterId);
  if (!current) throw new Response("Глава не найдена", { status: 404 });

  const form = await request.formData();
  if (form.get("intent") === "delete") {
    deleteChapter(current.id);
    return redirect("/admin/chapters");
  }
  if (form.get("intent") === "toggle-publication") {
    const willPublish = current.published !== 1;
    setChapterPublished(current.id, willPublish);
    if (willPublish) await sendNewChapterNotification(current);
    return redirect(`/admin/chapters/${current.slug}`);
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
  const { language, text } = useLocalization();
  const { chapter, otherChapterTexts } = loaderData;
  const navigate = useNavigate();
  const [content, setContent] = useState(chapter.content);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publicationDialogOpen, setPublicationDialogOpen] = useState(false);
  const pages = countPages(content);
  const totalPages = countTotalPages([...otherChapterTexts, content]);
  return (
    <main className="admin-page">
      <Header beforeAction={(
        <>
          <Link className="header-button preview-link--desktop" to={`/chapters/${chapter.slug}?preview=1`}>{text("Читать", "Читати")}</Link>
          <Link className="preview-toggle preview-toggle--mobile" to={`/chapters/${chapter.slug}?preview=1`} aria-label={text("Открыть предпросмотр", "Відкрити попередній перегляд")} title={text("Предпросмотр", "Попередній перегляд")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg>
          </Link>
        </>
      )} />
      <section className="admin-shell admin-shell--editor">
        <div className="editor-heading-row">
          <Link className="eyebrow editor-home-link" to="/admin/chapters">{text("Редактор", "Редактор")}</Link>
          <button className="editor-back-button" type="button" onClick={() => navigate(-1)}>
            <span aria-hidden="true">←</span>
            {text("Вернуться", "Повернутися")}
          </button>
        </div>
        <h1>{chapter.title}</h1>
        <div className="editor-metrics" aria-live="polite">
          <div>
            <span>{text("Объём этой главы", "Обсяг цієї глави")}</span>
            <b>{formatPages(pages, language)}</b>
          </div>
          <div>
            <span>{text("Вся работа", "Уся робота")}</span>
            <b>{formatPages(totalPages, language)}</b>
          </div>
          <small>{content.replace(/\s+/g, " ").trim().length.toLocaleString(language === "uk" ? "uk-UA" : "ru-RU")} {text("символов", "символів")} · {text("1800 символов на страницу", "1800 символів на сторінку")}</small>
        </div>
        <Form method="post" className="editor-form">
          <div className="chapter-position-note">{text("Глава", "Глава")} {chapter.number} · {text("адрес", "адреса")} /chapters/{chapter.slug}</div>
          <label>{text("Название", "Назва")}<input name="title" defaultValue={chapter.title} required /></label>
          <label>{text("Краткое описание", "Короткий опис")}<textarea name="subtitle" rows={3} defaultValue={chapter.subtitle} /></label>
          <label>{text("Текст главы", "Текст глави")}<textarea className="editor-form__content" name="content" rows={28} value={content} onChange={(event) => setContent(event.currentTarget.value)} /></label>
          <p className="editor-hint">{text("Разделяйте абзацы одной пустой строкой. Одна условная страница равна 1800 знакам с пробелами.", "Розділяйте абзаци одним порожнім рядком. Одна умовна сторінка дорівнює 1800 знакам із пробілами.")}</p>
          {actionData?.error && <p className="form-error">{text(actionData.error, actionData.error === "Название обязательно." ? "Назва обов’язкова." : "Не вдалося зберегти. Перевірте унікальність адреси глави.")}</p>}
          <button type="submit">{text("Сохранить изменения", "Зберегти зміни")}</button>
        </Form>
        <div className="chapter-controls">
          <div className={`publication-zone ${chapter.published === 1 ? "publication-zone--published" : ""}`}>
            <div>
              <b>{text("Публикация главы", "Публікація глави")}</b>
              <p>{chapter.published === 1 ? text("Глава опубликована", "Главу опубліковано") : text("Глава скрыта", "Главу приховано")}</p>
            </div>
            <button type="button" onClick={() => setPublicationDialogOpen(true)}>
              {chapter.published === 1 ? text("Скрыть", "Приховати") : text("Опубликовать", "Опублікувати")}
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <b>{text("Удаление главы", "Видалення глави")}</b>
              <p>{text("Глава и весь её текст будут удалены без возможности восстановления.", "Главу та весь її текст буде видалено без можливості відновлення.")}</p>
            </div>
            <button type="button" onClick={() => setDeleteDialogOpen(true)}>{text("Удалить главу", "Видалити главу")}</button>
          </div>
        </div>
      </section>
      {deleteDialogOpen && (
        <div className="confirm-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDeleteDialogOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <p className="eyebrow">{text("Удаление главы", "Видалення глави")}</p>
            <h2 id="delete-title">{text("Вы уверены?", "Ви впевнені?")}</h2>
            <p>{text("Это действие необратимо", "Ця дія незворотна")}</p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setDeleteDialogOpen(false)}>{text("Нет", "Ні")}</button>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button type="submit">{text("Да", "Так")}</button>
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
            <p className="eyebrow">{text("Публикация главы", "Публікація глави")}</p>
            <h2 id="publication-title">
              {chapter.published === 1 ? text("Скрыть главу?", "Приховати главу?") : text("Опубликовать главу?", "Опублікувати главу?")}
            </h2>
            <p>
              {chapter.published === 1
                ? text("Глава исчезнет из публичного списка и станет недоступна для чтения.", "Глава зникне з публічного списку та стане недоступною для читання.")
                : text("Глава появится в публичном списке и станет доступна читателям.", "Глава з’явиться в публічному списку та стане доступною читачам.")}
            </p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setPublicationDialogOpen(false)}>{text("Нет", "Ні")}</button>
              <Form method="post" onSubmit={() => setPublicationDialogOpen(false)}>
                <input type="hidden" name="intent" value="toggle-publication" />
                <button type="submit">{text("Да", "Так")}</button>
              </Form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
