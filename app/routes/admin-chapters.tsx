import { Link } from "react-router";
import type { Route } from "./+types/admin-chapters";
import { requireAdmin } from "../auth.server";
import { getAllChapters } from "../database.server";
import { Header } from "../components/header";

export function meta() {
  return [{ title: "Редактор глав — Phantom Freedom" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return { chapters: getAllChapters() };
}

export default function AdminChapters({ loaderData }: Route.ComponentProps) {
  return (
    <main className="admin-page">
      <Header />
      <section className="admin-shell">
        <p className="eyebrow">Управление содержанием</p>
        <h1>Главы</h1>
        <div className="admin-list">
          {loaderData.chapters.map((chapter) => (
            <Link to={`/admin/chapters/${chapter.id}`} key={chapter.id}>
              <span>{chapter.number}</span>
              <b>{chapter.title}</b>
              <small>Редактировать →</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
