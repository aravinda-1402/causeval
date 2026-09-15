import { ReportSchema, type Report } from "./schemas.js";
import { escapeHtml as e, redact } from "./utils.js";

export function serializeReport(
  report: Report,
  secrets: string[] = [],
): string {
  const sanitize = (value: unknown): unknown =>
    typeof value === "string"
      ? redact(value, secrets)
      : Array.isArray(value)
        ? value.map(sanitize)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                key,
                /^(?:.*[_-])?(?:api[_-]?key|token|secret|password)$/i.test(key)
                  ? "[REDACTED]"
                  : sanitize(item),
              ]),
            )
          : value;
  return JSON.stringify(sanitize(ReportSchema.parse(report)), null, 2);
}
/**
 * Static SVG badge. It reports a measurement, never a certification: the label
 * names the metric and nothing implies the project is safe or verified.
 */
export function renderBadge(
  report: Report,
  metric: "crc" | "trace" = "crc",
): string {
  const value =
    metric === "trace"
      ? Math.round(report.summary.traceCoverage * 100) + "%"
      : report.summary.causalCoverage === null
        ? "not verified"
        : Math.round(report.summary.causalCoverage * 100) + "%";
  const label = metric === "trace" ? "Trace" : "CRC";
  const right = `${label} ${value}`;
  const leftWidth = 84;
  const rightWidth = Math.max(58, right.length * 7.4 + 20);
  const width = Math.round(leftWidth + rightWidth);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="CausEval ${right}"><rect width="${width}" height="28" rx="5" fill="#141920"/><path d="M${leftWidth} 0h${width - leftWidth - 5}q5 0 5 5v18q0 5-5 5H${leftWidth}" fill="#236a4f"/><g fill="white" font-family="Verdana,sans-serif" font-size="12" text-anchor="middle"><text x="${leftWidth / 2}" y="18">CausEval</text><text x="${leftWidth + rightWidth / 2}" y="18">${e(right)}</text></g></svg>`;
}
const percent = (n: number | null) =>
  n === null ? "Not verified" : Math.round(n * 100) + "%";
export function renderMarkdown(report: Report): string {
  const text = (value: string) =>
    e(value)
      .replace(/[\r\n]+/g, " ")
      .replace(/([\\`*_[\]|])/g, "\\$1");
  const s = report.summary;
  const lines = [
    "<!-- causeval-report -->",
    "## CausEval",
    "",
    "| Metric | Result |",
    "| --- | ---: |",
    `| Behavioral rules | ${s.totalRules} |`,
    `| Eval cases | ${s.totalEvals} |`,
    `| Trace Coverage | ${percent(s.traceCoverage)} |`,
    `| Causal Rule Coverage | ${percent(s.causalCoverage)} |`,
    `| Pseudo-covered | ${s.pseudoCovered} |`,
    `| Uncovered | ${s.uncovered} |`,
    `| High-risk unprotected | ${s.highRiskUnprotected} |`,
    "",
  ];
  if (!s.evalSuiteDetected)
    lines.push(
      `**No eval suite detected.** CausEval extracted ${s.totalRules} behavioral rules (critical ${s.severity.critical}, high ${s.severity.high}, medium ${s.severity.medium}, low ${s.severity.low}). Run \`causeval generate\` to draft a starter suite.`,
      "",
    );
  if (!report.project.verified)
    lines.push(
      "Causal verification did not run (mode: scan). Causal Rule Coverage requires `causeval verify` with a runner, so no rule here is labelled pseudo-covered.",
      "",
    );
  if (s.generatedUnreviewed)
    lines.push(
      `${s.generatedUnreviewed} generated eval(s) are unreviewed and excluded from every metric above.`,
      "",
    );
  if (s.possibleRedundancies)
    lines.push(
      `${s.possibleRedundancies} rule(s) overlap with another rule; removal results for those carry a POSSIBLE REDUNDANCY confound.`,
      "",
    );
  const risky = report.rules.filter(
    (rule) =>
      ["critical", "high"].includes(rule.severity) &&
      (report.project.verified
        ? !report.causalResults.some(
            (r) =>
              r.ruleId === rule.id && r.classification === "causally-covered",
          )
        : !report.mappings.some(
            (m) =>
              m.ruleId === rule.id &&
              m.relationship === "direct" &&
              m.confidence >= report.project.mappingConfidence,
          )),
  );
  if (risky.length)
    lines.push(
      "### High-risk unprotected rules",
      "",
      ...risky
        .slice(0, 10)
        .map(
          (rule) =>
            `- **${text(rule.id)} [${rule.severity.toUpperCase()}]** ${text(rule.expectedBehavior)}`,
        ),
      ...(risky.length > 10
        ? [`${risky.length - 10} more in the full report.`]
        : []),
      "",
    );
  if (report.warnings.length)
    lines.push(
      "### Analysis warnings",
      "",
      ...report.warnings.map((warning) => `- ${text(warning)}`),
      "",
    );
  lines.push(
    `Provider ${text(report.run.provider)}/${text(report.run.model)} · ${report.run.runsPerEval} runs per eval · CausEval ${text(report.run.causevalVersion)}`,
    "",
    report.project.fixture
      ? "Deterministic fixture evidence; not a model benchmark.\n"
      : "",
    "CausEval measures whether existing evals detect controlled removal of behavioral instructions. It provides testing evidence, not proof of correctness, security, safety, compliance, or absence of harmful behavior.",
    "",
  );
  return lines.filter((l) => l !== undefined).join("\n");
}

const STYLES = `:root{color-scheme:dark;--bg:#0b0e12;--panel:#12171e;--text:#edf1f7;--muted:#a1acbb;--border:#29313c}
body.light{color-scheme:light;--bg:#f5f7fa;--panel:#fff;--text:#18212d;--muted:#566477;--border:#d7dde6}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font:16px/1.6 system-ui,sans-serif;margin:0}
main{max-width:1300px;margin:auto;padding:48px 28px}
header{display:flex;justify-content:space-between;align-items:start;gap:16px}
h1{font-size:40px;letter-spacing:-2px;margin:0}
h2{line-height:1.3}
h3{margin:26px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
p{color:var(--muted)}
button,input,select{font:inherit;color:inherit;background:var(--panel);border:1px solid var(--border);border-radius:7px;padding:9px 14px}
button{cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #81aaff;outline-offset:3px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:36px 0}
.metric{padding:24px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
.metric strong{display:block;font-size:40px;font-weight:550}
.metric span{color:var(--muted);font-size:14px}
.notice{background:var(--panel);border:1px solid var(--border);border-left:3px solid #d5a94c;border-radius:12px;padding:24px;margin:28px 0}
.notice h2{margin:0 0 8px;font-size:22px}
.notice code{background:var(--bg);padding:3px 7px;border-radius:5px;font-size:14px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}
input{flex:1;min-width:180px}
.scroll{overflow-x:auto;border:1px solid var(--border);border-radius:12px}
table{width:100%;border-collapse:collapse;background:var(--panel);font-size:14px}
th,td{padding:14px;border-bottom:1px solid var(--border);text-align:center;min-width:95px}
th:first-child,td:first-child{min-width:330px;text-align:left;position:sticky;left:0;background:var(--panel)}
th{font-weight:500;color:var(--muted)}
.rule{border:0;background:none;text-align:left;padding:0;width:100%}
small{display:block;color:var(--muted);font-size:12px;letter-spacing:.08em;margin-bottom:5px}
.cell{border:0;background:none;font-size:23px;padding:3px 10px}
.status{font-size:12px;display:block;letter-spacing:.04em;margin-top:7px}
.causally-covered{color:#48c79d}
.pseudo-covered{color:#d5a94c}
.uncovered{color:#ed7886}
.flaky,.indeterminate{color:#ab9ded}
dialog{background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:16px;padding:34px;width:min(760px,94vw);max-height:90vh}
dialog::backdrop{background:#0009;backdrop-filter:blur(4px)}
.close{float:right;font-size:22px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--bg);padding:18px;border:1px solid var(--border);border-radius:8px;font:14px/1.7 ui-monospace,monospace}
.diff{color:var(--text)}
.diff .del{color:#ed7886}
.diff .add{color:#48c79d}
.evidence{display:flex;gap:26px;flex-wrap:wrap}
.evidence strong{color:var(--text)}
.confound{border-left:3px solid #d5a94c;padding:2px 0 2px 14px;margin:12px 0}
.runs{width:100%;font-size:13px}
.runs td,.runs th{min-width:0;padding:8px;text-align:right}
.runs td:first-child,.runs th:first-child{min-width:0;text-align:left;position:static}
footer{margin-top:35px;color:var(--muted);font-size:13px}
details{margin:20px 0}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 18px;font-size:13px;color:var(--muted);margin:0}
dt{color:var(--text)}
dd{margin:0;overflow-wrap:anywhere}
#empty{display:none;padding:24px}
nav{display:flex;gap:8px;flex-wrap:wrap}
nav button.active{border-color:#48c79d;color:#48c79d}
@media(max-width:700px){main{padding:24px 16px}.metrics{grid-template-columns:1fr 1fr}.metric{padding:16px}.metric strong{font-size:30px}h1{font-size:32px}.evidence{flex-wrap:wrap}dl{grid-template-columns:1fr}}`;
const DIMENSION_LABELS: Record<string, string> = {
  positivePath: "normal path",
  negativePath: "negative path",
  boundary: "boundary",
  adversarial: "adversarial",
};
const renderDiff = (diff: string) =>
  diff
    .split("\n")
    .map(
      (line) =>
        `<span class="${line.startsWith("-") ? "del" : line.startsWith("+") ? "add" : ""}">${e(line)}</span>`,
    )
    .join("\n");

function renderDrawer(safe: Report, rule: Report["rules"][number]): string {
  const result = safe.causalResults.find((c) => c.ruleId === rule.id);
  const maps = safe.mappings.filter((m) => m.ruleId === rule.id);
  const gap = safe.gaps.find((g) => g.ruleId === rule.id);
  const suggestions = safe.suggestions.filter((g) => g.ruleId === rule.id);
  const sources = rule.sources ?? [rule.source];
  const pct = (n: number | null) =>
    n === null ? "—" : `${Math.round(n * 100)}%`;
  const interval = (stat: { interval?: [number, number] }) =>
    stat.interval
      ? `<br><span style="font-size:12px">95% CI ${pct(stat.interval[0])}–${pct(stat.interval[1])}</span>`
      : "";
  return `<dialog id="${e(rule.id)}" aria-label="${e(rule.id)} details"><button class="close" aria-label="Close rule details">×</button>
<small>${e(rule.id)} / ${e(rule.type)} / ${rule.severity}</small>
<h2>${e(rule.expectedBehavior)}</h2>
<p>${e(rule.rationale)}</p>
<h3>1 · Where this rule came from</h3>
${sources.map((s) => `<p>${e(s.file ?? safe.run.promptFile ?? "system prompt")}:${s.lineStart}–${s.lineEnd}</p><pre>${e(s.exactQuote)}</pre>`).join("")}
${rule.condition ? `<p>Condition: ${e(rule.condition)}</p>` : ""}
<details><summary>Disagree with this rule? Override it.</summary><p>Rules are addressed by stable key, not by the positional id. Paste one of these into your config:</p><pre>overrides: {
  // drop this rule from every metric
  ignoredRules: ["${e(rule.stableKey)}"],
  // or force the evals that cover it
  mappings: { "${e(rule.stableKey)}": ["your-eval-id"] },
  // or record why it is knowingly unprotected
  acceptedRisks: { "${e(rule.stableKey)}": "enforced by the payment gateway" },
}</pre></details>
<h3>2 · Which evals mapped, and why</h3>
${
  maps.length
    ? maps
        .map(
          (m) =>
            `<p><strong>${e(m.evalId)}</strong> · ${m.relationship} · confidence ${Math.round(m.confidence * 100)}% (threshold ${Math.round(safe.project.mappingConfidence * 100)}%)${m.manual ? " · manual override" : ""}<br>${e(m.rationale)}<br><span style="font-size:12px">Exercises: ${
              Object.entries(m.dimensions)
                .filter(([, v]) => v)
                .map(([k]) => DIMENSION_LABELS[k] ?? k)
                .join(", ") || "no declared dimension"
            }</span></p>`,
        )
        .join("")
    : "<p>No eval maps to this rule above the confidence threshold.</p>"
}
${gap && gap.missingDimensions.length ? `<p><strong>Missing dimensions:</strong> ${gap.missingDimensions.map((d) => DIMENSION_LABELS[d] ?? d).join(", ")}. ${e(gap.reason)}</p>` : gap ? `<p>${e(gap.reason)}</p>` : ""}
<h3>3 · What was mutated</h3>
${result?.diff ? `<pre class="diff">${renderDiff(result.diff)}</pre>` : "<p>No mutation was run for this rule.</p>"}
<h3>4 · What the runs showed</h3>
<p class="status ${result?.classification ?? "uncovered"}">${e(result?.classification ?? "not verified")}</p>
${
  result?.baseline.runs
    ? `<div class="evidence"><p>Baseline<br><strong>${result.baseline.passes} / ${result.baseline.runs} passed (${pct(result.baseline.passRate)})</strong>${interval(result.baseline)}</p><p>With the rule removed<br><strong>${result.mutant.passes} / ${result.mutant.runs} passed (${pct(result.mutant.passRate)})</strong>${interval(result.mutant)}</p><p>Detection effect<br><strong>${pct(result.detectionRate)}</strong>${result.thresholds ? `<br><span style="font-size:12px">needs ≥ ${pct(result.thresholds.minimumDetectionEffect)}</span>` : ""}</p></div>`
    : "<p>No baseline or mutant runs were executed.</p>"
}
${
  result?.perEval.length
    ? `<table class="runs"><thead><tr><th>Eval</th><th>Baseline</th><th>Mutant</th></tr></thead><tbody>${result.perEval.map((row) => `<tr><td>${e(row.evalId)}</td><td>${row.baselinePasses}/${row.baselineRuns}</td><td>${row.mutantPasses}/${row.mutantRuns}</td></tr>`).join("")}</tbody></table>`
    : ""
}
<h3>5 · Why CausEval classified it this way</h3>
<p>${e(result?.interpretation ?? "Not verified: run causeval verify to collect causal evidence for this rule.")}</p>
${result?.reason ? `<p>${e(result.reason)}</p>` : ""}
${(result?.confounders ?? []).map((c) => `<div class="confound"><p>${e(c.detail)}</p></div>`).join("")}
${safe.acceptedRisks[rule.stableKey] ? `<div class="confound"><p>Accepted risk: ${e(safe.acceptedRisks[rule.stableKey])}</p></div>` : ""}
<h3>6 · Suggested missing tests</h3>
${
  suggestions.length
    ? suggestions
        .map(
          (g) =>
            `<p><strong>${DIMENSION_LABELS[g.dimension] ?? g.dimension}</strong><br>${e(g.reason)}</p><pre>${e(JSON.stringify(g.eval, null, 2))}</pre>`,
        )
        .join("")
    : "<p>No candidates generated. Run causeval generate to draft cases for the missing dimensions.</p>"
}</dialog>`;
}

export function renderHTML(report: Report): string {
  const safe = ReportSchema.parse(JSON.parse(serializeReport(report)));
  const s = safe.summary;
  const pct = (n: number | null) =>
    n === null ? "—" : `${Math.round(n * 100)}%`;
  const statusOf = (ruleId: string) =>
    safe.causalResults.find((c) => c.ruleId === ruleId)?.classification ??
    (safe.mappings.some(
      (m) =>
        m.ruleId === ruleId &&
        m.relationship === "direct" &&
        m.confidence >= safe.project.mappingConfidence,
    )
      ? "not-verified"
      : "uncovered");
  const rows = safe.rules
    .map((rule) => {
      const status = statusOf(rule.id);
      return `<tr data-status="${status}" data-severity="${rule.severity}" data-type="${rule.type}" data-tag="${e(rule.tags.join(" "))}"><td><button class="rule" data-rule="${e(rule.id)}"><small>${e(rule.id)} · ${rule.severity}</small>${e(rule.expectedBehavior)}<span class="status ${status}">${status}</span></button></td>${safe.evals
        .map((test) => {
          const mapping = safe.mappings.find(
            (m) => m.ruleId === rule.id && m.evalId === test.id,
          );
          const symbol =
            mapping?.relationship === "direct"
              ? status === "causally-covered"
                ? "●"
                : "◐"
              : mapping?.relationship === "partial"
                ? "○"
                : "·";
          return `<td title="${e(mapping?.rationale ?? "No mapping")}"><button data-rule="${e(rule.id)}" aria-label="${e(rule.id)}, ${e(test.id)}: ${mapping?.relationship ?? "none"}" class="cell ${status}">${symbol}</button></td>`;
        })
        .join("")}</tr>`;
    })
    .join("");
  const emptySuite = `<div class="notice"><h2>No eval suite detected</h2><p>CausEval extracted <strong>${s.totalRules}</strong> behavioral rules from this prompt: ${s.severity.critical} critical, ${s.severity.high} high, ${s.severity.medium} medium, ${s.severity.low} low. There is nothing to map yet, so Trace Coverage is 0% by definition rather than by measurement.</p><p>Draft a starter suite with <code>causeval generate</code>, review the candidates with <code>causeval review</code>, then run <code>causeval scan</code> again.</p></div>`;
  const meta = Object.entries(safe.run.thresholds)
    .map(([k, v]) => `${k}=${v}`)
    .join(" · ");
  const causalMeta = Object.entries(safe.run.causal)
    .map(([k, v]) => `${k}=${v}`)
    .join(" · ");
  const reproduction = `<details><summary>Run metadata and reproduction</summary><dl><dt>CausEval</dt><dd>${e(safe.run.causevalVersion)} (report schema ${e(safe.schemaVersion)})</dd><dt>Mode</dt><dd>${e(safe.run.mode)}</dd><dt>Started</dt><dd>${e(safe.run.startedAt)}</dd><dt>Prompt</dt><dd>${e(safe.run.promptFile ?? "inline")} · ${e(safe.run.promptHash)}</dd><dt>Eval suite</dt><dd>${safe.run.evalFiles.length ? e(safe.run.evalFiles.join(", ")) : "none"} · ${e(safe.run.evalSuiteHash)}</dd><dt>Provider</dt><dd>${e(safe.run.provider)} / ${e(safe.run.model)} · temperature ${safe.run.temperature}${safe.run.seed === null ? "" : ` · seed ${safe.run.seed}`}</dd><dt>Judge</dt><dd>${safe.run.judgeModel ? e(safe.run.judgeProvider + " / " + safe.run.judgeModel) : "same as provider, or not used"}</dd><dt>Runner</dt><dd>${e(safe.run.runner.kind)}${safe.run.runner.identity ? " · " + e(safe.run.runner.identity) : ""}</dd><dt>Runs per eval</dt><dd>${safe.run.runsPerEval}</dd><dt>Cache</dt><dd>${safe.run.cache ? "enabled" : "bypassed"}</dd><dt>Thresholds</dt><dd>${e(meta)}</dd><dt>Causal settings</dt><dd>${e(causalMeta)}</dd></dl></details>`;
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CausEval · ${e(safe.project.name)}</title><style>${STYLES}</style></head><body><main><header><div><small>BEHAVIORAL CONTRACT COVERAGE</small><h1>CausEval<span style="color:#48c79d">.</span></h1><p>Code has coverage. Your prompts should too.</p></div><button id="theme" aria-label="Toggle color theme">◐ Theme</button></header>
<p>${e(safe.project.name)} · ${e(safe.project.generatedAt)}${safe.project.fixture ? " · Deterministic fixture" : ""}</p>
${s.evalSuiteDetected ? "" : emptySuite}
<div class="metrics"><div class="metric"><span>Behavioral Rules</span><strong>${s.totalRules}</strong><span>${s.totalEvals} eval cases</span></div><div class="metric" title="Credible direct mappings divided by total rules"><span>Trace Coverage</span><strong>${pct(s.traceCoverage)}</strong><span>${s.traceCovered} / ${s.totalRules} rules mapped</span></div><div class="metric" title="Causally protected rules divided by total rules"><span>Causal Rule Coverage</span><strong>${pct(s.causalCoverage)}</strong><span>${safe.project.verified ? s.causallyCovered + " / " + s.totalRules + " protected" : "Not verified — run causeval verify"}</span></div><div class="metric"><span>Pseudo-Covered</span><strong>${s.pseudoCovered}</strong><span>${s.uncovered} uncovered behaviors</span></div></div>
${s.baselinePassRate === null ? "" : `<p><strong>${pct(s.baselinePassRate)}</strong> of mapped eval runs passed at baseline, yet ${s.pseudoCovered} of those behaviors survived having their instruction removed.</p>`}
${s.generatedUnreviewed ? `<div class="notice"><h2>${s.generatedUnreviewed} generated evals awaiting review</h2><p>GENERATED — UNREVIEWED cases are excluded from every metric on this page. Accept them with <code>causeval review --accept</code> before they count as coverage.</p></div>` : ""}
<details><summary>How these metrics are calculated</summary><p>Trace Coverage = rules with a credible direct mapping / total rules. Causal Rule Coverage = rules with a stable baseline whose mutation is reliably detected / total rules. Severity changes neither metric. No rules produces 0%; a scan has no CRC until verification runs.</p></details>`;
  const controls = `<nav aria-label="Filter by result"><button data-filter="all" class="active">All rules</button><button data-filter="uncovered">Uncovered</button><button data-filter="pseudo-covered">Pseudo-covered</button><button data-filter="causally-covered">Causally covered</button><button data-filter="flaky">Flaky</button><button data-filter="indeterminate">Indeterminate</button></nav>
<div class="filters"><input id="search" aria-label="Search behavioral rules" placeholder="Search behavioral rules…"><select id="severity" aria-label="Filter severity"><option value="">All severities</option>${["critical", "high", "medium", "low"].map((v) => `<option>${v}</option>`).join("")}</select><select id="type" aria-label="Filter type"><option value="">All types</option>${[...new Set(safe.rules.map((r) => r.type))].map((t) => `<option>${e(t)}</option>`).join("")}</select><select id="tag" aria-label="Filter tag"><option value="">All tags</option>${[...new Set(safe.rules.flatMap((r) => r.tags))].map((t) => `<option>${e(t)}</option>`).join("")}</select></div>
<div class="scroll"><table><thead><tr><th>Behavioral rule</th>${safe.evals.map((t) => `<th>${e(t.id)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div><p id="empty">No rules match these filters.</p>
<p>● Causally validated &nbsp; ◐ Direct mapping, causally weak or unverified &nbsp; ○ Partial &nbsp; · No mapping</p>
${safe.redundancies.length ? `<details><summary>${safe.redundancies.length} possible rule redundancies</summary>${safe.redundancies.map((r) => `<p><strong>${e(r.ruleId)}</strong> may still be enforced by <strong>${e(r.overlapsWithRuleId)}</strong> (${Math.round(r.confidence * 100)}%): ${e(r.rationale)}</p>`).join("")}</details>` : ""}
${safe.warnings.length ? `<details><summary>${safe.warnings.length} analysis warnings</summary>${safe.warnings.map((w) => `<p>${e(w)}</p>`).join("")}</details>` : ""}`;
  const script = `<script>let status='all';const rows=[...document.querySelectorAll('tbody tr')];const q=s=>document.querySelector(s);function filter(){let count=0;rows.forEach(row=>{const show=(status==='all'||row.dataset.status===status)&&(!q('#severity').value||row.dataset.severity===q('#severity').value)&&(!q('#type').value||row.dataset.type===q('#type').value)&&(!q('#tag').value||row.dataset.tag.split(' ').includes(q('#tag').value))&&row.textContent.toLowerCase().includes(q('#search').value.toLowerCase());row.hidden=!show;if(show)count++});q('#empty').style.display=count?'none':'block'}document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{status=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter()});document.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',filter));document.querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.rule).showModal());document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());q('#theme').onclick=()=>document.body.classList.toggle('light');</script>`;
  const footer = `<footer>CausEval measures whether existing evals detect controlled removal of behavioral instructions under the tested model and configuration. It provides testing evidence, not proof of correctness, security, safety, compliance, or absence of harmful behavior. Causal verification should run against mocked, sandboxed, or otherwise non-production tools.</footer>`;
  return `${head}${controls}${reproduction}${footer}${safe.rules.map((rule) => renderDrawer(safe, rule)).join("")}</main>${script}</body></html>`;
}
