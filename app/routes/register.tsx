import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/register";
import { createUserSession, getCurrentUser, register } from "../auth.server";
import { findUserByEmail } from "../database.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Регистрация — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getCurrentUser(request)) return redirect("/");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return data({ error: "Введите корректную почту." }, { status: 400 });
  if (password.length < 8) return data({ error: "Пароль должен содержать не менее 8 символов." }, { status: 400 });
  if (password !== confirmation) return data({ error: "Пароли не совпадают." }, { status: 400 });
  if (findUserByEmail(email)) return data({ error: "Аккаунт с такой почтой уже существует." }, { status: 409 });

  const userId = await register(email, password);
  return createUserSession(request, userId);
}

export default function Register({ actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const ukError = actionData?.error === "Введите корректную почту."
    ? "Введіть коректну пошту."
    : actionData?.error === "Пароль должен содержать не менее 8 символов."
      ? "Пароль має містити щонайменше 8 символів."
      : actionData?.error === "Пароли не совпадают."
        ? "Паролі не збігаються."
        : "Обліковий запис із такою поштою вже існує.";
  return (
    <main className="auth-page">
      <Header />
      <section className="auth-card">
        <p className="eyebrow">{text("Новый аккаунт", "Новий обліковий запис")}</p>
        <h1>{text("Регистрация", "Реєстрація")}</h1>
        <Form method="post" className="auth-form">
          <label>{text("Почта", "Пошта")}<input type="email" name="email" autoComplete="email" required /></label>
          <label>{text("Пароль", "Пароль")}<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
          <label>{text("Повторите пароль", "Повторіть пароль")}<input type="password" name="confirmation" minLength={8} autoComplete="new-password" required /></label>
          {actionData?.error && <p className="form-error">{text(actionData.error, ukError)}</p>}
          <button type="submit">{text("Создать аккаунт", "Створити обліковий запис")}</button>
        </Form>
        <p className="auth-switch">{text("Уже есть аккаунт?", "Вже є обліковий запис?")} <Link to="/login">{text("Войти", "Увійти")}</Link></p>
      </section>
    </main>
  );
}
