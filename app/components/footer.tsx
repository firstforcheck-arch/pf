import { Link } from "react-router";

export function Footer() {
  return <footer className="site-footer">
    <Link className="wordmark" to="/"><img src="/logo4.png" alt="" /><span>Phantom Freedom</span></Link>
    <span>© 2026</span>
  </footer>;
}
