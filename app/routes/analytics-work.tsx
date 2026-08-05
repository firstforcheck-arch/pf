import { Link } from "react-router";
import type { Route } from "./+types/analytics-work";
import { requireWorkManager } from "../auth.server";
import { getWorkAnalytics, getWorkById, type AnalyticsTimeframe } from "../database.server";
import { Header } from "../components/header";
import { AnalyticsChart } from "../components/analytics-chart";
import { useLocalization } from "../localization";

function timeframe(request: Request): AnalyticsTimeframe { const value = new URL(request.url).searchParams.get("timeframe"); return value === "week" || value === "month" ? value : "day"; }
export async function loader({ request, params }: Route.LoaderArgs) {
  const workId = Number(params.workId);
  if (!Number.isInteger(workId)) throw new Response("Работа не найдена", { status: 404 });
  await requireWorkManager(request, workId);
  const work = getWorkById(workId);
  if (!work) throw new Response("Работа не найдена", { status: 404 });
  const selectedTimeframe = timeframe(request);
  return { work, selectedTimeframe, analytics: getWorkAnalytics(workId, selectedTimeframe) };
}

export default function WorkAnalytics({ loaderData }: Route.ComponentProps) {
  const { text, language } = useLocalization(); const { work, analytics, selectedTimeframe } = loaderData;
  const number = new Intl.NumberFormat(language === "uk" ? "uk-UA" : "ru-RU");
  return <main className="admin-page analytics-page"><Header /><section className="admin-shell analytics-shell">
    <Link className="analytics-back" to="/analytics">← {text("Все работы", "Усі роботи")}</Link>
    <p className="eyebrow">{text("Аналитика работы", "Аналітика роботи")}</p><h1>{work.title}</h1>
    <div className="analytics-metrics analytics-metrics--four"><article><span>{text("Уникальные открытия", "Унікальні відкриття")}</span><strong>{number.format(analytics.viewCount)}</strong></article><article><span>{text("Следят за работой", "Стежать за роботою")}</span><strong>{number.format(analytics.followerCount)}</strong></article><article><span>{text("Нравится", "Подобається")}</span><strong>{number.format(analytics.likeCount)}</strong></article><article><span>{text("Глав", "Глав")}</span><strong>{analytics.chapters.length}</strong></article></div>
    <section className="analytics-panel"><div className="analytics-panel__heading"><div><h2>{text("Просмотры глав", "Перегляди глав")}</h2><p>{text("Каждая линия — отдельная глава. Наведите на неё, чтобы увидеть название.", "Кожна лінія — окрема глава. Наведіть на неї, щоб побачити назву.")}</p></div><TimeframeNav value={selectedTimeframe} text={text} /></div><AnalyticsChart buckets={analytics.buckets} series={analytics.series} timeframe={selectedTimeframe} language={language} /></section>
    <section className="analytics-panel"><div className="analytics-panel__heading"><div><h2>{text("Главы", "Глави")}</h2><p>{text("Откройте главу, чтобы посмотреть дочитывания.", "Відкрийте главу, щоб переглянути дочитування.")}</p></div></div><div className="analytics-chapter-list">{analytics.chapters.map((chapter, index) => <Link to={`chapters/${chapter.id}?timeframe=${selectedTimeframe}`} key={chapter.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{chapter.title}</strong><b>→</b></Link>)}</div></section>
  </section></main>;
}

function TimeframeNav({ value, text }: { value: AnalyticsTimeframe; text: (ru: string, uk: string) => string }) {
  return <nav className="analytics-timeframes" aria-label={text("Период", "Період")}>{([["day", text("Дни", "Дні")], ["week", text("Недели", "Тижні")], ["month", text("Месяцы", "Місяці")]] as const).map(([key, label]) => <Link className={value === key ? "active" : ""} to={`?timeframe=${key}`} key={key}>{label}</Link>)}</nav>;
}
export { TimeframeNav };
