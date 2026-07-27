import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigation } from "react-router";
import { useLocalization } from "../localization";

const banners = [
  { desktop: "/zradnyk.png", mobile: "/zradnyk_mobile.png" },
  { desktop: "/zradnyk2.png", mobile: "/zradnyk_mobile2.png" },
  { desktop: "/zradnyk3.png", mobile: "/zradnyk_mobile3.png" },
];
const DISPLAY_TIME = 850;

function randomBannerIndex(previous?: number) {
  const choices = banners.map((_, index) => index).filter((index) => index !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? 0;
}

function initialBannerIndex(path: string) {
  let hash = 0;
  for (let index = 0; index < path.length; index += 1) {
    hash = (hash * 31 + path.charCodeAt(index)) >>> 0;
  }
  return hash % banners.length;
}

export function RouteLoader() {
  const { text } = useLocalization();
  const location = useLocation();
  const navigation = useNavigation();
  const [visible, setVisible] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(() =>
    initialBannerIndex(`${location.pathname}${location.search}`),
  );
  const bannerIndexRef = useRef(bannerIndex);
  const navigating = useRef(false);
  const navigationIdle = useRef(true);
  const loaderShown = useRef(true);
  const loadRequest = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const hideLater = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      loaderShown.current = false;
      setVisible(false);
    }, DISPLAY_TIME);
  };

  const show = async () => {
    window.clearTimeout(timer.current);
    const request = ++loadRequest.current;
    const next = randomBannerIndex(bannerIndexRef.current);
    const source = window.matchMedia("(max-width: 700px)").matches
      ? banners[next].mobile
      : banners[next].desktop;
    const image = new Image();
    const loaded = new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
    image.src = source;

    try {
      await image.decode();
    } catch {
      await loaded;
    }

    if (request !== loadRequest.current) return;

    bannerIndexRef.current = next;
    loaderShown.current = true;
    setBannerIndex(next);
    setVisible(true);

    if (navigationIdle.current) hideLater();
  };

  useEffect(() => {
    hideLater();
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    navigationIdle.current = navigation.state === "idle";

    if (navigation.state !== "idle") {
      if (!navigating.current) {
        navigating.current = true;
        void show();
      }
      return;
    }

    if (navigating.current) {
      navigating.current = false;
      if (loaderShown.current) hideLater();
    }
  }, [navigation.state]);

  return (
    <div
      className={`route-loader ${visible ? "route-loader--visible" : ""}`}
      aria-hidden={!visible}
      aria-live="polite"
    >
      <picture>
        <source media="(max-width: 700px)" srcSet={banners[bannerIndex].mobile} />
        <img className="route-loader__image" src={banners[bannerIndex].desktop} alt="" />
      </picture>
      <div className="route-loader__veil" />
      <div className="route-loader__status">
        <span className="route-loader__ring" />
        <span>{text("Загрузка", "Завантаження")}</span>
      </div>
    </div>
  );
}
