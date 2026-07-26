import { createHash, randomBytes } from "node:crypto";
import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/forgot-password";
import { getCurrentUser } from "../auth.server";
import { createPasswordResetToken, findUserByEmail } from "../database.server";
import { sendPasswordResetEmail } from "../mail.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Восстановление пароля — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getCurrentUser(request)) return redirect("/profile");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = findUserByEmail(email);
  if (!user) return data({ status: "not-found" as const }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  createPasswordResetToken(user.id, tokenHash, new Date(Date.now() + 60 * 60 * 1000).toISOString());
  const sent = await sendPasswordResetEmail(email, token);
  return data(
    { status: sent ? "sent" as const : "delivery-failed" as const },
    sent ? undefined : { status: 502 },
  );
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return (
    <main className="auth-page">
      <Header />
      <section className="auth-card">
        <p className="eyebrow">{text("Безопасность", "Безпека")}</p>
        <h1>{text("Восстановление", "Відновлення")}</h1>
        {actionData?.status === "sent" ? (
          <p className="form-success">{text("Письмо со ссылкой для восстановления отправлено.", "Лист із посиланням для відновлення надіслано.")}</p>
        ) : (
          <Form method="post" className="auth-form">
            <label>{text("Почта", "Пошта")}<input type="email" name="email" autoComplete="email" required /></label>
            <p className="editor-hint">{text("Укажите почту, сохранённую в профиле.", "Укажіть пошту, збережену в профілі.")}</p>
            {actionData?.status === "not-found" && (
              <p className="form-error">{text("Аккаунт с такой почтой не найден.", "Обліковий запис із такою поштою не знайдено.")}</p>
            )}
            {actionData?.status === "delivery-failed" && (
              <p className="form-error">{text("Не удалось отправить письмо. Проверьте настройки почты или попробуйте позже.", "Не вдалося надіслати лист. Перевірте налаштування пошти або спробуйте пізніше.")}</p>
            )}
            <button type="submit">{text("Отправить ссылку", "Надіслати посилання")}</button>
          </Form>
        )}
        <p className="auth-switch"><Link to="/login">← {text("Вернуться ко входу", "Повернутися до входу")}</Link></p>
      </section>
    </main>
  );
}
