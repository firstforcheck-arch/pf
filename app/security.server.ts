import { consumeRateLimit } from "./database.server";

export function getClientIp(request: Request) {
  return request.headers.get("CF-Connecting-IP")
    ?? request.headers.get("X-Real-IP")
    ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "unknown";
}

export function assertSameOrigin(request: Request) {
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(request.method.toUpperCase())) return;
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") throw new Response("Запрос с другого сайта отклонён.", { status: 403 });
  const origin = request.headers.get("Origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new Response("Не удалось подтвердить источник запроса.", { status: 403 });
    return;
  }
  if (origin !== new URL(request.url).origin) throw new Response("Запрос с другого сайта отклонён.", { status: 403 });
}

export function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number, discriminator = "", includeClientIp = true) {
  const clientPart = includeClientIp ? getClientIp(request) : "global";
  const result = consumeRateLimit(`${scope}:${clientPart}:${discriminator.toLocaleLowerCase()}`, limit, windowSeconds);
  if (!result.allowed) throw new Response("Слишком много запросов. Попробуйте позже.", { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
}

export function detectImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)))) return "image/gif";
  return null;
}

export async function verifiedImageBytes(file: File, allowedTypes: readonly string[]) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualType = detectImageMime(bytes);
  if (!actualType || actualType !== file.type || !allowedTypes.includes(actualType)) return null;
  return bytes;
}
