import { Link } from "react-router";
import { Header } from "../components/header";
import { useLocalization } from "../localization";

export function meta() {
  return [{ title: "Для авторов — Phantom Freedom" }];
}

export default function ForAuthors() {
  const { text } = useLocalization();
  const features = [
    {
      number: "01",
      title: text("Соберите работу", "Зберіть роботу"),
      description: text(
        "Добавьте название, описание, обложку и метки. Их порядок можно менять перетягиванием — карточка работы будет выглядеть именно так, как вы задумали.",
        "Додайте назву, опис, обкладинку й мітки. Їхній порядок можна змінювати перетягуванням — картка роботи виглядатиме саме так, як ви задумали.",
      ),
      image: "/1.png",
      alt: text("Настройка карточки работы в редакторе", "Налаштування картки роботи в редакторі"),
    },
    {
      number: "02",
      title: text("Управляйте главами", "Керуйте главами"),
      description: text(
        "Создавайте главы, меняйте их порядок и публикуйте тогда, когда текст готов. Общий объём всегда виден перед глазами.",
        "Створюйте глави, змінюйте їхній порядок і публікуйте тоді, коли текст готовий. Загальний обсяг завжди перед очима.",
      ),
      image: "/2.png",
      alt: text("Список глав авторской работы", "Список глав авторського твору"),
    },
    {
      number: "03",
      title: text("Следите за интересом", "Стежте за інтересом"),
      description: text(
        "Смотрите уникальные открытия, подписки и лайки. График показывает динамику каждой главы по дням, неделям и месяцам.",
        "Переглядайте унікальні відкриття, підписки й уподобання. Графік показує динаміку кожної глави за днями, тижнями та місяцями.",
      ),
      image: "/3.png",
      alt: text("Аналитика просмотров авторской работы", "Аналітика переглядів авторського твору"),
    },
    {
      number: "04",
      title: text("Понимайте, как читают", "Розумійте, як читають"),
      description: text(
        "Откройте отдельную главу, чтобы увидеть её просмотры и глубину чтения: сколько читателей дошло до 25%, 50%, 75% и финала.",
        "Відкрийте окрему главу, щоб побачити її перегляди та глибину читання: скільки читачів дійшло до 25%, 50%, 75% і фіналу.",
      ),
      image: "/4.png",
      alt: text("Аналитика отдельной главы и глубина чтения", "Аналітика окремої глави та глибина читання"),
    },
  ];

  return <main className="authors-page">
    <Header />
    <section className="authors-hero">
      <p className="eyebrow">{text("Инструменты для вашего текста", "Інструменти для вашого тексту")}</p>
      <h1>{text("Пишите свободно", "Пишіть вільно")}</h1>
      <p>{text(
        "Phantom Freedom даёт каждому зарегистрированному автору всё необходимое для публикации и развития работы. Свободно, без подписки и рекламы.",
        "Phantom Freedom дає кожному зареєстрованому автору все необхідне для публікації та розвитку твору. Вільно, без підписки й реклами.",
      )}</p>
      <div className="authors-hero__actions">
        <Link className="authors-primary-link" to="/editor">{text("Открыть редактор", "Відкрити редактор")} →</Link>
        <a href="#possibilities">{text("Посмотреть возможности", "Переглянути можливості")} ↓</a>
      </div>
    </section>

    <section className="authors-showcase" id="possibilities">
      {features.map((feature, index) => <article className={`authors-feature ${index % 2 ? "authors-feature--reverse" : ""}`} key={feature.number}>
        <div className="authors-feature__copy">
          <span>{feature.number}</span>
          <h2>{feature.title}</h2>
          <p>{feature.description}</p>
        </div>
        <figure className="authors-feature__visual">
          <img src={feature.image} alt={feature.alt} loading={index ? "lazy" : "eager"} draggable={false} />
        </figure>
      </article>)}
    </section>

    <section className="authors-cta">
      <p className="eyebrow">{text("Доступно после регистрации", "Доступно після реєстрації")}</p>
      <h2>{text("Ваша следующая работа может начаться здесь.", "Ваш наступний твір може початися тут.")}</h2>
      <p>{text("Создание работ, Редактор и Аналитика открыты всем зарегистрированным пользователям.", "Створення творів, Редактор і Аналітика відкриті всім зареєстрованим користувачам.")}</p>
      <Link className="authors-primary-link" to="/editor">{text("Начать писать", "Почати писати")} →</Link>
    </section>
  </main>;
}
