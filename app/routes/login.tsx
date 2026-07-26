import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/login";
import { authenticate, createUserSession, getCurrentUser } from "../auth.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Вход — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getCurrentUser(request)) return redirect("/");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const userId = await authenticate(identifier, password);
  if (!userId) return data({ error: "Неверный юзернейм, почта или пароль." }, { status: 400 });
  return createUserSession(request, userId);
}

export default function Login({ actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return (
    <main className="auth-page">
      <Header />
      <section className="auth-card">
        <p className="eyebrow">{text("Личный кабинет", "Особистий кабінет")}</p>
        <h1>{text("Вход", "Вхід")}</h1>
        <Form method="post" className="auth-form">
          <label>{text("Юзернейм или почта", "Юзернейм або пошта")}<input name="identifier" autoComplete="username" required /></label>
          <label>{text("Пароль", "Пароль")}<input type="password" name="password" autoComplete="current-password" required /></label>
          {actionData?.error && <p className="form-error">{text(actionData.error, "Неправильний юзернейм, пошта або пароль.")}</p>}
          <button type="submit">{text("Войти", "Увійти")}</button>
        </Form>
        <p className="auth-switch"><Link to="/forgot-password">{text("Забыли пароль?", "Забули пароль?")}</Link></p>
        <p className="auth-switch">{text("Нет аккаунта?", "Немає облікового запису?")} <Link to="/register">{text("Зарегистрироваться", "Зареєструватися")}</Link></p>
      </section>
    </main>
  );
}
