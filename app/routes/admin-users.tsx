import type { Route } from "./+types/admin-users";
import { Form, Link } from "react-router";
import { Header } from "../components/header";
import { requireAdmin } from "../auth.server";
import { countUsersForAdmin, getUsersForAdmin } from "../database.server";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Пользователи — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const username = url.searchParams.get("username")?.trim() ?? "";
  const email = url.searchParams.get("email")?.trim() ?? "";
  const requestedRole = url.searchParams.get("role") ?? "";
  const role = requestedRole === "reader" || requestedRole === "account-plus" ? requestedRole : "";
  return {
    users: getUsersForAdmin(admin.id, username, email, role),
    totalUsers: countUsersForAdmin(admin.id),
    filters: { username, email, role },
  };
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const hasFilters = Boolean(loaderData.filters.username || loaderData.filters.email || loaderData.filters.role);

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

        <Form className="admin-users-filter" method="get">
          <label>
            {text("Юзернейм", "Юзернейм")}
            <input name="username" type="search" defaultValue={loaderData.filters.username} placeholder={text("Поиск по юзернейму", "Пошук за юзернеймом")} />
          </label>
          <label>
            {text("Почта", "Пошта")}
            <input name="email" type="search" defaultValue={loaderData.filters.email} placeholder={text("Поиск по почте", "Пошук за поштою")} />
          </label>
          <label>
            {text("Роль", "Роль")}
            <select name="role" defaultValue={loaderData.filters.role}>
              <option value="">{text("Все роли", "Усі ролі")}</option>
              <option value="reader">{text("Читатель", "Читач")}</option>
              <option value="account-plus">Аккаунт+</option>
            </select>
          </label>
          <div className="admin-users-filter__actions">
            <button type="submit">{text("Найти", "Знайти")}</button>
            {hasFilters && <Link to="/admin/users">{text("Сбросить", "Скинути")}</Link>}
          </div>
        </Form>

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
              <span className={`admin-user-row__role ${user.accountPlus === 1 ? "admin-user-row__role--plus" : ""}`}>
                {user.accountPlus === 1 ? "Аккаунт+" : text("Читатель", "Читач")}
              </span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
