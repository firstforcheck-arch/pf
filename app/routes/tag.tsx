import type { Route } from "./+types/tag";
import { Header } from "../components/header";
import { getCurrentUser } from "../auth.server";
import { enrichWorkCards, getPublishedWorksByTag, getTagBySlug } from "../database.server";
import { WorkGrid } from "./home";
import { useLocalization } from "../localization";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.tag.name} — Phantom Freedom` : "Метка не найдена" }, { name: "description", content: loaderData?.tag.description ?? "" }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const tag = getTagBySlug(params.tagSlug);
  if (!tag) throw new Response("Метка не найдена", { status: 404 });
  const user = await getCurrentUser(request);
  return { tag, works: enrichWorkCards(getPublishedWorksByTag(tag.id), user?.id) };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { language, text } = useLocalization();
  return <main className="tag-page">
    <Header />
    <section className="section tag-page__content">
      <p className="eyebrow">{text("Метка", "Мітка")}</p>
      <h1>{language === "uk" ? loaderData.tag.nameUk : loaderData.tag.nameRu}</h1>
      <p className="tag-page__description">{(language === "uk" ? loaderData.tag.descriptionUk : loaderData.tag.descriptionRu) || text("Описание пока не добавлено.", "Опис поки не додано.")}</p>
      <div className="tag-page__count">{loaderData.works.length} {language === "uk" ? "робіт" : "работ"}</div>
      {loaderData.works.length ? <WorkGrid works={loaderData.works} /> : <p className="tag-page__empty">{text("Опубликованных работ с этой меткой пока нет.", "Опублікованих робіт із цією міткою поки немає.")}</p>}
    </section>
  </main>;
}
