import type { Route } from "./+types/chapter";
import { data, Form, Link, useRouteLoaderData, useSearchParams } from "react-router";
import { Header } from "../components/header";
import { createComment, deleteComment, getBookSettings, getChapter, getChapterByPublicSlug, getChapterComments, getPublishedChapters } from "../database.server";
import { getCurrentUser } from "../auth.server";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "../localization";

export function meta({ loaderData }: Route.MetaArgs) {
  const chapter = loaderData?.chapter;
  return [
    { title: chapter ? `${chapter.title} — ${loaderData?.book.title}` : `Глава не найдена — ${loaderData?.book.title}` },
    { name: "description", content: chapter?.subtitle ?? loaderData?.book.description },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const chapters = getPublishedChapters();
  const publishedChapter = getChapter(params.chapterId);
  const user = publishedChapter ? null : await getCurrentUser(request);
  const chapter = publishedChapter ?? (user?.role === "admin" ? getChapterByPublicSlug(params.chapterId) : undefined);
  return { chapter, chapters, book: getBookSettings(), comments: chapter ? getChapterComments(chapter.id) : [] };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) return data({ error: "Войдите, чтобы оставить комментарий." }, { status: 401 });
  const publishedChapter = getChapter(params.chapterId);
  const chapter = publishedChapter ?? (user.role === "admin" ? getChapterByPublicSlug(params.chapterId) : undefined);
  if (!chapter) return data({ error: "Глава не найдена." }, { status: 404 });
  const form = await request.formData();
  if (form.get("intent") === "delete-comment") {
    if (user.role !== "admin") return data({ error: "Недостаточно прав." }, { status: 403 });
    deleteComment(Number(form.get("commentId")), chapter.id);
    return { error: null };
  }
  if (!publishedChapter) return data({ error: "Глава не опубликована." }, { status: 400 });
  const content = String(form.get("content") ?? "").trim();
  if (!content) return data({ error: "Комментарий не может быть пустым." }, { status: 400 });
  if (content.length > 2000) return data({ error: "Комментарий не должен превышать 2000 символов." }, { status: 400 });
  createComment(chapter.id, user.id, content);
  return { error: null };
}

export default function ChapterPage({ loaderData, actionData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  const { chapter, chapters, comments } = loaderData;
  const rootData = useRouteLoaderData<{ user: { username: string; avatarUrl: string | null; role: "admin" | "reader" } | null }>("root");
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [searchParams] = useSearchParams();

  if (!chapter) {
    return (
      <main className="reader reader--empty">
        <Header />
        <div className="reader__empty-content">
          <p className="eyebrow">{text("Ошибка 404", "Помилка 404")}</p>
          <h1>{text("Такой главы пока нет", "Такої глави поки немає")}</h1>
          <Link className="reader__back" to="/#chapters">← {text("Вернуться к содержанию", "Повернутися до змісту")}</Link>
        </div>
      </main>
    );
  }

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const previous = chapterIndex >= 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const publicNumber = chapterIndex >= 0 ? chapterIndex + 1 : chapter.number;
  const preview = searchParams.get("preview") === "1" && rootData?.user?.role === "admin";

  return (
    <main className="reader">
      <Header profileEditorTo={`/admin/chapters/${chapter.slug}`} beforeAction={preview ? (
        <Link className="preview-toggle preview-toggle--mobile" to={`/admin/chapters/${chapter.slug}`} aria-label={text("Вернуться в редактор", "Повернутися до редактора")} title={text("Вернуться в редактор", "Повернутися до редактора")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6M9 12h10" /></svg>
        </Link>
      ) : undefined} action={(
        <div className="reader-header-actions">
          <ChapterSelect current={chapter} chapters={chapters} preview={preview} />
        </div>
      )} />

      <article className="reader__article">
        <div className="reader__intro">
          <span className="reader__number">{publicNumber}</span>
          <p className="eyebrow">{text("Глава", "Глава")} {publicNumber}</p>
          <h1>{chapter.title}</h1>
          <ChapterPagination previous={previous} next={next} position="intro" preview={preview} />
          {chapter.subtitle ? (
            <p className="reader__subtitle">{chapter.subtitle}</p>
          ) : (
            <div className="reader__subtitle-divider" aria-hidden="true" />
          )}
        </div>
        <div className="reader__text">
          {chapter.content.split(/\r?\n\r?\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </article>

      <ChapterPagination previous={previous} next={next} position="footer" preview={preview} />
      <section className="comments-section">
        <div className="section-heading">
          <p className="eyebrow">{text("Обсуждение", "Обговорення")}</p>
          <h2>{text("Комментарии", "Коментарі")}</h2>
        </div>
        {rootData?.user ? (
          <Form method="post" className="comment-form">
            <label className="sr-only" htmlFor="comment-content">{text("Текст комментария", "Текст коментаря")}</label>
            <textarea id="comment-content" name="content" rows={4} maxLength={2000} placeholder={text("Напишите комментарий…", "Напишіть коментар…")} required />
            {actionData?.error && <p className="form-error">{text(
              actionData.error,
              actionData.error === "Комментарий не может быть пустым."
                ? "Коментар не може бути порожнім."
                : actionData.error === "Комментарий не должен превышать 2000 символов."
                  ? "Коментар не має перевищувати 2000 символів."
                  : "Увійдіть, щоб залишити коментар.",
            )}</p>}
            <button type="submit">{text("Отправить", "Надіслати")}</button>
          </Form>
        ) : (
          <p className="comments-login">{text("Чтобы оставить комментарий, ", "Щоб залишити коментар, ")}<Link to="/login">{text("войдите в аккаунт", "увійдіть до облікового запису")}</Link>.</p>
        )}
        <div className="comment-list">
          {comments.length === 0 && <p className="comments-empty">{text("Комментариев пока нет.", "Коментарів поки немає.")}</p>}
          {comments.map((comment) => (
            <article className="comment" key={comment.id}>
              {comment.user.avatarUrl
                ? <img src={comment.user.avatarUrl} alt="" />
                : <span className="comment__avatar" aria-hidden="true">{comment.user.username.slice(0, 1).toUpperCase()}</span>}
              <div>
                <header>
                  <strong>{comment.user.username}</strong>
                  <div className="comment__meta">
                    <time dateTime={comment.createdAt}>{new Date(`${comment.createdAt}Z`).toLocaleString(language === "uk" ? "uk-UA" : "ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                      timeZone: "Europe/Kyiv",
                    })}</time>
                    {rootData?.user?.role === "admin" && (
                      <button className="comment__delete" type="button" onClick={() => setCommentToDelete(comment.id)} aria-label={text("Удалить комментарий", "Видалити коментар")} title={text("Удалить комментарий", "Видалити коментар")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
                      </button>
                    )}
                  </div>
                </header>
                <p>{comment.content}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      {commentToDelete !== null && (
        <div className="confirm-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCommentToDelete(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-comment-title">
            <p className="eyebrow">{text("Удаление комментария", "Видалення коментаря")}</p>
            <h2 id="delete-comment-title">{text("Удалить комментарий?", "Видалити коментар?")}</h2>
            <p>{text("Это действие нельзя отменить.", "Цю дію не можна скасувати.")}</p>
            <div className="confirm-modal__actions">
              <button type="button" onClick={() => setCommentToDelete(null)}>{text("Нет", "Ні")}</button>
              <Form method="post" onSubmit={() => setCommentToDelete(null)}>
                <input type="hidden" name="intent" value="delete-comment" />
                <input type="hidden" name="commentId" value={commentToDelete} />
                <button type="submit">{text("Да, удалить", "Так, видалити")}</button>
              </Form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

type PaginationChapter = {
  publicSlug: string;
  title: string;
};

type SelectChapter = PaginationChapter & {
  id: number;
  number: string;
};

function ChapterSelect({ current, chapters, preview }: { current: SelectChapter; chapters: SelectChapter[]; preview: boolean }) {
  const { text } = useLocalization();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 700px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className={`chapter-select ${open ? "chapter-select--open" : ""}`} ref={rootRef}>
      <button
        className="chapter-select__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{text("Глава", "Глава")} {Math.max(1, chapters.findIndex((item) => item.id === current.id) + 1)} — {current.title}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <>
          <button
            className="chapter-select__backdrop"
            type="button"
            aria-label={text("Закрыть выбор главы", "Закрити вибір глави")}
            onClick={() => setOpen(false)}
          />
          <div className="chapter-select__menu" role="dialog" aria-modal="true" aria-label={text("Выбор опубликованной главы", "Вибір опублікованої глави")}>
            <div className="chapter-select__menu-title">{text("Перейти к главе", "Перейти до глави")}</div>
            {chapters.map((item) => (
              <Link
                className={item.id === current.id ? "chapter-select__option chapter-select__option--active" : "chapter-select__option"}
                to={`/chapters/${item.publicSlug}${preview ? "?preview=1" : ""}`}
                aria-current={item.id === current.id ? "page" : undefined}
                key={item.id}
                onClick={() => setOpen(false)}
              >
                <small>{text("Глава", "Глава")} {chapters.findIndex((chapter) => chapter.id === item.id) + 1}</small>
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChapterPagination({
  previous,
  next,
  position,
  preview,
}: {
  previous?: PaginationChapter;
  next?: PaginationChapter;
  position: "intro" | "footer";
  preview: boolean;
}) {
  const { text } = useLocalization();
  return (
    <nav
      className={`reader__pagination reader__pagination--${position}`}
      aria-label={position === "intro" ? text("Навигация по главам перед текстом", "Навігація главами перед текстом") : text("Навигация по главам после текста", "Навігація главами після тексту")}
    >
      {previous ? (
        <Link to={`/chapters/${previous.publicSlug}${preview ? "?preview=1" : ""}`}>
          <small>{text("Предыдущая глава", "Попередня глава")}</small>
          <span>← {previous.title}</span>
        </Link>
      ) : <span />}
      {position === "footer" && (
        <Link to="/#chapters" className="reader__all-chapters">
          <small>{text("Содержание", "Зміст")}</small>
          <span>{text("Все главы", "Усі глави")}</span>
        </Link>
      )}
      {next ? (
        <Link to={`/chapters/${next.publicSlug}${preview ? "?preview=1" : ""}`} className="reader__next">
          <small>{text("Следующая глава", "Наступна глава")}</small>
          <span>{next.title} →</span>
        </Link>
      ) : (
        <Link to="/#chapters" className="reader__next">
          <small>{text("Конец", "Кінець")}</small>
          <span>{text("К списку глав", "До списку глав")} →</span>
        </Link>
      )}
    </nav>
  );
}
