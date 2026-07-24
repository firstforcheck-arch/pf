import type { Route } from "./+types/logout";
import { logout } from "../auth.server";

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}
