import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Code2,
  GitBranch,
  ScanLine,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/header";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import data from "@/lib/demo-data.json";

export default function Home() {
  const s = data.summary;
  const pseudoRule = data.rules.find(
    (rule) =>
      data.causalResults.find((r) => r.ruleId === rule.id)?.classification ===
      "pseudo-covered",
  )!;
  const pseudoResult = data.causalResults.find(
    (r) => r.ruleId === pseudoRule.id,
  )!;
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero page-width">
          <div className="hero-grid"></div>
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" /> CAUSAL RULE COVERAGE{" "}
              <span className="version-pill">v0.1</span>
            </div>
            <h1>
              Code has coverage.
              <br />
              Your prompts
              <br />
              <span>should too.</span>
            </h1>
            <p className="hero-description">
              Your evals can pass while critical behaviors go untested.
              <br className="desktop-break" /> Find the rules your AI eval suite
              doesn’t actually protect.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/demo">
                  Explore the live demo <ArrowRight size={17} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/docs">
                  Get started <ArrowUpRight size={16} />
                </Link>
              </Button>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={14} /> Open source
              </span>
              <span>
                <Check size={14} /> Works with your evals
              </span>
              <span>
                <Check size={14} /> No telemetry
              </span>
            </div>
          </div>
          <div className="hero-product">
            <div className="terminal-window">
              <div className="terminal-bar">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>support-agent / behavioral coverage</span>
                <Terminal size={14} />
              </div>
              <div className="terminal-content">
                <div className="terminal-command">
                  <span>❯</span> causeval verify
                </div>
                <div className="terminal-log">
                  <span>
                    <Check size={13} /> Extracted {s.totalRules} behavioral
                    rules
                  </span>
                  <span>
                    <Check size={13} /> Mapped {s.totalEvals} evaluation cases
                  </span>
                  <span>
                    <Check size={13} /> Verified with isolated rule removal
                  </span>
                </div>
                <div className="terminal-divider" />
                <div className="coverage-line">
                  <span>Eval pass rate (mapped)</span>
                  <strong>
                    {Math.round(s.baselinePassRate! * 100)}
                    <small>%</small>
                  </strong>
                </div>
                <div className="coverage-line">
                  <span>Trace Coverage</span>
                  <strong>
                    {Math.round(s.traceCoverage * 100)}
                    <small>%</small>
                  </strong>
                </div>
                <div className="segment-bar">
                  {Array.from({ length: 20 }, (_, i) => (
                    <i
                      key={i}
                      className={
                        i < Math.round(s.traceCoverage * 20) ? "trace-fill" : ""
                      }
                    />
                  ))}
                </div>
                <div className="coverage-line causal">
                  <span>
                    Causal Rule Coverage <span className="tiny-pill">CRC</span>
                  </span>
                  <strong>
                    {Math.round(s.causalCoverage! * 100)}
                    <small>%</small>
                  </strong>
                </div>
                <div className="segment-bar">
                  {Array.from({ length: 20 }, (_, i) => (
                    <i
                      key={i}
                      className={
                        i < Math.round(s.causalCoverage! * 20)
                          ? "causal-fill"
                          : ""
                      }
                    />
                  ))}
                </div>
                <div className="terminal-bottom">
                  <span>
                    <span className="status-dot green" />
                    {s.causallyCovered} protected
                  </span>
                  <span>
                    <span className="status-dot amber" />
                    {s.pseudoCovered} pseudo-covered
                  </span>
                  <span>
                    <span className="status-dot red" />
                    {s.uncovered} uncovered
                  </span>
                </div>
              </div>
              <Link
                href={`/demo?rule=${pseudoRule.id}`}
                className="terminal-alert"
              >
                <TriangleAlert size={17} />
                <span>
                  {s.pseudoCovered} behaviors look tested. They aren’t
                  protected.
                </span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <p className="fixture-caption">
              <CircleDashed size={12} /> Actual results from our deterministic
              support-agent fixture
            </p>
          </div>
        </section>
        <div className="compatibility">
          <span>YOUR PROMPT. YOUR EVALS. THE MISSING CONNECTION.</span>
          <div>
            <span>
              <Code2 size={17} /> Native YAML / JSON
            </span>
            <span>
              <Terminal size={17} /> Custom runners
            </span>
            <span>
              <GitBranch size={17} /> GitHub Actions
            </span>
            <span>
              <ShieldCheck size={17} /> Local model compatible
            </span>
          </div>
        </div>
        <section
          className="page-width explanation section-space"
          id="how-it-works"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE COVERAGE GAP</span>
              <h2>
                A passing test isn’t
                <br />
                the whole story.
              </h2>
            </div>
            <p>
              Semantic similarity is a starting point.
              <br />
              Removing a rule tells you whether
              <br />
              your evals actually depend on it.
            </p>
          </div>
          <Link className="causal-story" href={`/demo?rule=${pseudoRule.id}`}>
            <div className="story-rule">
              <div className="card-label">
                <ScanLine size={15} /> BEHAVIORAL RULE{" "}
                <span>{pseudoRule.id}</span>
              </div>
              <p>{pseudoRule.expectedBehavior}</p>
              <div className="story-source">
                {pseudoRule.source.file}{" "}
                <span>: {pseudoRule.source.lineStart}</span>
              </div>
            </div>
            <div className="story-connector">
              <span>
                REMOVE
                <br />
                RULE
              </span>
              <ArrowRight size={24} />
            </div>
            <div className="story-evals">
              <div>
                <span>BASELINE</span>
                {Array.from({ length: pseudoResult.baseline.runs }, (_, i) => (
                  <span
                    key={i}
                    className={
                      i < pseudoResult.baseline.passes
                        ? "pass-chip"
                        : "fail-chip"
                    }
                  >
                    <Check size={12} />{" "}
                    {i < pseudoResult.baseline.passes ? "PASS" : "FAIL"}
                  </span>
                ))}
              </div>
              <div>
                <span>WITHOUT RULE</span>
                {Array.from({ length: pseudoResult.mutant.runs }, (_, i) => (
                  <span
                    key={i}
                    className={
                      i < pseudoResult.mutant.passes ? "pass-chip" : "fail-chip"
                    }
                  >
                    <Check size={12} />{" "}
                    {i < pseudoResult.mutant.passes ? "PASS" : "FAIL"}
                  </span>
                ))}
              </div>
              <code>{pseudoResult.mappedEvalIds.join(", ")}</code>
            </div>
            <div className="story-result">
              <TriangleAlert size={22} />
              <strong>Pseudo-covered</strong>
              <p>
                The instruction is gone.
                <br />
                The eval didn’t notice.
              </p>
              <span>
                Inspect the evidence <ArrowUpRight size={14} />
              </span>
            </div>
          </Link>
          <div className="three-steps">
            {[
              {
                n: "01",
                icon: ScanLine,
                title: "Extract the contract",
                body: "Turn a system prompt into atomic, testable behavioral rules. Every rule points to its exact source.",
              },
              {
                n: "02",
                icon: GitBranch,
                title: "Trace your evals",
                body: "See which tests can detect a violation. Find missing boundaries, negative paths, and uncovered rules.",
              },
              {
                n: "03",
                icon: ShieldCheck,
                title: "Verify the protection",
                body: "Remove one rule at a time. Repeat the relevant evals. Measure the behavior they actually protect.",
              },
            ].map((step) => (
              <article key={step.n}>
                <div className="step-top">
                  <step.icon size={22} />
                  <span>{step.n}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="page-width last-section">
          <div className="start-panel">
            <div>
              <span className="eyebrow">EVIDENCE, NOT ASSUMPTIONS</span>
              <h2>
                Know what your
                <br />
                tests are protecting.
              </h2>
              <p>Start with the bundled example. No API key needed.</p>
              <Button asChild>
                <Link href="/docs">
                  Read the quick start <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
            <div className="start-code">
              <span className="code-label">
                <Terminal size={14} /> NO SETUP, NO API KEY
              </span>
              <pre>
                <span># See the whole idea in 30 seconds</span>
                {"\n"}npx causeval demo{"\n\n"}
                <span># Then point it at your own prompt</span>
                {"\n"}npm install -D causeval{"\n"}npx causeval init{"\n"}npx
                causeval scan
              </pre>
              <div>
                <CheckCircle2 size={14} /> {s.totalRules} rules.{" "}
                {s.causallyCovered} protected. {s.pseudoCovered} that only
                looked tested.
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width">
        <Brand />
        <span>Testing evidence. Never a safety certification.</span>
        <Link href="/docs">
          Documentation <ArrowUpRight size={13} />
        </Link>
      </footer>
    </>
  );
}
