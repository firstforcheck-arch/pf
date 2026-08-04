import type { Route } from "./+types/tag";
import { Link } from "react-router";
import { Header } from "../components/header";
import { getTagBySlug } from "../database.server";
import { formatLocalizedCount, useLocalization } from "../localization";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.tag.name} — Phantom Freedom` : "Метка не найдена" }, { name: "description", content: loaderData?.tag.description ?? "" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const tag = getTagBySlug(params.tagSlug);
  if (!tag) throw new Response("Метка не найдена", { status: 404 });
  return { tag };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
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
      </div>
    </section>
  </main>;
}
