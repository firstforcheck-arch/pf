import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Header } from "../components/header";
import { getPublishedChapters } from "../database.server";

const bookDescription = "История о свободе, памяти и цене решений, которые продолжают преследовать нас даже тогда, когда прошлое кажется окончательно забытым.";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Phantom Freedom" },
    { name: "description", content: bookDescription },
  ];
}

export async function loader() {
  return { chapters: getPublishedChapters() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { chapters } = loaderData;
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero__grid" />
          <div className="hero__glow" />
          <Header variant="overlay" />
          <div className="hero__content">
            <h1>Phantom<br />Freedom</h1>
            <p className="hero__lead">{bookDescription}</p>
            <a className="hero__button" href="#chapters">
              Начать читать <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero__aside">
            <span>{String(chapters.length).padStart(2, "0")} главы</span>
          </div>
        </section>

        <section className="about section">
          <div className="section__label">О книге</div>
          <div className="about__content">
            <p className="about__quote">Phantom Freedom</p>
            <p>{bookDescription}</p>
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
                  <span className="chapter-card__time">{chapter.readingTime}</span>
                  <span className="chapter-card__arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <Link className="wordmark" to="/" aria-label="Phantom Freedom — на главную">
          <img src="/var5.png" alt="" />
          <span>Phantom Freedom</span>
        </Link>
        <p>{bookDescription}</p>
        <span>© 2026</span>
      </footer>
    </>
  );
}
