import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useLocalization } from "../localization";

export function ScrollMemoryButton() {
  const { text } = useLocalization();
  const location = useLocation();
  const returnPosition = useRef(0);
  const [direction, setDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    returnPosition.current = 0;
    setDirection("up");
  }, [location.key]);

  function scrollToPosition(top: number) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function handleClick() {
    if (direction === "up") {
      returnPosition.current = window.scrollY;
      setDirection("down");
      scrollToPosition(0);
      return;
    }

    setDirection("up");
    scrollToPosition(returnPosition.current);
  }

  return (
    <button
      className={`scroll-memory-button scroll-memory-button--${direction}`}
      type="button"
      aria-label={direction === "up" ? text("Прокрутить наверх", "Прокрутити нагору") : text("Вернуться к прежней позиции", "Повернутися до попередньої позиції")}
      title={direction === "up" ? text("Наверх", "Нагору") : text("Вернуться", "Повернутися")}
      onClick={handleClick}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
