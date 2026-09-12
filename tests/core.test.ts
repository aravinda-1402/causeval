import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  RuleSchema,
  ReportSchema,
  FixtureProvider,
  FixtureRunner,
  fixturePrompt,
  fixtureEvals,
  extractRules,
  mapRules,
  analyze,
  analyzeGaps,
  findRedundancies,
  requiredDimensions,
  validateSource,
  stableKey,
  hash,
  wilson,
  classify,
  loadEvalText,
  checkGates,
  diffReports,
  serializeReport,
  renderHTML,
  renderBadge,
  renderMarkdown,
  suggestEvals,
} from "../packages/core/src/index.js";
const config = ConfigSchema.parse({ provider: { type: "fixture" } });
const provider = new FixtureProvider();
const example = () =>
  analyze({
    prompt: fixturePrompt,
    evals: fixtureEvals,
    provider,
    runner: new FixtureRunner(),
    config,
    verify: true,
  });

describe("schemas and deterministic identity", () => {
  it("has safe defaults and refuses single-run causal claims", () => {
    expect(config.causal.runsPerEval).toBe(3);
    expect(config.provider.temperature).toBe(0);
    expect(() => ConfigSchema.parse({ causal: { runsPerEval: 1 } })).toThrow();
    expect(() =>
      ConfigSchema.parse({ thresholds: { mappingConfidence: 1.1 } }),
    ).toThrow();
  });
  it("validates rules", () => {
    expect(() => RuleSchema.parse({ id: "R01" })).toThrow();
  });
  it("stable keys normalize punctuation, case and whitespace, not conditions", () => {
    expect(stableKey("Never reveal passwords.")).toBe(
      stableKey("NEVER  reveal passwords"),
    );
    expect(stableKey("Refund", "over 100")).not.toBe(
      stableKey("Refund", "over 1000"),
    );
  });
  it("cache hashes are canonical and content-sensitive", () => {
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
    expect(hash({ model: "a" })).not.toBe(hash({ model: "b" }));
  });
  it("reports a wide interval for small samples and never exceeds [0,1]", () => {
    const [low, high] = wilson(3, 3);
    expect(low).toBeLessThan(0.9);
    expect(high).toBe(1);
    expect(wilson(0, 0)).toEqual([0, 1]);
    expect(wilson(5, 10)[0]).toBeGreaterThan(0.2);
  });
});
describe("eval loading", () => {
  it("loads YAML and JSON", () => {
    expect(
      loadEvalText(
        JSON.stringify({ version: 1, evals: fixtureEvals }),
        "x.json",
      ),
    ).toHaveLength(9);
    expect(
      loadEvalText(
        "version: 1\nevals:\n  - id: a\n    input: Hello\n    expected:\n      behavior: Answer",
      ),
    ).toHaveLength(1);
  });
  it("rejects invalid syntax, empty suites, no inputs and duplicates", () => {
    for (const text of [
      "[bad: [",
      "version: 1\nevals: []",
      JSON.stringify({
        version: 1,
        evals: [{ id: "a", expected: { behavior: "x" } }],
      }),
      JSON.stringify({ version: 1, evals: [fixtureEvals[0], fixtureEvals[0]] }),
    ])
      expect(() => loadEvalText(text)).toThrow();
  });
  it("refuses a judge-free eval that declares no deterministic assertion", () => {
    expect(() =>
      loadEvalText(
        JSON.stringify({
          version: 1,
          evals: [
            {
              id: "a",
              input: "hi",
              expected: { behavior: "x", judge: false },
            },
          ],
        }),
        "x.json",
      ),
    ).toThrow(/deterministic assertion/);
  });
});

describe("extraction", () => {
  it("preserves exact source and global line numbers", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    expect(rules).toHaveLength(12);
    expect(rules[0].source.lineStart).toBe(7);
    expect(rules[1].source.lineStart).toBe(8);
    expect(rules[2].source.lineStart).toBe(8);
    expect(rules.every((r) => validateSource(fixturePrompt, r))).toBe(true);
    expect(new Set(rules.map((r) => r.stableKey)).size).toBe(12);
  });
  it("rejects fabricated source and invalid ranges", async () => {
    const rule = (await extractRules(fixturePrompt, provider))[0];
    expect(
      validateSource(fixturePrompt, {
        ...rule,
        source: { ...rule.source, exactQuote: "invented" },
      }),
    ).toBe(false);
    expect(
      validateSource(fixturePrompt, {
        ...rule,
        source: { ...rule.source, lineEnd: 999 },
      }),
    ).toBe(false);
  });
});
describe("dimension gaps and redundancy", () => {
  it("requires boundary cases only for threshold rules and adversarial for risky ones", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const refund = rules.find((r) => r.type === "boundary")!;
    const format = rules.find((r) => r.type === "output_constraint")!;
    expect(requiredDimensions(refund)).toContain("boundary");
    expect(requiredDimensions(refund)).toContain("adversarial");
    expect(requiredDimensions(format)).toEqual([
      "positivePath",
      "negativePath",
    ]);
  });
  it("names the missing dimensions rather than only a score", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const mappings = await mapRules(rules, fixtureEvals, provider, config);
    const gaps = analyzeGaps(rules, mappings, 0.7);
    const refund = gaps.find(
      (g) => g.ruleId === rules.find((r) => r.type === "boundary")!.id,
    )!;
    expect(refund.coveredDimensions).toContain("boundary");
    expect(refund.missingDimensions).toContain("adversarial");
    expect(refund.reason).toMatch(/missing adversarial/);
    const unmapped = gaps.find((g) => g.ruleId === "R03")!;
    expect(unmapped.missingDimensions.length).toBeGreaterThan(0);
    expect(unmapped.reason).toMatch(/No credible eval/);
  });
  it("flags an overlapping rule pair without changing its classification", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const overlaps = await findRedundancies(rules, provider);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].ruleId).toBe("R09");
    expect(overlaps[0].overlapsWithRuleId).toBe("R08");
    const report = await example();
    const result = report.causalResults.find((c) => c.ruleId === "R09")!;
    expect(result.classification).toBe("pseudo-covered");
    expect(result.confounders.map((c) => c.kind)).toContain(
      "possible-redundancy",
    );
    expect(
      result.confounders.find((c) => c.kind === "possible-redundancy")!.detail,
    ).toContain("POSSIBLE REDUNDANCY");
  });
  it("attaches the model-prior confound to every pseudo-covered result", async () => {
    const report = await example();
    for (const result of report.causalResults.filter(
      (c) => c.classification === "pseudo-covered",
    ))
      expect(result.confounders.map((c) => c.kind)).toContain("model-prior");
  });
});

describe("coverage classification", () => {
  it.each([
    [[1, 1, 1], [0, 0, 0], "causally-covered"],
    [[1, 1, 1], [1, 1, 1], "pseudo-covered"],
    [[1, 0, 0], [0, 0, 0], "flaky"],
    [[1, 1, 1], [1, 1, 0], "indeterminate"],
    [[1], [0], "indeterminate"],
  ] as const)("classifies %j / %j", (base, mutant, expected) => {
    expect(classify([...base], [...mutant], config.causal)).toBe(expected);
  });
  it("computes the complete evidence chain without invented metrics", async () => {
    const report = await example();
    expect(report.summary).toMatchObject({
      maturity: "prompt-evals-and-runner",
      evalSuiteDetected: true,
      totalRules: 12,
      totalEvals: 9,
      traceCoverage: 0.75,
      causallyCovered: 5,
      pseudoCovered: 4,
      uncovered: 3,
      flaky: 0,
      indeterminate: 0,
      highRiskUnprotected: 5,
      baselinePassRate: 1,
    });
    expect(report.summary.causalCoverage).toBeCloseTo(5 / 12, 10);
    const email = report.causalResults.find((c) => c.ruleId === "R06")!;
    expect(email.evidence).toHaveLength(6);
    expect(email.baseline.passes).toBe(3);
    expect(email.mutant.passes).toBe(3);
    expect(email.perEval).toEqual([
      {
        evalId: "email-confirmation",
        baselinePasses: 3,
        baselineRuns: 3,
        mutantPasses: 3,
        mutantRuns: 3,
      },
    ]);
    expect(email.thresholds).toEqual({
      minimumBaselinePassRate: 0.8,
      minimumDetectionEffect: 0.5,
      pseudoCoverageCeiling: 0.1,
    });
  });
  it("words pseudo-coverage as a limit of the experiment, not a verdict on the eval", async () => {
    const report = await example();
    const pseudo = report.causalResults.find(
      (c) => c.classification === "pseudo-covered",
    )!;
    expect(pseudo.interpretation).toContain("did not detect removal");
    expect(pseudo.interpretation).toContain("deterministic-support-v1");
    expect(pseudo.interpretation).not.toMatch(/definitely untested/i);
    expect(pseudo.interpretation).toContain("not proof");
  });
  it("records reproduction metadata without secrets", async () => {
    const report = await example();
    expect(report.run).toMatchObject({
      mode: "verify",
      provider: "fixture",
      model: "deterministic-support-v1",
      temperature: 0,
      seed: null,
      runsPerEval: 3,
      runner: { kind: "fixture", identity: "deterministic-support-v1" },
    });
    expect(report.run.promptHash).toMatch(/^sha256:[0-9a-f]{32}$/);
    expect(report.run.evalSuiteHash).toMatch(/^sha256:[0-9a-f]{32}$/);
    expect(report.run.causevalVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(JSON.stringify(report.run)).not.toMatch(/apiKey|sk-/);
  });
  it("strict mode validates unrelated rules", async () => {
    const strict = ConfigSchema.parse({
      provider: { type: "fixture" },
      causal: { strictMutationValidation: true },
    });
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider,
      runner: new FixtureRunner(),
      config: strict,
      verify: true,
    });
    expect(report.summary.causalCoverage).toBeCloseTo(5 / 12, 10);
  });
  it("scan does not claim CRC or label mapped rules pseudo-covered", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider,
      config,
    });
    expect(report.summary.causalCoverage).toBeNull();
    expect(report.summary.pseudoCovered).toBe(0);
    expect(report.summary.maturity).toBe("prompt-and-evals");
    expect(report.causalResults).toHaveLength(0);
  });
  it("execution errors become indeterminate, never mutation detections", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider,
      config,
      verify: true,
      runner: {
        run: async () => {
          throw new Error("runner broken");
        },
      },
    });
    expect(report.summary.causalCoverage).toBe(0);
    expect(report.summary.indeterminate).toBe(9);
    expect(report.run.runner).toEqual({ kind: "custom", identity: null });
    expect(
      report.warnings.filter((w) => w.includes("runner broken")),
    ).toHaveLength(9);
  });
});

describe("no eval suite", () => {
  it("scans a prompt with no evals instead of failing", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: [],
      provider,
      config,
    });
    expect(report.summary.maturity).toBe("prompt-only");
    expect(report.summary.evalSuiteDetected).toBe(false);
    expect(report.summary.totalRules).toBe(12);
    expect(report.summary.traceCoverage).toBe(0);
    expect(report.summary.severity).toEqual({
      critical: 3,
      high: 6,
      medium: 2,
      low: 1,
    });
    expect(report.warnings.join(" ")).toContain("causeval generate");
    expect(report.gaps.every((g) => g.missingDimensions.length > 0)).toBe(true);
  });
  it("refuses to verify without a reviewed eval and says what to do", async () => {
    await expect(
      analyze({
        prompt: fixturePrompt,
        evals: [],
        provider,
        config,
        verify: true,
        runner: new FixtureRunner(),
      }),
    ).rejects.toThrow(/causeval generate/);
    await expect(extractRules("", provider)).rejects.toThrow(/empty/);
  });
  it("names the empty suite in the gate reason", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: [],
      provider,
      config,
    });
    expect(checkGates(report, config).join(" ")).toContain(
      "No eval suite detected",
    );
  });
});
describe("manual overrides", () => {
  it("manual mappings override model decisions and validate IDs", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const custom = ConfigSchema.parse({
      overrides: { mappings: { [rules[0].stableKey]: ["email-confirmation"] } },
    });
    const mappings = await mapRules(rules, fixtureEvals, provider, custom);
    expect(mappings.filter((m) => m.ruleId === "R01")).toMatchObject([
      { evalId: "email-confirmation", manual: true },
    ]);
    custom.overrides.mappings[rules[0].stableKey] = ["missing"];
    await expect(
      mapRules(rules, fixtureEvals, provider, custom),
    ).rejects.toThrow(/unknown eval/);
  });
  it("a rejected mapping removes only that pair", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const custom = ConfigSchema.parse({
      overrides: {
        rejectedMappings: { [rules[0].stableKey]: ["identity-check"] },
      },
    });
    const mappings = await mapRules(rules, fixtureEvals, provider, custom);
    expect(mappings.some((m) => m.ruleId === "R01")).toBe(false);
    expect(mappings.some((m) => m.evalId === "ticket-privacy")).toBe(true);
    custom.overrides.rejectedMappings[rules[0].stableKey] = ["nope"];
    await expect(
      mapRules(rules, fixtureEvals, provider, custom),
    ).rejects.toThrow(/unknown eval/);
  });
  it("ignored rules leave the denominator and warn", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const custom = ConfigSchema.parse({
      provider: { type: "fixture" },
      overrides: { ignoredRules: [rules[2].stableKey] },
    });
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider,
      config: custom,
    });
    expect(report.summary.totalRules).toBe(11);
    expect(report.warnings.join(" ")).toContain(
      "excluded by manual stable-key",
    );
  });
});

describe("gates, reports and diffs", () => {
  it("detects gate failures with the measured numbers", async () => {
    const reasons = checkGates(await example(), config);
    expect(reasons.join(" ")).toContain("Causal Rule Coverage 42%");
    expect(reasons.join(" ")).toContain("below the 50% threshold");
  });
  it("round trips versioned JSON and renders escaped offline HTML", async () => {
    const report = await example();
    report.project.name = "<script>alert(1)</script>";
    const parsed = ReportSchema.parse(JSON.parse(serializeReport(report)));
    expect(parsed.schemaVersion).toBe("1.1");
    expect(parsed.summary.causalCoverage).toBeCloseTo(5 / 12, 10);
    const html = renderHTML(parsed);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("showModal");
    expect(html).toContain("Where this rule came from");
    expect(html).toContain("Why CausEval classified it this way");
    expect(html).toContain("Run metadata and reproduction");
    expect(renderBadge(parsed)).toContain("CRC 42%");
    expect(renderBadge(parsed, "trace")).toContain("Trace 75%");
    expect(renderBadge(parsed)).not.toMatch(/safe|certified|verified by/i);
  });
  it("serializes deterministically for the same input", async () => {
    const report = await example();
    report.project.generatedAt = "2026-01-01T00:00:00.000Z";
    report.run.startedAt = "2026-01-01T00:00:00.000Z";
    expect(serializeReport(report)).toBe(serializeReport(report));
    expect(renderHTML(report)).toBe(renderHTML(report));
  });
  it("markdown states when verification was skipped and never overclaims", async () => {
    const scan = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider,
      config,
    });
    const markdown = renderMarkdown(scan);
    expect(markdown).toContain("<!-- causeval-report -->");
    expect(markdown).toContain("Causal verification did not run");
    expect(markdown).toContain("testing evidence, not proof");
    expect(markdown).not.toMatch(/proves|guarantee|world's first/i);
  });
  it("redacts secrets from serialized reports", async () => {
    const report = await example();
    report.warnings.push("api_key=super-secret-value");
    expect(serializeReport(report)).not.toContain("super-secret-value");
  });
  it("leads a diff with new uncovered high-risk behavior, not the percentage", async () => {
    const before = await example();
    const after = structuredClone(before);
    // A newly added critical rule that no eval maps to.
    after.rules.push({
      ...after.rules[2],
      id: "R13",
      stableKey: "brand-new-critical-rule",
      expectedBehavior: "Never wire funds without a second approver.",
      severity: "critical",
    });
    const d = diffReports(before, after);
    expect(d.added).toHaveLength(1);
    expect(d.newHighRiskUncovered.map((r) => r.stableKey)).toEqual([
      "brand-new-critical-rule",
    ]);
    expect(diffReports(before, before).added).toHaveLength(0);
    expect(diffReports(before, before).newUncovered).toHaveLength(0);
  });
  it("suggests cases for every rule with a missing dimension", async () => {
    const report = await example();
    const suggestions = await suggestEvals(report, provider, config);
    expect(suggestions.length).toBeGreaterThan(10);
    expect(suggestions.every((s) => s.eval.causeval?.generated)).toBe(true);
    expect(
      suggestions.every((s) => s.eval.causeval?.review === "unreviewed"),
    ).toBe(true);
    expect(new Set(suggestions.map((s) => s.eval.id)).size).toBe(
      suggestions.length,
    );
    expect(
      suggestions.find(
        (s) => s.ruleId === "R05" && s.dimension === "adversarial",
      )?.eval.input,
    ).toContain("$400 refund");
  });
  it("asks for the boundary case when no eval covers the threshold", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: [],
      provider,
      config,
    });
    const suggestions = await suggestEvals(report, provider, config);
    const boundary = suggestions.find(
      (s) => s.ruleId === "R05" && s.dimension === "boundary",
    );
    expect(boundary?.eval.input).toContain("$101");
    expect(boundary?.reason).toContain("boundary");
  });
});
