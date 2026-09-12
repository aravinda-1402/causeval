import type { Metadata } from "next";
import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { CopyCommand } from "@/components/copy";
export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Configure CausEval providers, native evals, custom runners, and causal coverage gates.",
};
const sections = [
  "Quick start",
  "Concepts",
  "Configuration",
  "Native evals",
  "Custom runners",
  "Providers",
  "Reports and diff",
  "GitHub Action",
  "Privacy and limitations",
];
export default function Docs() {
  return (
    <>
      <Header />
      <main id="main" className="docs-layout">
        <aside className="docs-sidebar">
          <span>DOCUMENTATION</span>
          <nav aria-label="Documentation sections">
            {sections.map((s) => (
              <a key={s} href={"#" + s.toLowerCase().replaceAll(" ", "-")}>
                {s}
              </a>
            ))}
          </nav>
        </aside>
        <article className="docs-content">
          <span className="eyebrow">GET TO YOUR FIRST COVERAGE REPORT</span>
          <h1>Make the contract visible.</h1>
          <p className="docs-lead">
            CausEval connects what your prompt asks for to what your evals
            actually protect. Start with a deterministic example, then bring
            your own prompt.
          </p>
          <div className="docs-note">
            <Info size={19} />
            <p>
              The public demo is precomputed from a deterministic fixture. Its
              results demonstrate the method, not the performance of a real
              model. <Link href="/demo">Explore the evidence →</Link>
            </p>
          </div>
          <section id="quick-start">
            <h2>Quick start</h2>
            <p>
              The fastest way to see what CausEval does. No config, no API key:
            </p>
            <CopyCommand text="npx causeval demo" />
            <p>
              It runs the bundled support-agent example end to end and prints
              one causally covered rule, one pseudo-covered rule and one
              uncovered rule, with the baseline and mutant runs behind each.
            </p>
            <h3>Your own project</h3>
            <pre>
              {
                "npm install -D causeval\nnpx causeval init\nnpx causeval scan\nnpx causeval verify"
              }
            </pre>
            <p>
              <code>init</code> writes a config, prompt and eval suite pointed
              at the bundled fixture, so both commands work immediately. Change{" "}
              <code>provider</code> and set <code>CAUSEVAL_MODEL</code> to
              analyse your own prompt with your own model. npm publication is a
              separate release step; until then, run from a checkout with{" "}
              <code>pnpm causeval</code>.
            </p>
            <h3>No eval suite yet</h3>
            <p>
              That is a supported starting point. <code>scan</code> reports the
              behavioral contract and its severity breakdown instead of failing,
              then:
            </p>
            <pre>
              {
                "npx causeval generate\nnpx causeval review --list\nnpx causeval review --accept all"
              }
            </pre>
            <p>
              Generated cases are written as GENERATED — UNREVIEWED and are
              excluded from every coverage metric until you accept them, so a
              generated test can never inflate your coverage number.
            </p>
          </section>
          <section id="concepts">
            <h2>Two metrics. One important gap.</h2>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>What it measures</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Trace Coverage</td>
                  <td>
                    Rules with a direct mapping at confidence ≥ 0.70 / total
                    rules.
                  </td>
                </tr>
                <tr>
                  <td>Causal Rule Coverage</td>
                  <td>
                    Rules with stable baselines and reliable detection after
                    mutation / total rules.
                  </td>
                </tr>
                <tr>
                  <td>Pseudo-coverage</td>
                  <td>
                    Mapped rules whose removal does not meaningfully reduce pass
                    rate.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Verification repeats each mapped eval three times by default, and
              at least twice always. Baseline pass rate must be at least 0.80,
              per eval as well as in aggregate. Detection effect (baseline minus
              mutant pass rate) must be at least 0.50. Unstable baselines are
              flaky; ambiguous results stay indeterminate; a scan never claims
              causal coverage.
            </p>
            <p>
              Pseudo-coverage means one precise thing:{" "}
              <em>
                under the tested model and configuration, this eval did not
                detect removal of this instruction
              </em>
              . It is not proof the rule is untested. A base model may keep the
              behavior without being told, and another rule may still enforce
              it. Both confounds are attached to every pseudo-covered result.
            </p>
          </section>
          <section id="configuration">
            <h2>Configuration</h2>
            <pre>
              {
                "// causeval.config.ts\nexport default {\n  prompt: './prompts/system.md',\n  evals: ['./evals/**/*.yaml'],\n  provider: { type: 'openai', model: process.env.CAUSEVAL_MODEL },\n  thresholds: {\n    mappingConfidence: 0.70,\n    minimumTraceCoverage: 0.70,\n    minimumCausalCoverage: 0.50,\n    maximumHighRiskUncovered: 0,\n  },\n  causal: {\n    runsPerEval: 3,\n    minimumBaselinePassRate: 0.80,\n    minimumDetectionEffect: 0.50,\n    strictMutationValidation: false,\n  },\n  runnerTimeoutMs: 30000,\n};"
              }
            </pre>
            <p>
              <code>--strict</code> re-extracts mutants to verify unrelated
              behaviors remain. <code>--no-cache</code> bypasses extraction and
              mapping cache. Execution outcomes are never reused across
              repetitions.
            </p>
          </section>
          <section id="native-evals">
            <h2>Native evals</h2>
            <p>
              Use versioned YAML or JSON. Each eval needs a unique ID, input or
              messages, and an expected behavior. Literal assertions and
              semantic judging must both pass.
            </p>
            <pre>
              {
                "version: 1\nevals:\n  - id: confirmation-before-email\n    input: Email my manager that I will be late.\n    expected:\n      behavior: Ask for explicit confirmation before sending.\n      mustContain:\n        - confirm\n    tags:\n      - external-action\n      - confirmation"
              }
            </pre>
            <p>
              Deterministic assertions run first and cannot be overruled by a
              judge: <code>mustContain</code>, <code>mustNotContain</code>,{" "}
              <code>mustMatch</code> and <code>mustNotMatch</code> (regular
              expressions), <code>json</code> and <code>jsonSchema</code>. An
              eval can skip LLM judging entirely with <code>judge: false</code>{" "}
              when it declares at least one of them. Prefer deterministic
              checks: they are free, reproducible, and cannot be talked out of a
              verdict by the output they score.
            </p>
            <p>
              Assertions are case-sensitive. A separate <code>judge</code>{" "}
              provider uses the same options as the analysis provider and never
              sees the system prompt, so it cannot tell a baseline run from a
              mutant run. Native evaluation executes no tools; use a custom
              runner for sandboxed tools.
            </p>
          </section>
          <section id="custom-runners">
            <h2>Bring your existing eval suite</h2>
            <p>
              A local runner can wrap Promptfoo, DeepEval, pytest, or an
              internal agent. CausEval sends JSON through stdin and expects JSON
              on stdout.
            </p>
            <pre>
              {
                'causeval verify --runner "node ./scripts/run-evals.js"\n\n// stdin\n{\n  "promptPath": "/temporary/prompt.md",\n  "evalIds": ["confirmation-before-email"],\n  "runId": "unique-run-id",\n  "dryRun": true\n}\n\n// stdout\n{\n  "results": [\n    { "id": "confirmation-before-email", "passed": false }\n  ]\n}'
              }
            </pre>
            <div className="docs-note">
              <ShieldCheck size={19} />
              <p>
                Causal verification should run against mocked, sandboxed, or
                otherwise non-production tools. CausEval sets{" "}
                <code>CAUSEVAL_DRY_RUN=1</code>, but your runner must enforce
                it. The website never executes commands.
              </p>
            </div>
            <p>
              Return exactly one result per requested ID. Execution errors are
              indeterminate analysis, not failed evals. Runners are terminated
              on timeout and temporary files are removed.
            </p>
          </section>
          <section id="providers">
            <h2>Your model. Your infrastructure.</h2>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Configuration</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["openai", "CAUSEVAL_MODEL + OPENAI_API_KEY"],
                  ["anthropic", "CAUSEVAL_MODEL + ANTHROPIC_API_KEY"],
                  ["compatible", "model + baseURL + optional apiKey"],
                  ["ollama", "model; defaults to localhost:11434/v1"],
                  ["fixture", "Bundled deterministic support agent only"],
                ].map(([a, b]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              No model name is hard-coded in the core. Provider contracts are
              tested with mock HTTP responses. Live model behavior requires your
              credentials or running endpoint.
            </p>
          </section>
          <section id="reports-and-diff">
            <h2>Inspect and share the evidence</h2>
            <pre>
              {
                "causeval verify --suggest\ncauseval report --open\ncauseval badge\ncauseval diff before-report.json after-report.json\ncauseval diff origin/main HEAD\ncauseval verify --fail-on threshold"
              }
            </pre>
            <p>
              Versioned JSON and offline HTML include source clauses, mappings,
              mutation diffs, repeated outcomes, classifications, warnings, and
              suggested tests. The SVG badge is a local file you can commit.
            </p>
            <p>
              Git comparison analyzes both prompts against the current eval
              suite. Stable keys match normalized semantics. Uncertain changes
              are reported as added and removed rules.
            </p>
          </section>
          <section id="github-action">
            <h2>Protect the contract in CI</h2>
            <p>
              The composite action lives at <code>packages/action</code>.
              Install dependencies and build the CLI before invoking it. It
              produces outputs, a job summary, an artifact, and an optional
              updatable PR comment.
            </p>
            <pre>
              {
                "- uses: ./packages/action\n  with:\n    config: examples/support-agent/causeval.config.ts\n    mode: verify\n    fail-on: threshold\n    comment: 'false'"
              }
            </pre>
            <p>
              Cloud credentials must be repository secrets. Normal CI uses
              fixtures with no paid API. Comments require opt-in and{" "}
              <code>pull-requests: write</code> permission. See{" "}
              <code>docs/github-action.md</code> for full setup.
            </p>
          </section>
          <section id="privacy-and-limitations">
            <h2>Evidence with clear boundaries</h2>
            <ul>
              <li>
                No telemetry, accounts, database, or API keys on the website.
              </li>
              <li>
                Only relevant prompt and eval content goes to the configured
                provider.
              </li>
              <li>
                Local cache and reports may contain sensitive prompt content.
                Keep private data out of public Git history.
              </li>
              <li>
                Secret redaction is best-effort; it cannot detect every secret.
              </li>
              <li>
                Small samples, imperfect extraction, overlapping instructions,
                model priors, and weak judges limit causal conclusions.
              </li>
            </ul>
            <p>
              CausEval provides testing evidence, not proof of correctness,
              security, safety, compliance, or absence of harmful behavior.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
