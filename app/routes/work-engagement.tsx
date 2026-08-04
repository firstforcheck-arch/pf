import type { Route } from "./+types/work-engagement";
import { data } from "react-router";
import { getCurrentUser } from "../auth.server";
import { getWorkById, setWorkFollowing, setWorkLiked } from "../database.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) return data({ ok: false, error: "auth" }, { status: 401 });
  const workId = Number(params.workId);
  const work = Number.isInteger(workId) ? getWorkById(workId) : undefined;
  if (!work || work.published !== 1) return data({ ok: false, error: "not-found" }, { status: 404 });

  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "like") setWorkLiked(user.id, work.id, form.get("enabled") === "yes");
  if (intent === "follow") setWorkFollowing(user.id, work.id, form.get("enabled") === "yes");
  return { ok: true, error: null };
}

