import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/admin-chapter";
import { requireAdmin } from "../auth.server";
import { getChapterForEditing, saveChapter } from "../database.server";
import { Header } from "../components/header";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const chapter = getChapterForEditing(Number(params.chapterId));
  if (!chapter) throw new Response("Глава не найдена", { status: 404 });
  return { chapter };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const current = getChapterForEditing(Number(params.chapterId));
  if (!current) throw new Response("Глава не найдена", { status: 404 });

  const form = await request.formData();
  const chapter = {
    ...current,
    slug: String(form.get("slug") ?? "").trim(),
    number: String(form.get("number") ?? "").trim(),
    title: String(form.get("title") ?? "").trim(),
    subtitle: String(form.get("subtitle") ?? "").trim(),
    readingTime: String(form.get("readingTime") ?? "").trim(),
    content: String(form.get("content") ?? ""),
  };

  if (!chapter.slug || !chapter.number || !chapter.title) {
    return data({ error: "Адрес, номер и название обязательны." }, { status: 400 });
  }

  try {
    saveChapter(chapter);
  } catch {
    return data({ error: "Не удалось сохранить. Проверьте уникальность адреса главы." }, { status: 400 });
  }
  return redirect("/admin/chapters");
}

export default function AdminChapter({ loaderData, actionData }: Route.ComponentProps) {
  const { chapter } = loaderData;
  return (
    <main className="admin-page">
      <Header />
      <section className="admin-shell admin-shell--editor">
        <p className="eyebrow">Редактор</p>
        <h1>{chapter.title}</h1>
        <Form method="post" className="editor-form">
          <div className="editor-form__row">
            <label>Номер<input name="number" defaultValue={chapter.number} required /></label>
            <label>Адрес<input name="slug" defaultValue={chapter.slug} required /></label>
            <label>Время чтения<input name="readingTime" defaultValue={chapter.readingTime} /></label>
          </div>
          <label>Название<input name="title" defaultValue={chapter.title} required /></label>
          <label>Краткое описание<textarea name="subtitle" rows={3} defaultValue={chapter.subtitle} /></label>
          <label>Текст главы<textarea className="editor-form__content" name="content" rows={28} defaultValue={chapter.content} /></label>
          <p className="editor-hint">Разделяйте абзацы одной пустой строкой. SQLite сохранит длинный текст без сокращений.</p>
          {actionData?.error && <p className="form-error">{actionData.error}</p>}
          <button type="submit">Сохранить изменения</button>
        </Form>
      </section>
    </main>
  );
}
