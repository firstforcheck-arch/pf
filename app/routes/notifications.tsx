import type { Route } from "./+types/notifications";
import { getCurrentUser } from "../auth.server";
import { markNotificationsRead } from "../database.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw new Response("Необходима авторизация", { status: 401 });
  markNotificationsRead(user.id);
  return { ok: true };
}

export default function NotificationsAction() {
  return null;
}
