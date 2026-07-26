import type { Route } from "./+types/works";
import { Header } from "../components/header";
import { getPublishedWorks } from "../database.server";
import { WorkGrid } from "./home";
import { useLocalization } from "../localization";

export function meta() { return [{ title: "Работы — Phantom Freedom" }]; }
export async function loader() { return { works: getPublishedWorks() }; }
export default function Works({ loaderData }: Route.ComponentProps) {
  const { text } = useLocalization();
  return <main className="catalog-page"><Header /><section className="catalog-shell"><p className="eyebrow">Phantom Freedom</p><h1>{text("Работы", "Роботи")}</h1><WorkGrid works={loaderData.works} /></section></main>;
}
