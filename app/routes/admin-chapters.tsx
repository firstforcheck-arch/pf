import { useEffect, useRef, useState } from "react";
import { Form, Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/admin-chapters";
import { requireWorkManager } from "../auth.server";
import {
  createChapter,
  createTag,
  getAllChapters,
  getWorkById,
  getWorkTags,
  reorderChapters,
  saveWork,
  setWorkTags,
  setWorkPublished,
} from "../database.server";
import { Header } from "../components/header";
import { countPages, countTotalPages, formatChapters, formatPages } from "../text-metrics";
import { useLocalization } from "../localization";
import { backfillTagTranslations, translateTagContent } from "../translation.server";

export function meta() {
  return [{ title: "Редактор — Phantom Freedom" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const workId = Number(params.workId);
  await requireWorkManager(request, workId);
  await backfillTagTranslations();
  const book = getWorkById(workId);
  if (!book) throw new Response("Работа не найдена", { status: 404 });
  const chapters = getAllChapters(workId);
  return {
    book,
    chapters: chapters.map((chapter) => ({ ...chapter, pages: countPages(chapter.content) })),
    totalPages: countTotalPages(chapters.map((chapter) => chapter.content)),
    selectedTags: getWorkTags(workId),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const workId = Number(params.workId);
  await requireWorkManager(request, workId);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "toggle-work-publication") {
    setWorkPublished(workId, form.get("published") === "yes");
    return { ok: true };
  }

  if (intent === "create-tag") {
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    const sourceLanguage = form.get("language") === "uk" ? "uk" : "ru";
    let translation: Awaited<ReturnType<typeof translateTagContent>>;
    try {
      translation = await translateTagContent({ name, description, sourceLanguage });
    } catch {
      return { ok: false, tagError: "Не удалось автоматически перевести метку. Попробуйте ещё раз." };
    }
    const result = createTag({ name, description, sourceLanguage, ...translation });
    if ("error" in result) return { ok: false, tagError: result.error };
    return { ok: true, createdTag: result.tag };
  }

  if (intent === "save-book") {
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (!title) return { ok: false, error: "Название не может быть пустым." };
    const current = getWorkById(workId);
    if (!current) throw new Response("Работа не найдена", { status: 404 });
    const requestedX = Number(form.get("coverPositionX"));
    const requestedY = Number(form.get("coverPositionY"));
    const requestedZoom = Number(form.get("coverZoom"));
    const coverPositionX = Number.isFinite(requestedX) ? Math.min(100, Math.max(0, requestedX)) : current.coverPositionX;
    const coverPositionY = Number.isFinite(requestedY) ? Math.min(100, Math.max(0, requestedY)) : current.coverPositionY;
    if (!Number.isFinite(requestedZoom) || requestedZoom < 0.25 || requestedZoom > 3) {
      return { ok: false, error: "Масштаб обложки должен быть от 0.25 до 3." };
    }
    const coverZoom = requestedZoom;
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
    saveWork(workId, { title, description, notes: current.notes, coverUrl, coverPositionX, coverPositionY, coverZoom });
    setWorkTags(workId, form.getAll("tagId").map(Number).filter(Number.isInteger));
    return { ok: true };
  }

  if (intent === "save-notes") {
    const current = getWorkById(workId);
    if (!current) throw new Response("Работа не найдена", { status: 404 });
    saveWork(workId, { ...current, notes: String(form.get("notes") ?? "").trim() });
    return { ok: true };
  }

  if (intent === "create-chapter") {
    return redirect(`/editor/works/${workId}/chapters/${createChapter(workId)}`);
  }

  if (intent === "reorder") {
    const order = JSON.parse(String(form.get("order") ?? "[]")) as number[];
    reorderChapters(workId, order);
    return { ok: true };
  }

  return { ok: false };
}

export default function AdminChapters({ loaderData, actionData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  const reorderFetcher = useFetcher();
  const [chapters, setChapters] = useState(loaderData.chapters);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [publicationDialogOpen, setPublicationDialogOpen] = useState(false);

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
            <TagEditor workId={loaderData.book.id} initialTags={loaderData.selectedTags} />
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
                  : actionData.error === "Масштаб обложки должен быть от 0.25 до 3." ? "Масштаб обкладинки має бути від 0.25 до 3."
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
          <div className={`publication-zone ${loaderData.book.published === 1 ? "publication-zone--published" : ""}`}>
            <div>
              <strong>{loaderData.book.published === 1 ? text("Работа опубликована", "Роботу опубліковано") : text("Работа скрыта", "Роботу приховано")}</strong>
              <small>{text("Скрытая работа и её главы доступны только владельцу и администратору.", "Прихована робота та її глави доступні лише власнику й адміністратору.")}</small>
            </div>
            <button type="button" onClick={() => setPublicationDialogOpen(true)}>{loaderData.book.published === 1 ? text("Скрыть работу", "Приховати роботу") : text("Опубликовать работу", "Опублікувати роботу")}</button>
          </div>
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
                <Link to={`/editor/works/${loaderData.book.id}/chapters/${chapter.slug}`}>{chapter.title}</Link>
                <strong className={`publication-badge ${chapter.published === 1 ? "publication-badge--yes" : ""}`}>
                  {text("Опубликована", "Опублікована")}: {chapter.published === 1 ? text("Да", "Так") : text("Нет", "Ні")}
                </strong>
                <em>{formatPages(chapter.pages, language)}</em>
                <Link className="admin-list__edit" to={`/editor/works/${loaderData.book.id}/chapters/${chapter.slug}`}>{text("Редактировать", "Редагувати")} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      {publicationDialogOpen && (
        <div className="confirm-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPublicationDialogOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="work-publication-title">
            <p className="eyebrow">{text("Видимость работы", "Видимість роботи")}</p>
            <h2 id="work-publication-title">{loaderData.book.published === 1 ? text("Скрыть работу?", "Приховати роботу?") : text("Опубликовать работу?", "Опублікувати роботу?")}</h2>
            <p>{loaderData.book.published === 1
              ? text("Работа и все её главы исчезнут из публичного доступа. Вернуть их можно в любой момент.", "Робота та всі її глави зникнуть із публічного доступу. Повернути їх можна будь-коли.")
              : text("Работа появится в каталоге, а опубликованные главы станут доступны читателям.", "Робота з’явиться в каталозі, а опубліковані глави стануть доступними читачам.")}</p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setPublicationDialogOpen(false)}>{text("Отмена", "Скасувати")}</button>
              <Form method="post" onSubmit={() => setPublicationDialogOpen(false)}>
                <input type="hidden" name="intent" value="toggle-work-publication" />
                <input type="hidden" name="published" value={loaderData.book.published === 1 ? "no" : "yes"} />
                <button type="submit">{loaderData.book.published === 1 ? text("Да, скрыть", "Так, приховати") : text("Да, опубликовать", "Так, опублікувати")}</button>
              </Form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const MIN_COVER_ZOOM = 0.25;
const MAX_COVER_ZOOM = 3;

function TagEditor({ workId, initialTags }: { workId: number; initialTags: import("../database.server").TagRecord[] }) {
  const { text, language } = useLocalization();
  const searchFetcher = useFetcher<{ tags: import("../database.server").TagRecord[] }>();
  const createFetcher = useFetcher<{ ok: boolean; createdTag?: import("../database.server").TagRecord; tagError?: string }>();
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => searchFetcher.load(`/editor/works/${workId}/tags/search?q=${encodeURIComponent(query)}`), 220);
    return () => window.clearTimeout(timeout);
  }, [open, query, workId]);

  useEffect(() => {
    const tag = createFetcher.data?.createdTag;
    if (!tag) return;
    setSelectedTags((tags) => tags.some((item) => item.id === tag.id) ? tags : [...tags, tag]);
    setName("");
    setDescription("");
    setCreating(false);
    setOpen(false);
    setQuery("");
  }, [createFetcher.data?.createdTag]);

  useEffect(() => {
    if (!creating) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCreating(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [creating]);

  const results = searchFetcher.data?.tags ?? [];
  const selectedIds = new Set(selectedTags.map((tag) => tag.id));
  const availableResults = results.filter((tag) => !selectedIds.has(tag.id));
  return <fieldset className="tag-editor">
    <legend>{text("Метки", "Мітки")}</legend>
    {selectedTags.map((tag) => <input key={tag.id} type="hidden" name="tagId" value={tag.id} />)}
    <div className="tag-editor__selected">
      {selectedTags.length ? selectedTags.map((tag) => <span className="tag-chip tag-chip--editable" key={tag.id}>
        <Link to={`/tags/${tag.slug}`}>{localizedTagName(tag, language)}</Link>
        <button type="button" aria-label={`${text("Удалить метку", "Видалити мітку")} ${localizedTagName(tag, language)}`} onClick={() => setSelectedTags((tags) => tags.filter((item) => item.id !== tag.id))}>×</button>
      </span>) : <small>{text("Метки пока не выбраны.", "Мітки поки не вибрані.")}</small>}
    </div>
    <div className="tag-combobox">
      <button className="tag-editor__toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? text("Закрыть", "Закрити") : text("Добавить метку", "Додати мітку")}</button>
      {open && <div className="tag-editor__panel">
        <label className="tag-editor__search"><span>{text("Поиск метки", "Пошук мітки")}</span><input autoFocus value={query} placeholder={text("Начните вводить название…", "Почніть вводити назву…")} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="tag-editor__list" aria-busy={searchFetcher.state !== "idle"}>
          {availableResults.map((tag) => <button type="button" key={tag.id} onClick={() => setSelectedTags((tags) => [...tags, tag])}>
            <span><strong>{localizedTagName(tag, language)}</strong><small>{localizedTagDescription(tag, language) || text("Без описания", "Без опису")}</small></span><b>{tag.workCount}</b>
          </button>)}
          {searchFetcher.state === "idle" && !availableResults.length && <p>{text("Других подходящих меток не найдено.", "Інших відповідних міток не знайдено.")}</p>}
        </div>
        <div className="tag-editor__panel-footer"><small>{text("Показано не более 20 совпадений", "Показано не більше 20 збігів")}</small><button className="tag-editor__create-toggle" type="button" onClick={() => { setCreating(true); setName(query); }}>+ {text("Создать метку", "Створити мітку")}</button></div>
      </div>}
    </div>
    {creating && <div className="confirm-modal tag-create-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="create-tag-title">
        <p className="eyebrow">{text("Новая метка", "Нова мітка")}</p>
        <h2 id="create-tag-title">{text("Создать метку", "Створити мітку")}</h2>
        <p>{text("Добавьте короткое понятное название и описание, которое поможет авторам выбрать данную метку.", "Додайте коротку зрозумілу назву й опис, які допоможуть авторам вибрати цю мітку.")}</p>
        <p className="tag-create-modal__notice"><strong>{text("Перед созданием метки, пожалуйста, проверьте наличие похожей в системе.", "Перед створенням мітки, будь ласка, перевірте наявність схожої в системі.")}</strong></p>
        <p className="tag-create-modal__language-warning"><strong>{text("Обязательно пишите текст метки на языке интерфейса.", "Обов’язково пишіть текст мітки мовою інтерфейсу.")}</strong></p>
        <div className="tag-create-modal__fields">
          <label>{text("Название", "Назва")}<input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
          <label>{text("Описание", "Опис")}<textarea value={description} maxLength={500} rows={4} onChange={(event) => setDescription(event.target.value)} /></label>
          {createFetcher.data?.tagError && String(createFetcher.formData?.get("name") ?? "") === name && <p className="form-error">{text(createFetcher.data.tagError, translateTagError(createFetcher.data.tagError))}</p>}
        </div>
        <div className="confirm-modal__actions">
          <button type="button" onClick={() => setCreating(false)}>{text("Отмена", "Скасувати")}</button>
          <button type="button" disabled={!name.trim() || createFetcher.state !== "idle"} onClick={() => createFetcher.submit({ intent: "create-tag", name, description, language }, { method: "post" })}>{createFetcher.state === "submitting" ? text("Перевод…", "Переклад…") : text("Создать", "Створити")}</button>
        </div>
      </section>
    </div>}
  </fieldset>;
}

function translateTagError(error: string) {
  if (error === "Введите название метки.") return "Введіть назву мітки.";
  if (error === "Название метки не должно превышать 60 символов.") return "Назва мітки не повинна перевищувати 60 символів.";
  if (error === "Описание метки не должно превышать 500 символов.") return "Опис мітки не повинен перевищувати 500 символів.";
  if (error === "Такая метка уже существует.") return "Така мітка вже існує.";
  if (error === "Не удалось автоматически перевести метку. Попробуйте ещё раз.") return "Не вдалося автоматично перекласти мітку. Спробуйте ще раз.";
  return error;
}

function localizedTagName(tag: import("../database.server").TagRecord, language: "ru" | "uk") {
  return language === "uk" ? tag.nameUk : tag.nameRu;
}

function localizedTagDescription(tag: import("../database.server").TagRecord, language: "ru" | "uk") {
  return language === "uk" ? tag.descriptionUk : tag.descriptionRu;
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
  const [draftZoomInput, setDraftZoomInput] = useState(initialZoom.toFixed(2));
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
    setDraftZoomInput("1.00");
  }

  function openEditor() {
    if (!previewUrl) return;
    setDraftPosition(position);
    setDraftZoom(zoom);
    setDraftZoomInput(zoom.toFixed(2));
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

  const parsedDraftZoom = Number(draftZoomInput.replace(",", "."));
  const zoomIsValid = draftZoomInput.trim() !== ""
    && Number.isFinite(parsedDraftZoom)
    && parsedDraftZoom >= MIN_COVER_ZOOM
    && parsedDraftZoom <= MAX_COVER_ZOOM;

  return (
    <>
      <div className="cover-editor">
        <button className="cover-editor__preview" type="button" onClick={openEditor} disabled={!previewUrl}>
          {previewUrl ? (
            <>
              <img src={previewUrl} alt={text("Предпросмотр обложки", "Попередній перегляд обкладинки")} style={{ transform: coverTransform(position.x, position.y, zoom) }} />
              <span className="cover-editor__preview-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg>
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
              <input type="range" min={MIN_COVER_ZOOM} max={MAX_COVER_ZOOM} step="0.01" value={draftZoom} onChange={(event) => {
                const value = Number(event.currentTarget.value);
                setDraftZoom(value);
                setDraftZoomInput(value.toFixed(2));
              }} />
              <span className="cover-crop-zoom__value">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draftZoomInput}
                  aria-label={text("Значение масштаба", "Значення масштабу")}
                  aria-invalid={!zoomIsValid}
                  onChange={(event) => {
                    const input = event.currentTarget.value;
                    setDraftZoomInput(input);
                    const value = Number(input.replace(",", "."));
                    if (Number.isFinite(value)) setDraftZoom(Math.min(MAX_COVER_ZOOM, Math.max(MIN_COVER_ZOOM, value)));
                  }}
                />
                <b aria-hidden="true">×</b>
              </span>
            </label>
            {!zoomIsValid && <p className="cover-crop-zoom__error">{text("Введите значение от 0.25 до 3.", "Введіть значення від 0.25 до 3.")}</p>}
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setEditorOpen(false)}>{text("Отмена", "Скасувати")}</button>
              <button type="button" disabled={!zoomIsValid} onClick={() => {
                setPosition(draftPosition);
                setZoom(parsedDraftZoom);
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
