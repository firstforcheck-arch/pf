import { randomUUID } from "node:crypto";
import { data } from "react-router";
import type { Route } from "./+types/analytics-track";
import { enforceRateLimit } from "../security.server";
import { getCurrentUser } from "../auth.server";
import { recordChapterProgress, recordChapterView, recordWorkView } from "../database.server";

const VISITOR_COOKIE = "__phantom_visitor";

function readVisitorCookie(request: Request) {
  const value = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1);
  return value && /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null;
}

export async function action({ request }: Route.ActionArgs) {
  enforceRateLimit(request, "analytics", 120, 60);
  const form = await request.formData();
  const workId = Number(form.get("workId"));
  const chapterId = Number(form.get("chapterId"));
  const threshold = Number(form.get("threshold"));
  if (!Number.isInteger(workId) || workId <= 0) return data({ ok: false }, { status: 400 });
  const user = await getCurrentUser(request);
  const storedVisitor = readVisitorCookie(request);
  const anonymousVisitor = storedVisitor ?? randomUUID();
  const visitorKey = user ? `user:${user.id}` : `visitor:${anonymousVisitor}`;

  if (Number.isInteger(chapterId) && chapterId > 0) {
    recordChapterView(chapterId, workId, visitorKey);
    if ([25, 50, 75, 100].includes(threshold)) recordChapterProgress(chapterId, workId, visitorKey, threshold);
  } else {
    recordWorkView(workId, visitorKey);
  }

  const headers = new Headers();
  if (!user && !storedVisitor) headers.set("Set-Cookie", `${VISITOR_COOKIE}=${anonymousVisitor}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return data({ ok: true }, { headers });
}
