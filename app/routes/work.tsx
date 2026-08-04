import type { Route } from "./+types/work";
import { useEffect } from "react";
import { Form, isRouteErrorResponse, Link, useLocation } from "react-router";
import { Header } from "../components/header";
import { WorkUnavailable } from "../components/work-unavailable";
import { getPublishedChapters, getWorkBySlug, getWorkTags, isFollowingWork, setWorkFollowing } from "../database.server";
import { getCurrentUser } from "../auth.server";
import { countTotalPages, formatChapters, formatPages } from "../text-metrics";
import { useLocalization } from "../localization";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.book.title ?? "Работа не найдена" }, { name: "description", content: loaderData?.book.description ?? "" }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const book = getWorkBySlug(params.workSlug);
  if (!book) throw new Response("Работа не найдена", { status: 404 });
  const user = await getCurrentUser(request);
  const chapters = getPublishedChapters(book.id);
  return { book, chapters, tags: getWorkTags(book.id), user, following: user ? isFollowingWork(user.id, book.id) : false, totalPages: countTotalPages(chapters.map((chapter) => chapter.content)) };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw new Response("Необходима авторизация", { status: 401 });
  const book = getWorkBySlug(params.workSlug);
  if (!book) throw new Response("Работа не найдена", { status: 404 });
  const form = await request.formData();
  if (form.get("intent") === "toggle-follow") {
    setWorkFollowing(user.id, book.id, form.get("following") === "yes");
  }
  return { ok: true };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const unavailable = isRouteErrorResponse(error) && error.status === 404;
  return <WorkUnavailable notFound={unavailable} />;
}

export default function Work({ loaderData }: Route.ComponentProps) {
  const { book, chapters, totalPages } = loaderData;
  const location = useLocation();
  const { language, text } = useLocalization();
  useEffect(() => {
    if (location.hash !== "#chapters") return;
    requestAnimationFrame(() => document.getElementById("chapters")?.scrollIntoView({ behavior: "smooth" }));
  }, [location.key, location.hash]);

  return (
    <>
      <main>
        <section className={`hero ${book.coverUrl ? "hero--with-cover" : ""} ${book.description.trim() ? "" : "hero--without-description"}`}>
          <div className="hero__grid" /><div className="hero__glow" /><Header variant="overlay" />
          <div className="hero__content">
            <h1>{book.title}</h1>
            {book.coverUrl && <figure className="hero__cover"><img src={book.coverUrl} alt={book.title} style={{ transform: `translate(${50 - book.coverPositionX}%, ${50 - book.coverPositionY}%) scale(${book.coverZoom})` }} /></figure>}
            {book.description.trim() && <p className="hero__lead">{book.description}</p>}
            <div className="hero__buttons">
              <Link className="hero__button" to={chapters[0] ? `/works/${book.slug}/chapters/${chapters[0].publicSlug}` : "#chapters"}>{text("Начать читать", "Почати читати")} <span>↓</span></Link>
              {loaderData.user ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="toggle-follow" />
                  <input type="hidden" name="following" value={loaderData.following ? "no" : "yes"} />
                  <button className={`follow-work-button ${loaderData.following ? "follow-work-button--active" : ""}`} type="submit">
                    {loaderData.following ? text("Вы следите за работой", "Ви стежите за роботою") : text("Следить за работой", "Стежити за роботою")}
                  </button>
                </Form>
              ) : <Link className="follow-work-button" to="/login">{text("Следить за работой", "Стежити за роботою")}</Link>}
            </div>
          </div>
          <div className="hero__aside"><span>{formatChapters(chapters.length, language)} · {formatPages(totalPages, language)}</span></div>
        </section>
        <section className="about section">
          <div className="section__label">{text("Примечания", "Нотатки")}</div>
          <div className="about__content">
            <div className="about__main">
              <p className="about__quote">{text("Примечания", "Нотатки")}</p>
              <p className="book-notes">{book.notes || text("Примечаний пока нет.", "Приміток поки немає.")}</p>
              <Link className="author-card author-card--signature" to={`/users/${book.owner.username}`} aria-label={`${text("Автор работы", "Автор роботи")}: ${book.owner.username}`}>
                <strong>{book.owner.username}</strong>
                {book.owner.avatarUrl ? <img src={book.owner.avatarUrl} alt="" /> : <span>{book.owner.username[0].toUpperCase()}</span>}
              </Link>
              {loaderData.tags.length > 0 && <div className="author-tags"><b>{text("Метки:", "Мітки:")}</b>{loaderData.tags.map((tag) => <Link className="tag-chip" to={`/tags/${tag.slug}`} key={tag.id}>{language === "uk" ? tag.nameUk : tag.nameRu}</Link>)}</div>}
              <div className="book-stats"><span><b>{text("Объём работы", "Обсяг роботи")}</b>{formatPages(totalPages, language)}</span></div>
            </div>
          </div>
        </section>
        <section className="chapters section" id="chapters">
          <div className="section__label">{text("Содержание", "Зміст")}</div>
          <div className="chapters__content"><div className="section-heading"><p className="eyebrow">{text("Читать онлайн", "Читати онлайн")}</p><h2>{text("Главы", "Глави")}</h2></div>
            <div className="chapter-list">{chapters.map((chapter, index) => <Link className="chapter-card" to={`/works/${book.slug}/chapters/${chapter.publicSlug}`} key={chapter.id}><span className="chapter-card__number">{index + 1}</span><span className="chapter-card__copy"><b>{chapter.title}</b><small>{chapter.subtitle}</small></span><span className="chapter-card__arrow">↗</span></Link>)}</div>
          </div>
        </section>
      </main>
    </>
  );
}
