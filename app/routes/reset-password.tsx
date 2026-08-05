import { createHash } from "node:crypto";
import { data, Form, Link } from "react-router";
import type { Route } from "./+types/reset-password";
import { changeUserPassword } from "../auth.server";
import { consumePasswordResetToken } from "../database.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";
import { assertSameOrigin, enforceRateLimit } from "../security.server";

export function meta() {
  return [{ title: "Новый пароль — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return { token: new URL(request.url).searchParams.get("token") ?? "" };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  enforceRateLimit(request, "password-reset-submit", 10, 60 * 60);
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 8) return data({ ok: false, error: "Пароль должен содержать не менее 8 символов." }, { status: 400 });
  if (password !== confirmation) return data({ ok: false, error: "Пароли не совпадают." }, { status: 400 });
  const userId = consumePasswordResetToken(createHash("sha256").update(token).digest("hex"));
  if (!userId) return data({ ok: false, error: "Ссылка недействительна или устарела." }, { status: 400 });
  await changeUserPassword(userId, password);
  return { ok: true, error: null };
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return (
    <main className="auth-page">
      <Header />
      <section className="auth-card">
        <p className="eyebrow">{text("Безопасность", "Безпека")}</p>
        <h1>{text("Новый пароль", "Новий пароль")}</h1>
        {actionData?.ok ? (
          <>
            <p className="form-success">{text("Пароль успешно изменён.", "Пароль успішно змінено.")}</p>
            <p className="auth-switch"><Link to="/login">{text("Войти", "Увійти")} →</Link></p>
          </>
        ) : (
          <Form method="post" className="auth-form">
            <input type="hidden" name="token" value={loaderData.token} />
            <label>{text("Новый пароль", "Новий пароль")}<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
            <label>{text("Повторите пароль", "Повторіть пароль")}<input type="password" name="confirmation" minLength={8} autoComplete="new-password" required /></label>
            {actionData?.error && <p className="form-error">{text(
              actionData.error,
              actionData.error === "Пароли не совпадают." ? "Паролі не збігаються."
                : actionData.error === "Ссылка недействительна или устарела." ? "Посилання недійсне або застаріло."
                  : "Пароль має містити щонайменше 8 символів.",
            )}</p>}
            <button type="submit">{text("Сохранить пароль", "Зберегти пароль")}</button>
          </Form>
        )}
      </section>
    </main>
  );
}
