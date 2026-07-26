export const CHARACTERS_PER_PAGE = 1800;

export function countPages(text: string) {
  const characters = text.replace(/\s+/g, " ").trim().length;
  return characters === 0 ? 0 : Math.ceil(characters / CHARACTERS_PER_PAGE);
}

export function countTotalPages(texts: string[]) {
  return countPages(texts.join("\n\n"));
}

function formatCount(value: number, one: string, few: string, many: string) {
  const lastTwo = value % 100;
  const last = value % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? many
    : last === 1
      ? one
      : last >= 2 && last <= 4
        ? few
        : many;
  return `${value} ${word}`;
}

export function formatPages(pages: number, language: "ru" | "uk" = "ru") {
  return language === "uk"
    ? formatCount(pages, "сторінка", "сторінки", "сторінок")
    : formatCount(pages, "страница", "страницы", "страниц");
}

export function formatChapters(chapters: number, language: "ru" | "uk" = "ru") {
  return language === "uk"
    ? formatCount(chapters, "глава", "глави", "глав")
    : formatCount(chapters, "глава", "главы", "глав");
}
