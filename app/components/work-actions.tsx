import { Link, useFetcher, useRouteLoaderData } from "react-router";
import { useLocalization } from "../localization";

type WorkActionsProps = {
  workId: number;
  likeCount: number;
  liked: boolean;
  following: boolean;
  variant?: "card" | "reader";
};

export function WorkActions({ workId, likeCount, liked, following, variant = "card" }: WorkActionsProps) {
  const { text } = useLocalization();
  const rootData = useRouteLoaderData<{ user: { id: number } | null }>("root");
  const likeFetcher = useFetcher();
  const followFetcher = useFetcher();
  const pendingLiked = likeFetcher.formData?.get("enabled");
  const pendingFollowing = followFetcher.formData?.get("enabled");
  const activeLiked = pendingLiked ? pendingLiked === "yes" : liked;
  const activeFollowing = pendingFollowing ? pendingFollowing === "yes" : following;
  const optimisticLikes = likeCount + (activeLiked === liked ? 0 : activeLiked ? 1 : -1);

  if (!rootData?.user) {
    return (
      <div className={`work-actions work-actions--${variant}`}>
        <Link className="work-action work-action--like" to="/login" aria-label={text("Войти, чтобы поставить лайк", "Увійти, щоб поставити вподобайку")}>
          <HeartIcon /> <span>{optimisticLikes}</span>
        </Link>
        {variant === "reader" && <Link className="work-action work-action--follow" to="/login">{text("Следить", "Стежити")}</Link>}
      </div>
    );
  }

  return (
    <div className={`work-actions work-actions--${variant}`}>
      <likeFetcher.Form method="post" action={`/works/${workId}/engagement`}>
        <input type="hidden" name="intent" value="like" />
        <input type="hidden" name="enabled" value={activeLiked ? "no" : "yes"} />
        <button className={`work-action work-action--like ${activeLiked ? "is-active" : ""}`} type="submit" aria-pressed={activeLiked} aria-label={activeLiked ? text("Убрать лайк", "Прибрати вподобайку") : text("Поставить лайк", "Поставити вподобайку")}>
          <HeartIcon /> <span>{optimisticLikes}</span>
        </button>
      </likeFetcher.Form>
      {variant === "reader" && <followFetcher.Form method="post" action={`/works/${workId}/engagement`}>
        <input type="hidden" name="intent" value="follow" />
        <input type="hidden" name="enabled" value={activeFollowing ? "no" : "yes"} />
        <button className={`work-action work-action--follow ${activeFollowing ? "is-active" : ""}`} type="submit" aria-pressed={activeFollowing}>
          {activeFollowing ? text("Вы следите", "Ви стежите") : text("Следить", "Стежити")}
        </button>
      </followFetcher.Form>}
    </div>
  );
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>;
}
