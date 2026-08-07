import type { Route } from "./+types/work-cover";
import { getWorkBySlug } from "../database.server";

export function loader({ params }: Route.LoaderArgs) {
  const coverUrl = getWorkBySlug(params.workSlug)?.coverUrl;
  const match = coverUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new Response("Cover not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

