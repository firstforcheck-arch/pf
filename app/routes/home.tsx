import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Header } from "../components/header";
import { getPublishedWorks } from "../database.server";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Phantom Freedom — ваш уголок свободы" }];
}

export async function loader() {
  return { works: getPublishedWorks().slice(0, 3) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return <main>
    <section className="platform-hero">
      <Header variant="overlay" />
      <div className="hero__grid" /><div className="hero__glow" />
      <div className="platform-hero__content">
        <p className="eyebrow">{text("Пространство без цензуры", "Простір без цензури")}</p>
        <h1>Phantom<br />Freedom</h1>
        <p>{text("Ваш уголок свободы. Публикуйте и читайте истории на любые темы — без государственной цензуры и навязанных рамок.", "Ваш куточок свободи. Публікуйте та читайте історії на будь-які теми — без державної цензури й нав’язаних рамок.")}</p>
        <Link className="hero__button" to="/works">{text("Смотреть работы", "Переглянути роботи")} →</Link>
      </div>
    </section>
    <section className="works-preview section">
      <div className="section__label">{text("Работы", "Роботи")}</div>
      <div><div className="section-heading"><p className="eyebrow">{text("Читайте свободно", "Читайте вільно")}</p><h2>{text("Новые работы", "Нові роботи")}</h2></div><WorkGrid works={loaderData.works} /></div>
    </section>
  </main>;
}

export function WorkGrid({ works }: { works: ReturnType<typeof getPublishedWorks> }) {
  return <div className="work-grid">{works.map((work) => <Link className="work-card" to={`/works/${work.slug}`} key={work.id}>
    <div className="work-card__cover">{work.coverUrl ? <img src={work.coverUrl} alt="" /> : <span>{work.title.slice(0, 1)}</span>}</div>
    <div><h3>{work.title}</h3><p>{work.description}</p><small>@{work.owner.username}</small></div>
  </Link>)}</div>;
}
