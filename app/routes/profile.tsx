import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/profile";
import { changeUserPassword, getCurrentUser, verifyUserPassword } from "../auth.server";
import { findUserByEmail, findUserByUsername, updateUserProfile } from "../database.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";
import { verifiedImageBytes } from "../security.server";

export function meta() {
  return [{ title: "Профиль — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw redirect("/login");
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw redirect("/login");
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "profile");

  if (intent === "password") {
    const currentPassword = String(form.get("currentPassword") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (!(await verifyUserPassword(user.id, currentPassword))) {
      return data({ ok: false, section: "password", error: "Текущий пароль указан неверно." }, { status: 400 });
    }
    if (password.length < 8) {
      return data({ ok: false, section: "password", error: "Новый пароль должен содержать не менее 8 символов." }, { status: 400 });
    }
    if (password !== confirmation) {
      return data({ ok: false, section: "password", error: "Пароли не совпадают." }, { status: 400 });
    }
    await changeUserPassword(user.id, password);
    return { ok: true, section: "password", error: null };
  }

  const username = String(form.get("username") ?? "").trim();
  const emailValue = String(form.get("email") ?? "").trim().toLowerCase();
  const email = emailValue || null;
  if (!username) return data({ ok: false, section: "profile", error: "Юзернейм не может быть пустым." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return data({ ok: false, section: "profile", error: "Введите корректную почту." }, { status: 400 });
  }
  const usernameOwner = findUserByUsername(username);
  if (usernameOwner && usernameOwner.id !== user.id) {
    return data({ ok: false, section: "profile", error: "Такой юзернейм уже занят." }, { status: 409 });
  }
  const emailOwner = email ? findUserByEmail(email) : undefined;
  if (emailOwner && emailOwner.id !== user.id) {
    return data({ ok: false, section: "profile", error: "Эта почта уже используется." }, { status: 409 });
  }

  let avatarUrl = form.get("removeAvatar") === "yes" ? null : user.avatarUrl;
  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(avatar.type)) {
      return data({ ok: false, section: "profile", error: "Поддерживаются изображения JPG, PNG, WebP и GIF." }, { status: 400 });
    }
    if (avatar.size > 1024 * 1024) {
      return data({ ok: false, section: "profile", error: "Размер изображения не должен превышать 1 МБ." }, { status: 400 });
    }
    const bytes = await verifiedImageBytes(avatar, ["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!bytes) return data({ ok: false, section: "profile", error: "Содержимое файла не соответствует заявленному формату изображения." }, { status: 400 });
    avatarUrl = `data:${avatar.type};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  updateUserProfile(user.id, username, email, avatarUrl);
  return { ok: true, section: "profile", error: null };
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { text } = useLocalization();
  const translateError = (error: string) => {
    const messages: Record<string, string> = {
      "Текущий пароль указан неверно.": "Поточний пароль указано неправильно.",
      "Новый пароль должен содержать не менее 8 символов.": "Новий пароль має містити щонайменше 8 символів.",
      "Пароли не совпадают.": "Паролі не збігаються.",
      "Юзернейм не может быть пустым.": "Юзернейм не може бути порожнім.",
      "Введите корректную почту.": "Введіть коректну пошту.",
      "Такой юзернейм уже занят.": "Такий юзернейм уже зайнятий.",
      "Эта почта уже используется.": "Ця пошта вже використовується.",
      "Поддерживаются изображения JPG, PNG, WebP и GIF.": "Підтримуються зображення JPG, PNG, WebP і GIF.",
      "Размер изображения не должен превышать 1 МБ.": "Розмір зображення не має перевищувати 1 МБ.",
    };
    return text(error, messages[error] ?? error);
  };

  return (
    <main className="admin-page">
      <Header />
      <section className="admin-shell profile-page">
        <div className="admin-section">
          <p className="eyebrow">{text("Личный кабинет", "Особистий кабінет")}</p>
          <h1>{text("Профиль", "Профіль")}</h1>
          <Form method="post" encType="multipart/form-data" className="editor-form profile-form">
            <input type="hidden" name="intent" value="profile" />
            <div className="profile-form__avatar">
              <label className="profile-avatar-upload" aria-label={text("Выбрать иконку профиля", "Вибрати іконку профілю")}>
                {loaderData.user.avatarUrl
                  ? <img src={loaderData.user.avatarUrl} alt="" />
                  : <span aria-hidden="true">{loaderData.user.username.slice(0, 1).toUpperCase()}</span>}
                <span className="profile-avatar-upload__overlay" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 7.5h2.1l1.2-2h3.4l1.2 2H17a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="12.7" r="3" />
                  </svg>
                </span>
                <input className="sr-only" type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif" />
              </label>
              <div>
                <strong>{text("Иконка профиля", "Іконка профілю")}</strong>
                <small>{text("Нажмите на изображение, чтобы выбрать новое.", "Натисніть на зображення, щоб вибрати нове.")}</small>
                {loaderData.user.avatarUrl && <label className="profile-form__remove"><input type="checkbox" name="removeAvatar" value="yes" /> {text("Удалить текущую иконку", "Видалити поточну іконку")}</label>}
                <small>{text("JPG, PNG, WebP или GIF, не более 1 МБ.", "JPG, PNG, WebP або GIF, не більше 1 МБ.")}</small>
              </div>
            </div>
            <label>{text("Юзернейм", "Юзернейм")}<input name="username" defaultValue={loaderData.user.username} autoComplete="username" required /></label>
            <label>{text("Почта (необязательно)", "Пошта (необов’язково)")}<input type="email" name="email" defaultValue={loaderData.user.email ?? ""} autoComplete="email" /></label>
            <p className="editor-hint">{text(
              "На эту почту будут приходить уведомления о новых главах и ссылка для восстановления пароля.",
              "На цю пошту надходитимуть сповіщення про нові глави та посилання для відновлення пароля.",
            )}</p>
            {actionData?.section === "profile" && actionData.error && <p className="form-error">{translateError(actionData.error)}</p>}
            {actionData?.section === "profile" && actionData.ok && <p className="form-success">{text("Профиль сохранён.", "Профіль збережено.")}</p>}
            <button type="submit">{text("Сохранить профиль", "Зберегти профіль")}</button>
          </Form>
        </div>
        <div className="admin-section">
          <p className="eyebrow">{text("Безопасность", "Безпека")}</p>
          <h1>{text("Смена пароля", "Зміна пароля")}</h1>
          <Form method="post" className="editor-form">
            <input type="hidden" name="intent" value="password" />
            <label>{text("Текущий пароль", "Поточний пароль")}<input type="password" name="currentPassword" autoComplete="current-password" required /></label>
            <label>{text("Новый пароль", "Новий пароль")}<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
            <label>{text("Повторите новый пароль", "Повторіть новий пароль")}<input type="password" name="confirmation" minLength={8} autoComplete="new-password" required /></label>
            {actionData?.section === "password" && actionData.error && <p className="form-error">{translateError(actionData.error)}</p>}
            {actionData?.section === "password" && actionData.ok && <p className="form-success">{text("Пароль изменён.", "Пароль змінено.")}</p>}
            <button type="submit">{text("Изменить пароль", "Змінити пароль")}</button>
          </Form>
        </div>
      </section>
    </main>
  );
}
