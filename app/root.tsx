import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "./app.css";
import { RouteLoader } from "./components/route-loader";
import { getCurrentUser } from "./auth.server";
import type { Route } from "./+types/root";
import { getBookSettings } from "./database.server";

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await getCurrentUser(request), book: getBookSettings() };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/var5.png" />
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

export default function App() {
  return (
    <>
      <RouteLoader />
      <Outlet />
    </>
  );
}
