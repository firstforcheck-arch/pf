import type { Route } from "./+types/tag-search";
import { requireWorkManager } from "../auth.server";
import { searchTags } from "../database.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireWorkManager(request, Number(params.workId));
  const search = new URL(request.url).searchParams;
  const query = search.get("q") ?? "";
  const excludedIds = search.getAll("exclude").map(Number).filter(Number.isInteger);
  return { tags: searchTags(query, 20, excludedIds) };
}
