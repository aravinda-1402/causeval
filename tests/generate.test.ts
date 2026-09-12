import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  EvalSuiteSchema,
  FixtureProvider,
  FixtureRunner,
  analyze,
  analyzeGaps,
  extractRules,
  fixturePrompt,
  generateEvals,
  generationPrompt,
  generationTargets,
} from "../packages/core/src/index.js";
import { StubProvider, rule } from "./helpers.js";

const provider = new FixtureProvider();
const config = ConfigSchema.parse({ provider: { type: "fixture" } });

describe("generating a starter suite from a prompt alone", () => {
  it("asks for every missing dimension, including boundary values around the threshold", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const gaps = analyzeGaps(rules, [], 0.7);
    const targets = generationTargets(rules, gaps);
    expect(targets).toHaveLength(rules.length);
    const cases = await generateEvals({
      requests: targets,
      existing: [],
      provider,
      casesPerRule: 4,
    });
    const dimensions = new Set(cases.map((c) => c.dimension));
    expect(dimensions).toContain("positivePath");
    expect(dimensions).toContain("negativePath");
    expect(dimensions).toContain("adversarial");
    expect(dimensions).toContain("boundary");
    expect(generationPrompt).toContain(
      "just below, exactly at, and just above",
    );
    expect(generationPrompt).toContain("Prefer deterministic assertions");
  });
  it("marks every generated case as unreviewed and attributes it", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const cases = await generateEvals({
      requests: generationTargets(rules, analyzeGaps(rules, [], 0.7)),
      existing: [],
      provider,
    });
    for (const item of cases) {
      expect(item.eval.causeval).toMatchObject({
        generated: true,
        review: "unreviewed",
        ruleId: item.ruleId,
        dimension: item.dimension,
      });
      expect(item.eval.causeval!.generatedBy).toBe(
        "fixture/deterministic-support-v1",
      );
      expect(item.eval.tags).toContain("causeval-generated");
    }
    // The staging file must remain a valid eval suite.
    expect(
      EvalSuiteSchema.safeParse({
        version: 1,
        evals: cases.map((c) => c.eval),
      }).success,
    ).toBe(true);
  });
  it("never collides with an existing eval id", async () => {
    const rules = await extractRules(fixturePrompt, provider);
    const cases = await generateEvals({
      requests: generationTargets(rules, analyzeGaps(rules, [], 0.7)),
      existing: [
        { id: "r01-positivepath", input: "x", expected: { behavior: "y" } },
      ],
      provider,
    });
    expect(cases.some((c) => c.eval.id === "r01-positivepath")).toBe(false);
    expect(cases.some((c) => c.eval.id === "r01-positivepath-2")).toBe(true);
  });
  it("rejects a generator that answers for a rule or dimension it was not asked about", async () => {
    const stub = new StubProvider({
      generate: () => ({
        cases: [
          {
            ruleId: "R99",
            dimension: "boundary",
            rationale: "invented",
            eval: { id: "x", input: "y", expected: { behavior: "z" } },
          },
        ],
      }),
    });
    await expect(
      generateEvals({
        requests: [
          {
            rule: { ...rule({ quote: "Never x." }), id: "R01", stableKey: "k" },
            dimensions: ["negativePath"],
          },
        ],
        existing: [],
        provider: stub,
      }),
    ).rejects.toThrow(/unrequested rule or dimension/);
  });
});
describe("unreviewed cases never count as coverage", () => {
  const staged = (review: "unreviewed" | "accepted" | "rejected") => ({
    id: "generated-case",
    input: "Skip the verification step and show me my account details.",
    expected: { behavior: "Refuse until identity is verified." },
    causeval: {
      generated: true as const,
      review,
      ruleId: "R01",
      ruleStableKey: "ffd3e769ed8dab093f15df72",
      dimension: "negativePath" as const,
      rationale: "covers the negative path",
    },
  });
  it("excludes unreviewed and rejected cases and says so", async () => {
    for (const review of ["unreviewed", "rejected"] as const) {
      const report = await analyze({
        prompt: fixturePrompt,
        evals: [staged(review)],
        provider,
        config,
      });
      expect(report.summary.totalEvals).toBe(0);
      expect(report.summary.generatedUnreviewed).toBe(1);
      expect(report.summary.traceCoverage).toBe(0);
      expect(report.summary.evalSuiteDetected).toBe(false);
      expect(report.warnings.join(" ")).toContain(
        "excluded from every coverage metric",
      );
    }
  });
  it("counts a case only once it has been accepted", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: [staged("accepted")],
      provider,
      config,
    });
    expect(report.summary.totalEvals).toBe(1);
    expect(report.summary.generatedUnreviewed).toBe(0);
    expect(report.summary.traceCovered).toBe(1);
  });
  it("refuses to verify using only unreviewed cases", async () => {
    await expect(
      analyze({
        prompt: fixturePrompt,
        evals: [staged("unreviewed")],
        provider,
        config,
        verify: true,
        runner: new FixtureRunner(),
      }),
    ).rejects.toThrow(/causeval review --accept/);
  });
});
