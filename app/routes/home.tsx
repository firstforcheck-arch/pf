import type { Route } from "./+types/home";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Header } from "../components/header";
import { getBookSettings, getPublishedChapters } from "../database.server";
import { countTotalPages, formatChapters, formatPages } from "../text-metrics";
import { useLocalization } from "../localization";

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
  const location = useLocation();
  const { language, text } = useLocalization();

  useEffect(() => {
    if (location.hash !== "#chapters") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("chapters")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

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
            <Link className="hero__button" to={chapters[0] ? `/chapters/${chapters[0].slug}` : "/#chapters"}>
              {text("Начать читать", "Почати читати")} <span aria-hidden="true">↓</span>
            </Link>
          </div>
          <div className="hero__aside">
            <span>{formatChapters(chapters.length, language)} · {formatPages(totalPages, language)}</span>
          </div>
        </section>

        <section className="about section">
          <div className="section__label">{text("Примечания", "Примітки")}</div>
          <div className="about__content">
            <p className="about__quote">{text("Примечания", "Примітки")}</p>
            <p className="book-notes">{book.notes || text("Примечаний пока нет.", "Приміток поки немає.")}</p>
            <div className="book-stats">
              <span><b>{text("Объём работы", "Обсяг роботи")}</b>{formatPages(totalPages, language)}</span>
            </div>
          </div>
        </section>

        <section className="chapters section" id="chapters">
          <div className="section__label">{text("Содержание", "Зміст")}</div>
          <div className="chapters__content">
            <div className="section-heading">
              <p className="eyebrow">{text("Читать онлайн", "Читати онлайн")}</p>
              <h2>{text("Главы", "Глави")}</h2>
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
        <Link className="wordmark" to="/" aria-label={`${book.title} — ${text("на главную", "на головну")}`}>
          <img src="/var5.png" alt="" />
          <span>{book.title}</span>
        </Link>
        <span>© 2026</span>
      </footer>
    </>
  );
}
