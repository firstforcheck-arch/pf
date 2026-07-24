import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

export function ScrollMemoryButton() {
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
      aria-label={direction === "up" ? "Прокрутить наверх" : "Вернуться к прежней позиции"}
      title={direction === "up" ? "Наверх" : "Вернуться"}
      onClick={handleClick}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
