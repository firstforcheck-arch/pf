import type { Route } from "./+types/robots";
import { getSiteUrl } from "../seo.server";

export function loader({ request }: Route.LoaderArgs) {
  const siteUrl = getSiteUrl(request);
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /analytics",
    "Disallow: /editor",
    "Disallow: /messages/",
    "Disallow: /notifications",
    "Disallow: /profile",
    "Disallow: /reset-password",
    "Disallow: /events",
    "Disallow: /tags/search",
    "Disallow: /analytics/track",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

