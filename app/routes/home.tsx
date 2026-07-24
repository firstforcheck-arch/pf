import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Header } from "../components/header";
import { getBookSettings, getPublishedChapters } from "../database.server";
import { countTotalPages, formatPages } from "../text-metrics";

export function meta({ loaderData }: Route.MetaArgs) {
  const book = loaderData?.book;
  return [
    { title: book?.title ?? "Phantom Freedom" },
    { name: "description", content: book?.description ?? "" },
  ];
}

export async function loader() {
  const chapters = getPublishedChapters();
  return {
    book: getBookSettings(),
    chapters,
    totalPages: countTotalPages(chapters.map((chapter) => chapter.content)),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { book, chapters, totalPages } = loaderData;
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero__grid" />
          <div className="hero__glow" />
          <Header variant="overlay" />
          <div className="hero__content">
            <h1>{book.title}</h1>
            <p className="hero__lead">{book.description}</p>
            <a className="hero__button" href="#chapters">
              Начать читать <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero__aside">
            <span>{String(chapters.length).padStart(2, "0")} главы · {formatPages(totalPages)}</span>
          </div>
        </section>

        <section className="about section">
          <div className="section__label">О книге</div>
          <div className="about__content">
            <p className="about__quote">{book.title}</p>
            <p>{book.description}</p>
            <div className="book-stats">
              <span><b>Объём работы</b>{formatPages(totalPages)}</span>
            </div>
          </div>
        </section>

        <section className="chapters section" id="chapters">
          <div className="section__label">Содержание</div>
          <div className="chapters__content">
            <div className="section-heading">
              <p className="eyebrow">Читать онлайн</p>
              <h2>Главы</h2>
            </div>
            <div className="chapter-list">
              {chapters.map((chapter) => (
                <Link className="chapter-card" to={`/chapters/${chapter.slug}`} key={chapter.id}>
                  <span className="chapter-card__number">{chapter.number}</span>
                  <span className="chapter-card__copy">
                    <b>{chapter.title}</b>
                    <small>{chapter.subtitle}</small>
                  </span>
                  <span className="chapter-card__arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <Link className="wordmark" to="/" aria-label={`${book.title} — на главную`}>
          <img src="/var5.png" alt="" />
          <span>{book.title}</span>
        </Link>
        <p>{book.description}</p>
        <span>© 2026</span>
      </footer>
    </>
  );
}
