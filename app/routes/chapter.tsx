import type { Route } from "./+types/chapter";
import { Link } from "react-router";
import { Header } from "../components/header";
import { getChapter, getPublishedChapters } from "../database.server";

export function meta({ loaderData }: Route.MetaArgs) {
  const chapter = loaderData?.chapter;
  return [
    { title: chapter ? `${chapter.title} — Phantom Freedom` : "Глава не найдена — Phantom Freedom" },
    { name: "description", content: chapter?.subtitle ?? "Phantom Freedom" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const chapters = getPublishedChapters();
  return { chapter: getChapter(params.chapterId), chapters };
}

export default function ChapterPage({ loaderData }: Route.ComponentProps) {
  const { chapter, chapters } = loaderData;

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
  const previous = chapters[chapterIndex - 1];
  const next = chapters[chapterIndex + 1];

  return (
    <main className="reader">
      <Header action={<Link className="reader__back" to="/#chapters">← Все главы</Link>} />

      <article className="reader__article">
        <div className="reader__intro">
          <span className="reader__number">{chapter.number}</span>
          <p className="eyebrow">Глава {chapter.slug} · {chapter.readingTime} чтения</p>
          <h1>{chapter.title}</h1>
          <p>{chapter.subtitle}</p>
        </div>
        <div className="reader__text">
          {chapter.content.split(/\r?\n\r?\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </article>

      <nav className="reader__pagination" aria-label="Навигация по главам">
        {previous ? (
          <Link to={`/chapters/${previous.slug}`}>
            <small>Предыдущая</small>
            <span>← {previous.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/chapters/${next.slug}`} className="reader__next">
            <small>Следующая</small>
            <span>{next.title} →</span>
          </Link>
        ) : (
          <Link to="/#chapters" className="reader__next">
            <small>Конец</small>
            <span>К списку глав →</span>
          </Link>
        )}
      </nav>
    </main>
  );
}
