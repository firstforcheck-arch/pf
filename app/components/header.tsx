import { Form, Link, useFetcher, useRevalidator, useRouteLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { useLocalization } from "../localization";

type HeaderProps = {
  variant?: "overlay" | "solid";
  action?: React.ReactNode;
  beforeAction?: React.ReactNode;
  profileEditorTo?: string;
};

export function Header({ variant = "solid", action, beforeAction, profileEditorTo = "/editor" }: HeaderProps) {
  const { text } = useLocalization();
  const rootData = useRouteLoaderData<{
    user: { username: string; avatarUrl: string | null; role: "admin" | "reader"; accountPlus: number } | null;
    book: { title: string; description: string };
    unreadNotifications: number;
    notifications: NotificationItem[];
  }>("root");
  const user = rootData?.user;
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!user) return;
    const events = new EventSource("/events");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type?: string };
      if (payload.type === "notification" || payload.type === "message") revalidator.revalidate();
    };
    return () => events.close();
  }, [user?.username]);

  return (
    <header className={`site-header site-header--${variant}`}>
      <Link className="wordmark" to="/" aria-label={`${rootData?.book.title ?? "Phantom Freedom"} — ${text("на главную", "на головну")}`}>
        <img src="/logo4.png" alt="" />
        <span>{rootData?.book.title ?? "Phantom Freedom"}</span>
      </Link>
      <nav className="site-header__navigation">
        <Link className="header-works-link" to="/works">{text("Работы", "Роботи")}</Link>
        <Link className="header-works-link" to="/about">{text("О платформе", "Про платформу")}</Link>
      </nav>
      <div className={`site-header__action ${user ? "site-header__action--authenticated" : ""}`}>
        <ThemeToggle className="theme-toggle--desktop" />
        <LanguageToggle className="language-toggle--desktop" />
        {beforeAction}
        {action}
        {user && <NotificationMenu notifications={rootData?.notifications ?? []} unread={rootData?.unreadNotifications ?? 0} />}
        <ProfileMenu user={user} editorTo={profileEditorTo} />
      </div>
    </header>
  );
}

type NotificationItem = {
  type: "chapter" | "message";
  id: number;
  readAt: string | null;
  workSlug: string | null;
  workTitle: string | null;
  chapterSlug: string | null;
  chapterTitle: string | null;
  senderUsername: string | null;
  messagePreview: string | null;
};

function NotificationMenu({
  notifications,
  unread,
}: {
  notifications: NotificationItem[];
  unread: number;
}) {
  const { text } = useLocalization();
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();

  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread > 0) fetcher.submit({}, { method: "post", action: "/notifications" });
  }

  return (
    <div className={`notification-menu ${open ? "notification-menu--open" : ""}`}>
      <button className="notification-menu__trigger" type="button" onClick={toggle} aria-expanded={open} aria-label={text("Уведомления", "Сповіщення")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>
      {open && <button className="notification-menu__backdrop" type="button" aria-label={text("Закрыть уведомления", "Закрити сповіщення")} onClick={() => setOpen(false)} />}
      {open && (
        <div className="notification-menu__panel">
          <strong>{text("Уведомления", "Сповіщення")}</strong>
          {notifications.length === 0 ? <p>{text("Новых уведомлений пока нет.", "Нових сповіщень поки немає.")}</p> : notifications.map((notification) => notification.type === "message" ? (
            <Link to={`/messages/${notification.senderUsername}`} key={`message-${notification.id}`} onClick={() => setOpen(false)}>
              <small>{notification.senderUsername}</small>
              <span>{text("Новое сообщение", "Нове повідомлення")}: {notification.messagePreview}</span>
            </Link>
          ) : (
            <Link to={`/works/${notification.workSlug}/chapters/${notification.chapterSlug}`} key={`chapter-${notification.id}`} onClick={() => setOpen(false)}>
              <small>{notification.workTitle}</small>
              <span>{text("Новая глава", "Нова глава")}: {notification.chapterTitle}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({
  user,
  editorTo,
}: {
  user: { username: string; avatarUrl: string | null; role: "admin" | "reader"; accountPlus: number } | null | undefined;
  editorTo: string;
}) {
  const { text } = useLocalization();
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
    if (!window.matchMedia("(max-width: 700px)").matches) return;
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
        aria-label={text("Открыть меню профиля", "Відкрити меню профілю")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {user?.avatarUrl
          ? <img className="profile-avatar" src={user.avatarUrl} alt="" />
          : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" /></svg>}
      </button>
      <button className="profile-menu__backdrop" type="button" aria-label={text("Закрыть меню профиля", "Закрити меню профілю")} onClick={() => setOpen(false)} />
      <aside className="profile-menu__drawer" aria-hidden={!open} aria-label={text("Меню профиля", "Меню профілю")}>
        <div className="profile-menu__heading">
          {user ? (
            <Link className="profile-menu__heading-user" to="/profile" onClick={() => setOpen(false)}>
              <small>{text("Профиль", "Профіль")}</small>
              <strong>{user.username}</strong>
            </Link>
          ) : (
            <div className="profile-menu__heading-user">
              <small>{text("Профиль", "Профіль")}</small>
              <strong>{text("Гость", "Гість")}</strong>
            </div>
          )}
          <button type="button" aria-label={text("Закрыть меню профиля", "Закрити меню профілю")} onClick={() => setOpen(false)}>×</button>
        </div>
        <nav>
          {user && (
            <Link className="profile-menu__profile-link" to="/profile" onClick={() => setOpen(false)}>
              <span>{text("Профиль", "Профіль")}</span>
              <b aria-hidden="true">→</b>
            </Link>
          )}
          <Link className="profile-menu__works-link" to="/works" onClick={() => setOpen(false)}>
            <span>{text("Работы", "Роботи")}</span>
            <b aria-hidden="true">→</b>
          </Link>
          <Link className="profile-menu__works-link profile-menu__about-link" to="/about" onClick={() => setOpen(false)}>
            <span>{text("О платформе", "Про платформу")}</span>
            <b aria-hidden="true">→</b>
          </Link>
          {(user?.role === "admin" || user?.accountPlus === 1) && (<>
            <Link to={editorTo} onClick={() => setOpen(false)}>
              <span>{text("Редактор", "Редактор")}</span>
              <b aria-hidden="true">→</b>
            </Link>
            <Link to="/analytics" onClick={() => setOpen(false)}><span>{text("Аналитика", "Аналітика")}</span><b aria-hidden="true">→</b></Link>
          </>)}
          {user?.role === "admin" && (
            <Link to="/admin/users" onClick={() => setOpen(false)}>
              <span>{text("Управление", "Керування")}</span>
              <b aria-hidden="true">→</b>
            </Link>
          )}
          <div className="profile-menu__theme">
            <span>{text("Тёмная тема", "Темна тема")}</span>
            <ThemeToggle className="theme-toggle--mobile" showLabel />
          </div>
          <div className="profile-menu__theme">
            <span>{text("Язык", "Мова")}</span>
            <LanguageToggle />
          </div>
          {!user && (
            <>
              <Link to="/login" onClick={() => setOpen(false)}><span>{text("Вход", "Вхід")}</span><b aria-hidden="true">→</b></Link>
              <Link to="/register" onClick={() => setOpen(false)}><span>{text("Регистрация", "Реєстрація")}</span><b aria-hidden="true">→</b></Link>
            </>
          )}
        </nav>
        {user && (
          <Form method="post" action="/logout">
            <button className="profile-menu__logout" type="submit">{text("Выйти", "Вийти")}</button>
          </Form>
        )}
      </aside>
    </div>
  );
}

function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { text } = useLocalization();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function syncSystemTheme(event: MediaQueryListEvent) {
      if (localStorage.getItem("theme")) return;
      const nextTheme = event.matches ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    }

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      className={`theme-toggle ${className ?? ""}`}
      type="button"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={theme === "dark" ? text("Включить светлую тему", "Увімкнути світлу тему") : text("Включить тёмную тему", "Увімкнути темну тему")}
      onClick={toggleTheme}
    >
      {showLabel && <span>{theme === "dark" ? text("Включена", "Увімкнена") : text("Выключена", "Вимкнена")}</span>}
      <i aria-hidden="true"><b /></i>
    </button>
  );
}

function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, text } = useLocalization();
  return (
    <div className={`language-toggle ${className ?? ""}`} role="group" aria-label={text("Выбор языка", "Вибір мови")}>
      <button type="button" className={language === "ru" ? "active" : ""} aria-pressed={language === "ru"} onClick={() => setLanguage("ru")}>RU</button>
      <button type="button" className={language === "uk" ? "active" : ""} aria-pressed={language === "uk"} onClick={() => setLanguage("uk")}>UA</button>
    </div>
  );
}
