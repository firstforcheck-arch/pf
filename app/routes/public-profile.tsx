import { data, Form, Link } from "react-router";
import type { Route } from "./+types/public-profile";
import { changeUserPassword, getCurrentUser } from "../auth.server";
import { getPublicUserByUsername, getWorksByOwner, setUserAccountPlus, updateUserProfile, findUserById } from "../database.server";
import { Header } from "../components/header";
import { WorkGrid } from "./home";
import { useLocalization } from "../localization";

export async function loader({ request, params }: Route.LoaderArgs) {
  const profile = getPublicUserByUsername(params.username);
  if (!profile) throw new Response("Пользователь не найден", { status: 404 });
  const viewer = await getCurrentUser(request);
  const privateUser = viewer?.role === "admin" ? findUserById(profile.id) : null;
  return { profile, privateUser, viewer, isAdmin: viewer?.role === "admin", works: getWorksByOwner(profile.id, viewer?.role === "admin") };
}
export async function action({ request, params }: Route.ActionArgs) {
  const admin = await getCurrentUser(request);
  if (admin?.role !== "admin") throw new Response("Недостаточно прав", { status: 403 });
  const profile = getPublicUserByUsername(params.username);
  if (!profile) throw new Response("Пользователь не найден", { status: 404 });
  const form = await request.formData();
  const user = findUserById(profile.id)!;
  if (form.get("intent") === "account-plus" && profile.role !== "admin") setUserAccountPlus(profile.id, form.get("enabled") === "yes");
  if (form.get("intent") === "email") updateUserProfile(user.id, user.username, String(form.get("email") || "").trim() || null, user.avatarUrl);
  if (form.get("intent") === "password") {
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return data({ error: "Пароль должен содержать не менее 8 символов." }, { status: 400 });
    await changeUserPassword(user.id, password);
  }
  return { error: null };
}
export default function PublicProfile({ loaderData, actionData }: Route.ComponentProps) {
  const { text, language } = useLocalization();
  const { profile } = loaderData;
  return <main className="profile-public-page"><Header /><section className="profile-public-shell"><div className="public-profile-card">
    {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.username[0].toUpperCase()}</span>}
    <div><p className="eyebrow">{profile.accountPlus === 1 || profile.role === "admin" ? "Аккаунт+" : text("Читатель", "Читач")}</p><h1>{profile.username}</h1><small>{text("Последний онлайн", "Останній онлайн")}: {new Date(`${profile.lastSeen}Z`).toLocaleString(language === "uk" ? "uk-UA" : "ru-RU")}</small>
      {loaderData.viewer?.id !== profile.id && <Link className="profile-message-button" to={loaderData.viewer ? `/messages/${profile.username}` : "/login"}>{text("Написать сообщение", "Написати повідомлення")}</Link>}
    </div>
  </div>
  {loaderData.isAdmin && loaderData.privateUser && <section className="admin-user-panel"><div className="admin-user-panel__heading"><p className="eyebrow">{text("Доступ администратора", "Доступ адміністратора")}</p><h2>{text("Управление пользователем", "Керування користувачем")}</h2></div>
    {profile.role !== "admin" && <Form method="post" className="admin-user-panel__toggle"><input type="hidden" name="intent" value="account-plus" /><input type="hidden" name="enabled" value={profile.accountPlus === 1 ? "no" : "yes"} /><button type="submit">{profile.accountPlus === 1 ? text("Отключить Аккаунт+", "Вимкнути Акаунт+") : text("Выдать Аккаунт+", "Видати Акаунт+")}</button></Form>}
    <Form method="post" className="editor-form"><input type="hidden" name="intent" value="email" /><label>Email<input type="email" name="email" defaultValue={loaderData.privateUser.email ?? ""} /></label><button type="submit">{text("Сохранить почту", "Зберегти пошту")}</button></Form>
    <Form method="post" className="editor-form"><input type="hidden" name="intent" value="password" /><label>{text("Назначить новый пароль", "Призначити новий пароль")}<input type="password" name="password" minLength={8} /></label>{actionData?.error && <p className="form-error">{actionData.error}</p>}<button type="submit">{text("Сменить пароль", "Змінити пароль")}</button></Form>
  </section>}
  <section className="public-profile-works"><div className="section-heading"><p className="eyebrow">{text("Публикации", "Публікації")}</p><h2>{text("Работы пользователя", "Роботи користувача")}</h2></div><WorkGrid works={loaderData.works} /></section>
  </section></main>;
}
