import type { Route } from "./+types/chapter";
import { Link, useRouteLoaderData } from "react-router";
import { Header } from "../components/header";
import { getBookSettings, getChapter, getChapterBySlug, getPublishedChapters } from "../database.server";
import { getCurrentUser } from "../auth.server";
import { useEffect, useRef, useState } from "react";

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
  const chapter = publishedChapter ?? (user?.role === "admin" ? getChapterBySlug(params.chapterId) : undefined);
  return { chapter, chapters, book: getBookSettings() };
}

export default function ChapterPage({ loaderData }: Route.ComponentProps) {
  const { chapter, chapters } = loaderData;
  const rootData = useRouteLoaderData<{ user: { email: string; role: "admin" | "reader" } | null }>("root");

  if (!chapter) {
    return (
      <main className="reader reader--empty">
        <Header />
        <div className="reader__empty-content">
          <p className="eyebrow">Ошибка 404</p>
          <h1>Такой главы пока нет</h1>
          <Link className="reader__back" to="/#chapters">← Вернуться к содержанию</Link>
        </div>
      </main>
    );
  }

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const previous = chapterIndex >= 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;

  return (
    <main className="reader">
      <Header profileEditorTo={`/admin/chapters/${chapter.id}`} action={(
        <div className="reader-header-actions">
          <ChapterSelect current={chapter} chapters={chapters} />
          {rootData?.user?.role === "admin" && (
            <Link className="reader__edit" to={`/admin/chapters/${chapter.id}`}>Редактор</Link>
          )}
          <Link className="reader__back" to="/#chapters">← Все главы</Link>
        </div>
      )} />

      <article className="reader__article">
        <div className="reader__intro">
          <span className="reader__number">{chapter.number}</span>
          <p className="eyebrow">Глава {chapter.slug}</p>
          <h1>{chapter.title}</h1>
          <ChapterPagination previous={previous} next={next} position="intro" />
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

      <ChapterPagination previous={previous} next={next} position="footer" />
    </main>
  );
}

type PaginationChapter = {
  slug: string;
  title: string;
};

type SelectChapter = PaginationChapter & {
  id: number;
  number: string;
};

function ChapterSelect({ current, chapters }: { current: SelectChapter; chapters: SelectChapter[] }) {
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
        <span>Глава {current.number} — {current.title}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <>
          <button
            className="chapter-select__backdrop"
            type="button"
            aria-label="Закрыть выбор главы"
            onClick={() => setOpen(false)}
          />
          <div className="chapter-select__menu" role="dialog" aria-modal="true" aria-label="Выбор опубликованной главы">
            <div className="chapter-select__menu-title">Перейти к главе</div>
            {chapters.map((item) => (
              <Link
                className={item.id === current.id ? "chapter-select__option chapter-select__option--active" : "chapter-select__option"}
                to={`/chapters/${item.slug}`}
                aria-current={item.id === current.id ? "page" : undefined}
                key={item.id}
                onClick={() => setOpen(false)}
              >
                <small>Глава {item.number}</small>
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
}: {
  previous?: PaginationChapter;
  next?: PaginationChapter;
  position: "intro" | "footer";
}) {
  return (
    <nav
      className={`reader__pagination reader__pagination--${position}`}
      aria-label={position === "intro" ? "Навигация по главам перед текстом" : "Навигация по главам после текста"}
    >
      {previous ? (
        <Link to={`/chapters/${previous.slug}`}>
          <small>Предыдущая глава</small>
          <span>← {previous.title}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link to={`/chapters/${next.slug}`} className="reader__next">
          <small>Следующая глава</small>
          <span>{next.title} →</span>
        </Link>
      ) : (
        <Link to="/#chapters" className="reader__next">
          <small>Конец</small>
          <span>К списку глав →</span>
        </Link>
      )}
    </nav>
  );
}
