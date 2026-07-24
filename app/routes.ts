import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("chapters/:chapterId", "routes/chapter.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("admin/chapters", "routes/admin-chapters.tsx"),
  route("admin/chapters/:chapterId", "routes/admin-chapter.tsx"),
] satisfies RouteConfig;
