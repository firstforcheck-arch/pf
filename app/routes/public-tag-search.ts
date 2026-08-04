import type { Route } from "./+types/public-tag-search";
import { searchPublishedTags } from "../database.server";

export function loader({ request }: Route.LoaderArgs) {
  const search = new URL(request.url).searchParams;
  return {
    tags: searchPublishedTags(
      search.get("q") ?? "",
      20,
      search.getAll("exclude"),
    ),
  };
}
