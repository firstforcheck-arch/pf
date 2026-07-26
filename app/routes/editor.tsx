import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/editor";
import { requireCreator } from "../auth.server";
import { createWork, deleteWork, getAllWorks, getWorksByOwner } from "../database.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireCreator(request);
  return { user, works: user.role === "admin" ? getAllWorks() : getWorksByOwner(user.id, true) };
}
export async function action({ request }: Route.ActionArgs) {
  const user = await requireCreator(request);
  const form = await request.formData();
  if (form.get("intent") === "create") return redirect(`/editor/works/${createWork(user.id)}`);
  if (form.get("intent") === "delete") {
    const id = Number(form.get("workId"));
    const allowed = user.role === "admin" || getWorksByOwner(user.id, true).some((work) => work.id === id);
    if (!allowed) throw new Response("Недостаточно прав", { status: 403 });
    deleteWork(id);
  }
  return { ok: true };
}
export default function Editor({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return <main className="admin-page"><Header /><section className="admin-shell"><p className="eyebrow">{text("Личный кабинет автора", "Особистий кабінет автора")}</p><h1>{text("Редактор", "Редактор")}</h1>
    <Form method="post"><input type="hidden" name="intent" value="create" /><button className="add-chapter-button" type="submit"><span>+</span>{text("Создать работу", "Створити роботу")}</button></Form>
    <div className="editor-work-list">{loaderData.works.map((work) => <article key={work.id}><Link to={`/editor/works/${work.id}`}><strong>{work.title}</strong><small>@{work.owner.username}</small></Link><Link to={`/works/${work.slug}`}>{text("Открыть", "Відкрити")} ↗</Link><Form method="post"><input type="hidden" name="intent" value="delete" /><input type="hidden" name="workId" value={work.id} /><button type="submit">{text("Удалить", "Видалити")}</button></Form></article>)}</div>
  </section></main>;
}
