import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme";
export function Header() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/demo">Interactive demo</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/docs#github-action">
            GitHub Action <ArrowUpRight size={13} />
          </Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/docs" className="nav-cta">
            Get started <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
