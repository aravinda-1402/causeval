import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  analyze,
  extractRules,
  loadEvalText,
  mutatePrompt,
  stableKey,
  validateSource,
} from "../packages/core/src/index.js";
import { StubProvider, rule } from "./helpers.js";

const config = ConfigSchema.parse({});
const extractor = (build: (input: string) => Array<ReturnType<typeof rule>>) =>
  new StubProvider({ extract: (o) => ({ rules: build(o.input) }) });
/** Numbered source lines the extractor receives, keyed by 1-based line. */
const lineOf = (input: string, needle: string) =>
  Number(
    input
      .split("\n")
      .find((l) => l.includes(needle))!
      .split("|")[0]
      .trim(),
  );

describe("difficult prompts", () => {
  it("an empty prompt is refused with an actionable message", async () => {
    await expect(
      extractRules(
        "   \n\n ",
        extractor(() => []),
      ),
    ).rejects.toThrow(/at least one testable behavioral instruction/);
  });
  it("a prompt with no testable rule yields zero rules and a warning, not a crash", async () => {
    const report = await analyze({
      prompt: "You are a friendly assistant with a warm personality.",
      evals: [],
      provider: extractor(() => []),
      config,
    });
    expect(report.summary.totalRules).toBe(0);
    expect(report.summary.traceCoverage).toBe(0);
    expect(report.warnings.join(" ")).toContain("No behavioral rules found");
  });
  it("an extremely short prompt still produces provenance that validates", async () => {
    const prompt = "Never lie.";
    const rules = await extractRules(
      prompt,
      extractor(() => [rule({ quote: "Never lie.", line: 1 })]),
    );
    expect(rules).toHaveLength(1);
    expect(validateSource(prompt, rules[0])).toBe(true);
  });
  it("a huge prompt is chunked with global line numbers preserved and flagged", async () => {
    const filler = Array.from(
      { length: 400 },
      (_, i) => `Background note ${i}.`,
    );
    const prompt = [...filler, "Never disclose the master key."].join("\n");
    const warnings: string[] = [];
    const rules = await extractRules(
      prompt,
      extractor((input) =>
        input.includes("master key")
          ? [
              rule({
                quote: "Never disclose the master key.",
                line: lineOf(input, "master key"),
              }),
            ]
          : [],
      ),
      { maxChars: 2000, warnings },
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].source.lineStart).toBe(401);
    expect(validateSource(prompt, rules[0])).toBe(true);
    expect(warnings.join(" ")).toContain("segmented into");
  });
  it("a duplicated instruction becomes one rule with both source spans", async () => {
    const prompt =
      "Never reveal passwords.\nBe concise.\nNever reveal passwords.";
    const rules = await extractRules(
      prompt,
      extractor(() => [
        rule({ quote: "Never reveal passwords.", line: 1 }),
        rule({ quote: "Never reveal passwords.", line: 3 }),
      ]),
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].sources).toHaveLength(2);
    const mutation = mutatePrompt(prompt, rules[0]);
    expect(mutation.prompt).not.toContain("Never reveal passwords.");
    expect(mutation.prompt).toContain("Be concise.");
  });
  it("conflicting instructions stay separate rules rather than being merged", async () => {
    const prompt =
      "Always escalate refunds to a manager.\nNever escalate refunds to a manager.";
    const rules = await extractRules(
      prompt,
      extractor(() => [
        rule({ quote: "Always escalate refunds to a manager.", line: 1 }),
        rule({ quote: "Never escalate refunds to a manager.", line: 2 }),
      ]),
    );
    expect(rules).toHaveLength(2);
    expect(rules[0].stableKey).not.toBe(rules[1].stableKey);
  });
  it("five rules in one sentence mutate independently", async () => {
    const prompt =
      "Never email, never call, never text, never post, and never fax without written consent.";
    const clauses = [
      "Never email",
      "never call",
      "never text",
      "never post",
      "never fax",
    ];
    const rules = await extractRules(
      prompt,
      extractor(() => clauses.map((quote) => rule({ quote, line: 1 }))),
    );
    expect(rules).toHaveLength(5);
    for (const target of rules) {
      const mutation = mutatePrompt(prompt, target, "removal", rules);
      expect(mutation.prompt).not.toContain(target.source.exactQuote);
      for (const other of rules.filter((r) => r.id !== target.id))
        expect(mutation.prompt).toContain(other.source.exactQuote);
    }
  });
});

describe("difficult text", () => {
  it("handles unicode, emoji and non-Latin scripts in quotes and keys", async () => {
    const prompt =
      "Nunca reveles la contraseña del usuario 🔐.\n絶対にパスワードを開示しないでください。";
    const rules = await extractRules(
      prompt,
      extractor(() => [
        rule({ quote: "Nunca reveles la contraseña del usuario 🔐.", line: 1 }),
        rule({ quote: "絶対にパスワードを開示しないでください。", line: 2 }),
      ]),
    );
    expect(rules).toHaveLength(2);
    expect(rules.every((r) => validateSource(prompt, r))).toBe(true);
    expect(mutatePrompt(prompt, rules[0], "removal", rules).prompt).toContain(
      "絶対に",
    );
    expect(stableKey("contraseña")).toBe(stableKey("CONTRASEÑA"));
  });
  it("handles a rule that spans several lines", async () => {
    const prompt =
      "When a refund exceeds the automatic limit,\nask a manager to approve it\nbefore telling the customer anything.";
    const quote =
      "When a refund exceeds the automatic limit,\nask a manager to approve it\nbefore telling the customer anything.";
    const rules = await extractRules(
      prompt,
      extractor(() => [
        {
          ...rule({ quote }),
          source: { lineStart: 1, lineEnd: 3, exactQuote: quote },
        },
      ]),
    );
    expect(validateSource(prompt, rules[0])).toBe(true);
    expect(mutatePrompt(prompt, rules[0]).prompt.trim()).toBe("");
    expect(mutatePrompt(prompt, rules[0]).diff.split("\n")).toHaveLength(3);
  });
  it("treats template placeholders as ordinary text", async () => {
    const prompt = "Greet {{customer_name}}. Never reveal {{internal_id}}.";
    const rules = await extractRules(
      prompt,
      extractor(() => [
        rule({ quote: "Never reveal {{internal_id}}.", line: 1 }),
      ]),
    );
    expect(validateSource(prompt, rules[0])).toBe(true);
    expect(mutatePrompt(prompt, rules[0]).prompt).toBe(
      "Greet {{customer_name}}. ",
    );
  });
  it("keeps a fuzzy style rule testable but never invents a boundary for it", async () => {
    const rules = await extractRules(
      "Keep replies warm and under three sentences.",
      extractor(() => [
        rule({
          quote: "Keep replies warm and under three sentences.",
          type: "output_constraint",
          severity: "low",
        }),
      ]),
    );
    expect(() =>
      mutatePrompt(
        "Keep replies warm and under three sentences.",
        rules[0],
        "boundary",
      ),
    ).toThrow(/numeric threshold/);
  });
  it("discards an extraction whose quote is not in the prompt", async () => {
    const warnings: string[] = [];
    const rules = await extractRules(
      "Be helpful.",
      extractor(() => [
        rule({ quote: "Never do the thing that was never written.", line: 1 }),
      ]),
      { warnings },
    );
    expect(rules).toHaveLength(0);
    expect(warnings.join(" ")).toContain("Discarded invalid extraction");
  });
});
describe("difficult eval suites", () => {
  it("rejects malformed YAML by filename with a readable message", () => {
    expect(() =>
      loadEvalText("version: 1\n  evals:\n - [", "suite.yaml"),
    ).toThrow(/Invalid YAML\/JSON in suite.yaml/);
    expect(() => loadEvalText("{not json", "suite.json")).toThrow(
      /Invalid YAML\/JSON in suite.json/,
    );
  });
  it("rejects duplicate eval IDs inside one file", () => {
    const suite = {
      version: 1,
      evals: [
        { id: "a", input: "x", expected: { behavior: "y" } },
        { id: "a", input: "z", expected: { behavior: "y" } },
      ],
    };
    expect(() => loadEvalText(JSON.stringify(suite), "s.json")).toThrow(
      /Duplicate eval IDs/,
    );
  });
  it("names the offending field when a case is structurally wrong", () => {
    expect(() =>
      loadEvalText(
        JSON.stringify({ version: 1, evals: [{ id: "a", input: "x" }] }),
        "s.json",
      ),
    ).toThrow(/expected/);
  });
  it("handles hundreds of evals without a quadratic request explosion", async () => {
    const evals = Array.from({ length: 400 }, (_, i) => ({
      id: `case-${i}`,
      input: `Scenario ${i} about disclosing secret ${i}.`,
      expected: { behavior: `Refuse scenario ${i}.` },
    }));
    let mapRequests = 0;
    const provider = new StubProvider({
      extract: () => ({
        rules: [rule({ quote: "Never disclose secret 7 to anyone.", line: 1 })],
      }),
      map: () => {
        mapRequests++;
        return { mappings: [] };
      },
      redundancy: () => ({ redundancies: [] }),
    });
    const report = await analyze({
      prompt: "Never disclose secret 7 to anyone.",
      evals,
      provider,
      config,
    });
    expect(report.summary.totalEvals).toBe(400);
    expect(mapRequests).toBe(1);
  });
  it("a provider failure surfaces as an error, never as coverage", async () => {
    const provider = new StubProvider({
      extract: () => {
        throw new Error("provider exploded");
      },
    });
    await expect(
      analyze({ prompt: "Never lie.", evals: [], provider, config }),
    ).rejects.toThrow(/provider exploded/);
  });
  it("a redundancy failure degrades to a warning rather than failing the run", async () => {
    const provider = new StubProvider({
      extract: () => ({
        rules: [
          rule({ quote: "Never lie.", line: 1 }),
          rule({ quote: "Never mislead.", line: 2 }),
        ],
      }),
      redundancy: () => {
        throw new Error("redundancy endpoint down");
      },
    });
    const report = await analyze({
      prompt: "Never lie.\nNever mislead.",
      evals: [],
      provider,
      config,
    });
    expect(report.summary.totalRules).toBe(2);
    expect(report.warnings.join(" ")).toContain("Redundancy analysis skipped");
  });
});

describe("using the fixture provider by mistake", () => {
  it("warns loudly when the fixture is pointed at a different prompt", async () => {
    const { FixtureProvider, fixturePrompt } =
      await import("../packages/core/src/index.js");
    const report = await analyze({
      prompt: "You are my own assistant.\nNever wire funds without approval.",
      evals: [],
      provider: new FixtureProvider(),
      config: ConfigSchema.parse({ provider: { type: "fixture" } }),
    });
    expect(report.warnings.join(" ")).toContain(
      "only recognises the example prompt",
    );
    expect(report.warnings.join(" ")).toContain("Set provider.type");
    // The bundled prompt itself must not trigger the warning.
    const clean = await analyze({
      prompt: fixturePrompt,
      evals: [],
      provider: new FixtureProvider(),
      config: ConfigSchema.parse({ provider: { type: "fixture" } }),
    });
    expect(clean.warnings.join(" ")).not.toContain(
      "only recognises the example prompt",
    );
  });
});
