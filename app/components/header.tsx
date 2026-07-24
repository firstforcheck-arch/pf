import { Form, Link, useRouteLoaderData } from "react-router";

type HeaderProps = {
  variant?: "overlay" | "solid";
  action?: React.ReactNode;
};

export function Header({ variant = "solid", action }: HeaderProps) {
  const rootData = useRouteLoaderData<{ user: { email: string; role: "admin" | "reader" } | null }>("root");
  const user = rootData?.user;

  return (
    <header className={`site-header site-header--${variant}`}>
      <Link className="wordmark" to="/" aria-label="Phantom Freedom — на главную">
        <img src="/var5.png" alt="" />
        <span>Phantom Freedom</span>
      </Link>
      <div className="site-header__action">
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
