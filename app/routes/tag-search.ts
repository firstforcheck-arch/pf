import type { Route } from "./+types/tag-search";
import { requireWorkManager } from "../auth.server";
import { searchTags } from "../database.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireWorkManager(request, Number(params.workId));
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return { tags: searchTags(query, 20) };
}
