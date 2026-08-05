import type { Route } from "./+types/admin-users";
import { Form, Link } from "react-router";
import { Header } from "../components/header";
import { requireAdmin } from "../auth.server";
import { countUsersForAdmin, getUsersForAdmin } from "../database.server";
import { useLocalization } from "../localization";
import { AdminTabs } from "../components/admin-tabs";

const PAGE_SIZE = 10;

export function meta() {
  return [{ title: "Пользователи — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const username = url.searchParams.get("username")?.trim() ?? "";
  const email = url.searchParams.get("email")?.trim() ?? "";
  const requestedPage = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const totalUsers = countUsersForAdmin(admin.id, username, email);
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  return {
    users: getUsersForAdmin(admin.id, username, email, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
    totalUsers,
    filters: { username, email },
    pagination: { currentPage, totalPages },
  };
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

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const hasFilters = Boolean(loaderData.filters.username || loaderData.filters.email);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (loaderData.filters.username) params.set("username", loaderData.filters.username);
    if (loaderData.filters.email) params.set("email", loaderData.filters.email);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
  };
  const pagination = loaderData.pagination.totalPages > 1 && <nav className="catalog-pagination admin-users-pagination" aria-label={text("Навигация по страницам", "Навігація сторінками")}>
    <Link className={`catalog-pagination__edge ${loaderData.pagination.currentPage === 1 ? "is-disabled" : ""}`} to={pageHref(loaderData.pagination.currentPage - 1)} aria-disabled={loaderData.pagination.currentPage === 1} tabIndex={loaderData.pagination.currentPage === 1 ? -1 : undefined}><span aria-hidden="true">←</span><b>{text("Назад", "Назад")}</b></Link>
    <div className="catalog-pagination__pages">{visiblePages(loaderData.pagination.currentPage, loaderData.pagination.totalPages).map((item) => typeof item === "number" ? <Link className={item === loaderData.pagination.currentPage ? "is-current" : ""} to={pageHref(item)} aria-current={item === loaderData.pagination.currentPage ? "page" : undefined} key={item}>{item}</Link> : <span aria-hidden="true" key={item}>•••</span>)}</div>
    <Link className={`catalog-pagination__edge ${loaderData.pagination.currentPage === loaderData.pagination.totalPages ? "is-disabled" : ""}`} to={pageHref(loaderData.pagination.currentPage + 1)} aria-disabled={loaderData.pagination.currentPage === loaderData.pagination.totalPages} tabIndex={loaderData.pagination.currentPage === loaderData.pagination.totalPages ? -1 : undefined}><b>{text("Вперёд", "Вперед")}</b><span aria-hidden="true">→</span></Link>
  </nav>;

  return (
    <main className="admin-users-page">
      <Header />
      <section className="admin-users-shell">
        <div className="admin-users-heading">
          <div>
            <p className="eyebrow">{text("Управление системой", "Керування системою")}</p>
            <p className="admin-users-count">
              <strong>{loaderData.totalUsers}</strong>
              <span>{text("пользователей", "користувачів")}</span>
            </p>
          </div>
          <h1>{text("Пользователи", "Користувачі")}</h1>
        </div>

        <AdminTabs />

        <Form className="admin-users-filter" method="get">
          <label>
            {text("Юзернейм", "Юзернейм")}
            <input name="username" type="search" defaultValue={loaderData.filters.username} placeholder={text("Поиск по юзернейму", "Пошук за юзернеймом")} />
          </label>
          <label>
            {text("Почта", "Пошта")}
            <input name="email" type="search" defaultValue={loaderData.filters.email} placeholder={text("Поиск по почте", "Пошук за поштою")} />
          </label>
          <div className="admin-users-filter__actions">
            <button type="submit">{text("Найти", "Знайти")}</button>
            {hasFilters && <Link to="/admin/users">{text("Сбросить", "Скинути")}</Link>}
          </div>
        </Form>

        {pagination}
        <div className="admin-users-list">
          {loaderData.users.length === 0 ? (
            <p className="admin-users-empty">{text("Пользователи не найдены.", "Користувачів не знайдено.")}</p>
          ) : loaderData.users.map((user) => (
            <Link className="admin-user-row" to={`/users/${encodeURIComponent(user.username)}`} key={user.id}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" />
                : <span className="admin-user-row__avatar">{user.username.slice(0, 1).toUpperCase()}</span>}
              <strong>{user.username}</strong>
              <span className="admin-user-row__email">{user.email ?? text("Почта не указана", "Пошту не вказано")}</span>
              <span className="admin-user-row__role">{text("Пользователь", "Користувач")}</span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
        {pagination}
      </section>
    </main>
  );
}
