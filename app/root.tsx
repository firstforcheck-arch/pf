import {
  isRouteErrorResponse,
  Links,
  Meta,
  matchPath,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import "./app.css";
import { RouteLoader } from "./components/route-loader";
import { getCurrentUser } from "./auth.server";
import type { Route } from "./+types/root";
import { ScrollMemoryButton } from "./components/scroll-memory-button";
import { LocalizationProvider, LocalizedFormValidation } from "./localization";
import { getUnreadNotificationCount, getUserNotifications } from "./database.server";
import { Footer } from "./components/footer";
import { getSiteUrl } from "./seo.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return {
    user,
    notifications: user ? getUserNotifications(user.id) : [],
    unreadNotifications: user ? getUnreadNotificationCount(user.id) : 0,
    siteUrl: getSiteUrl(request),
    book: { title: "Phantom Freedom", description: "Ваш уголок свободы" },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <script src="/theme-init.js" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const privateSeoPaths = /^(?:\/admin(?:\/|$)|\/analytics(?:\/|$)|\/editor(?:\/|$)|\/messages(?:\/|$)|\/notifications(?:\/|$)|\/profile(?:\/|$)|\/login\/?$|\/register\/?$|\/forgot-password\/?$|\/reset-password\/?$)/;

export default function App({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const isChapterReader = Boolean(matchPath({ path: "/works/:workSlug/chapters/:chapterId", end: true }, pathname));
  const noIndex = privateSeoPaths.test(pathname);
  const canonical = new URL(pathname === "/" ? "/" : pathname.replace(/\/$/, ""), `${loaderData.siteUrl}/`).toString();
  return (
    <LocalizationProvider>
      {noIndex
        ? <meta name="robots" content="noindex, nofollow" />
        : <link rel="canonical" href={canonical} />}
      <LocalizedFormValidation />
      <RouteLoader />
      <Outlet />
      {!isChapterReader && <Footer />}
      <ScrollMemoryButton />
    </LocalizationProvider>
  );
}
