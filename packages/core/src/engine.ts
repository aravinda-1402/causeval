import {
  ConfigSchema,
  ReportSchema,
  type BehavioralRule,
  type Config,
  type CausalResult,
  type CoverageGap,
  type EvalCase,
  type Redundancy,
  type Report,
  type RuleEvalMapping,
} from "./schemas.js";
import { CAUSEVAL_VERSION, REPORT_SCHEMA_VERSION } from "./version.js";
import {
  analyzeGaps,
  extractRules,
  findRedundancies,
  mapRules,
  requiredDimensions,
} from "./analysis.js";
import { generateEvals, generationTargets } from "./generate.js";
import { fixturePrompt } from "./fixture.js";
import { mutatePrompt } from "./mutation.js";
import { hash, wilson } from "./utils.js";
import type { LLMProvider } from "./provider.js";
import type { EvalRunner } from "./runner.js";

export function credibleMappings(
  rule: BehavioralRule,
  mappings: RuleEvalMapping[],
  threshold: number,
) {
  return mappings.filter(
    (m) =>
      m.ruleId === rule.id &&
      m.relationship === "direct" &&
      m.confidence >= threshold,
  );
}
export function classify(
  baseline: number[],
  mutant: number[],
  config: Config["causal"],
): CausalResult["classification"] {
  if (baseline.length < 2 || mutant.length < 2) return "indeterminate";
  const b = baseline.reduce((a, v) => a + v, 0) / baseline.length;
  const m = mutant.reduce((a, v) => a + v, 0) / mutant.length;
  if (b < config.minimumBaselinePassRate) return "flaky";
  const effect = b - m;
  if (effect >= config.minimumDetectionEffect) return "causally-covered";
  if (effect <= config.pseudoCoverageCeiling) return "pseudo-covered";
  return "indeterminate";
}
/**
 * Plain-language statement of exactly what the evidence supports. Pseudo-
 * coverage deliberately says "this eval did not detect removal", never "this
 * rule is untested": a base model can keep the behavior without the
 * instruction, which the experiment cannot distinguish from a weak eval.
 */
export function interpret(
  result: CausalResult,
  config: Config["causal"],
  model: string,
): string {
  const b = Math.round(result.baseline.passRate * 100);
  const m = Math.round(result.mutant.passRate * 100);
  const effect = Math.round(result.detectionRate * 100);
  switch (result.classification) {
    case "causally-covered":
      return `Under ${model} at these settings, removing this instruction changed the mapped evals from ${b}% to ${m}% passing (detection effect ${effect}%, threshold ${Math.round(config.minimumDetectionEffect * 100)}%). The evals depend on the instruction.`;
    case "pseudo-covered":
      return `Under ${model} at these settings, this eval did not detect removal of this instruction: the mapped evals passed ${b}% of runs with it and ${m}% without it. That can mean the eval is too weak, or that the model keeps the behavior without being told. It is not proof the rule is untested.`;
    case "uncovered":
      return "No eval maps to this rule with enough confidence to run a mutation experiment, so no causal evidence exists.";
    case "flaky":
      return `Baseline pass rate was ${b}%, below the ${Math.round(config.minimumBaselinePassRate * 100)}% stability floor. An unstable baseline cannot support a causal claim in either direction.`;
    default:
      return result.reason
        ? `No causal conclusion: ${result.reason}`
        : `Detection effect ${effect}% fell between the pseudo-coverage ceiling (${Math.round(config.pseudoCoverageCeiling * 100)}%) and the detection threshold (${Math.round(config.minimumDetectionEffect * 100)}%). More runs are needed.`;
  }
}
const stats = (values: number[]) => {
  const passes = values.reduce((a, v) => a + v, 0);
  return {
    runs: values.length,
    passes,
    passRate: values.length ? passes / values.length : 0,
    interval: wilson(passes, values.length),
  };
};
export function calculateSummary(
  rules: BehavioralRule[],
  evals: EvalCase[],
  mappings: RuleEvalMapping[],
  results: CausalResult[],
  config: Config,
  verified: boolean,
  extras: {
    unreviewed?: number;
    redundancies?: Redundancy[];
    hasRunner?: boolean;
  } = {},
): Report["summary"] {
  const count = (s: string) =>
    results.filter((r) => r.classification === s).length;
  const mapped = rules.filter(
    (r) =>
      credibleMappings(r, mappings, config.thresholds.mappingConfidence).length,
  );
  const protectedIds = new Set(
    results
      .filter((r) => r.classification === "causally-covered")
      .map((r) => r.ruleId),
  );
  const baselineRuns = results.reduce((a, r) => a + r.baseline.runs, 0);
  const baselinePasses = results.reduce((a, r) => a + r.baseline.passes, 0);
  return {
    maturity: !evals.length
      ? "prompt-only"
      : extras.hasRunner
        ? "prompt-evals-and-runner"
        : "prompt-and-evals",
    evalSuiteDetected: evals.length > 0,
    totalRules: rules.length,
    totalEvals: evals.length,
    generatedUnreviewed: extras.unreviewed ?? 0,
    traceCovered: mapped.length,
    traceCoverage: rules.length ? mapped.length / rules.length : 0,
    causalCoverage: verified
      ? rules.length
        ? protectedIds.size / rules.length
        : 0
      : null,
    causallyCovered: count("causally-covered"),
    pseudoCovered: count("pseudo-covered"),
    uncovered: rules.length - mapped.length,
    flaky: count("flaky"),
    indeterminate: count("indeterminate"),
    highRiskUnprotected: rules.filter(
      (r) =>
        ["high", "critical"].includes(r.severity) &&
        (verified
          ? !protectedIds.has(r.id)
          : !mapped.some((m) => m.id === r.id)),
    ).length,
    untestedBoundaries: rules.filter(
      (r) =>
        requiredDimensions(r).includes("boundary") &&
        !credibleMappings(
          r,
          mappings,
          config.thresholds.mappingConfidence,
        ).some((m) => m.dimensions.boundary),
    ).length,
    possibleRedundancies: extras.redundancies?.length ?? 0,
    baselinePassRate: baselineRuns ? baselinePasses / baselineRuns : null,
    severity: {
      critical: rules.filter((r) => r.severity === "critical").length,
      high: rules.filter((r) => r.severity === "high").length,
      medium: rules.filter((r) => r.severity === "medium").length,
      low: rules.filter((r) => r.severity === "low").length,
    },
  };
}

export interface AnalyzeOptions {
  prompt: string;
  evals: EvalCase[];
  provider: LLMProvider;
  judge?: LLMProvider;
  runner?: EvalRunner;
  config?: Config;
  verify?: boolean;
  name?: string;
  file?: string;
  evalFiles?: string[];
  cache?: boolean;
  onProgress?: (message: string) => void;
}
/**
 * Runs the pipeline: extract the behavioral contract, map it to the eval suite
 * and, when verifying, remove one rule at a time and re-run the mapped evals.
 * A missing eval suite is a supported state, not an error: the contract and its
 * gaps are still reported so `causeval generate` has something to work from.
 */
export async function analyze(options: AnalyzeOptions): Promise<Report> {
  const config = options.config ?? ConfigSchema.parse({});
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const unreviewed = options.evals.filter(
    (e) => e.causeval?.generated && e.causeval.review !== "accepted",
  );
  const evals = options.evals.filter(
    (e) => !(e.causeval?.generated && e.causeval.review !== "accepted"),
  );
  if (unreviewed.length)
    warnings.push(
      `${unreviewed.length} generated eval(s) have not been accepted and are excluded from every coverage metric. Run causeval review to accept, edit or reject them.`,
    );
  if (options.verify && !evals.length)
    throw new Error(
      "Verification needs at least one reviewed eval. Run causeval generate, then causeval review --accept, or point config.evals at your suite.",
    );
  // The fixture only knows the bundled prompt. Without this, someone who runs
  // init, pastes in their real prompt and forgets to switch providers gets a
  // confident report about rules that were never in their file.
  if (options.provider.name === "fixture" && options.prompt !== fixturePrompt)
    warnings.push(
      "The bundled fixture provider only recognises the example prompt, so rules in your own prompt were not extracted. Set provider.type to your model (openai, anthropic, compatible or ollama) and configure a model to analyse this prompt.",
    );
  options.onProgress?.("Extracting behavioral rules");
  const extracted = await extractRules(options.prompt, options.provider, {
    file: options.file,
    maxChars: config.maxPromptChars,
    warnings,
  });
  const rules = extracted.filter(
    (r) => !config.overrides.ignoredRules.includes(r.stableKey),
  );
  if (extracted.length !== rules.length)
    warnings.push(
      `${extracted.length - rules.length} rules excluded by manual stable-key override; metrics use the remaining rules.`,
    );
  if (!rules.length)
    warnings.push(
      "No behavioral rules found. Coverage is 0%; review extraction and ignored rules.",
    );
  let mappings: RuleEvalMapping[] = [];
  if (!evals.length) {
    warnings.push(
      "No eval suite detected. Trace Coverage is 0% because there is nothing to map; run causeval generate to draft a starter suite.",
    );
  } else if (rules.length) {
    options.onProgress?.(
      `Mapping ${rules.length} rules to ${evals.length} evals`,
    );
    mappings = await mapRules(rules, evals, options.provider, config, warnings);
    if (
      !mappings.some(
        (m) =>
          m.relationship === "direct" &&
          m.confidence >= config.thresholds.mappingConfidence,
      )
    )
      warnings.push(
        "No credible direct mappings found. Review eval assertions or provide manual mappings.",
      );
  }
  let redundancies: Redundancy[] = [];
  if (config.redundancy.enabled && rules.length > 1) {
    try {
      options.onProgress?.("Checking for overlapping rules");
      redundancies = await findRedundancies(rules, options.provider);
    } catch (error) {
      warnings.push(
        `Redundancy analysis skipped: ${error instanceof Error ? error.message : "provider error"}.`,
      );
    }
  }
  const gaps: CoverageGap[] = analyzeGaps(
    rules,
    mappings,
    config.thresholds.mappingConfidence,
  );
  if (options.verify) {
    const mapped = rules.filter(
      (r) =>
        credibleMappings(r, mappings, config.thresholds.mappingConfidence)
          .length,
    );
    const executions =
      mapped.reduce(
        (total, rule) =>
          total +
          new Set(
            credibleMappings(
              rule,
              mappings,
              config.thresholds.mappingConfidence,
            ).map((m) => m.evalId),
          ).size,
        0,
      ) *
      2 *
      config.causal.runsPerEval;
    options.onProgress?.(
      `Verification plan: ${mapped.length} mapped rules x ${config.causal.runsPerEval} runs x 2 phases = ${executions} eval executions (each is one model call, plus one judge call unless the eval opts out)`,
    );
  }
  const results = options.verify
    ? await verifyRules({
        rules,
        evals,
        mappings,
        redundancies,
        config,
        prompt: options.prompt,
        provider: options.provider,
        runner: options.runner,
        warnings,
        onProgress: options.onProgress,
      })
    : [];
  return ReportSchema.parse({
    schemaVersion: REPORT_SCHEMA_VERSION,
    project: {
      name: options.name ?? "CausEval project",
      generatedAt: new Date().toISOString(),
      provider: options.provider.name,
      model: options.provider.model,
      fixture: options.provider.name === "fixture",
      verified: Boolean(options.verify),
      mappingConfidence: config.thresholds.mappingConfidence,
    },
    run: {
      causevalVersion: CAUSEVAL_VERSION,
      mode: options.verify ? "verify" : "scan",
      startedAt,
      promptFile: options.file ?? null,
      promptHash: "sha256:" + hash(options.prompt).slice(0, 32),
      evalFiles: options.evalFiles ?? [],
      evalSuiteHash: "sha256:" + hash(evals).slice(0, 32),
      provider: options.provider.name,
      model: options.provider.model,
      temperature: options.provider.temperature ?? config.provider.temperature,
      seed: options.provider.seed ?? null,
      judgeProvider: options.judge?.name ?? null,
      judgeModel: options.judge?.model ?? null,
      runner:
        options.runner?.describe?.() ??
        (options.runner
          ? { kind: "custom", identity: null }
          : { kind: "none", identity: null }),
      runsPerEval: config.causal.runsPerEval,
      thresholds: config.thresholds,
      causal: config.causal,
      cache: options.cache ?? true,
    },
    summary: calculateSummary(
      rules,
      evals,
      mappings,
      results,
      config,
      Boolean(options.verify),
      {
        unreviewed: unreviewed.length,
        redundancies,
        hasRunner: Boolean(options.runner),
      },
    ),
    rules,
    evals,
    mappings,
    causalResults: results,
    redundancies,
    gaps,
    warnings,
    suggestions: [],
  });
}

async function verifyRules(options: {
  rules: BehavioralRule[];
  evals: EvalCase[];
  mappings: RuleEvalMapping[];
  redundancies: Redundancy[];
  config: Config;
  prompt: string;
  provider: LLMProvider;
  runner?: EvalRunner;
  warnings: string[];
  onProgress?: (message: string) => void;
}): Promise<CausalResult[]> {
  const { config, rules, evals, mappings, warnings } = options;
  if (!options.runner) throw new Error("Verification requires an eval runner.");
  const results: CausalResult[] = [];
  for (const rule of rules) {
    const ids = [
      ...new Set(
        credibleMappings(
          rule,
          mappings,
          config.thresholds.mappingConfidence,
        ).map((m) => m.evalId),
      ),
    ];
    const baseline: number[] = [];
    const mutant: number[] = [];
    const evidence: NonNullable<CausalResult["evidence"]> = [];
    const result: CausalResult = {
      ruleId: rule.id,
      mappedEvalIds: ids,
      baseline: stats([]),
      mutant: { ...stats([]), mutationType: config.causal.mutationType },
      detectionRate: 0,
      classification: ids.length ? "indeterminate" : "uncovered",
      perEval: [],
      confounders: [],
      thresholds: {
        minimumBaselinePassRate: config.causal.minimumBaselinePassRate,
        minimumDetectionEffect: config.causal.minimumDetectionEffect,
        pseudoCoverageCeiling: config.causal.pseudoCoverageCeiling,
      },
      evidence,
    };
    if (!ids.length) {
      result.interpretation = interpret(
        result,
        config.causal,
        options.provider.model,
      );
      results.push(result);
      continue;
    }
    const tests = evals.filter((e) => ids.includes(e.id));
    try {
      const mutation = mutatePrompt(
        options.prompt,
        rule,
        config.causal.mutationType,
        rules,
      );
      result.diff = mutation.diff;
      if (config.causal.strictMutationValidation) {
        const mutantRules = await extractRules(
          mutation.prompt,
          options.provider,
          { maxChars: config.maxPromptChars },
        );
        const keys = new Set(mutantRules.map((r) => r.stableKey));
        if (
          keys.has(rule.stableKey) ||
          rules.some(
            (r) => r.stableKey !== rule.stableKey && !keys.has(r.stableKey),
          )
        )
          throw new Error(
            "Strict mutation validation failed: target remains or unrelated semantics changed.",
          );
      }
      for (const phase of ["baseline", "mutant"] as const) {
        for (let run = 1; run <= config.causal.runsPerEval; run++) {
          const outcomes = await options.runner.run(
            phase === "baseline" ? options.prompt : mutation.prompt,
            tests,
            `${rule.stableKey}-${phase}-${run}`,
          );
          if (
            outcomes.length !== tests.length ||
            new Set(outcomes.map((o) => o.id)).size !== tests.length ||
            tests.some((t) => !outcomes.some((o) => o.id === t.id)) ||
            outcomes.some((o) => typeof o.passed !== "boolean")
          )
            throw new Error("Runner returned incomplete or invalid outcomes.");
          evidence.push({ phase, run, outcomes });
          (phase === "baseline" ? baseline : mutant).push(
            ...outcomes.map((o) => (o.passed ? 1 : 0)),
          );
        }
      }
      result.baseline = stats(baseline);
      result.mutant = {
        ...stats(mutant),
        mutationType: config.causal.mutationType,
      };
      result.detectionRate = result.baseline.passRate - result.mutant.passRate;
      result.perEval = tests.map((test) => {
        const passes = (phase: "baseline" | "mutant") =>
          evidence
            .filter((e) => e.phase === phase)
            .flatMap((e) => e.outcomes)
            .filter((o) => o.id === test.id);
        const b = passes("baseline");
        const m = passes("mutant");
        return {
          evalId: test.id,
          baselinePasses: b.filter((o) => o.passed).length,
          baselineRuns: b.length,
          mutantPasses: m.filter((o) => o.passed).length,
          mutantRuns: m.length,
        };
      });
      result.classification = classify(baseline, mutant, config.causal);
      // One unstable mapped eval must not disappear inside an aggregate of easy tests.
      if (
        result.perEval.some(
          (e) =>
            e.baselineRuns &&
            e.baselinePasses / e.baselineRuns <
              config.causal.minimumBaselinePassRate,
        )
      )
        result.classification = "flaky";
    } catch (error) {
      result.classification = "indeterminate";
      result.reason =
        error instanceof Error ? error.message : "Verification failed";
      result.baseline = stats(baseline);
      result.mutant = {
        ...stats(mutant),
        mutationType: config.causal.mutationType,
      };
      warnings.push(`${rule.id}: ${result.reason}`);
    }
    if (result.classification === "pseudo-covered") {
      result.confounders.push({
        kind: "model-prior",
        detail: `The model may follow this behavior from training even without the instruction. This experiment cannot separate a weak eval from a strong model prior; it shows only that ${options.provider.model} kept passing without the rule.`,
      });
      for (const overlap of options.redundancies.filter(
        (r) => r.ruleId === rule.id,
      ))
        result.confounders.push({
          kind: "possible-redundancy",
          detail: `POSSIBLE REDUNDANCY: ${overlap.overlapsWithRuleId} may still enforce this behavior after removal (${overlap.rationale}). Removing both together would be a stronger test.`,
        });
    }
    result.interpretation = interpret(
      result,
      config.causal,
      options.provider.model,
    );
    results.push(result);
    options.onProgress?.(
      `${rule.id} ${result.classification}` +
        (result.baseline.runs
          ? ` (baseline ${result.baseline.passes}/${result.baseline.runs}, mutant ${result.mutant.passes}/${result.mutant.runs})`
          : ""),
    );
  }
  return results;
}

/**
 * Drafts evals for the dimensions a rule is missing. Works with an empty suite
 * (every dimension is missing) and after verification (pseudo-covered and
 * uncovered rules first). Results are always unreviewed candidates.
 */
export async function suggestEvals(
  report: Report,
  provider: LLMProvider,
  config?: Config,
): Promise<Report["suggestions"]> {
  const weak = new Set(
    report.causalResults
      .filter((c) =>
        ["uncovered", "pseudo-covered", "flaky"].includes(c.classification),
      )
      .map((c) => c.ruleId),
  );
  const targets = generationTargets(report.rules, report.gaps).filter(
    (t) =>
      weak.has(t.rule.id) ||
      !report.mappings.some(
        (m) =>
          m.ruleId === t.rule.id &&
          m.relationship === "direct" &&
          m.confidence >= report.project.mappingConfidence,
      ) ||
      t.dimensions.length > 0,
  );
  return generateEvals({
    requests: targets,
    existing: report.evals,
    provider,
    casesPerRule: config?.generate.casesPerRule,
  });
}
export function checkGates(report: Report, config: Config): string[] {
  const reasons: string[] = [];
  if (!report.summary.totalRules) reasons.push("No behavioral rules found");
  if (!report.summary.evalSuiteDetected)
    reasons.push(
      "No eval suite detected: Trace Coverage is 0% because there is nothing to map",
    );
  else if (
    report.summary.traceCoverage < config.thresholds.minimumTraceCoverage
  )
    reasons.push(
      `Trace Coverage ${Math.round(report.summary.traceCoverage * 100)}% is below the ${Math.round(config.thresholds.minimumTraceCoverage * 100)}% threshold`,
    );
  if (
    report.project.verified &&
    (report.summary.causalCoverage ?? 0) <
      config.thresholds.minimumCausalCoverage
  )
    reasons.push(
      `Causal Rule Coverage ${Math.round((report.summary.causalCoverage ?? 0) * 100)}% is below the ${Math.round(config.thresholds.minimumCausalCoverage * 100)}% threshold`,
    );
  if (
    report.summary.highRiskUnprotected >
    config.thresholds.maximumHighRiskUncovered
  )
    reasons.push(
      `${report.summary.highRiskUnprotected} high-risk rules are unprotected (limit ${config.thresholds.maximumHighRiskUncovered})`,
    );
  if (report.summary.indeterminate || report.summary.flaky)
    reasons.push(
      `Verification produced ${report.summary.flaky} flaky and ${report.summary.indeterminate} indeterminate results`,
    );
  return reasons;
}
/**
 * Compares two reports. New unprotected high-risk behavior matters more than a
 * percentage moving, so regressions are reported first and separately.
 */
export function diffReports(before: Report, after: Report) {
  const key = (r: BehavioralRule) => r.stableKey;
  const added = after.rules.filter(
    (r) => !before.rules.some((b) => key(b) === key(r)),
  );
  const removed = before.rules.filter(
    (r) => !after.rules.some((a) => key(a) === key(r)),
  );
  const isCovered = (report: Report, stableKey: string) => {
    const rule = report.rules.find((r) => r.stableKey === stableKey);
    return rule
      ? report.mappings.some(
          (m) =>
            m.ruleId === rule.id &&
            m.relationship === "direct" &&
            m.confidence >= report.project.mappingConfidence,
        )
      : false;
  };
  const isProtected = (report: Report, stableKey: string) => {
    const rule = report.rules.find((r) => r.stableKey === stableKey);
    return rule
      ? report.causalResults.some(
          (c) =>
            c.ruleId === rule.id && c.classification === "causally-covered",
        )
      : false;
  };
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const newUncovered = after.rules
    .filter(
      (r) =>
        !isCovered(after, r.stableKey) &&
        (added.some((a) => a.stableKey === r.stableKey) ||
          isCovered(before, r.stableKey)),
    )
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const newlyUnprotected =
    before.project.verified && after.project.verified
      ? after.rules.filter(
          (r) =>
            isProtected(before, r.stableKey) &&
            !isProtected(after, r.stableKey),
        )
      : [];
  return {
    added,
    removed,
    unchanged: after.rules.length - added.length,
    newUncovered,
    newHighRiskUncovered: newUncovered.filter((r) =>
      ["high", "critical"].includes(r.severity),
    ),
    newlyUnprotected,
    traceDelta: after.summary.traceCoverage - before.summary.traceCoverage,
    causalDelta:
      before.summary.causalCoverage !== null &&
      after.summary.causalCoverage !== null
        ? after.summary.causalCoverage - before.summary.causalCoverage
        : null,
    note: "Changed wording appears as added/removed unless normalized semantics match. No uncertain semantic equivalence is assumed.",
  };
}
