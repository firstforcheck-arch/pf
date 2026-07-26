import { useEffect, useRef, useState } from "react";
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
import { useLocalization } from "../localization";

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
    const current = getBookSettings();
    const requestedX = Number(form.get("coverPositionX"));
    const requestedY = Number(form.get("coverPositionY"));
    const requestedZoom = Number(form.get("coverZoom"));
    const coverPositionX = Number.isFinite(requestedX) ? Math.min(100, Math.max(0, requestedX)) : current.coverPositionX;
    const coverPositionY = Number.isFinite(requestedY) ? Math.min(100, Math.max(0, requestedY)) : current.coverPositionY;
    const coverZoom = Number.isFinite(requestedZoom) ? Math.min(3, Math.max(1, requestedZoom)) : current.coverZoom;
    let coverUrl = form.get("removeCover") === "yes" ? null : current.coverUrl;
    const cover = form.get("cover");
    if (cover instanceof File && cover.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type)) {
        return { ok: false, error: "Обложка должна быть в формате JPG, PNG или WebP." };
      }
      if (cover.size > 5 * 1024 * 1024) {
        return { ok: false, error: "Размер обложки не должен превышать 5 МБ." };
      }
      coverUrl = `data:${cover.type};base64,${Buffer.from(await cover.arrayBuffer()).toString("base64")}`;
    }
    saveBookSettings({ title, description, notes: current.notes, coverUrl, coverPositionX, coverPositionY, coverZoom });
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
  const { language, text } = useLocalization();
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
          <p className="eyebrow">{text("Основная информация", "Основна інформація")}</p>
          <h1>{text("Шапка работы", "Шапка роботи")}</h1>
          <Form method="post" encType="multipart/form-data" className="editor-form book-header-form">
            <input type="hidden" name="intent" value="save-book" />
            <label>{text("Название", "Назва")}<input name="title" defaultValue={loaderData.book.title} required /></label>
            <label>{text("Описание", "Опис")}<textarea name="description" rows={5} defaultValue={loaderData.book.description} /></label>
            <CoverEditor
              coverUrl={loaderData.book.coverUrl}
              initialX={loaderData.book.coverPositionX}
              initialY={loaderData.book.coverPositionY}
              initialZoom={loaderData.book.coverZoom}
            />
            {actionData?.error && <p className="form-error">{text(
              actionData.error,
              actionData.error === "Название не может быть пустым." ? "Назва не може бути порожньою."
                : actionData.error === "Размер обложки не должен превышать 5 МБ." ? "Розмір обкладинки не має перевищувати 5 МБ."
                  : "Обкладинка має бути у форматі JPG, PNG або WebP.",
            )}</p>}
            <button type="submit">{text("Сохранить шапку", "Зберегти шапку")}</button>
          </Form>
        </div>

        <div className="admin-section">
          <p className="eyebrow">{text("Дополнительная информация", "Додаткова інформація")}</p>
          <h1>{text("Примечания", "Примітки")}</h1>
          <Form method="post" className="editor-form book-header-form">
            <input type="hidden" name="intent" value="save-notes" />
            <label>{text("Текст примечания", "Текст примітки")}<textarea name="notes" rows={7} defaultValue={loaderData.book.notes} /></label>
            <button type="submit">{text("Сохранить примечания", "Зберегти примітки")}</button>
          </Form>
        </div>

        <div className="admin-section">
          <p className="eyebrow">{text("Управление содержанием", "Керування вмістом")}</p>
          <h1>{text("Главы", "Глави")}</h1>
          <div className="admin-summary">
            <span>{text("Общий объём текста", "Загальний обсяг тексту")}</span>
            <div className="admin-summary__values">
              <strong>{formatChapters(loaderData.chapters.length, language)}</strong>
              <b>{formatPages(loaderData.totalPages, language)}</b>
            </div>
            <small>{text("Расчёт: 1800 символов на страницу", "Розрахунок: 1800 символів на сторінку")}</small>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="create-chapter" />
            <button className="add-chapter-button" type="submit">
              <span>+</span>
              {text("Добавить главу", "Додати главу")}
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
                  aria-label={`${text("Переместить главу", "Перемістити главу")} ${chapter.title}`}
                  onDragStart={() => setDraggedId(chapter.id)}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <span>⠿</span>
                </button>
                <span>{chapter.number}</span>
                <Link to={`/admin/chapters/${chapter.slug}`}>{chapter.title}</Link>
                <strong className={`publication-badge ${chapter.published === 1 ? "publication-badge--yes" : ""}`}>
                  {text("Опубликована", "Опублікована")}: {chapter.published === 1 ? text("Да", "Так") : text("Нет", "Ні")}
                </strong>
                <em>{formatPages(chapter.pages, language)}</em>
                <Link className="admin-list__edit" to={`/admin/chapters/${chapter.slug}`}>{text("Редактировать", "Редагувати")} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function CoverEditor({
  coverUrl,
  initialX,
  initialY,
  initialZoom,
}: {
  coverUrl: string | null;
  initialX: number;
  initialY: number;
  initialZoom: number;
}) {
  const { text } = useLocalization();
  const [previewUrl, setPreviewUrl] = useState(coverUrl);
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [draftPosition, setDraftPosition] = useState(position);
  const [zoom, setZoom] = useState(initialZoom);
  const [draftZoom, setDraftZoom] = useState(initialZoom);
  const [editorOpen, setEditorOpen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function selectCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrlRef.current);
    const centered = { x: 50, y: 50 };
    setPosition(centered);
    setDraftPosition(centered);
    setZoom(1);
    setDraftZoom(1);
  }

  function openEditor() {
    if (!previewUrl) return;
    setDraftPosition(position);
    setDraftZoom(zoom);
    setEditorOpen(true);
  }

  function moveCover(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDraftPosition({
      x: Math.min(100, Math.max(0, drag.positionX - ((event.clientX - drag.x) / bounds.width) * 100)),
      y: Math.min(100, Math.max(0, drag.positionY - ((event.clientY - drag.y) / bounds.height) * 100)),
    });
  }

  return (
    <>
      <div className="cover-editor">
        <button className="cover-editor__preview" type="button" onClick={openEditor} disabled={!previewUrl}>
          {previewUrl ? (
            <>
              <img src={previewUrl} alt={text("Предпросмотр обложки", "Попередній перегляд обкладинки")} style={{ transform: coverTransform(position.x, position.y, zoom) }} />
              <span className="cover-editor__preview-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 7.5h2.1l1.2-2h3.4l1.2 2H17a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.7" r="3" /></svg>
              </span>
            </>
          ) : <span>{text("Обложка не загружена", "Обкладинку не завантажено")}</span>}
        </button>
        <div className="cover-editor__controls">
          <label>{text("Обложка работы", "Обкладинка роботи")}<input type="file" name="cover" accept="image/jpeg,image/png,image/webp" onChange={selectCover} /></label>
          <small>{text("Рекомендуемая пропорция 2:3. JPG, PNG или WebP до 5 МБ.", "Рекомендована пропорція 2:3. JPG, PNG або WebP до 5 МБ.")}</small>
          {coverUrl && <label className="cover-editor__remove"><input type="checkbox" name="removeCover" value="yes" /> {text("Удалить текущую обложку", "Видалити поточну обкладинку")}</label>}
        </div>
        <input type="hidden" name="coverPositionX" value={position.x} />
        <input type="hidden" name="coverPositionY" value={position.y} />
        <input type="hidden" name="coverZoom" value={zoom} />
      </div>
      {editorOpen && previewUrl && (
        <div className="confirm-modal cover-crop-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditorOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cover-crop-title">
            <p className="eyebrow">{text("Редактор обложки", "Редактор обкладинки")}</p>
            <h2 id="cover-crop-title">{text("Выберите область", "Виберіть область")}</h2>
            <p>{text("Перетаскивайте изображение внутри рамки.", "Перетягуйте зображення всередині рамки.")}</p>
            <div
              className="cover-crop-frame"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY, positionX: draftPosition.x, positionY: draftPosition.y };
              }}
              onPointerMove={moveCover}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            >
              <img src={previewUrl} alt="" draggable={false} style={{ transform: coverTransform(draftPosition.x, draftPosition.y, draftZoom) }} />
            </div>
            <label className="cover-crop-zoom">
              <span>{text("Масштаб", "Масштаб")}</span>
              <input type="range" min="1" max="3" step="0.01" value={draftZoom} onChange={(event) => setDraftZoom(Number(event.currentTarget.value))} />
              <output>{draftZoom.toFixed(2)}×</output>
            </label>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setEditorOpen(false)}>{text("Отмена", "Скасувати")}</button>
              <button type="button" onClick={() => {
                setPosition(draftPosition);
                setZoom(draftZoom);
                setEditorOpen(false);
              }}>{text("Применить", "Застосувати")}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function coverTransform(x: number, y: number, zoom: number) {
  return `translate(${50 - x}%, ${50 - y}%) scale(${zoom})`;
}
