export const CHARACTERS_PER_PAGE = 1800;

export function countPages(text: string) {
  const characters = text.replace(/\s+/g, " ").trim().length;
  return characters === 0 ? 0 : Math.ceil(characters / CHARACTERS_PER_PAGE);
}

export function countTotalPages(texts: string[]) {
  return countPages(texts.join("\n\n"));
}

export function formatPages(pages: number) {
  const lastTwo = pages % 100;
  const last = pages % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? "страниц"
    : last === 1
      ? "страница"
      : last >= 2 && last <= 4
        ? "страницы"
        : "страниц";
  return `${pages} ${word}`;
}
