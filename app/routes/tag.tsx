import type { Route } from "./+types/tag";
import { data, Form, Link, redirect, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { getCurrentUser, requireAdmin } from "../auth.server";
import { deleteTag, getTagBySlug, updateTagManually } from "../database.server";
import { formatLocalizedCount, useLocalization } from "../localization";
import { absoluteUrl, socialMeta } from "../seo";
import { getSiteUrl } from "../seo.server";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData ? `${loaderData.tag.name} — Phantom Freedom` : "Метка не найдена";
  const description = loaderData?.tag.description || "Произведения по метке на Phantom Freedom.";
  return socialMeta({ title, description, url: loaderData ? absoluteUrl(loaderData.siteUrl, `/tags/${loaderData.tag.slug}`) : undefined });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const tag = getTagBySlug(params.tagSlug);
  if (!tag) throw new Response("Метка не найдена", { status: 404 });
  const user = await getCurrentUser(request);
  return { tag, siteUrl: getSiteUrl(request), isAdmin: user?.role === "admin" };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const tag = getTagBySlug(params.tagSlug);
  if (!tag) throw new Response("Метка не найдена", { status: 404 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "delete") {
    deleteTag(tag.id);
    return redirect("/admin/tags");
  }
  if (intent !== "edit") return data({ ok: false, error: "Неизвестное действие." }, { status: 400 });
  const result = updateTagManually(tag.id, {
    nameRu: String(form.get("nameRu") ?? ""),
    nameUk: String(form.get("nameUk") ?? ""),
    descriptionRu: String(form.get("descriptionRu") ?? ""),
    descriptionUk: String(form.get("descriptionUk") ?? ""),
  });
  if ("error" in result) return data({ ok: false, error: result.error }, { status: 400 });
  return { ok: true, error: null };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editFetcher = useFetcher<{ ok: boolean; error: string | null }>();
  useEffect(() => {
    if (editFetcher.data?.ok) setEditing(false);
  }, [editFetcher.data]);
  useEffect(() => {
    if (!editing && !deleting) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editFetcher.state === "idle") { setEditing(false); setDeleting(false); }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [editing, deleting, editFetcher.state]);

  return <main className="tag-page">
    <Header />
    <section className="section tag-page__content">
      <div className="tag-page__card">
        <div className="tag-page__glow" aria-hidden="true" />
        <p className="eyebrow">{text("Метка", "Мітка")}</p>
        <h1>{language === "uk" ? loaderData.tag.nameUk : loaderData.tag.nameRu}</h1>
        <div className="tag-page__details">
          <p className="tag-page__description">{(language === "uk" ? loaderData.tag.descriptionUk : loaderData.tag.descriptionRu) || text("Описание пока не добавлено.", "Опис поки не додано.")}</p>
          <div className="tag-page__aside">
            <strong>{formatLocalizedCount(language, loaderData.tag.workCount, ["работа", "работы", "работ"], ["робота", "роботи", "робіт"])}</strong>
            <Link to={`/works?tag=${encodeURIComponent(loaderData.tag.slug)}`}>{text("Найти работы", "Знайти роботи")} <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        {loaderData.isAdmin && <div className="tag-admin-actions">
          <button type="button" onClick={() => setEditing(true)}>{text("Редактировать", "Редагувати")}</button>
          <button className="tag-admin-actions__delete" type="button" onClick={() => setDeleting(true)}>{text("Удалить", "Видалити")}</button>
        </div>}
      </div>
    </section>

    {editing && <div className="confirm-modal tag-manage-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && editFetcher.state === "idle") setEditing(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-tag-title">
        <p className="eyebrow">{text("Ручной перевод", "Ручний переклад")}</p>
        <h2 id="edit-tag-title">{text("Редактировать метку", "Редагувати мітку")}</h2>
        <editFetcher.Form method="post" className="tag-manage-form">
          <input type="hidden" name="intent" value="edit" />
          <div className="tag-manage-form__grid">
            <label>{text("Название на русском", "Назва російською")}<input name="nameRu" required maxLength={60} defaultValue={loaderData.tag.nameRu} placeholder={text("Введите название на русском", "Введіть назву російською")} /></label>
            <label>{text("Название на украинском", "Назва українською")}<input name="nameUk" required maxLength={60} defaultValue={loaderData.tag.nameUk} placeholder={text("Введите название на украинском", "Введіть назву українською")} /></label>
            <label>{text("Описание на русском", "Опис російською")}<textarea name="descriptionRu" maxLength={500} defaultValue={loaderData.tag.descriptionRu} placeholder={text("Введите описание на русском", "Введіть опис російською")} /></label>
            <label>{text("Описание на украинском", "Опис українською")}<textarea name="descriptionUk" maxLength={500} defaultValue={loaderData.tag.descriptionUk} placeholder={text("Введите описание на украинском", "Введіть опис українською")} /></label>
          </div>
          {editFetcher.data?.error && <p className="form-error">{editFetcher.data.error}</p>}
          <div className="confirm-modal__actions"><button type="button" disabled={editFetcher.state !== "idle"} onClick={() => setEditing(false)}>{text("Отмена", "Скасувати")}</button><button type="submit" disabled={editFetcher.state !== "idle"}>{editFetcher.state === "submitting" ? text("Сохранение…", "Збереження…") : text("Сохранить", "Зберегти")}</button></div>
        </editFetcher.Form>
      </section>
    </div>}

    {deleting && <div className="confirm-modal tag-delete-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleting(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delete-tag-title">
        <p className="eyebrow">{text("Необратимое действие", "Незворотна дія")}</p>
        <h2 id="delete-tag-title">{text("Удалить метку?", "Видалити мітку?")}</h2>
        <p>{text("Метка будет удалена из всех работ. Сами работы останутся без изменений.", "Мітку буде видалено з усіх робіт. Самі роботи залишаться без змін.")}</p>
        <div className="confirm-modal__actions"><button type="button" onClick={() => setDeleting(false)}>{text("Отмена", "Скасувати")}</button><Form method="post"><input type="hidden" name="intent" value="delete" /><button type="submit">{text("Удалить", "Видалити")}</button></Form></div>
      </section>
    </div>}
  </main>;
}
