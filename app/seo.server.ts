export function getSiteUrl(request: Request) {
  const configured = process.env.APP_URL?.trim();
  try {
    return new URL(configured || request.url).origin;
  } catch {
    return new URL(request.url).origin;
  }
}
