import Link from "next/link";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme";
export function Header() {
  return (
    <header className="site-header simple-header">
      <div className="nav-wrap">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/demo">Example report</Link>
          <Link href="/docs">Guide</Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
