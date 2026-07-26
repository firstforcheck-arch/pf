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

export function RouteLoader() {
  const { text } = useLocalization();
  const location = useLocation();
  const navigation = useNavigation();
  const [visible, setVisible] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const firstRender = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    setBannerIndex((current) => randomBannerIndex(current));
    setVisible(true);
  };

  useEffect(() => {
    setBannerIndex(randomBannerIndex());
    timer.current = window.setTimeout(() => setVisible(false), DISPLAY_TIME);
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (navigation.state !== "idle") show();
  }, [navigation.state]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    show();
    timer.current = window.setTimeout(() => setVisible(false), DISPLAY_TIME);
  }, [location.key]);

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
