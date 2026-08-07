import type { Route } from "./+types/sitemap";
import { getPublishedChapters, getPublishedWorks, getPublishedTags } from "../database.server";
import { getSiteUrl } from "../seo.server";
import { absoluteUrl } from "../seo";

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[character]!);
}

export function loader({ request }: Route.LoaderArgs) {
  const siteUrl = getSiteUrl(request);
  const entries = new Map<string, string | undefined>([["/", undefined], ["/about", undefined], ["/for-authors", undefined], ["/works", undefined]]);
  for (const tag of getPublishedTags()) entries.set(`/tags/${encodeURIComponent(tag.slug)}`, undefined);
  for (const work of getPublishedWorks()) {
    entries.set(`/works/${encodeURIComponent(work.slug)}`, work.updatedAt);
    entries.set(`/users/${encodeURIComponent(work.owner.username)}`, undefined);
    for (const chapter of getPublishedChapters(work.id)) {
      entries.set(`/works/${encodeURIComponent(work.slug)}/chapters/${encodeURIComponent(chapter.publicSlug)}`, chapter.updatedAt);
    }
  }
  const urls = [...entries].map(([path, lastModified]) => {
    const lastmod = lastModified ? `<lastmod>${escapeXml(new Date(`${lastModified}Z`).toISOString())}</lastmod>` : "";
    return `  <url><loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc>${lastmod}</url>`;
  }).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
