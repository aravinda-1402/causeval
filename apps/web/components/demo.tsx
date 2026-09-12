"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  FileCode2,
  GitBranch,
  Grid2X2,
  LayoutDashboard,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme";
import { Button } from "./ui/button";
import data from "@/lib/demo-data.json";

type Rule = (typeof data.rules)[number];
const labels: Record<string, string> = {
  "causally-covered": "Causally covered",
  "pseudo-covered": "Pseudo-covered",
  uncovered: "Uncovered",
  flaky: "Flaky",
  indeterminate: "Indeterminate",
};
const tabs = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Coverage Matrix", icon: Grid2X2 },
  { name: "Uncovered", icon: CircleDashed },
  { name: "Pseudo-Covered", icon: TriangleAlert },
  { name: "Causally Covered", icon: ShieldCheck },
  { name: "Behavioral Contract", icon: FileCode2 },
];
const resultFor = (id: string) =>
  data.causalResults.find((r) => r.ruleId === id)!;
const statusFor = (id: string) => resultFor(id)?.classification ?? "uncovered";
const percent = (n: number) => Math.round(n * 100) + "%";
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"status-badge " + status}>
      {status === "causally-covered" ? (
        <CircleCheck size={12} />
      ) : status === "pseudo-covered" ? (
        <TriangleAlert size={12} />
      ) : (
        <CircleDashed size={12} />
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
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [filters, setFilters] = useState(false);
  const [selected, setSelected] = useState<Rule | null>(null);
  const [drawerTab, setDrawerTab] = useState("Evidence");
  const [metric, setMetric] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const s = data.summary;
  const firstPseudoRule = data.rules.find(
    (rule) => statusFor(rule.id) === "pseudo-covered",
  )!;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("rule");
    if (id) setSelected(data.rules.find((r) => r.id === id) ?? null);
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
          .querySelector<HTMLInputElement>(
            '[aria-label="Search behavioral rules"]',
          )
          ?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const openRule = (r: Rule) => {
    setSelected(r);
    setDrawerTab("Evidence");
  };
  const selectedStatus = selected ? statusFor(selected.id) : "";
  const causal = selected ? resultFor(selected.id) : undefined;
  const suggestions = selected
    ? data.suggestions.filter((x) => x.ruleId === selected.id)
    : [];
  const rules = data.rules.filter((rule) => {
    const status = statusFor(rule.id);
    return (
      (tab === "Uncovered"
        ? status === "uncovered"
        : tab === "Pseudo-Covered"
          ? status === "pseudo-covered"
          : tab === "Causally Covered"
            ? status === "causally-covered"
            : true) &&
      (!severity ||
        (severity === "unprotected-high-risk"
          ? ["high", "critical"].includes(rule.severity) &&
            status !== "causally-covered"
          : rule.severity === severity)) &&
      (!type || rule.type === type) &&
      (!tag || rule.tags.includes(tag)) &&
      `${rule.id} ${rule.expectedBehavior} ${rule.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const metrics = [
    {
      name: "Behavioral rules",
      value: String(s.totalRules),
      detail: `Across ${s.totalEvals} evaluation cases`,
      icon: FileCode2,
      tone: "neutral",
      explain: `Each atomic, externally testable instruction in the system prompt counts as one behavioral rule. This fixture has ${s.totalRules} rules and ${s.totalEvals} evals.`,
    },
    {
      name: "Trace Coverage",
      value: percent(s.traceCoverage),
      detail: `${s.traceCovered} of ${s.totalRules} rules mapped`,
      icon: GitBranch,
      tone: "blue",
      explain: `${s.traceCovered} rules have at least one direct mapping with confidence ≥ ${percent(data.run.thresholds.mappingConfidence)}. Trace Coverage = ${s.traceCovered} / ${s.totalRules} = ${percent(s.traceCoverage)}. Mappings can be mistaken; verification tests their causal strength.`,
    },
    {
      name: "Causal Rule Coverage",
      value: percent(s.causalCoverage!),
      detail: `${s.causallyCovered} of ${s.totalRules} rules protected`,
      icon: ShieldCheck,
      tone: "green",
      explain: `${s.causallyCovered} rules have stable passing baselines and a detection effect of at least ${percent(data.run.causal.minimumDetectionEffect)} across ${data.run.runsPerEval} runs per mapped eval. CRC = ${s.causallyCovered} / ${s.totalRules} = ${percent(s.causalCoverage!)}. Severity does not change this metric.`,
    },
    {
      name: "Pseudo-covered",
      value: String(s.pseudoCovered).padStart(2, "0"),
      detail: "Mapped, but not protected",
      icon: TriangleAlert,
      tone: "amber",
      explain: `${s.pseudoCovered} rules have credible mappings and stable baselines, yet removing the instruction left their evals passing. Under the tested model and configuration those evals did not detect the removal. That can mean a weak test, or a model that keeps the behavior without being told.`,
    },
  ];
  return (
    <div className="app-shell">
      <aside className={"app-sidebar " + (menu ? "mobile-open" : "")}>
        <div className="sidebar-top">
          <Brand />
          <span className="version-label">v0.1</span>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">S</span>
          <div>
            Support agent<small>Example workspace</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="sidebar-section-label">ANALYSIS</div>
        <nav aria-label="Analysis navigation">
          {tabs.map((t) => (
            <button
              key={t.name}
              className={tab === t.name ? "active" : ""}
              onClick={() => {
                setTab(t.name);
                setMenu(false);
              }}
            >
              <t.icon size={17} />
              {t.name}
              {t.name === "Pseudo-Covered" ? (
                <span className="nav-count amber-count">{s.pseudoCovered}</span>
              ) : t.name === "Uncovered" ? (
                <span className="nav-count">{s.uncovered}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-notice">
            <span>
              <Sparkles size={15} /> Explore the evidence
            </span>
            <p>
              A deterministic example.
              <br />
              No API keys. No model calls.
            </p>
            <Link href="/docs">
              Run it on your prompt <ArrowUpRightIcon />
            </Link>
          </div>
          <Link href="/docs">
            <BookOpen size={16} /> Documentation
          </Link>
          <Link href="/">
            <ArrowLeft size={16} /> Back to CausEval
          </Link>
          <div className="sidebar-theme">
            <span>APACHE 2.0</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <LayoutDashboard size={18} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <span>Support agent</span>
            <ChevronRight size={13} />
            <strong>{tab}</strong>
          </div>
          <span className="fixture-pill">
            <span className="status-dot green" /> DETERMINISTIC DEMO
          </span>
        </header>
        <main id="main" className="dashboard">
          <div className="dashboard-heading">
            <div>
              <div className="eyebrow">BEHAVIORAL CONTRACT ANALYSIS</div>
              <h1>{tab === "Overview" ? "Coverage overview" : tab}</h1>
              <p>Your evals pass. Here’s what they actually protect.</p>
            </div>
            <div className="dashboard-actions">
              <a
                className="button button-outline button-small"
                href="/demo.json"
                download="causeval-report.json"
              >
                <ArrowDownToLine size={15} /> Export JSON
              </a>
              <Button size="sm" asChild>
                <Link href="/docs">
                  <Terminal size={15} /> Run on your prompt
                </Link>
              </Button>
            </div>
          </div>
          <div className="run-metadata">
            <span>
              <FileCode2 size={14} /> support-agent / system.md
            </span>
            <span>
              <GitBranch size={14} /> rule removal
            </span>
            <span>
              <Check size={14} /> 3 runs per eval
            </span>
            <span>Fixture v1</span>
          </div>
          <div className="dashboard-metrics">
            {metrics.map((m) => (
              <button
                key={m.name}
                className={"dashboard-metric " + m.tone}
                onClick={() => setMetric(m.name)}
                aria-label={`Explain ${m.name}`}
              >
                <div>
                  <span>{m.name}</span>
                  <m.icon size={16} />
                </div>
                <strong>{m.value}</strong>
                <span className="metric-detail">
                  {m.tone === "green" ? (
                    <span className="small-bar">
                      {Array.from({ length: 10 }, (_, i) => (
                        <i
                          key={i}
                          className={
                            i < Math.round(s.causalCoverage! * 10)
                              ? "filled"
                              : ""
                          }
                        />
                      ))}
                    </span>
                  ) : null}
                  {m.detail}
                </span>
                <span className="metric-info">ⓘ</span>
              </button>
            ))}
          </div>
          <button
            className="finding-banner"
            onClick={() => {
              setTab("Pseudo-Covered");
              openRule(firstPseudoRule);
            }}
          >
            <span className="finding-icon">
              <TriangleAlert size={19} />
            </span>
            <div>
              <strong>
                {s.pseudoCovered} rules look tested. Their removal goes
                undetected.
              </strong>
              <p>
                These behaviors have mapped evals, but removing the instruction
                changed nothing. Start with {firstPseudoRule.id}.
              </p>
            </div>
            <span>
              Investigate <ArrowRight size={16} />
            </span>
          </button>
          {tab === "Overview" && (
            <div className="overview-panels">
              <section className="protection-panel">
                <div className="panel-heading">
                  <h2>The protection gap</h2>
                  <span>{s.totalRules} behavioral rules</span>
                </div>
                <div className="protection-chart">
                  <div className="protection-stack">
                    <span
                      className="green-stack"
                      style={{
                        width: (s.causallyCovered / s.totalRules) * 100 + "%",
                      }}
                    >
                      {s.causallyCovered}
                    </span>
                    <span
                      className="amber-stack"
                      style={{
                        width: (s.pseudoCovered / s.totalRules) * 100 + "%",
                      }}
                    >
                      {s.pseudoCovered}
                    </span>
                    <span
                      className="red-stack"
                      style={{
                        width: (s.uncovered / s.totalRules) * 100 + "%",
                      }}
                    >
                      {s.uncovered}
                    </span>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="green" />
                      Causally covered
                    </span>
                    <span>
                      <i className="amber" />
                      Pseudo-covered
                    </span>
                    <span>
                      <i className="red" />
                      Uncovered
                    </span>
                  </div>
                </div>
              </section>
              <section className="risk-panel">
                <span className="risk-number">{s.highRiskUnprotected}</span>
                <div>
                  <h2>High-risk rules are unprotected</h2>
                  <p>
                    Privacy, authorization, and external actions.
                    <br />
                    Review the behavioral boundaries first.
                  </p>
                </div>
                <button
                  aria-label="Filter high and critical risk rules"
                  className="icon-button"
                  onClick={() => {
                    setTab("Behavioral Contract");
                    setSeverity("unprotected-high-risk");
                    setFilters(true);
                  }}
                >
                  <ArrowUpRightIcon />
                </button>
              </section>
            </div>
          )}
          <section className="matrix-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {tab === "Behavioral Contract"
                    ? "Behavioral contract"
                    : tab === "Overview" || tab === "Coverage Matrix"
                      ? "Rule–eval coverage matrix"
                      : tab + " rules"}{" "}
                  <span className="count-chip">{rules.length}</span>
                </h2>
                <p>
                  Every rule, every mapping, every outcome. Select a rule to
                  inspect the evidence.
                </p>
              </div>
              <a href="/report.html" target="_blank" rel="noreferrer">
                Standalone report <ArrowUpRightIcon />
              </a>
            </div>
            <div className="matrix-toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search rules, behaviors, tags…"
                  aria-label="Search behavioral rules"
                />
                <kbd>/</kbd>
              </label>
              <button
                className={
                  "button button-outline button-small " +
                  (filters ? "selected-filter" : "")
                }
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={14} /> Filters
                {(severity || type || tag) && (
                  <span className="status-dot green" />
                )}
              </button>
              <span className="matrix-help">
                Click a rule to explore <ChevronRight size={13} />
              </span>
            </div>
            {filters && (
              <div className="filter-row">
                <label>
                  Severity
                  <select
                    aria-label="Severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="">All severities</option>
                    <option value="unprotected-high-risk">
                      High-risk unprotected
                    </option>
                    {["critical", "high", "medium", "low"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select
                    aria-label="Type"
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
                    {[...new Set(data.rules.flatMap((r) => r.tags))].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  onClick={() => {
                    setSeverity("");
                    setType("");
                    setTag("");
                    setQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
            <div className="matrix-scroll">
              <table className="coverage-matrix">
                <thead>
                  <tr>
                    <th>BEHAVIORAL RULE</th>
                    {tab !== "Behavioral Contract" &&
                      data.evals.map((ev, i) => (
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
                        {tab !== "Behavioral Contract" &&
                          data.evals.map((ev) => {
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
                      setTab("Overview");
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
                  <i className="legend-cell pseudo">◐</i> Direct, causally weak
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
          <footer className="dashboard-footer">
            <span>
              <ShieldCheck size={13} /> Testing evidence, not proof of safety or
              correctness.
            </span>
            <span>Built for inspectable evidence.</span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="rule-drawer"
            aria-describedby="rule-description"
          >
            {selected && (
              <>
                <div className="drawer-top">
                  <span>
                    <FileCode2 size={15} /> BEHAVIORAL RULE <b>{selected.id}</b>
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
                    {selected.severity.toUpperCase()} SEVERITY <span>·</span>{" "}
                    {selected.type.replaceAll("_", " ")}
                  </Dialog.Description>
                  <div className="source-block">
                    <span>
                      <FileCode2 size={14} /> {selected.source.file}:
                      {selected.source.lineStart}
                    </span>
                    <code>{selected.source.exactQuote}</code>
                  </div>
                  <div
                    className="drawer-tabs"
                    role="tablist"
                    aria-label="Rule details"
                  >
                    {["Evidence", "Suggested evals", "Source & mappings"].map(
                      (t) => (
                        <button
                          role="tab"
                          aria-selected={drawerTab === t}
                          key={t}
                          onClick={() => setDrawerTab(t)}
                        >
                          {t}
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
                            <GitBranch size={14} /> CONTROLLED RULE REMOVAL
                          </div>
                          <div className="experiment-stage">
                            <div>
                              <span className="stage-number">01</span>
                              <strong>Original prompt</strong>
                              <span className="stage-meta">Baseline</span>
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
                          <pre className="mutation-diff">{causal.diff}</pre>
                          <div className="remove-arrow">
                            <ArrowDown size={16} />
                            <span>Run the same evals again</span>
                          </div>
                          <div className="experiment-stage">
                            <div>
                              <span className="stage-number">02</span>
                              <strong>Without {selected.id}</strong>
                              <span className="stage-meta">Mutant</span>
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
                              <Sparkles size={15} /> Explore suggested evals{" "}
                              <ArrowRight size={15} />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="uncovered-evidence">
                          <CircleDashed size={34} />
                          <h3>No eval reaches this behavior.</h3>
                          <p>
                            There is no credible mapping to an existing eval. A
                            causal experiment cannot run until a relevant test
                            exists.
                          </p>
                          <Button
                            onClick={() => setDrawerTab("Suggested evals")}
                          >
                            Explore missing tests <ArrowRight size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : drawerTab === "Suggested evals" ? (
                    <div className="suggestions">
                      <p className="suggestion-note">
                        GENERATED — UNREVIEWED. Drafted from the rule, never
                        executed, and excluded from every coverage number until
                        a developer accepts them.
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
                              setTimeout(() => setCopied(false), 2000);
                            } catch {
                              setCopied(false);
                            }
                          }}
                        >
                          {copied ? (
                            <Check size={15} />
                          ) : (
                            <FileCode2 size={15} />
                          )}{" "}
                          {copied ? "Copied JSON" : "Copy suggested evals"}
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
                  <CircleDashed size={12} /> Deterministic fixture · 3
                  repetitions · No live model calls
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
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
