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
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const userId = await authenticate(email, password);
  if (!userId) return data({ error: "Неверная почта или пароль." }, { status: 400 });
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
          <label>{text("Почта", "Пошта")}<input type="email" name="email" autoComplete="email" required /></label>
          <label>{text("Пароль", "Пароль")}<input type="password" name="password" autoComplete="current-password" required /></label>
          {actionData?.error && <p className="form-error">{text(actionData.error, "Неправильна пошта або пароль.")}</p>}
          <button type="submit">{text("Войти", "Увійти")}</button>
        </Form>
        <p className="auth-switch">{text("Нет аккаунта?", "Немає облікового запису?")} <Link to="/register">{text("Зарегистрироваться", "Зареєструватися")}</Link></p>
      </section>
    </main>
  );
}
