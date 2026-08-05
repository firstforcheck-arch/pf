import { Link } from "react-router";
import type { Route } from "./+types/analytics";
import { requireCreator } from "../auth.server";
import { getAnalyticsWorks } from "../database.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireCreator(request);
  return { works: getAnalyticsWorks(user) };
}

export default function Analytics({ loaderData }: Route.ComponentProps) {
  const { text, language } = useLocalization();
  const number = new Intl.NumberFormat(language === "uk" ? "uk-UA" : "ru-RU");
  return <main className="admin-page analytics-page"><Header />
    <section className="admin-shell analytics-shell">
      <p className="eyebrow">{text("Авторская статистика", "Авторська статистика")}</p>
      <div className="analytics-heading"><div><h1>{text("Аналитика", "Аналітика")}</h1><p>{text("Уникальные просмотры и вовлечённость читателей ваших работ.", "Унікальні перегляди та залученість читачів ваших робіт.")}</p></div><span>{loaderData.works.length}</span></div>
      <div className="analytics-work-grid">
        {loaderData.works.map((work) => <Link className="analytics-work-card" to={`/analytics/works/${work.id}`} key={work.id}>
          <div><small>{work.published ? text("Опубликована", "Опублікована") : text("Черновик", "Чернетка")}</small><h2>{work.title}</h2><p>@{work.owner.username}</p></div>
          <dl><div><dt>{text("Просмотры", "Перегляди")}</dt><dd>{number.format(work.viewCount)}</dd></div><div><dt>{text("Следят", "Стежать")}</dt><dd>{number.format(work.followerCount)}</dd></div><div><dt>{text("Нравится", "Подобається")}</dt><dd>{number.format(work.likeCount)}</dd></div></dl>
          <b aria-hidden="true">→</b>
        </Link>)}
        {!loaderData.works.length && <div className="analytics-empty"><h2>{text("Работ пока нет", "Робіт поки немає")}</h2><p>{text("Создайте первую работу в редакторе — её статистика появится здесь.", "Створіть першу роботу в редакторі — її статистика з’явиться тут.")}</p><Link to="/editor">{text("Перейти в редактор", "Перейти до редактора")}</Link></div>}
      </div>
    </section>
  </main>;
}
