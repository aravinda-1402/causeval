import Link from "next/link";
import { Star } from "lucide-react";
import { Brand } from "./brand";
import { GitHubMark } from "./github";
import { ThemeToggle } from "./theme";
export const REPO_URL = "https://github.com/aravinda-1402/causeval";
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
          <a
            className="repo-link"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Star CausEval on GitHub"
          >
            <GitHubMark />
            <span className="repo-link-text" aria-hidden="true">
              Star on GitHub
            </span>
            <Star size={14} className="repo-link-star" aria-hidden="true" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
