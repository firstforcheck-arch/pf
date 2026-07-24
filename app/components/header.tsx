import { Form, Link, useRouteLoaderData } from "react-router";

type HeaderProps = {
  variant?: "overlay" | "solid";
  action?: React.ReactNode;
  beforeAction?: React.ReactNode;
};

export function Header({ variant = "solid", action, beforeAction }: HeaderProps) {
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
      <div className="site-header__action">
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
      </div>
    </header>
  );
}
