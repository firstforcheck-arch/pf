import type { Route } from "./+types/chapter";
import { data, Form, isRouteErrorResponse, Link, useRouteLoaderData, useSearchParams } from "react-router";
import { Header } from "../components/header";
import { WorkActions } from "../components/work-actions";
import { WorkUnavailable } from "../components/work-unavailable";
import { canManageWork, createComment, deleteComment, getChapter, getChapterByPublicSlug, getChapterComments, getPublishedChapters, getWorkBySlug, getWorkEngagement, updateComment } from "../database.server";
import { getCurrentUser } from "../auth.server";
import { useEffect, useRef, useState } from "react";
import { useLocalization } from "../localization";
import { AnalyticsTracker } from "../components/analytics-tracker";
import { formatInlineText } from "../components/formatted-text";
import { enforceRateLimit } from "../security.server";

export function meta({ loaderData }: Route.MetaArgs) {
  const chapter = loaderData?.chapter;
  return [
    { title: chapter ? `${chapter.title} — ${loaderData?.book.title}` : `Глава не найдена — ${loaderData?.book.title}` },
    { name: "description", content: chapter?.subtitle ?? loaderData?.book.description },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  const publicBook = getWorkBySlug(params.workSlug);
  const privateBook = publicBook ? undefined : getWorkBySlug(params.workSlug, true);
  const book = publicBook ?? (privateBook && user && canManageWork(user, privateBook.id) ? privateBook : undefined);
  if (!book) throw new Response("Работа не найдена", { status: 404 });
  const chapters = getPublishedChapters(book.id);
  const publishedChapter = book.published === 1 ? getChapter(book.id, params.chapterId) : undefined;
  const chapter = publishedChapter ?? (user && canManageWork(user, book.id) ? getChapterByPublicSlug(book.id, params.chapterId) : undefined);
  return { chapter, chapters, book, canManage: Boolean(user && canManageWork(user, book.id)), comments: chapter ? getChapterComments(chapter.id) : [], engagement: getWorkEngagement(book.id, user?.id) };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) return data({ error: "Войдите, чтобы оставить комментарий." }, { status: 401 });
  const publicBook = getWorkBySlug(params.workSlug);
  const privateBook = publicBook ? undefined : getWorkBySlug(params.workSlug, true);
  const book = publicBook ?? (privateBook && canManageWork(user, privateBook.id) ? privateBook : undefined);
  if (!book) return data({ error: "Работа не найдена." }, { status: 404 });
  const publishedChapter = book.published === 1 ? getChapter(book.id, params.chapterId) : undefined;
  const chapter = publishedChapter ?? (canManageWork(user, book.id) ? getChapterByPublicSlug(book.id, params.chapterId) : undefined);
  if (!chapter) return data({ error: "Глава не найдена." }, { status: 404 });
  const form = await request.formData();
  enforceRateLimit(request, "comments", 30, 60, String(user.id));
  if (form.get("intent") === "delete-comment") {
    if (!deleteComment(Number(form.get("commentId")), chapter.id, user.id, user.role === "admin")) return data({ error: "Недостаточно прав для удаления комментария." }, { status: 403 });
    return { error: null };
  }
  if (form.get("intent") === "edit-comment") {
    const content = String(form.get("content") ?? "").trim();
    if (!content) return data({ error: "Комментарий не может быть пустым." }, { status: 400 });
    if (content.length > 2000) return data({ error: "Комментарий не должен превышать 2000 символов." }, { status: 400 });
    if (!updateComment(Number(form.get("commentId")), chapter.id, user.id, content)) return data({ error: "Можно редактировать только свой комментарий." }, { status: 403 });
    return { error: null };
  }
  if (!publishedChapter) return data({ error: "Глава не опубликована." }, { status: 400 });
  const content = String(form.get("content") ?? "").trim();
  if (!content) return data({ error: "Комментарий не может быть пустым." }, { status: 400 });
  if (content.length > 2000) return data({ error: "Комментарий не должен превышать 2000 символов." }, { status: 400 });
  createComment(chapter.id, user.id, content);
  return { error: null };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const unavailable = isRouteErrorResponse(error) && error.status === 404;
  return <WorkUnavailable notFound={unavailable} />;
}

export default function ChapterPage({ loaderData, actionData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  const { chapter, chapters, comments, book, canManage, engagement } = loaderData;
  const rootData = useRouteLoaderData<{ user: { id: number; username: string; avatarUrl: string | null; role: "admin" | "reader" } | null }>("root");
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [commentToEdit, setCommentToEdit] = useState<(typeof comments)[number] | null>(null);
  const [searchParams] = useSearchParams();

  if (!chapter) {
    return (
      <main className="reader reader--empty">
        <Header />
        <div className="reader__empty-content">
          <p className="eyebrow">{text("Ошибка 404", "Помилка 404")}</p>
          <h1>{text("Такой главы пока нет", "Такої глави поки немає")}</h1>
          <Link className="reader__back" to={`/works/${book.slug}#chapters`}>← {text("Вернуться к содержанию", "Повернутися до змісту")}</Link>
        </div>
      </main>
    );
  }

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const previous = chapterIndex >= 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const publicNumber = chapterIndex >= 0 ? chapterIndex + 1 : chapter.number;
  const preview = searchParams.get("preview") === "1" && canManage;

  return (
    <main className="reader">
      <AnalyticsTracker workId={book.id} chapterId={chapter.id} disabled={preview} />
      <Header profileEditorTo={`/editor/works/${book.id}/chapters/${chapter.slug}`} beforeAction={preview ? (
        <Link className="preview-toggle preview-toggle--mobile" to={`/editor/works/${book.id}/chapters/${chapter.slug}`} aria-label={text("Вернуться в редактор", "Повернутися до редактора")} title={text("Вернуться в редактор", "Повернутися до редактора")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6M9 12h10" /></svg>
        </Link>
      ) : undefined} action={(
        <div className="reader-header-actions">
          <ChapterSelect current={chapter} chapters={chapters} preview={preview} workSlug={book.slug} />
        </div>
      )} />

      <article className="reader__article">
        <div className="reader__intro">
          <span className="reader__number">{publicNumber}</span>
          <p className="eyebrow">{text("Глава", "Глава")} {publicNumber}</p>
          <h1>{chapter.title}</h1>
          {chapter.subtitle ? (
            <p className="reader__subtitle">{chapter.subtitle}</p>
          ) : (
            <div className="reader__subtitle-divider" aria-hidden="true" />
          )}
        </div>
        <div className="reader__text">
          {chapter.content.split(/\r?\n\r?\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{formatInlineText(paragraph)}</p>)}
        </div>
      </article>

      <ChapterPagination previous={previous} next={next} position="footer" preview={preview} workSlug={book.slug} />
      <section className="reader-engagement" aria-label={text("Поддержать работу", "Підтримати роботу")}>
        <div>
          <p className="eyebrow">{text("Понравилась история?", "Сподобалася історія?")}</p>
          <h2>{text("Поддержите работу", "Підтримайте роботу")}</h2>
          <p>{text("Поставьте лайк и подпишитесь, чтобы не пропустить новые главы.", "Поставте вподобайку та підпишіться, щоб не пропустити нові глави.")}</p>
        </div>
        <WorkActions workId={book.id} likeCount={engagement.likeCount} liked={engagement.liked} following={engagement.following} variant="reader" />
      </section>
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
              <Link className="comment__author-avatar" to={`/users/${encodeURIComponent(comment.user.username)}`} aria-label={comment.user.username}>
                {comment.user.avatarUrl
                  ? <img className="comment__avatar" src={comment.user.avatarUrl} alt="" />
                  : <span className="comment__avatar" aria-hidden="true">{comment.user.username.slice(0, 1).toUpperCase()}</span>}
              </Link>
              <div>
                <header>
                  <Link className="comment__author-name" to={`/users/${encodeURIComponent(comment.user.username)}`}>{comment.user.username}</Link>
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
                    {(rootData?.user?.id === comment.user.id || rootData?.user?.role === "admin") && <div className="comment__actions">
                      {rootData?.user?.id === comment.user.id && <button className="comment__edit" type="button" onClick={() => setCommentToEdit(comment)} aria-label={text("Редактировать комментарий", "Редагувати коментар")} title={text("Редактировать комментарий", "Редагувати коментар")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.5-10.5-3.2-3.2L5 15.8 4 20ZM13.8 7l3.2 3.2" /></svg>
                      </button>}
                      <button className="comment__delete" type="button" onClick={() => setCommentToDelete(comment.id)} aria-label={text("Удалить комментарий", "Видалити коментар")} title={text("Удалить комментарий", "Видалити коментар")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
                      </button>
                    </div>}
                  </div>
                </header>
                <p>{comment.content}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      {commentToDelete !== null && (
        <div className="confirm-modal comment-delete-modal" role="presentation" onMouseDown={(event) => {
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
                <button type="submit">{text("Да", "Так")}</button>
              </Form>
            </div>
          </section>
        </div>
      )}
      {commentToEdit && (
        <div className="confirm-modal comment-edit-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommentToEdit(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-comment-title">
            <p className="eyebrow">{text("Ваш комментарий", "Ваш коментар")}</p>
            <h2 id="edit-comment-title">{text("Редактировать комментарий", "Редагувати коментар")}</h2>
            <Form method="post" className="comment-edit-form" onSubmit={() => setCommentToEdit(null)}>
              <input type="hidden" name="intent" value="edit-comment" />
              <input type="hidden" name="commentId" value={commentToEdit.id} />
              <label className="sr-only" htmlFor="edited-comment-content">{text("Текст комментария", "Текст коментаря")}</label>
              <textarea id="edited-comment-content" name="content" rows={6} maxLength={2000} defaultValue={commentToEdit.content} required autoFocus />
              <div className="confirm-modal__actions"><button type="button" onClick={() => setCommentToEdit(null)}>{text("Отмена", "Скасувати")}</button><button type="submit">{text("Сохранить", "Зберегти")}</button></div>
            </Form>
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

function ChapterSelect({ current, chapters, preview, workSlug }: { current: SelectChapter; chapters: SelectChapter[]; preview: boolean; workSlug: string }) {
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
                to={`/works/${workSlug}/chapters/${item.publicSlug}${preview ? "?preview=1" : ""}`}
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
  workSlug,
}: {
  previous?: PaginationChapter;
  next?: PaginationChapter;
  position: "intro" | "footer";
  preview: boolean;
  workSlug: string;
}) {
  const { text } = useLocalization();
  return (
    <nav
      className={`reader__pagination reader__pagination--${position}`}
      aria-label={position === "intro" ? text("Навигация по главам перед текстом", "Навігація главами перед текстом") : text("Навигация по главам после текста", "Навігація главами після тексту")}
    >
      {previous ? (
        <Link to={`/works/${workSlug}/chapters/${previous.publicSlug}${preview ? "?preview=1" : ""}`}>
          <small>{text("Предыдущая глава", "Попередня глава")}</small>
          <span>← {previous.title}</span>
        </Link>
      ) : <span />}
      {position === "footer" && (
        <Link to={`/works/${workSlug}#chapters`} className="reader__all-chapters">
          <small>{text("Содержание", "Зміст")}</small>
          <span>{text("Все главы", "Усі глави")}</span>
        </Link>
      )}
      {next ? (
        <Link to={`/works/${workSlug}/chapters/${next.publicSlug}${preview ? "?preview=1" : ""}`} className="reader__next">
          <small>{text("Следующая глава", "Наступна глава")}</small>
          <span>{next.title} →</span>
        </Link>
      ) : (
        <Link to={`/works/${workSlug}#chapters`} className="reader__next">
          <small>{text("Конец", "Кінець")}</small>
          <span>{text("К списку глав", "До списку глав")} →</span>
        </Link>
      )}
    </nav>
  );
}
