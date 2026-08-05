import type { Route } from "./+types/admin-tags";
import { Form, Link } from "react-router";
import { Header } from "../components/header";
import { requireAdmin } from "../auth.server";
import { countTags, getTagsForAdmin } from "../database.server";
import { formatLocalizedCount, useLocalization } from "../localization";
import { AdminTabs } from "../components/admin-tabs";

const PAGE_SIZE = 10;

export function meta() {
  return [{ title: "Метки — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const search = new URL(request.url).searchParams;
  const requestedPage = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1);
  const name = search.get("name")?.trim() ?? "";
  const description = search.get("description")?.trim() ?? "";
  const requestedSort = search.get("sort");
  const sort = requestedSort === "unpopular" || requestedSort === "newest" ? requestedSort : "popular";
  const totalTags = countTags(name, description);
  const totalPages = Math.max(1, Math.ceil(totalTags / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  return { tags: getTagsForAdmin(PAGE_SIZE, (currentPage - 1) * PAGE_SIZE, name, description, sort), currentPage, totalPages, totalTags, filters: { name, description, sort } };
}

function visiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
  const result: Array<number | string> = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) result.push(`ellipsis-${page}`);
    result.push(page);
  });
  return result;
}

export default function AdminTags({ loaderData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  const hasFilters = Boolean(loaderData.filters.name || loaderData.filters.description || loaderData.filters.sort !== "popular");
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (loaderData.filters.name) params.set("name", loaderData.filters.name);
    if (loaderData.filters.description) params.set("description", loaderData.filters.description);
    if (loaderData.filters.sort !== "popular") params.set("sort", loaderData.filters.sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/tags?${query}` : "/admin/tags";
  };
  const pagination = loaderData.totalPages > 1 && <nav className="catalog-pagination admin-tags-pagination" aria-label={text("Навигация по страницам", "Навігація сторінками")}>
    <Link className={`catalog-pagination__edge ${loaderData.currentPage === 1 ? "is-disabled" : ""}`} to={href(loaderData.currentPage - 1)} aria-disabled={loaderData.currentPage === 1}><span aria-hidden="true">←</span><b>{text("Назад", "Назад")}</b></Link>
    <div className="catalog-pagination__pages">{visiblePages(loaderData.currentPage, loaderData.totalPages).map((item) => typeof item === "number" ? <Link className={item === loaderData.currentPage ? "is-current" : ""} aria-current={item === loaderData.currentPage ? "page" : undefined} to={href(item)} key={item}>{item}</Link> : <span key={item}>•••</span>)}</div>
    <Link className={`catalog-pagination__edge ${loaderData.currentPage === loaderData.totalPages ? "is-disabled" : ""}`} to={href(loaderData.currentPage + 1)} aria-disabled={loaderData.currentPage === loaderData.totalPages}><b>{text("Вперёд", "Вперед")}</b><span aria-hidden="true">→</span></Link>
  </nav>;
  return <main className="admin-tags-page">
    <Header />
    <section className="admin-tags-shell">
      <div className="admin-tags-heading"><div><p className="eyebrow">{text("Управление системой", "Керування системою")}</p><p><strong>{loaderData.totalTags}</strong> {text("меток", "міток")}</p></div><h1>{text("Метки", "Мітки")}</h1></div>
      <AdminTabs />
      <Form className="admin-tags-filter" method="get">
        <label>{text("Название", "Назва")}<input type="search" name="name" defaultValue={loaderData.filters.name} placeholder={text("Поиск по названию", "Пошук за назвою")} /></label>
        <label>{text("Описание", "Опис")}<input type="search" name="description" defaultValue={loaderData.filters.description} placeholder={text("Поиск по описанию", "Пошук за описом")} /></label>
        <label>{text("Сортировка", "Сортування")}<select name="sort" defaultValue={loaderData.filters.sort}><option value="popular">{text("Более популярные", "Більш популярні")}</option><option value="unpopular">{text("Менее популярные", "Менш популярні")}</option><option value="newest">{text("Более новые", "Новіші")}</option></select></label>
        <div className="admin-tags-filter__actions"><button type="submit">{text("Применить", "Застосувати")}</button>{hasFilters && <Link to="/admin/tags">{text("Сбросить", "Скинути")}</Link>}</div>
      </Form>
      {pagination}
      <div className="admin-tags-list">
        {loaderData.tags.length ? loaderData.tags.map((tag) => <Link className="admin-tag-card" to={`/tags/${tag.slug}`} key={tag.id}>
          <div><strong>{language === "uk" ? tag.nameUk : tag.nameRu}</strong><span>{language === "uk" ? tag.nameRu : tag.nameUk}</span></div>
          <p>{(language === "uk" ? tag.descriptionUk : tag.descriptionRu) || text("Без описания", "Без опису")}</p>
          <b>{formatLocalizedCount(language, tag.workCount, ["работа", "работы", "работ"], ["робота", "роботи", "робіт"])}</b><i aria-hidden="true">→</i>
        </Link>) : <p className="admin-tags-empty">{hasFilters ? text("По заданным фильтрам меток не найдено.", "За заданими фільтрами міток не знайдено.") : text("Меток пока нет.", "Міток поки немає.")}</p>}
      </div>
      {pagination}
    </section>
  </main>;
}
