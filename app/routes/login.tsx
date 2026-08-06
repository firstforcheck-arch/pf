import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/login";
import { authenticate, createUserSession, getCurrentUser } from "../auth.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";
import { useState } from "react";
import { assertSameOrigin, enforceRateLimit } from "../security.server";

export function meta() {
  return [{ title: "Вход — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getCurrentUser(request)) return redirect("/");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const identifier = String(form.get("identifier") ?? "").trim();
  enforceRateLimit(request, "login-ip", 30, 15 * 60);
  enforceRateLimit(request, "login-account", 8, 15 * 60, identifier, false);
  const password = String(form.get("password") ?? "");
  const userId = await authenticate(identifier, password);
  if (!userId) return data({ error: "Неверный юзернейм, почта или пароль." }, { status: 400 });
  return createUserSession(request, userId);
}

export default function Login({ actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <main className="auth-page">
      <Header />
      <section className="auth-card">
        <p className="eyebrow">{text("Личный кабинет", "Особистий кабінет")}</p>
        <h1>{text("Вход", "Вхід")}</h1>
        <Form method="post" className="auth-form">
          <label>{text("Юзернейм или почта", "Юзернейм або пошта")}<input name="identifier" autoComplete="username" placeholder={text("Введите юзернейм или почту", "Введіть юзернейм або пошту")} required /></label>
          <label>{text("Пароль", "Пароль")}<span className="password-field"><input type={passwordVisible ? "text" : "password"} name="password" autoComplete="current-password" placeholder={text("Введите пароль", "Введіть пароль")} required /><button className="password-field__toggle" type="button" aria-label={passwordVisible ? text("Скрыть пароль", "Приховати пароль") : text("Показать пароль", "Показати пароль")} aria-pressed={passwordVisible} title={passwordVisible ? text("Скрыть пароль", "Приховати пароль") : text("Показать пароль", "Показати пароль")} onClick={() => setPasswordVisible((visible) => !visible)}><svg viewBox="0 0 24 24" aria-hidden="true">{passwordVisible ? <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/></> : <><path d="M4 10.5c2 2.3 4.7 3.5 8 3.5s6-1.2 8-3.5"/><path d="m7.2 13.5-1.7 2M12 14v2.7M16.8 13.5l1.7 2"/></>}</svg></button></span></label>
          {actionData?.error && <p className="form-error">{text(actionData.error, "Неправильний юзернейм, пошта або пароль.")}</p>}
          <button type="submit">{text("Войти", "Увійти")}</button>
        </Form>
        <p className="auth-switch"><Link to="/forgot-password">{text("Забыли пароль?", "Забули пароль?")}</Link></p>
        <p className="auth-switch">{text("Нет аккаунта?", "Немає облікового запису?")} <Link to="/register">{text("Зарегистрироваться", "Зареєструватися")}</Link></p>
      </section>
    </main>
  );
}
