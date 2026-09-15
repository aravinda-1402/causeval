import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  TriangleAlert,
} from "lucide-react";
import { Header, REPO_URL } from "@/components/header";
import { CopyBlock } from "@/components/copy";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import data from "@/lib/demo-data.json";
const QUICKSTART = [
  "git clone https://github.com/aravinda-1402/causeval.git",
  "cd causeval",
  "pnpm install --frozen-lockfile",
  "pnpm build",
  "pnpm causeval demo",
] as const;
export const metadata = process.env.NEXT_PUBLIC_SITE_URL
  ? { alternates: { canonical: process.env.NEXT_PUBLIC_SITE_URL } }
  : {};

export default function Home() {
  const s = data.summary;
  const example = data.rules.find((rule) =>
    data.causalResults.some(
      (result) =>
        result.ruleId === rule.id && result.classification === "pseudo-covered",
    ),
  )!;
  return (
    <>
      <Header />
      <main id="main" className="simple-home">
        <section className="welcome page-width">
          <div className="welcome-copy">
            <span className="quiet-label">AI TESTING, MADE CLEAR</span>
            <h1>
              Do your tests catch
              <br />
              missing AI rules?
            </h1>
            <p>
              CausEval removes one instruction at a time and checks whether your
              tests notice. See what’s covered, find the gaps, and know what to
              test next.
            </p>
            <Button asChild>
              <Link href="/demo">
                Explore the example <ArrowRight size={18} />
              </Link>
            </Button>
            <span className="welcome-note">
              No setup. No API key. Saved example results.
            </span>
            <a className="text-link" href="#how-it-works">
              How does it work?
            </a>
          </div>
          <div className="example-preview">
            <div className="preview-heading">
              <span className="quiet-label">EXAMPLE REPORT</span>
              <span>Support assistant</span>
            </div>
            <h2>
              {s.totalRules - s.causallyCovered} rules need a closer look.
            </h2>
            <p>
              Here’s what the tests detected when instructions were removed.
            </p>
            <div className="preview-totals">
              <div>
                <CheckCircle2 size={19} className="tone-green" />
                <strong>{s.causallyCovered}</strong>
                <span>Removal detected</span>
              </div>
              <div>
                <TriangleAlert size={19} className="tone-amber" />
                <strong>{s.pseudoCovered}</strong>
                <span>Removal missed</span>
              </div>
              <div>
                <CircleDashed size={19} className="tone-red" />
                <strong>{s.uncovered}</strong>
                <span>No test linked</span>
              </div>
            </div>
            <Link className="preview-finding" href={"/demo?rule=" + example.id}>
              <span className="quiet-label">ONE GAP TO EXPLORE</span>
              <strong>{example.expectedBehavior}</strong>
              <span>The instruction was removed. The test still passed.</span>
              <b>
                See what happened <ArrowRight size={17} />
              </b>
            </Link>
            <p className="preview-caption">
              Precomputed example, not a live model assessment.
            </p>
          </div>
        </section>
        <section id="how-it-works" className="simple-how page-width">
          <div className="simple-section-heading">
            <span className="quiet-label">THE IDEA</span>
            <h2>A passing test is only the start.</h2>
            <p>
              If an instruction disappears, would your tests catch it? CausEval
              helps you check.
            </p>
          </div>
          <div className="how-grid">
            {[
              [
                "1",
                "Find the rules",
                "Start with the instructions you give your AI, such as ‘verify identity before sharing account details.’",
              ],
              [
                "2",
                "Check the tests",
                "Link each rule to the tests meant to check it. Remove that rule and repeat those tests.",
              ],
              [
                "3",
                "Review the gaps",
                "See which removals were detected, which were missed, and which rules have no linked test.",
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span className="how-number">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="simple-start page-width">
          <div className="simple-start-copy">
            <span className="quiet-label">WHEN YOU’RE READY</span>
            <h2>Run it on your own prompt.</h2>
            <p>
              The example above needs nothing installed. To check your own AI,
              point CausEval at your prompt and your existing tests.
            </p>
            <span className="simple-start-marks">
              {["Apache-2.0", "No telemetry", "Works with existing tests"].map(
                (mark) => (
                  <span key={mark}>
                    <Check size={16} /> {mark}
                  </span>
                ),
              )}
            </span>
            <div className="simple-start-actions">
              <Button asChild variant="outline">
                <Link href="/docs">
                  Setup guide <ArrowRight size={17} />
                </Link>
              </Button>
              <a className="text-link" href={REPO_URL}>
                Star the repository
              </a>
            </div>
          </div>
          <CopyBlock title="Terminal · Node 22+" lines={QUICKSTART} />
        </section>
      </main>
      <footer className="site-footer page-width simple-footer">
        <Brand />
        <span>
          Created by{" "}
          <a href="https://github.com/aravinda-1402">
            Aravinda Raman Jatavallabha
          </a>
        </span>
        <a href="https://github.com/aravinda-1402/causeval">
          View source on GitHub
        </a>
      </footer>
    </>
  );
}
