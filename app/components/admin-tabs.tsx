import { NavLink } from "react-router";
import { useLocalization } from "../localization";

export function AdminTabs() {
  const { text } = useLocalization();
  return <nav className="admin-tabs" aria-label={text("Разделы управления", "Розділи керування")}>
    <NavLink to="/admin/users" className={({ isActive }) => isActive ? "is-active" : undefined}>
      {text("Пользователи", "Користувачі")}
    </NavLink>
    <NavLink to="/admin/tags" className={({ isActive }) => isActive ? "is-active" : undefined}>
      {text("Метки", "Мітки")}
    </NavLink>
  </nav>;
}
