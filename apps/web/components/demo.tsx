"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  FileCode2,
  GitBranch,
  Grid2X2,
  List,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Header } from "./header";
import { Button } from "./ui/button";
import data from "@/lib/demo-data.json";
type Rule = (typeof data.rules)[number];
const labels: Record<string, string> = {
  "causally-covered": "Removal detected",
  "pseudo-covered": "Removal missed",
  uncovered: "No test linked",
  flaky: "Inconsistent results",
  indeterminate: "Not enough evidence",
};
const meaning: Record<string, string> = {
  "causally-covered":
    "The tests reliably noticed when this instruction was removed.",
  "pseudo-covered":
    "The tests still passed after this instruction was removed.",
  uncovered: "No existing test is confidently linked to this rule.",
  flaky:
    "The original tests did not pass consistently, so this result needs review.",
  indeterminate:
    "The experiment did not produce a clear result. Review the evidence before drawing a conclusion.",
};
const nextStep: Record<string, string> = {
  "causally-covered":
    "Keep this test and rerun it when your prompt or model changes.",
  "pseudo-covered":
    "Review the test’s checks. Try a case that would fail if this rule were broken.",
  uncovered: "Add a test for this behavior, then run the check again.",
  flaky:
    "Make the original test results consistent before checking rule removal again.",
  indeterminate:
    "Inspect the test results and experiment settings, then rerun the check.",
};
const resultFor = (id: string) =>
  data.causalResults.find((r) => r.ruleId === id)!;
const statusFor = (id: string) => resultFor(id)?.classification ?? "uncovered";
const percent = (n: number) => Math.round(n * 100) + "%";
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"status-badge " + status}>
      {status === "causally-covered" ? (
        <CircleCheck size={15} />
      ) : status === "pseudo-covered" ? (
        <TriangleAlert size={15} />
      ) : (
        <CircleDashed size={15} />
      )}{" "}
      {labels[status] ?? status}
    </span>
  );
}
function Passes({ passes, runs }: { passes: number; runs: number }) {
  return (
    <div className="passes">
      {Array.from({ length: runs }, (_, i) => (
        <span key={i} className={i < passes ? "pass-chip" : "fail-chip"}>
          {i < passes ? <Check size={12} /> : <X size={12} />}{" "}
          {i < passes ? "PASS" : "FAIL"}
        </span>
      ))}
    </div>
  );
}
export function Demo() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [filters, setFilters] = useState(false);
  const [matrixView, setMatrixView] = useState(false);
  const [selected, setSelected] = useState<Rule | null>(null);
  const [drawerTab, setDrawerTab] = useState("Evidence");
  const [metric, setMetric] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const s = data.summary;
  useEffect(() => {
    const syncRule = () => {
      const id = new URLSearchParams(window.location.search).get("rule");
      setSelected(data.rules.find((r) => r.id === id) ?? null);
      setDrawerTab("Evidence");
    };
    syncRule();
    window.addEventListener("popstate", syncRule);
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !target.matches("input,textarea,select,[contenteditable=true]") &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>('[aria-label="Search rules"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("popstate", syncRule);
      window.removeEventListener("keydown", shortcut);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);
  const openRule = (rule: Rule) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setSelected(rule);
    setDrawerTab("Evidence");
    setCopied(false);
    setCopyError(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    const url = new URL(window.location.href);
    url.searchParams.set("rule", rule.id);
    window.history.replaceState(null, "", url);
  };
  const closeRule = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("rule");
    window.history.replaceState(null, "", url);
  };
  const reset = () => {
    setQuery("");
    setSeverity("");
    setType("");
    setTag("");
    setStatus("all");
  };
  const selectedStatus = selected ? statusFor(selected.id) : "";
  const causal = selected ? resultFor(selected.id) : undefined;
  const suggestions = selected
    ? data.suggestions.filter((x) => x.ruleId === selected.id)
    : [];
  const rank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const priority = (rule: Rule) =>
    (statusFor(rule.id) === "causally-covered" ? 10 : 0) +
    (rank[rule.severity] ?? 4);
  const rules = data.rules
    .filter(
      (rule) =>
        (status === "all" ||
          (status === "attention"
            ? statusFor(rule.id) !== "causally-covered"
            : statusFor(rule.id) === status)) &&
        (!severity || rule.severity === severity) &&
        (!type || rule.type === type) &&
        (!tag || rule.tags.includes(tag)) &&
        (rule.id + " " + rule.expectedBehavior + " " + rule.tags.join(" "))
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => priority(a) - priority(b));
  const firstGap = [...data.rules]
    .sort((a, b) => priority(a) - priority(b))
    .find((rule) => statusFor(rule.id) !== "causally-covered")!;
  const metrics = [
    {
      name: "Removal detected",
      value: s.causallyCovered,
      icon: CircleCheck,
      status: "causally-covered",
      tone: "green",
      detail: "Tests caught the missing instruction",
      explain:
        "The original tests passed consistently, then reliably failed when the instruction was removed. This is called causal rule coverage. It is evidence for the tested setup, not a guarantee of safety.",
    },
    {
      name: "Removal missed",
      value: s.pseudoCovered,
      icon: TriangleAlert,
      status: "pseudo-covered",
      tone: "amber",
      detail: "Tests passed with the instruction missing",
      explain:
        "The tests still passed after removing the instruction. This is called pseudo-coverage. The test might be weak, or the model or another instruction might preserve the behavior. Review the evidence and test checks.",
    },
    {
      name: "No test linked",
      value: s.uncovered,
      icon: CircleDashed,
      status: "uncovered",
      tone: "red",
      detail: "Add a test for these rules",
      explain:
        "No existing test was confidently linked to the rule. This is called uncovered. Add a relevant test before checking whether it detects removal.",
    },
  ];
  const hasFilters = !!(query || severity || type || tag || status !== "all");
  return (
    <>
      <Header />
      <main id="main" className="report-page">
        <div className="example-notice">
          <CircleDashed size={17} />
          <span>
            <strong>You’re exploring an example.</strong> Saved results for a
            support assistant. No live AI calls.
          </span>
          <Link href="/docs">
            Use your own project <ArrowRight size={15} />
          </Link>
        </div>
        <div className="report-heading">
          <div>
            <span className="quiet-label">
              SUPPORT ASSISTANT / EXAMPLE REPORT
            </span>
            <h1>See what your tests catch.</h1>
            <p>
              {s.totalRules} rules checked against {s.totalEvals} tests. Start
              with the gaps below.
            </p>
          </div>
          <details className="report-download">
            <summary>
              <ArrowDownToLine size={16} /> Download report
            </summary>
            <div>
              <a href="/demo.json" download="causeval-report.json">
                JSON data <ArrowDownToLine size={15} />
              </a>
              <a href="/report.html" target="_blank" rel="noreferrer">
                Full HTML report ↗
              </a>
            </div>
          </details>
        </div>
        <section className="result-summary" aria-label="Results summary">
          {metrics.map((m) => (
            <article key={m.name} className={"result-card tone-" + m.tone}>
              <div>
                <m.icon size={20} />
                <button
                  onClick={() => setMetric(m.name)}
                  aria-label={"Explain " + m.name}
                >
                  What does this mean?
                </button>
              </div>
              <strong>
                {m.value}
                <small> / {s.totalRules} rules</small>
              </strong>
              <h2>{m.name}</h2>
              <p>{m.detail}</p>
            </article>
          ))}
        </section>
        <section className="next-action">
          <div className="next-action-icon">
            <TriangleAlert size={22} />
          </div>
          <div>
            <span className="quiet-label">START HERE</span>
            <h2>{s.highRiskUnprotected} high-priority rules need review.</h2>
            <p>
              Start with the rules marked critical or high. Open a rule to see
              what happened and what to test next.
            </p>
          </div>
          <Button onClick={() => openRule(firstGap)}>
            Review the first gap <ArrowRight size={17} />
          </Button>
        </section>
        <section className="rules-panel" aria-labelledby="rules-title">
          <div className="rules-heading">
            <div>
              <h2 id="rules-title">Your rules</h2>
              <p>Needs attention first. Select a rule to see its result.</p>
            </div>
            <div className="view-switch" role="group" aria-label="Report view">
              <button
                aria-pressed={!matrixView}
                onClick={() => setMatrixView(false)}
              >
                <List size={16} /> List
              </button>
              <button
                aria-pressed={matrixView}
                onClick={() => setMatrixView(true)}
              >
                <Grid2X2 size={16} /> Matrix
              </button>
            </div>
          </div>
          <div className="rule-controls">
            <label className="rule-search">
              <Search size={18} />
              <input
                aria-label="Search rules"
                placeholder="Search rules…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              className="button button-outline"
              aria-expanded={filters}
              aria-controls="advanced-filters"
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={16} /> Filters
              {severity || type || tag ? " •" : ""}
            </button>
          </div>
          <div
            className="status-filters"
            role="group"
            aria-label="Filter rules by result"
          >
            {[
              { id: "all", label: "All rules", count: s.totalRules },
              {
                id: "attention",
                label: "Needs attention",
                count: s.totalRules - s.causallyCovered,
              },
              ...metrics.map((m) => ({
                id: m.status,
                label: m.name,
                count: m.value,
              })),
            ].map((item) => (
              <button
                key={item.id}
                aria-pressed={status === item.id}
                onClick={() => setStatus(item.id)}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>
          {filters && (
            <div id="advanced-filters" className="simple-filters">
              <label>
                Priority
                <select
                  aria-label="Priority"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  <option value="">All priorities</option>
                  {["critical", "high", "medium", "low"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Rule type
                <select
                  aria-label="Rule type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">All types</option>
                  {[...new Set(data.rules.map((r) => r.type))].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Tag
                <select
                  aria-label="Tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">All tags</option>
                  {[...new Set(data.rules.flatMap((r) => r.tags))].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="list-context">
            <span role="status">
              {rules.length} of {s.totalRules} rules
              {hasFilters ? " match your filters" : " · sorted by priority"}
            </span>
            {hasFilters && <button onClick={reset}>Clear all filters</button>}
          </div>
          {!matrixView ? (
            <div className="rule-list">
              {rules.map((rule) => (
                <button
                  className="rule-row"
                  key={rule.id}
                  onClick={() => openRule(rule)}
                >
                  <span className="rule-row-id">{rule.id}</span>
                  <span className="rule-row-copy">
                    <strong>{rule.expectedBehavior}</strong>
                    <span>
                      <span className={"priority-label " + rule.severity}>
                        {rule.severity} priority
                      </span>
                      <span>{rule.type.replaceAll("_", " ")}</span>
                    </span>
                  </span>
                  <StatusBadge status={statusFor(rule.id)} />
                  <ChevronRight className="row-arrow" size={18} />
                </button>
              ))}
              {rules.length === 0 && (
                <div className="simple-empty">
                  <Search size={24} />
                  <h3>No rules match these filters.</h3>
                  <p>
                    Try another search or clear the filters to see all rules.
                  </p>
                  <Button variant="outline" onClick={reset}>
                    Clear all filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <section
              className="matrix-panel simple-matrix"
              aria-label="Rule to test mappings"
            >
              <div className="matrix-scroll">
                <table className="coverage-matrix">
                  <thead>
                    <tr>
                      <th>BEHAVIORAL RULE</th>
                      {data.evals.map((ev, i) => (
                        <th key={ev.id}>
                          <span className="eval-number">
                            E{String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="eval-name">
                            {ev.id.replaceAll("-", " ")}
                          </span>
                        </th>
                      ))}
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => {
                      const status = statusFor(rule.id);
                      return (
                        <tr key={rule.id}>
                          <td>
                            <button
                              className="matrix-rule"
                              onClick={() => openRule(rule)}
                            >
                              <span className="rule-id">{rule.id}</span>
                              <span>
                                <strong>{rule.expectedBehavior}</strong>
                                <small>
                                  <span
                                    className={"severity-dot " + rule.severity}
                                  />
                                  {rule.severity} <i>·</i>{" "}
                                  {rule.type.replaceAll("_", " ")}
                                </small>
                              </span>
                            </button>
                          </td>
                          {data.evals.map((ev) => {
                            const mapping = data.mappings.find(
                              (m) => m.ruleId === rule.id && m.evalId === ev.id,
                            );
                            const mapped = !!mapping;
                            return (
                              <td key={ev.id}>
                                <button
                                  className={
                                    "mapping-cell " +
                                    (mapped ? status : "no-mapping")
                                  }
                                  title={mapping?.rationale ?? "No mapping"}
                                  aria-label={`${rule.id} / ${ev.id}: ${mapped ? labels[status] : "no mapping"}`}
                                  onClick={() => openRule(rule)}
                                >
                                  {mapped ? (
                                    status === "causally-covered" ? (
                                      <Check size={14} />
                                    ) : (
                                      <span>◐</span>
                                    )
                                  ) : (
                                    <span>·</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td>
                            <button
                              className="status-button"
                              onClick={() => openRule(rule)}
                            >
                              <StatusBadge status={status} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rules.length === 0 && (
                  <div className="empty-state">
                    <Search size={25} />
                    <h3>No matching behaviors</h3>
                    <p>Try a different search or clear your filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setSeverity("");
                        setType("");
                        setTag("");
                        setStatus("all");
                      }}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
              <div className="matrix-footer">
                <div>
                  <span>
                    <i className="legend-cell covered">✓</i> Causally validated
                  </span>
                  <span>
                    <i className="legend-cell pseudo">◐</i> Direct, causally
                    weak
                  </span>
                  <span>
                    <i className="legend-cell none">·</i> No mapping
                  </span>
                </div>
                <span>
                  {rules.length} of {s.totalRules} rules
                </span>
              </div>
            </section>
          )}
        </section>
        <details className="report-method">
          <summary>How this report was calculated</summary>
          <p>
            Each linked test was repeated {data.run.runsPerEval} times before
            and after removing one instruction. {s.traceCovered} of{" "}
            {s.totalRules} rules have a linked test (trace coverage:{" "}
            {percent(s.traceCoverage)}). {s.causallyCovered} of {s.totalRules}{" "}
            had removals detected reliably (causal rule coverage:{" "}
            {percent(s.causalCoverage!)}).
          </p>
          <p>
            These are precomputed results from a deterministic example. They
            explain the method, not the performance of a live model.{" "}
            <Link href="/docs#concepts">Read the method and thresholds →</Link>
          </p>
        </details>
        <footer className="report-footer">
          <span>Evidence for this test setup. Not a safety certification.</span>
          <a href="https://github.com/aravinda-1402/causeval">
            Source on GitHub
          </a>
          <Link href="/docs">Ready for your own project? Setup guide →</Link>
        </footer>
      </main>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) closeRule();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="rule-drawer simple-drawer"
            aria-describedby="rule-description"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = returnFocus.current;
              if (target?.isConnected && target !== document.body)
                target.focus();
              else
                document
                  .querySelector<HTMLInputElement>(
                    '[aria-label="Search rules"]',
                  )
                  ?.focus();
            }}
          >
            {selected && (
              <>
                <div className="drawer-top">
                  <span>
                    <FileCode2 size={15} /> RULE <b>{selected.id}</b>
                  </span>
                  <Dialog.Close
                    className="icon-button"
                    aria-label="Close rule details"
                  >
                    <X size={19} />
                  </Dialog.Close>
                </div>
                <div className="drawer-content">
                  <StatusBadge status={selectedStatus} />
                  <Dialog.Title className="drawer-title">
                    {selected.expectedBehavior}
                  </Dialog.Title>
                  <Dialog.Description
                    id="rule-description"
                    className="drawer-description"
                  >
                    {selected.severity.toUpperCase()} PRIORITY <span>·</span>{" "}
                    {selected.type.replaceAll("_", " ")}
                  </Dialog.Description>
                  <details className="rule-source">
                    <summary>View original instruction</summary>
                    <div className="source-block">
                      <span>
                        <FileCode2 size={14} /> {selected.source.file}:
                        {selected.source.lineStart}
                      </span>
                      <code>{selected.source.exactQuote}</code>
                    </div>
                  </details>
                  <section className="plain-verdict">
                    <h3>What happened</h3>
                    <p>{meaning[selectedStatus]}</p>
                    {selectedStatus === "pseudo-covered" && (
                      <p>
                        The test may be weak, or the behavior may remain because
                        of the model or another instruction.
                      </p>
                    )}
                    <h3>What to do next</h3>
                    <p>{nextStep[selectedStatus]}</p>
                  </section>
                  <div
                    className="drawer-tabs"
                    role="group"
                    aria-label="Rule details"
                  >
                    {["Evidence", "Suggested evals", "Source & mappings"].map(
                      (t) => (
                        <button
                          type="button"
                          aria-pressed={drawerTab === t}
                          key={t}
                          onClick={() => setDrawerTab(t)}
                        >
                          {t === "Evidence"
                            ? "Test results"
                            : t === "Suggested evals"
                              ? "Suggested tests"
                              : "Technical details"}
                          {t === "Suggested evals" &&
                            suggestions.length > 0 && (
                              <span>{suggestions.length}</span>
                            )}
                        </button>
                      ),
                    )}
                  </div>
                  {drawerTab === "Evidence" ? (
                    <div className="drawer-evidence">
                      {causal?.baseline.runs ? (
                        <>
                          <div className="evidence-label">
                            <GitBranch size={14} /> BEFORE AND AFTER
                          </div>
                          <div className="experiment-stage">
                            <div>
                              <span className="stage-number">01</span>
                              <strong>Original prompt</strong>
                              <span className="stage-meta">Before</span>
                            </div>
                            <p>{causal.mappedEvalIds.join(", ")}</p>
                            <Passes
                              passes={causal.baseline.passes}
                              runs={causal.baseline.runs}
                            />
                          </div>
                          <div className="remove-arrow">
                            <ArrowDown size={16} />
                            <span>Remove only this rule</span>
                          </div>
                          <details className="rule-source">
                            <summary>View the exact change</summary>
                            <pre className="mutation-diff">{causal.diff}</pre>
                          </details>
                          <div className="remove-arrow">
                            <ArrowDown size={16} />
                            <span>Run the same evals again</span>
                          </div>
                          <div className="experiment-stage">
                            <div>
                              <span className="stage-number">02</span>
                              <strong>Without {selected.id}</strong>
                              <span className="stage-meta">After removal</span>
                            </div>
                            <Passes
                              passes={causal.mutant.passes}
                              runs={causal.mutant.runs}
                            />
                          </div>
                          <div className={"verdict " + selectedStatus}>
                            {selectedStatus === "causally-covered" ? (
                              <ShieldCheck size={21} />
                            ) : (
                              <TriangleAlert size={21} />
                            )}
                            <div>
                              <strong>
                                {selectedStatus === "pseudo-covered"
                                  ? "The instruction is gone. The eval still passes."
                                  : "The eval detects the missing instruction."}
                              </strong>
                              <p>{causal.interpretation}</p>
                            </div>
                          </div>
                          {causal.confounders.length > 0 && (
                            <div className="confounders">
                              <div className="evidence-label">
                                <TriangleAlert size={14} /> WHAT THIS CANNOT
                                RULE OUT
                              </div>
                              {causal.confounders.map((c) => (
                                <p key={c.kind}>{c.detail}</p>
                              ))}
                            </div>
                          )}
                          <div className="effect-row">
                            <span>Detection effect</span>
                            <strong>{percent(causal.detectionRate)}</strong>
                            <span>
                              {percent(causal.baseline.passRate)} −{" "}
                              {percent(causal.mutant.passRate)}, needs ≥{" "}
                              {percent(
                                causal.thresholds?.minimumDetectionEffect ??
                                  0.5,
                              )}
                            </span>
                          </div>
                          {causal.perEval.length > 1 && (
                            <table className="per-eval">
                              <thead>
                                <tr>
                                  <th>Eval</th>
                                  <th>Baseline</th>
                                  <th>Without rule</th>
                                </tr>
                              </thead>
                              <tbody>
                                {causal.perEval.map((row) => (
                                  <tr key={row.evalId}>
                                    <td>{row.evalId}</td>
                                    <td>
                                      {row.baselinePasses}/{row.baselineRuns}
                                    </td>
                                    <td>
                                      {row.mutantPasses}/{row.mutantRuns}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {suggestions.length > 0 && (
                            <Button
                              className="full-width"
                              onClick={() => setDrawerTab("Suggested evals")}
                            >
                              <Sparkles size={15} /> Review suggested tests{" "}
                              <ArrowRight size={15} />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="uncovered-evidence">
                          <CircleDashed size={34} />
                          <h3>No test is linked to this rule.</h3>
                          <p>
                            Add a test that checks this behavior, then run
                            verification to see whether it catches a missing
                            instruction.
                          </p>
                          <Button
                            onClick={() => setDrawerTab("Suggested evals")}
                          >
                            Review suggested tests <ArrowRight size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : drawerTab === "Suggested evals" ? (
                    <div className="suggestions">
                      <span role="status" className="copy-feedback">
                        {copied
                          ? "Suggested tests copied."
                          : copyError
                            ? "Could not copy. Select the test text below to copy it manually."
                            : ""}
                      </span>
                      <p className="suggestion-note">
                        Draft suggestions — review before use. These tests have
                        not been run or included in the results.
                      </p>
                      {suggestions.length ? (
                        suggestions.map((item, i) => (
                          <article key={item.eval.id}>
                            <div className="suggestion-heading">
                              <span>0{i + 1}</span>
                              <h3>{item.dimension}</h3>
                            </div>
                            <p>{item.reason}</p>
                            <pre>
                              <span>input:</span>
                              {"\n  "}
                              {item.eval.input}
                              {"\n\n"}
                              <span>expected.behavior:</span>
                              {"\n  "}
                              {item.eval.expected.behavior}
                            </pre>
                          </article>
                        ))
                      ) : (
                        <p>
                          This rule is causally protected in the fixture. No
                          missing tests were generated.
                        </p>
                      )}
                      {suggestions.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                JSON.stringify(
                                  {
                                    version: 1,
                                    evals: suggestions.map((s) => s.eval),
                                  },
                                  null,
                                  2,
                                ),
                              );
                              setCopied(true);
                              setCopyError(false);
                              if (copyTimer.current)
                                clearTimeout(copyTimer.current);
                              copyTimer.current = setTimeout(
                                () => setCopied(false),
                                2000,
                              );
                            } catch {
                              setCopyError(true);
                              setCopied(false);
                            }
                          }}
                        >
                          {copied ? (
                            <Check size={15} />
                          ) : (
                            <FileCode2 size={15} />
                          )}{" "}
                          {copied ? "Copied" : "Copy suggested tests (JSON)"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mapping-details">
                      <h3>Severity rationale</h3>
                      <p>{selected.rationale}</p>
                      <h3>Stable identity</h3>
                      <code>{selected.stableKey}</code>
                      <h3>Eval mappings</h3>
                      {data.mappings
                        .filter((m) => m.ruleId === selected.id)
                        .map((m) => (
                          <article key={m.evalId}>
                            <strong>{m.evalId}</strong>
                            <span className="mapping-meta">
                              {m.relationship} · {percent(m.confidence)}{" "}
                              confidence
                            </span>
                            <p>{m.rationale}</p>
                            <div className="dimension-tags">
                              {Object.entries(m.dimensions).map(
                                ([key, value]) => (
                                  <span
                                    key={key}
                                    className={value ? "present" : ""}
                                  >
                                    {value ? "✓" : "—"}{" "}
                                    {key
                                      .replace(/([A-Z])/g, " $1")
                                      .toLowerCase()}
                                  </span>
                                ),
                              )}
                            </div>
                          </article>
                        ))}
                      {!data.mappings.some((m) => m.ruleId === selected.id) && (
                        <p>No mappings found.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="drawer-bottom">
                  <CircleDashed size={12} /> Saved example ·{" "}
                  {data.run.runsPerEval} runs per test · No live AI calls
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!metric}
        onOpenChange={(open) => {
          if (!open) setMetric(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="metric-dialog">
            <Dialog.Close
              className="icon-button"
              aria-label="Close metric explanation"
            >
              <X size={18} />
            </Dialog.Close>
            <Dialog.Title>{metric}</Dialog.Title>
            <Dialog.Description>
              {metrics.find((m) => m.name === metric)?.explain}
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
