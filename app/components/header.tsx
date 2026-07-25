import { Form, Link, useRouteLoaderData } from "react-router";
import { useEffect, useState } from "react";

type HeaderProps = {
  variant?: "overlay" | "solid";
  action?: React.ReactNode;
  beforeAction?: React.ReactNode;
  profileEditorTo?: string;
};

export function Header({ variant = "solid", action, beforeAction, profileEditorTo = "/admin/chapters" }: HeaderProps) {
  const rootData = useRouteLoaderData<{
    user: { email: string; role: "admin" | "reader" } | null;
    book: { title: string; description: string };
  }>("root");
  const user = rootData?.user;

  return (
    <header className={`site-header site-header--${variant}`}>
      <Link className="wordmark" to="/" aria-label={`${rootData?.book.title ?? "Phantom Freedom"} — на главную`}>
        <img src="/var5.png" alt="" />
        <span>{rootData?.book.title ?? "Phantom Freedom"}</span>
      </Link>
      <div className={`site-header__action ${user ? "site-header__action--authenticated" : ""}`}>
        {beforeAction}
        {action ?? (user ? (
          <>
            {user.role === "admin" && <Link className="header-button" to="/admin/chapters">Редактор</Link>}
            <Form method="post" action="/logout">
              <button className="header-button header-button--accent" type="submit">Выйти</button>
            </Form>
          </>
        ) : (
          <>
            <Link className="header-button" to="/login">Вход</Link>
            <Link className="header-button header-button--accent" to="/register">Регистрация</Link>
          </>
        ))}
        {user && <ProfileMenu user={user} editorTo={profileEditorTo} />}
      </div>
    </header>
  );
}

function ProfileMenu({
  user,
  editorTo,
}: {
  user: { email: string; role: "admin" | "reader" };
  editorTo: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className={`profile-menu ${open ? "profile-menu--open" : ""}`}>
      <button
        className="profile-menu__trigger"
        type="button"
        aria-label="Открыть меню профиля"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
        </svg>
      </button>
      <button className="profile-menu__backdrop" type="button" aria-label="Закрыть меню профиля" onClick={() => setOpen(false)} />
      <aside className="profile-menu__drawer" aria-hidden={!open} aria-label="Меню профиля">
        <div className="profile-menu__heading">
          <div>
            <small>Профиль</small>
            <strong>{user.email}</strong>
          </div>
          <button type="button" aria-label="Закрыть меню профиля" onClick={() => setOpen(false)}>×</button>
        </div>
        <nav>
          {user.role === "admin" && (
            <Link to={editorTo} onClick={() => setOpen(false)}>
              <span>Редактор</span>
              <b aria-hidden="true">→</b>
            </Link>
          )}
          <Link to="/#chapters" onClick={() => setOpen(false)}>
            <span>Все главы</span>
            <b aria-hidden="true">→</b>
          </Link>
        </nav>
        <Form method="post" action="/logout">
          <button className="profile-menu__logout" type="submit">Выйти</button>
        </Form>
      </aside>
    </div>
  );
}
