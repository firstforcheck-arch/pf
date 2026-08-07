import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Header } from "../components/header";
import { WorkActions } from "../components/work-actions";
import { getCurrentUser } from "../auth.server";
import { enrichWorkCards, getPublishedWorks, type WorkCardRecord } from "../database.server";
import { useLocalization } from "../localization";
import { formatChapters, formatPages } from "../text-metrics";
import { socialMeta } from "../seo";
import { absoluteUrl } from "../seo";
import { getSiteUrl } from "../seo.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [...socialMeta({
    title: "Phantom Freedom — ваш уголок свободы",
    description: "Независимая платформа для публикации и чтения авторских произведений.",
  }), ...(loaderData ? [{ "script:ld+json": {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Phantom Freedom",
    url: absoluteUrl(loaderData.siteUrl, "/"),
  } }] : [])];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { works: enrichWorkCards(getPublishedWorks(10), user?.id), siteUrl: getSiteUrl(request) };
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
      <div><div className="section-heading"><p className="eyebrow">{text("Читайте свободно", "Читайте вільно")}</p><h2>{text("Новые работы", "Нові роботи")}</h2></div><WorkGrid works={loaderData.works} /></div>
    </section>
  </main>;
}

export function WorkGrid({ works }: { works: WorkCardRecord[] }) {
  const { language, text } = useLocalization();
  return <div className="work-grid">{works.map((work) => <article className="work-card" key={work.id}>
    <Link className="work-card__cover" to={`/works/${work.slug}`} aria-label={work.title}>
      {work.coverUrl ? <img src={work.coverUrl} alt="" style={{ transform: `translate(${50 - work.coverPositionX}%, ${50 - work.coverPositionY}%) scale(${work.coverZoom})` }} /> : <span>{work.title}</span>}
    </Link>
    <div className="work-card__body">
      <div className="work-card__summary">
        <Link className="work-card__title" to={`/works/${work.slug}`}><h3>{work.title}</h3></Link>
        <Link className="work-card__author" to={`/users/${encodeURIComponent(work.owner.username)}`}>
          {work.owner.avatarUrl ? <img src={work.owner.avatarUrl} alt="" /> : <span aria-hidden="true">{work.owner.username.slice(0, 1).toUpperCase()}</span>}
          <small>{work.owner.username}</small>
        </Link>
        <div className="work-card__metrics">
          <span><b>{text("Страницы", "Сторінки")}</b>{formatPages(work.totalPages, language)}</span>
          <span><b>{text("Главы", "Глави")}</b>{formatChapters(work.chapterCount, language)}</span>
        </div>
      </div>
      {work.tags.length > 0 && <div className="work-card__tags"><b>{text("Метки:", "Мітки:")}</b>{work.tags.map((tag) => <Link className="tag-chip" to={`/tags/${tag.slug}`} key={tag.id}>{language === "uk" ? tag.nameUk : tag.nameRu}</Link>)}</div>}
      <p className="work-card__description">{work.description || text("Описание пока не добавлено.", "Опис поки не додано.")}</p>
    </div>
    <WorkActions workId={work.id} likeCount={work.likeCount} liked={work.liked} following={work.following} />
    {work.firstChapterSlug ? <Link className="work-card__read" to={`/works/${work.slug}/chapters/${work.firstChapterSlug}`}>
      <span>{text("Читать", "Читати")}</span><span aria-hidden="true">→</span>
    </Link> : null}
  </article>)}</div>;
}
