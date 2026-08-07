import { Form, Link, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/works";
import { Header } from "../components/header";
import { getCurrentUser } from "../auth.server";
import { enrichWorkCards, getPublishedTagsBySlugs, getPublishedWorks, type TagRecord } from "../database.server";
import { WorkGrid } from "./home";
import { useLocalization } from "../localization";
import { socialMeta } from "../seo";

export function meta() {
  return socialMeta({
    title: "Работы — Phantom Freedom",
    description: "Каталог авторских произведений Phantom Freedom: находите новые истории по меткам и объёму.",
  });
}

function pageCount(value: string | null) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  const search = new URL(request.url).searchParams;
  const query = (search.get("q") ?? "").trim().slice(0, 120);
  const minPages = pageCount(search.get("minPages"));
  const maxPages = pageCount(search.get("maxPages"));
  const sort = search.get("sort") === "popular" ? "popular" : "newest";
  const selectedTagSlugs = [...new Set(search.getAll("tag").filter(Boolean))].slice(0, 20);
  const requestedPage = Math.max(1, Math.floor(Number(search.get("page"))) || 1);
  const normalizedQuery = query.toLocaleLowerCase("ru");

  const filteredWorks = enrichWorkCards(getPublishedWorks(), user?.id)
    .filter((work) => !normalizedQuery || work.title.toLocaleLowerCase("ru").includes(normalizedQuery))
    .filter((work) => minPages === null || work.totalPages >= minPages)
    .filter((work) => maxPages === null || work.totalPages <= maxPages)
    .filter((work) => selectedTagSlugs.every((slug) => work.tags.some((tag) => tag.slug === slug)))
    .sort((left, right) => sort === "popular"
      ? right.likeCount - left.likeCount || Date.parse(right.createdAt) - Date.parse(left.createdAt)
      : Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const totalWorks = filteredWorks.length;
  const totalPages = Math.ceil(totalWorks / 10);
  const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const works = filteredWorks.slice((currentPage - 1) * 10, currentPage * 10);

  return { works, selectedTags: getPublishedTagsBySlugs(selectedTagSlugs), filters: { query, minPages, maxPages, sort, selectedTagSlugs }, pagination: { currentPage, totalPages, totalWorks } };
}

function CatalogTagFilter({ initialTags }: { initialTags: TagRecord[] }) {
  const { language, text } = useLocalization();
  const fetcher = useFetcher<{ tags: TagRecord[] }>();
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedKey = selectedTags.map((tag) => tag.slug).sort().join(",");

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams({ q: query });
    selectedTags.forEach((tag) => params.append("exclude", tag.slug));
    const timeout = window.setTimeout(() => fetcher.load(`/tags/search?${params}`), 220);
    return () => window.clearTimeout(timeout);
  }, [open, query, selectedKey]);

  const tagName = (tag: TagRecord) => language === "uk" ? tag.nameUk : tag.nameRu;
  return <fieldset className="catalog-tag-filter">
    <legend>{text("Метки", "Мітки")}</legend>
    {selectedTags.map((tag) => <input type="hidden" name="tag" value={tag.slug} key={tag.id} />)}
    <div className="catalog-tag-filter__selected">
      {selectedTags.map((tag) => <span key={tag.id}>{tagName(tag)}<button type="button" aria-label={`${text("Удалить метку", "Видалити мітку")} ${tagName(tag)}`} onClick={() => setSelectedTags((tags) => tags.filter((item) => item.id !== tag.id))}>×</button></span>)}
    </div>
    <div className="catalog-tag-filter__combobox">
      <button className="catalog-tag-filter__toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{selectedTags.length ? text("Добавить ещё", "Додати ще") : text("Выбрать метки", "Вибрати мітки")}</button>
      {open && <div className="catalog-tag-filter__dropdown">
        <label><span>{text("Поиск метки", "Пошук мітки")}</span><input autoFocus type="search" value={query} placeholder={text("Введите название метки", "Введіть назву мітки")} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="catalog-tag-filter__results" aria-busy={fetcher.state !== "idle"}>
          {(fetcher.data?.tags ?? []).map((tag) => <button type="button" key={tag.id} onClick={() => setSelectedTags((tags) => [...tags, tag])}>
            <span><strong>{tagName(tag)}</strong><small>{language === "uk" ? tag.descriptionUk : tag.descriptionRu}</small></span><b>{tag.workCount}</b>
          </button>)}
          {fetcher.state === "idle" && fetcher.data && !fetcher.data.tags.length && <p>{text("Подходящих меток не найдено.", "Відповідних міток не знайдено.")}</p>}
        </div>
        <small>{text("Показано не более 20 совпадений", "Показано не більше 20 збігів")}</small>
      </div>}
    </div>
  </fieldset>;
}

function visiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page > 0 && page <= totalPages).sort((left, right) => left - right);
  const result: Array<number | string> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(`ellipsis-${page}`);
    result.push(page);
  });
  return result;
}

export default function Works({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const { filters } = loaderData;
  const filtersActive = Boolean(filters.query || filters.minPages !== null || filters.maxPages !== null || filters.sort !== "newest" || filters.selectedTagSlugs.length);
  const filterKey = `${filters.query}:${filters.minPages}:${filters.maxPages}:${filters.sort}:${filters.selectedTagSlugs.join(",")}`;
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setFiltersOpen(false);
  }, [filterKey]);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.minPages !== null) params.set("minPages", String(filters.minPages));
    if (filters.maxPages !== null) params.set("maxPages", String(filters.maxPages));
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    filters.selectedTagSlugs.forEach((slug) => params.append("tag", slug));
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/works?${query}` : "/works";
  };
  const renderPagination = (position: "top" | "bottom") => loaderData.pagination.totalPages > 1 ? <nav className={`catalog-pagination ${position === "top" ? "catalog-pagination--top" : ""}`} aria-label={text("Навигация по страницам", "Навігація сторінками")}>
    <Link className={`catalog-pagination__edge ${loaderData.pagination.currentPage === 1 ? "is-disabled" : ""}`} to={pageHref(loaderData.pagination.currentPage - 1)} aria-disabled={loaderData.pagination.currentPage === 1} tabIndex={loaderData.pagination.currentPage === 1 ? -1 : undefined}><span aria-hidden="true">←</span><b>{text("Назад", "Назад")}</b></Link>
    <div className="catalog-pagination__pages">{visiblePages(loaderData.pagination.currentPage, loaderData.pagination.totalPages).map((item) => typeof item === "number" ? <Link className={item === loaderData.pagination.currentPage ? "is-current" : ""} to={pageHref(item)} aria-current={item === loaderData.pagination.currentPage ? "page" : undefined} key={item}>{item}</Link> : <span aria-hidden="true" key={item}>•••</span>)}</div>
    <Link className={`catalog-pagination__edge ${loaderData.pagination.currentPage === loaderData.pagination.totalPages ? "is-disabled" : ""}`} to={pageHref(loaderData.pagination.currentPage + 1)} aria-disabled={loaderData.pagination.currentPage === loaderData.pagination.totalPages} tabIndex={loaderData.pagination.currentPage === loaderData.pagination.totalPages ? -1 : undefined}><b>{text("Вперёд", "Вперед")}</b><span aria-hidden="true">→</span></Link>
  </nav> : null;

  return <main className="catalog-page">
    <Header />
    <section className="catalog-shell">
      <p className="eyebrow">Phantom Freedom</p>
      <div className="catalog-heading-row">
        <h1>{text("Работы", "Роботи")}</h1>
        <button className="catalog-filters__trigger" type="button" aria-expanded={filtersOpen} aria-controls="catalog-filter-panel" onClick={() => setFiltersOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/></svg>
          {text("Фильтры", "Фільтри")}
          {filtersActive && <span className="catalog-filters__active" aria-label={text("Фильтры применены", "Фільтри застосовано")} />}
        </button>
        {filtersOpen && <Form className="catalog-filters__panel" id="catalog-filter-panel" key={filterKey} method="get">
            <label className="catalog-filters__title">{text("Название работы", "Назва роботи")}<input type="search" name="q" defaultValue={filters.query} placeholder={text("Введите название", "Введіть назву")} /></label>
            <label>{text("Страниц от", "Сторінок від")}<input type="search" inputMode="numeric" pattern="[0-9]*" name="minPages" placeholder="0" defaultValue={filters.minPages ?? ""} /></label>
            <label>{text("Страниц до", "Сторінок до")}<input type="search" inputMode="numeric" pattern="[0-9]*" name="maxPages" placeholder="1000" defaultValue={filters.maxPages ?? ""} /></label>
            <label>{text("Сортировка", "Сортування")}<select name="sort" defaultValue={filters.sort}><option value="newest">{text("Более новые", "Новіші")}</option><option value="popular">{text("Более популярные", "Популярніші")}</option></select></label>
            <CatalogTagFilter initialTags={loaderData.selectedTags} />
            <div className="catalog-filters__actions">
              <Link to="/works">{text("Сбросить", "Скинути")}</Link>
              <button type="submit">{text("Применить", "Застосувати")}</button>
            </div>
          </Form>}
        {filtersActive && <div className="catalog-filter-status"><span>{text("Фильтры применены", "Фільтри застосовано")}</span><Link to="/works">{text("Сбросить", "Скинути")} <b aria-hidden="true">×</b></Link></div>}
      </div>
      {renderPagination("top")}
      {loaderData.works.length > 0 ? <WorkGrid works={loaderData.works} /> : <div className="catalog-empty"><p>{text("Работы по заданным параметрам не найдены.", "Робіт за заданими параметрами не знайдено.")}</p><Link to="/works">{text("Сбросить фильтры", "Скинути фільтри")}</Link></div>}
      {renderPagination("bottom")}
    </section>
  </main>;
}
