import { useEffect, useRef } from "react";

function sendAnalytics(values: Record<string, string>) {
  const body = new URLSearchParams(values);
  void fetch("/analytics/track", { method: "POST", body, credentials: "same-origin", keepalive: true });
}

export function AnalyticsTracker({ workId, chapterId, disabled = false }: { workId: number; chapterId?: number; disabled?: boolean }) {
  const reported = useRef(new Set<number>());
  useEffect(() => {
    if (disabled) return;
    reported.current.clear();
    sendAnalytics({ workId: String(workId), ...(chapterId ? { chapterId: String(chapterId) } : {}) });
    if (!chapterId) return;
    const reportProgress = () => {
      const article = document.querySelector<HTMLElement>(".reader__article");
      if (!article) return;
      const bounds = article.getBoundingClientRect();
      const progress = Math.max(0, Math.min(100, ((window.innerHeight - bounds.top) / Math.max(1, bounds.height)) * 100));
      [25, 50, 75, 100].forEach((threshold) => {
        if (progress < threshold || reported.current.has(threshold)) return;
        reported.current.add(threshold);
        sendAnalytics({ workId: String(workId), chapterId: String(chapterId), threshold: String(threshold) });
      });
    };
    reportProgress();
    window.addEventListener("scroll", reportProgress, { passive: true });
    window.addEventListener("resize", reportProgress);
    return () => {
      window.removeEventListener("scroll", reportProgress);
      window.removeEventListener("resize", reportProgress);
    };
  }, [workId, chapterId, disabled]);
  return null;
}
