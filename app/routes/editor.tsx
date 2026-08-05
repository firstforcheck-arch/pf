import { Form, Link, redirect } from "react-router";
import { useEffect, useState } from "react";
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
  const { text, language } = useLocalization();
  const workCountLabel = (() => {
    const count = loaderData.works.length;
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (language === "uk") return mod10 === 1 && mod100 !== 11 ? "робота" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "роботи" : "робіт";
    return mod10 === 1 && mod100 !== 11 ? "работа" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "работы" : "работ";
  })();
  const [workToDelete, setWorkToDelete] = useState<(typeof loaderData.works)[number] | null>(null);
  useEffect(() => {
    if (!workToDelete) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWorkToDelete(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [workToDelete]);
  useEffect(() => {
    if (workToDelete && !loaderData.works.some((work) => work.id === workToDelete.id)) setWorkToDelete(null);
  }, [loaderData.works, workToDelete]);
  return <main className="admin-page">
    <Header />
    <section className="admin-shell">
      <p className="eyebrow">{text("Личный кабинет автора", "Особистий кабінет автора")}</p>
      <div className="editor-page-heading">
        <h1>{text("Редактор", "Редактор")}</h1>
        <div className="editor-work-counter"><strong>{loaderData.works.length}</strong><span>{workCountLabel}</span></div>
      </div>
      <Form method="post"><input type="hidden" name="intent" value="create" /><button className="add-chapter-button" type="submit"><span>+</span>{text("Создать работу", "Створити роботу")}</button></Form>
      <div className="editor-work-list">{loaderData.works.map((work) => <article key={work.id}>
        <Link to={`/editor/works/${work.id}`}><strong>{work.title}</strong><small>@{work.owner.username}</small></Link>
        <span className={`editor-work-status ${work.published === 1 ? "editor-work-status--published" : ""}`}><i aria-hidden="true" />{work.published === 1 ? text("Опубликована", "Опублікована") : text("Черновик", "Чернетка")}</span>
        <Link to={`/works/${work.slug}`}>{text("Открыть", "Відкрити")} ↗</Link>
        <button className="editor-work-delete" type="button" onClick={() => setWorkToDelete(work)}>{text("Удалить", "Видалити")}</button>
      </article>)}</div>
    </section>
    {workToDelete && <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-work-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkToDelete(null); }}>
      <section>
        <button className="confirm-modal__close" type="button" onClick={() => setWorkToDelete(null)} aria-label={text("Закрыть", "Закрити")}>×</button>
        <p className="eyebrow">{text("Необратимое действие", "Незворотна дія")}</p>
        <h2 id="delete-work-title">{text("Удалить работу?", "Видалити роботу?")}</h2>
        <p>{text(`Работа «${workToDelete.title}» и все связанные с ней главы будут удалены без возможности восстановления.`, `Роботу «${workToDelete.title}» і всі пов’язані з нею глави буде видалено без можливості відновлення.`)}</p>
        <div className="confirm-modal__actions">
          <button type="button" onClick={() => setWorkToDelete(null)}>{text("Отмена", "Скасувати")}</button>
          <Form method="post"><input type="hidden" name="intent" value="delete" /><input type="hidden" name="workId" value={workToDelete.id} /><button type="submit">{text("Удалить работу", "Видалити роботу")}</button></Form>
        </div>
      </section>
    </div>}
  </main>;
}
