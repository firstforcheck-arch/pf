import { Link } from "react-router";
import { Header } from "./header";
import { useLocalization } from "../localization";

export function WorkUnavailable({ notFound = true }: { notFound?: boolean }) {
  const { text } = useLocalization();

  return (
    <main className="work-unavailable">
      <Header />
      <section>
        <div className="work-unavailable__code">{notFound ? "404" : "!"}</div>
        <p className="eyebrow">{text("Работа недоступна", "Робота недоступна")}</p>
        <p>{text(
          "Возможно, автор временно ограничил доступ к работе или такой страницы больше нет.",
          "Можливо, автор тимчасово обмежив доступ до роботи або такої сторінки більше немає.",
        )}</p>
        <div>
          <Link className="hero__button" to="/works">{text("Перейти к работам", "Перейти до робіт")} →</Link>
          <Link className="work-unavailable__home" to="/">{text("На главную", "На головну")}</Link>
        </div>
      </section>
    </main>
  );
}
