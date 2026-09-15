#!/usr/bin/env node
import { Command } from "commander";
import { readFile, writeFile, mkdir, access, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, dirname, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createJiti } from "jiti";
import fg from "fast-glob";
import { parse, stringify } from "yaml";
import {
  CAUSEVAL_VERSION,
  ConfigSchema,
  EvalSuiteSchema,
  ReportSchema,
  CachedProvider,
  HTTPProvider,
  FixtureProvider,
  FixtureRunner,
  CustomRunner,
  NativeRunner,
  analyze,
  analyzeGaps,
  extractRules,
  generateEvals,
  generationTargets,
  describeDimension,
  mapRules,
  suggestEvals,
  serializeReport,
  renderHTML,
  renderBadge,
  renderMarkdown,
  loadEvalText,
  checkGates,
  diffReports,
  fixturePrompt,
  fixtureEvals,
  redact,
  hash,
  type Config,
  type EvalCase,
  type LLMProvider,
  type Report,
} from "@causeval/core";
export { defineConfig } from "@causeval/core";

async function save(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}
async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
  );
}
async function loadConfig(
  path: string,
): Promise<{ config: Config; cwd: string }> {
  const full = resolve(path);
  if (!(await exists(full)))
    throw new Error(
      `Config not found: ${path}\n  Run "causeval init" to create one, pass --config <path>, or try "causeval demo" for a no-setup walkthrough.`,
    );
  const jiti = createJiti(import.meta.url);
  const raw = await jiti.import(full, { default: true });
  const result = ConfigSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      "Invalid configuration: " +
        result.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
    );
  return { config: result.data, cwd: dirname(full) };
}
async function inputs(
  config: Config,
  cwd: string,
  options: { requireEvals?: boolean } = {},
) {
  const files = await fg(config.evals, {
    cwd,
    absolute: true,
    onlyFiles: true,
  });
  if (!files.length && options.requireEvals)
    throw new Error(
      `No eval files matched ${config.evals.join(", ")} in ${cwd}\n  Run "causeval generate" to draft a starter suite from your prompt, or correct config.evals.`,
    );
  const evals = (
    await Promise.all(
      files.map(async (p) => loadEvalText(await readFile(p, "utf8"), p)),
    )
  ).flat();
  const duplicates = evals
    .map((e) => e.id)
    .filter((id, i, all) => all.indexOf(id) !== i);
  if (duplicates.length)
    throw new Error(
      `Duplicate eval IDs across files: ${[...new Set(duplicates)].join(", ")}. IDs must be globally unique.`,
    );
  let prompt: string;
  try {
    prompt = await readFile(resolve(cwd, config.prompt), "utf8");
  } catch {
    throw new Error(
      `System prompt not found: ${config.prompt}\n  Set config.prompt to the file holding your system prompt.`,
    );
  }
  return {
    prompt,
    evals,
    evalFiles: files.map((p) => relative(cwd, p).replaceAll("\\", "/")),
  };
}
function makeProvider(
  config: Config,
  cwd: string,
  cache: boolean,
  onHit?: (m: string) => void,
) {
  const inner =
    config.provider.type === "fixture"
      ? new FixtureProvider()
      : new HTTPProvider(config.provider);
  return new CachedProvider(
    inner,
    resolve(cwd, ".causeval/cache"),
    hash({
      baseURL: config.provider.baseURL ?? process.env.CAUSEVAL_BASE_URL ?? "",
      promptFile: config.prompt,
    }),
    cache,
    onHit,
  );
}
/** The judge is cached separately so identical verdicts are never re-billed
 * and a run stays reproducible, and it is reported explicitly. */
function makeJudge(
  llm: CachedProvider,
  config: Config,
  cwd: string,
  cache: boolean,
): LLMProvider {
  if (!config.judge) return llm.scoped("judge");
  const inner =
    config.judge.type === "fixture"
      ? new FixtureProvider()
      : new HTTPProvider(config.judge);
  return new CachedProvider(
    inner,
    resolve(cwd, ".causeval/cache"),
    "judge:" +
      hash({
        type: config.judge.type,
        model: config.judge.model,
        baseURL: config.judge.baseURL ?? process.env.CAUSEVAL_BASE_URL ?? "",
      }),
    cache,
  );
}

function secretValues(config: Config) {
  return Object.entries(process.env)
    .filter(([k]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k))
    .map(([, v]) => v ?? "")
    .concat([config.provider.apiKey ?? "", config.judge?.apiKey ?? ""]);
}
async function artifacts(report: Report, config: Config, cwd: string) {
  const safe = ReportSchema.parse(
    JSON.parse(serializeReport(report, secretValues(config))),
  );
  await save(resolve(cwd, config.output.json), serializeReport(safe));
  await save(resolve(cwd, config.output.html), renderHTML(safe));
  await save(resolve(cwd, ".causeval/badge.svg"), renderBadge(safe));
  await save(
    resolve(cwd, ".causeval/badge-trace.svg"),
    renderBadge(safe, "trace"),
  );
  await save(resolve(cwd, ".causeval/summary.md"), renderMarkdown(safe));
  return safe;
}
const pad = (label: string, value: string) => `  ${label.padEnd(29)}${value}`;
function printNoEvals(report: Report) {
  const s = report.summary;
  console.log(
    [
      "",
      "  No eval suite detected.",
      "",
      `  CausEval extracted ${s.totalRules} behavioral rules from your system prompt.`,
      "",
      `    Critical  ${s.severity.critical}`,
      `    High      ${s.severity.high}`,
      `    Medium    ${s.severity.medium}`,
      `    Low       ${s.severity.low}`,
      "",
      "  You can generate a starter behavioral eval suite with:",
      "",
      "    causeval generate",
      "",
      "  Generated cases are written as GENERATED - UNREVIEWED and do not count",
      "  as coverage until you accept them with causeval review.",
      "",
    ].join("\n"),
  );
}
function printWarnings(report: Report) {
  for (const warning of report.warnings) console.log("  Warning: " + warning);
}
function print(report: Report) {
  const s = report.summary;
  if (!s.evalSuiteDetected) {
    printNoEvals(report);
    return printWarnings(report);
  }
  const percent = (v: number | null) =>
    v === null ? "Not verified" : Math.round(v * 100) + "%";
  const line = "  " + "─".repeat(52);
  console.log(
    [
      "",
      `  CAUSEVAL  /  ${report.project.name}`,
      line,
      pad("Behavioral rules", `${s.totalRules}`) +
        `   (${s.severity.critical} critical, ${s.severity.high} high, ${s.severity.medium} medium, ${s.severity.low} low)`,
      pad("Eval cases", `${s.totalEvals}`),
      "",
      pad("Trace Coverage", percent(s.traceCoverage)) +
        `   ${s.traceCovered} / ${s.totalRules} rules mapped`,
      pad("Causal Rule Coverage", percent(s.causalCoverage)) +
        (report.project.verified
          ? `   ${s.causallyCovered} / ${s.totalRules} rules protected`
          : "   run causeval verify"),
      "",
      pad("Causally covered", `${s.causallyCovered}`),
      pad("Pseudo-covered", `${s.pseudoCovered}`),
      pad("Uncovered", `${s.uncovered}`),
      pad("Flaky / indeterminate", `${s.flaky} / ${s.indeterminate}`),
      line,
    ].join("\n"),
  );
  if (s.baselinePassRate !== null) {
    const runs = report.causalResults.reduce((a, r) => a + r.baseline.runs, 0);
    const passes = report.causalResults.reduce(
      (a, r) => a + r.baseline.passes,
      0,
    );
    console.log(
      `\n  Baseline pass rate: ${Math.round(s.baselinePassRate * 100)}% (${passes}/${runs} mapped eval runs)` +
        (s.pseudoCovered
          ? `\n  ${s.pseudoCovered} behavior(s) kept passing after their instruction was removed.`
          : ""),
    );
  }
  if (report.project.fixture)
    console.log("\n  Deterministic fixture — not a model benchmark.");
  const risky = report.rules.filter((r) =>
    ["high", "critical"].includes(r.severity),
  );
  const statusOf = (id: string) =>
    report.causalResults.find((c) => c.ruleId === id)?.classification ??
    (report.mappings.some(
      (m) =>
        m.ruleId === id &&
        m.relationship === "direct" &&
        m.confidence >= report.project.mappingConfidence,
    )
      ? "mapped, not verified"
      : "uncovered");
  const unprotected = report.project.verified
    ? risky.filter((r) => statusOf(r.id) !== "causally-covered")
    : risky.filter((r) => statusOf(r.id) === "uncovered");
  if (unprotected.length) {
    console.log(
      report.project.verified
        ? "\n  High-risk rules without causal protection:"
        : "\n  High-risk rules with no eval mapped to them:",
    );
    for (const r of unprotected)
      console.log(
        `  ${r.id} [${r.severity.toUpperCase()}] ${r.expectedBehavior}  - ${statusOf(r.id)}`,
      );
  }
  if (s.generatedUnreviewed)
    console.log(
      `\n  ${s.generatedUnreviewed} generated eval(s) are not accepted yet and are excluded from these metrics.`,
    );
  printWarnings(report);
}

async function emitOutputs(
  path: string,
  report: Report,
  config: Config,
  cwd: string,
  gates: string[],
) {
  await save(
    resolve(path),
    JSON.stringify(
      {
        causevalVersion: CAUSEVAL_VERSION,
        mode: report.run.mode,
        verified: report.project.verified,
        evalSuiteDetected: report.summary.evalSuiteDetected,
        traceCoverage: report.summary.traceCoverage,
        causalCoverage: report.summary.causalCoverage,
        uncovered: report.summary.uncovered,
        pseudoCovered: report.summary.pseudoCovered,
        highRiskUnprotected: report.summary.highRiskUnprotected,
        totalRules: report.summary.totalRules,
        totalEvals: report.summary.totalEvals,
        gateFailed: gates.length > 0,
        gateReasons: gates,
        markdown: renderMarkdown(report),
        paths: {
          reportJson: resolve(cwd, config.output.json),
          reportHtml: resolve(cwd, config.output.html),
          badge: resolve(cwd, ".causeval/badge.svg"),
          summaryMarkdown: resolve(cwd, ".causeval/summary.md"),
          directory: resolve(cwd, ".causeval"),
        },
      },
      null,
      2,
    ),
  );
}
interface RunOptions {
  config: string;
  cache?: boolean;
  suggest?: boolean;
  strict?: boolean;
  runs?: string;
  mutation?: "removal" | "boundary";
  runner?: string;
  failOn?: string;
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
  emitOutputs?: string;
}
async function run(mode: "scan" | "verify", options: RunOptions) {
  const { config, cwd } = await loadConfig(options.config);
  if (options.strict) config.causal.strictMutationValidation = true;
  if (options.mutation) config.causal.mutationType = options.mutation;
  if (options.runs) {
    const runs = Number(options.runs);
    if (!Number.isInteger(runs) || runs < 2 || runs > 100)
      throw new Error("--runs must be a whole number between 2 and 100.");
    config.causal.runsPerEval = runs;
  }
  ConfigSchema.parse(config);
  const data = await inputs(config, cwd, { requireEvals: mode === "verify" });
  const progress = options.quiet
    ? undefined
    : (m: string) => console.log("  " + m);
  const cache = options.cache !== false;
  const llm = makeProvider(
    config,
    cwd,
    cache,
    options.verbose || options.debug ? progress : undefined,
  );
  const judge = makeJudge(llm, config, cwd, cache);
  const runner =
    mode === "verify"
      ? options.runner
        ? new CustomRunner(options.runner, config.runnerTimeoutMs, cwd)
        : config.provider.type === "fixture"
          ? new FixtureRunner()
          : new NativeRunner(llm, judge, config.causal.candidateTemperature)
      : undefined;
  const report = await analyze({
    ...data,
    config,
    provider: llm,
    judge: mode === "verify" ? judge : undefined,
    runner,
    verify: mode === "verify",
    name: basename(cwd) || "Current project",
    file: config.prompt,
    cache,
    onProgress: progress,
  });
  report.acceptedRisks = config.overrides.acceptedRisks;
  if (options.suggest && report.rules.length)
    report.suggestions = await suggestEvals(report, llm, config);
  const safe = await artifacts(report, config, cwd);
  if (options.suggest && report.suggestions.length)
    await writeStaging(config, cwd, report.suggestions);
  const gates = options.failOn === "threshold" ? checkGates(safe, config) : [];
  if (options.emitOutputs)
    await emitOutputs(options.emitOutputs, safe, config, cwd, gates);
  if (!options.quiet) {
    print(safe);
    const usage = llm.usage;
    const judgeUsage = judge === llm ? null : judge.usage;
    // A default scoped judge shares the provider's underlying request counter.
    const requests =
      usage.requests + (config.judge ? (judgeUsage?.requests ?? 0) : 0);
    console.log(
      `\n  Provider requests: ${requests}` +
        (usage.cacheHits + (judgeUsage?.cacheHits ?? 0)
          ? ` (${usage.cacheHits + (judgeUsage?.cacheHits ?? 0)} analysis result(s) reused from .causeval/cache)`
          : ""),
    );
    console.log(`\n  Report: ${resolve(cwd, config.output.html)}\n`);
    if (safe.summary.evalSuiteDetected && !safe.project.verified)
      console.log(
        "  Causal verification did not run. Use causeval verify to measure Causal Rule Coverage.\n",
      );
  }
  if (gates.length) {
    if (!options.quiet)
      console.error("Coverage gate failed:\n  - " + gates.join("\n  - "));
    process.exitCode = 1;
  }
}

const STAGING_HEADER = `# GENERATED - UNREVIEWED
# CausEval drafted these cases from your system prompt. They do NOT count as
# coverage until you accept them:
#   causeval review --list
#   causeval review --accept <id|all>
#   causeval review --reject <id|all>
# Edit any case in this file before accepting it. Accepted cases are copied into
# the suite file configured as generate.acceptedFile.
`;
async function readSuite(path: string): Promise<EvalCase[]> {
  if (!(await exists(path))) return [];
  const parsed = EvalSuiteSchema.safeParse(parse(await readFile(path, "utf8")));
  if (!parsed.success)
    throw new Error(
      `Could not read ${path}: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    );
  return parsed.data.evals;
}
async function writeStaging(
  config: Config,
  cwd: string,
  suggestions: Report["suggestions"],
) {
  const path = resolve(cwd, config.generate.stagingFile);
  const previous = await readSuite(path);
  const decisions = new Map(
    previous
      .filter((e) => e.causeval)
      .map((e) => [e.id, e.causeval!.review] as const),
  );
  const merged = suggestions.map((s) => ({
    ...s.eval,
    causeval: {
      ...s.eval.causeval!,
      review: decisions.get(s.eval.id) ?? s.eval.causeval!.review,
    },
  }));
  await save(path, STAGING_HEADER + stringify({ version: 1, evals: merged }));
  return { path, count: merged.length };
}
async function writeAccepted(config: Config, cwd: string, staged: EvalCase[]) {
  const path = resolve(cwd, config.generate.acceptedFile);
  const accepted = staged.filter((e) => e.causeval?.review === "accepted");
  // An empty suite file fails eval loading, so remove it instead.
  if (!accepted.length) {
    await rm(path, { force: true });
    return { path, count: 0 };
  }
  await save(
    path,
    "# Accepted CausEval-generated cases. Reviewed by a developer; counted as coverage.\n" +
      stringify({ version: 1, evals: accepted }),
  );
  return { path, count: accepted.length };
}

const INIT_CONFIG = `// CausEval configuration. A plain object works anywhere. Once causeval is a
// dependency you can wrap it in defineConfig from 'causeval' for editor types.
export default {
  prompt: './prompts/system.md',
  evals: ['./evals/**/*.yaml'],
  // Swap to your own provider and set CAUSEVAL_MODEL when you are ready:
  //   provider: { type: 'openai', model: process.env.CAUSEVAL_MODEL },
  provider: { type: 'fixture' },
};
`;
async function initProject(directory: string, promptOnly: boolean) {
  const cwd = resolve(directory);
  const files: Array<[string, string]> = [
    ["causeval.config.ts", INIT_CONFIG],
    ["prompts/system.md", fixturePrompt + "\n"],
  ];
  // Keep private artifacts out of a new user's Git history without replacing
  // any existing ignore policy.
  if (!(await exists(resolve(cwd, ".causeval/.gitignore"))))
    files.push([
      ".causeval/.gitignore",
      "# Prompt-derived cache, reports and generated candidates may be private.\n*\n!.gitignore\n",
    ]);
  if (!promptOnly)
    files.push([
      "evals/example.yaml",
      stringify({ version: 1, evals: fixtureEvals }),
    ]);
  for (const [path] of files)
    if (await exists(resolve(cwd, path)))
      throw new Error(
        `Refusing to overwrite ${path}. Use --dir to choose an empty directory.`,
      );
  for (const [path, content] of files) await save(resolve(cwd, path), content);
  const shown = relative(process.cwd(), cwd).replaceAll("\\", "/");
  const where =
    !shown || shown === "." ? "" : ` --config ${shown}/causeval.config.ts`;
  console.log(
    [
      "",
      `  CausEval initialised in ${cwd}`,
      "",
      "  Next:",
      promptOnly
        ? `    1. causeval scan${where}        see the behavioral contract (no eval suite yet)\n    2. causeval generate${where}    draft a starter eval suite\n    3. causeval review${where} --list  accept, edit or reject each case`
        : `    1. causeval scan${where}      map the contract to the bundled evals\n    2. causeval verify${where}    remove each rule and re-run the mapped evals`,
      "",
      "  The starter config uses a deterministic fixture and needs no API key.",
      "  For your own prompt or generated eval execution, configure your provider",
      "  and model (docs/providers.md), or pass --runner to your eval pipeline.",
      "",
    ].join("\n"),
  );
}

async function runGenerate(options: RunOptions & { rules?: string }) {
  const { config, cwd } = await loadConfig(options.config);
  const data = await inputs(config, cwd);
  const cache = options.cache !== false;
  const progress = options.quiet
    ? undefined
    : (m: string) => console.log("  " + m);
  const llm = makeProvider(
    config,
    cwd,
    cache,
    options.verbose ? progress : undefined,
  );
  progress?.("Extracting behavioral rules");
  const rules = (
    await extractRules(data.prompt, llm, {
      file: config.prompt,
      maxChars: config.maxPromptChars,
    })
  ).filter((r) => !config.overrides.ignoredRules.includes(r.stableKey));
  if (!rules.length)
    throw new Error(
      "No behavioral rules were extracted, so there is nothing to generate. Check the system prompt path and content.",
    );
  const wanted = options.rules
    ?.split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  const active = data.evals.filter(
    (e) => !(e.causeval?.generated && e.causeval.review !== "accepted"),
  );
  const mappings = active.length
    ? await mapRules(rules, active, llm, config)
    : [];
  const gaps = analyzeGaps(
    rules,
    mappings,
    config.thresholds.mappingConfidence,
  );
  const targets = generationTargets(rules, gaps).filter(
    (t) => !wanted || wanted.includes(t.rule.id),
  );
  if (!targets.length) {
    console.log(
      "\n  Every extracted rule already has an eval for each dimension it needs. Nothing to generate.\n",
    );
    return;
  }
  progress?.(
    `Drafting cases for ${targets.length} rule(s) across ${[...new Set(targets.flatMap((t) => t.dimensions))].length} dimensions`,
  );
  const suggestions = await generateEvals({
    requests: targets,
    existing: active,
    provider: llm,
    casesPerRule: config.generate.casesPerRule,
  });
  const staged = await writeStaging(config, cwd, suggestions);
  const byDimension = suggestions.reduce<Record<string, number>>((acc, s) => {
    acc[describeDimension(s.dimension)] =
      (acc[describeDimension(s.dimension)] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    [
      "",
      `  GENERATED - UNREVIEWED: ${staged.count} candidate eval case(s) for ${targets.length} rule(s)`,
      "",
      ...Object.entries(byDimension).map(
        ([dimension, count]) => `    ${dimension.padEnd(16)}${count}`,
      ),
      "",
      `  Written to ${relative(process.cwd(), staged.path) || staged.path}`,
      "",
      "  These do NOT count as coverage yet. Review them:",
      "",
      "    causeval review --list",
      "    causeval review --accept all        (or --accept <id>,<id>)",
      "    causeval review --reject <id>",
      "",
      "  Edit any case in the staging file before accepting it.",
      "",
    ].join("\n"),
  );
}

async function runReview(options: {
  config: string;
  list?: boolean;
  accept?: string;
  reject?: string;
}) {
  const { config, cwd } = await loadConfig(options.config);
  const path = resolve(cwd, config.generate.stagingFile);
  const staged = await readSuite(path);
  if (!staged.length)
    throw new Error(
      `No generated cases found at ${config.generate.stagingFile}. Run "causeval generate" first.`,
    );
  const apply = (list: string | undefined, review: "accepted" | "rejected") => {
    if (!list) return 0;
    const wanted = list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const all = wanted.includes("all");
    const unknown = all
      ? []
      : wanted.filter((id) => !staged.some((e) => e.id === id));
    if (unknown.length)
      throw new Error(
        `Unknown generated eval id(s): ${unknown.join(", ")}. Run "causeval review --list" to see the available ids.`,
      );
    let changed = 0;
    for (const item of staged)
      if (item.causeval && (all || wanted.includes(item.id))) {
        item.causeval.review = review;
        changed++;
      }
    return changed;
  };
  const accepted = apply(options.accept, "accepted");
  const rejected = apply(options.reject, "rejected");
  if (accepted || rejected) {
    await save(path, STAGING_HEADER + stringify({ version: 1, evals: staged }));
    const written = await writeAccepted(config, cwd, staged);
    console.log(
      `\n  Accepted ${accepted}, rejected ${rejected}.` +
        (written.count
          ? `\n  ${written.count} accepted case(s) written to ${relative(process.cwd(), written.path) || written.path}.`
          : "\n  No accepted cases remain, so the accepted suite file was removed.") +
        "\n  Re-run causeval scan (or verify) to include them in coverage.\n",
    );
    return;
  }
  const counts = { unreviewed: 0, accepted: 0, rejected: 0 };
  console.log("\n  GENERATED - UNREVIEWED candidates\n");
  for (const item of staged) {
    const review = item.causeval?.review ?? "unreviewed";
    counts[review]++;
    console.log(
      `  [${review.toUpperCase().padEnd(10)}] ${item.id}\n     rule ${item.causeval?.ruleId ?? "?"} · ${describeDimension(item.causeval!.dimension)}\n     input: ${(item.input ?? "").slice(0, 96)}\n     why:   ${(item.causeval?.rationale ?? "").slice(0, 96)}\n`,
    );
  }
  console.log(
    `  ${counts.unreviewed} unreviewed · ${counts.accepted} accepted · ${counts.rejected} rejected`,
  );
  console.log(
    `  Only accepted cases count as coverage. Edit ${relative(process.cwd(), path) || path} before accepting.\n`,
  );
}

function chips(passes: number, runs: number) {
  return Array.from({ length: runs }, (_, i) =>
    i < passes ? "PASS" : "FAIL",
  ).join(" ");
}
async function runDemo(options: { dir?: string; quiet?: boolean }) {
  const cwd = resolve(options.dir ?? ".causeval-demo");
  const config = ConfigSchema.parse({
    provider: { type: "fixture" },
    prompt: "./prompts/system.md",
    evals: ["./evals/*.yaml"],
  });
  await save(resolve(cwd, "prompts/system.md"), fixturePrompt + "\n");
  await save(
    resolve(cwd, "evals/example.yaml"),
    stringify({ version: 1, evals: fixtureEvals }),
  );
  await save(resolve(cwd, "causeval.config.ts"), INIT_CONFIG);
  const provider = new FixtureProvider();
  const report = await analyze({
    prompt: fixturePrompt,
    evals: fixtureEvals,
    provider,
    runner: new FixtureRunner(),
    config,
    verify: true,
    name: "CausEval demo - Aura support agent",
    file: "prompts/system.md",
    evalFiles: ["evals/example.yaml"],
  });
  report.suggestions = await suggestEvals(report, provider, config);
  const safe = await artifacts(report, config, cwd);
  if (options.quiet) return;
  print(safe);
  const show = (
    classification: string,
    heading: string,
    explanation: string,
  ) => {
    const result = safe.causalResults.find(
      (c) => c.classification === classification,
    );
    if (!result) return;
    const rule = safe.rules.find((r) => r.id === result.ruleId)!;
    console.log(
      [
        "",
        `  ${heading}`,
        `  ${"─".repeat(52)}`,
        `  RULE              ${rule.id}  ${rule.expectedBehavior}`,
        `                    ${rule.source.file}:${rule.source.lineStart}`,
        ...(result.baseline.runs
          ? [
              "",
              `  BASELINE          ${chips(result.baseline.passes, result.baseline.runs)}   ${result.baseline.passes}/${result.baseline.runs}`,
              "                          ↓  remove this rule from the prompt",
              `  MUTANT            ${chips(result.mutant.passes, result.mutant.runs)}   ${result.mutant.passes}/${result.mutant.runs}`,
              "",
              `  DETECTION EFFECT  ${Math.round(result.detectionRate * 100)}%   →  ${classification.toUpperCase()}`,
            ]
          : ["", `  RESULT            ${classification.toUpperCase()}`]),
        "",
        ...explanation.split("\n").map((l) => "  " + l),
      ].join("\n"),
    );
  };
  show(
    "causally-covered",
    "CAUSALLY COVERED — the eval depends on the rule",
    "Removing the instruction made the mapped eval fail. This behavior has\nregression protection under the tested model and configuration.",
  );
  show(
    "pseudo-covered",
    "PSEUDO-COVERED — the eval looked related but did not notice",
    "The existing eval did not detect removal of this behavioral instruction.\nEither the eval never creates a violation opportunity, or the model keeps\nthe behavior without being told. CausEval cannot tell those apart.",
  );
  show(
    "uncovered",
    "UNCOVERED — no eval maps to this rule at all",
    "No eval in the suite can falsify this rule, so no experiment was run.\nRun causeval generate to draft candidate cases for it.",
  );
  console.log(
    [
      "",
      `  Full report: ${resolve(cwd, config.output.html)}`,
      `  Editable copy of the demo project: ${cwd}`,
      "",
      "  This is a deterministic fixture, not a model benchmark: the responses are",
      "  fixed so the mechanics are reproducible without an API key.",
      "",
    ].join("\n"),
  );
}

function printDiff(before: Report, after: Report) {
  if (before.warnings.length) {
    console.log("  Base analysis warnings:");
    printWarnings(before);
  }
  if (after.warnings.length) {
    console.log("  Current analysis warnings:");
    printWarnings(after);
  }
  const d = diffReports(before, after);
  const pct = (n: number) =>
    `${n >= 0 ? "+" : ""}${Math.round(n * 1000) / 10}%`;
  const lines = ["", "  BEHAVIORAL CONTRACT DIFF", "  " + "─".repeat(52)];
  if (d.newHighRiskUncovered.length)
    lines.push(
      "",
      `  ${d.newHighRiskUncovered.length} new high-risk rule(s) introduced without eval coverage:`,
      ...d.newHighRiskUncovered.map(
        (r) => `    [${r.severity.toUpperCase()}] ${r.expectedBehavior}`,
      ),
    );
  const otherNew = d.newUncovered.filter(
    (r) => !["high", "critical"].includes(r.severity),
  );
  if (otherNew.length)
    lines.push(
      "",
      `  ${otherNew.length} other rule(s) newly without coverage:`,
      ...otherNew.map(
        (r) => `    [${r.severity.toUpperCase()}] ${r.expectedBehavior}`,
      ),
    );
  if (d.newlyUnprotected.length)
    lines.push(
      "",
      `  ${d.newlyUnprotected.length} rule(s) lost causal protection:`,
      ...d.newlyUnprotected.map((r) => `    ${r.id} ${r.expectedBehavior}`),
    );
  if (
    !d.newHighRiskUncovered.length &&
    !otherNew.length &&
    !d.newlyUnprotected.length
  )
    lines.push("", "  No new uncovered or unprotected behaviors.");
  lines.push(
    "",
    `  Rules       +${d.added.length} / -${d.removed.length} (${d.unchanged} unchanged)`,
    `  Trace       ${Math.round(before.summary.traceCoverage * 100)}% → ${Math.round(after.summary.traceCoverage * 100)}%  ${pct(d.traceDelta)}`,
    d.causalDelta === null
      ? "  CRC         not comparable (one side was not verified)"
      : `  CRC         ${Math.round(before.summary.causalCoverage! * 100)}% → ${Math.round(after.summary.causalCoverage! * 100)}%  ${pct(d.causalDelta)}`,
    "",
    "  " + d.note,
    "",
  );
  console.log(lines.join("\n"));
  return d;
}
function addRunOptions(command: Command) {
  return command
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--no-cache", "Bypass the analysis cache")
    .option("--suggest", "Also draft candidate evals for missing dimensions")
    .option("--emit-outputs <path>", "Write a machine-readable summary JSON")
    .option("--fail-on <policy>", "threshold or never", "never")
    .option("--quiet", "Suppress output")
    .option("--verbose", "Detailed progress and cache hits")
    .option("--debug", "Alias for --verbose; no secret dumps");
}

export function createProgram() {
  const program = new Command()
    .name("causeval")
    .description(
      "Code has coverage. Your prompts should too.\nMeasures whether your evals detect controlled removal of behavioral instructions.",
    )
    .version(CAUSEVAL_VERSION);
  program
    .command("demo")
    .description("Run the bundled example end to end. No API key, no config.")
    .option("--dir <path>", "Where to write the demo project", ".causeval-demo")
    .option("--quiet", "Suppress output")
    .action((options) => runDemo(options));
  program
    .command("init")
    .description("Create a runnable CausEval project in this directory")
    .option("--dir <path>", "Destination directory", ".")
    .option(
      "--prompt-only",
      "Start from a system prompt with no eval suite yet",
      false,
    )
    .action((options) => initProject(options.dir, Boolean(options.promptOnly)));
  addRunOptions(
    program
      .command("scan")
      .description(
        "Extract behavioral rules, map them to your evals and measure Trace Coverage",
      ),
  ).action((options) => {
    if (!["threshold", "never"].includes(options.failOn))
      throw new Error("--fail-on must be threshold or never.");
    return run("scan", options);
  });
  addRunOptions(
    program
      .command("verify")
      .description(
        "Remove each rule in turn, re-run its mapped evals and measure Causal Rule Coverage",
      ),
  )
    .option("--strict", "Re-extract each mutant to validate mutation integrity")
    .option("--runs <count>", "Repetitions per mapped eval (minimum 2)")
    .option("--mutation <type>", "removal or boundary")
    .option(
      "--runner <command>",
      "Local command that executes your evals; never auto-discovered",
    )
    .action((options) => {
      if (!["threshold", "never"].includes(options.failOn))
        throw new Error("--fail-on must be threshold or never.");
      if (
        options.mutation &&
        !["removal", "boundary"].includes(options.mutation)
      )
        throw new Error("--mutation must be removal or boundary.");
      return run("verify", options);
    });
  program
    .command("generate")
    .description(
      "Draft candidate evals for the dimensions your rules are missing",
    )
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--no-cache", "Bypass the analysis cache")
    .option("--rules <ids>", "Comma-separated rule IDs to target")
    .option("--quiet", "Suppress output")
    .option("--verbose", "Detailed progress")
    .action((options) => runGenerate(options));
  program
    .command("review")
    .description("List, accept or reject generated eval candidates")
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--list", "List candidates and their review state")
    .option("--accept <ids>", 'Comma-separated ids, or "all"')
    .option("--reject <ids>", 'Comma-separated ids, or "all"')
    .action((options) => runReview(options));
  program
    .command("report")
    .description("Re-render the stored JSON report as standalone HTML")
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--open", "Open the report in your browser")
    .action(async (options) => {
      const { config, cwd } = await loadConfig(options.config);
      const path = resolve(cwd, config.output.json);
      if (!(await exists(path)))
        throw new Error(
          `No report at ${config.output.json}. Run causeval scan or causeval verify first.`,
        );
      const report = ReportSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
      await artifacts(report, config, cwd);
      const html = resolve(cwd, config.output.html);
      console.log("Report: " + html);
      if (options.open) openInBrowser(html);
    });
  program
    .command("badge")
    .description("Write a static SVG badge from the stored report")
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--metric <name>", "crc or trace", "crc")
    .option("--out <path>", "Output file")
    .action(async (options) => {
      if (!["crc", "trace"].includes(options.metric))
        throw new Error("--metric must be crc or trace.");
      const { config, cwd } = await loadConfig(options.config);
      const report = ReportSchema.parse(
        JSON.parse(await readFile(resolve(cwd, config.output.json), "utf8")),
      );
      const out = resolve(
        cwd,
        options.out ??
          (options.metric === "trace"
            ? ".causeval/badge-trace.svg"
            : ".causeval/badge.svg"),
      );
      await save(out, renderBadge(report, options.metric));
      console.log("Badge: " + out);
    });
  program
    .command("diff")
    .description("Compare two JSON reports, or the prompt at two Git refs")
    .argument("<before>")
    .argument("<after>")
    .option("-c, --config <path>", "Configuration file", "causeval.config.ts")
    .option("--json", "Print the raw diff as JSON")
    .action(async (before: string, after: string, options) => {
      const [a, b] = await loadDiffReports(before, after, options.config);
      const result = printDiff(a, b);
      if (options.json) console.log(JSON.stringify(result, null, 2));
    });
  return program;
}

function openInBrowser(path: string) {
  const url = pathToFileURL(path).href;
  const command =
    process.platform === "win32"
      ? "rundll32"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.on("error", () =>
    console.error(
      "Could not open a browser. Open the printed report path manually.",
    ),
  );
  child.unref();
}
async function loadDiffReports(
  before: string,
  after: string,
  configPath: string,
): Promise<[Report, Report]> {
  if (before.endsWith(".json") && after.endsWith(".json")) {
    const [a, b] = await Promise.all(
      [before, after].map(async (path) =>
        ReportSchema.parse(JSON.parse(await readFile(resolve(path), "utf8"))),
      ),
    );
    return [a, b];
  }
  const { config, cwd } = await loadConfig(configPath);
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const promptPath = relative(root, resolve(cwd, config.prompt)).replaceAll(
    "\\",
    "/",
  );
  if (promptPath.startsWith("..") || isAbsolute(promptPath))
    throw new Error(
      "The system prompt must be inside the Git repository to compare refs.",
    );
  const { evals, evalFiles } = await inputs(config, cwd, {
    requireEvals: true,
  });
  const llm = makeProvider(config, cwd, true);
  const reports: Report[] = [];
  for (const ref of [before, after]) {
    if (ref.startsWith("-") || !ref.trim()) throw new Error("Invalid Git ref.");
    let commit: string;
    try {
      commit = execFileSync(
        "git",
        ["rev-parse", "--verify", "--end-of-options", ref + "^{commit}"],
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch {
      throw new Error(
        `Cannot resolve Git ref ${ref}. Fetch the base branch (fetch-depth: 0 in CI), check the ref with git log, or compare two saved report JSON files.`,
      );
    }
    const prompt = execFileSync("git", ["show", `${commit}:${promptPath}`], {
      cwd,
      encoding: "utf8",
    });
    reports.push(
      await analyze({
        prompt,
        evals,
        evalFiles,
        provider: llm,
        config,
        name: ref,
        file: promptPath,
      }),
    );
  }
  return reports.map((report) =>
    ReportSchema.parse(
      JSON.parse(serializeReport(report, secretValues(config))),
    ),
  ) as [Report, Report];
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
) {
  createProgram()
    .parseAsync()
    .catch((error) => {
      const secrets = Object.entries(process.env)
        .filter(([k]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k))
        .map(([, v]) => v ?? "");
      console.error(
        "\nCausEval: " +
          redact(
            error instanceof Error ? error.message : String(error),
            secrets,
          ) +
          "\n",
      );
      process.exitCode = 2;
    });
}
