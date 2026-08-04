import type { Language } from "./localization";
import { getTagsPendingTranslation, saveTagTranslation } from "./database.server";

if (!process.env.DEEPL_API_KEY) {
  try { process.loadEnvFile?.(); } catch { /* Production environments usually inject variables directly. */ }
}

type DeepLResponse = {
  translations?: Array<{ text?: string }>;
  message?: string;
};

export async function translateTagContent(input: { name: string; description: string; sourceLanguage: Language }) {
  const authKey = process.env.DEEPL_API_KEY?.trim();
  if (!authKey) throw new Error("DEEPL_API_KEY is not configured");

  const texts = [input.name.trim(), input.description.trim()].filter(Boolean);
  const endpoint = authKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const response = await fetch(`${endpoint}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texts,
      source_lang: input.sourceLanguage === "uk" ? "UK" : "RU",
      target_lang: input.sourceLanguage === "uk" ? "RU" : "UK",
      context: "Название и описание тематической метки литературного произведения.",
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json() as DeepLResponse;
  if (!response.ok) throw new Error(payload.message || `DeepL returned ${response.status}`);
  const translatedName = payload.translations?.[0]?.text?.trim();
  if (!translatedName) throw new Error("DeepL returned an empty translation");
  return {
    translatedName,
    translatedDescription: input.description.trim() ? (payload.translations?.[1]?.text?.trim() ?? "") : "",
  };
}

export async function backfillTagTranslations(limit = 8) {
  const pendingTags = getTagsPendingTranslation(limit);
  await Promise.allSettled(pendingTags.map(async (tag) => {
      const translated = await translateTagContent(tag);
      saveTagTranslation(tag.id, translated.translatedName, translated.translatedDescription, tag.sourceLanguage);
  }));
}
