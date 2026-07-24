import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigation } from "react-router";

const banners = ["/zradnyk.png", "/zradnyk2.png", "/zradnyk3.png"];
const DISPLAY_TIME = 850;

function randomBanner(previous?: string) {
  const choices = banners.filter((banner) => banner !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? banners[0];
}

export function RouteLoader() {
  const location = useLocation();
  const navigation = useNavigation();
  const [visible, setVisible] = useState(true);
  const [banner, setBanner] = useState(banners[0]);
  const firstRender = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    setBanner((current) => randomBanner(current));
    setVisible(true);
  };

  useEffect(() => {
    setBanner(randomBanner());
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
      <img className="route-loader__image" src={banner} alt="" />
      <div className="route-loader__veil" />
      <div className="route-loader__status">
        <span className="route-loader__ring" />
        <span>Загрузка</span>
      </div>
    </div>
  );
}
