import { Link } from "react-router";
import type { Route } from "./+types/analytics-chapter";
import { requireWorkManager } from "../auth.server";
import { getChapterAnalytics, getChapterById, getWorkById, type AnalyticsTimeframe } from "../database.server";
import { Header } from "../components/header";
import { AnalyticsChart } from "../components/analytics-chart";
import { useLocalization } from "../localization";
import { TimeframeNav } from "./analytics-work";

export async function loader({ request, params }: Route.LoaderArgs) {
  const workId = Number(params.workId), chapterId = Number(params.chapterId);
  if (!Number.isInteger(workId) || !Number.isInteger(chapterId)) throw new Response("Глава не найдена", { status: 404 });
  await requireWorkManager(request, workId);
  const work = getWorkById(workId), chapter = getChapterById(workId, chapterId);
  if (!work || !chapter) throw new Response("Глава не найдена", { status: 404 });
  const value = new URL(request.url).searchParams.get("timeframe");
  const selectedTimeframe: AnalyticsTimeframe = value === "week" || value === "month" ? value : "day";
  return { work, chapter, selectedTimeframe, analytics: getChapterAnalytics(chapterId, workId, selectedTimeframe) };
}

export default function ChapterAnalytics({ loaderData }: Route.ComponentProps) {
  const { text, language } = useLocalization(); const { work, chapter, analytics, selectedTimeframe } = loaderData;
  const number = new Intl.NumberFormat(language === "uk" ? "uk-UA" : "ru-RU");
  return <main className="admin-page analytics-page"><Header /><section className="admin-shell analytics-shell">
    <Link className="analytics-back" to={`/analytics/works/${work.id}?timeframe=${selectedTimeframe}`}>← {work.title}</Link><p className="eyebrow">{text("Аналитика главы", "Аналітика глави")}</p><h1>{chapter.title}</h1>
    <div className="analytics-metrics analytics-metrics--single"><article><span>{text("Уникальные читатели", "Унікальні читачі")}</span><strong>{number.format(analytics.totalViews)}</strong></article></div>
    <section className="analytics-panel"><div className="analytics-panel__heading"><h2>{text("Просмотры главы", "Перегляди глави")}</h2><TimeframeNav value={selectedTimeframe} text={text} /></div><AnalyticsChart buckets={analytics.buckets} series={[{ id: chapter.id, name: chapter.title, values: analytics.values }]} timeframe={selectedTimeframe} language={language} /></section>
    <section className="analytics-panel"><div className="analytics-panel__heading"><div><h2>{text("Глубина чтения", "Глибина читання")}</h2><p>{text("Сколько уникальных читателей дошло до каждой отметки.", "Скільки унікальних читачів дійшло до кожної позначки.")}</p></div></div><div className="analytics-progress-table" role="table"><div className="analytics-progress-table__head" role="row"><span>{text("Прочитано", "Прочитано")}</span><span>{text("Людей", "Людей")}</span><span>{text("От всех читателей", "Від усіх читачів")}</span></div>{analytics.progress.map((row) => <div role="row" key={row.threshold}><strong>{row.threshold}%</strong><span>{number.format(row.count)}</span><div><b>{row.percentage}%</b><i><em style={{ width: `${Math.min(100, row.percentage)}%` }} /></i></div></div>)}</div></section>
  </section></main>;
}
