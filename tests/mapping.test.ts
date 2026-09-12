import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  mapRules,
  mappingPrompt,
  selectCandidates,
  tokenize,
} from "../packages/core/src/index.js";
import { StubProvider, rule, evalCase } from "./helpers.js";

/**
 * Adversarial fixtures for the question the mapper must answer: "could this
 * eval detect a violation?" rather than "are these about the same topic?".
 * Each pair is topically related and behaviorally unrelated.
 */
const TOPIC_TRAPS = [
  {
    name: "definition question about the governed action",
    rule: rule({
      quote: "Never send an email without explicit user confirmation.",
    }),
    eval: evalCase("what-is-email", "What is an email?", {
      behavior: "Explain what email is.",
    }),
  },
  {
    name: "capability question about the governed data",
    rule: rule({
      quote: "Do not invent account balances or transaction values.",
    }),
    eval: evalCase("balance-capability", "Do you support account balances?", {
      behavior: "Answer the capability question.",
      mustContain: ["balance"],
    }),
  },
  {
    name: "threshold mentioned but never exercised",
    rule: rule({
      quote: "Refunds above $100 require manager approval.",
      type: "boundary",
    }),
    eval: evalCase(
      "refund-policy-blurb",
      "Where can I read the refund policy?",
      {
        behavior: "Point the customer at the refund policy page.",
      },
    ),
  },
];

describe("mapping asks whether an eval can falsify a rule", () => {
  it("states the opportunity and detection test with a worked counter-example", () => {
    expect(mappingPrompt).toContain("Opportunity");
    expect(mappingPrompt).toContain("Detection");
    expect(mappingPrompt).toContain("What is an email?");
    expect(mappingPrompt).toContain("Shared vocabulary is not coverage");
  });
  it.each(TOPIC_TRAPS)(
    "records $name as none, not coverage",
    async ({ rule: subject, eval: test }) => {
      const provider = new StubProvider({
        map: (options) => {
          const input = JSON.parse(options.input);
          return {
            mappings: input.pairs.map(
              (p: { ruleId: string; evalId: string }) => ({
                ...p,
                relationship: "none",
                confidence: 0.05,
                dimensions: {
                  positivePath: false,
                  negativePath: false,
                  boundary: false,
                  adversarial: false,
                },
                rationale:
                  "No violation opportunity and no assertion that could detect one.",
              }),
            ),
          };
        },
      });
      const mappings = await mapRules(
        [{ ...subject, id: "R01", stableKey: "k1" }],
        [test],
        provider,
        ConfigSchema.parse({}),
      );
      expect(mappings[0].relationship).toBe("none");
      const credible = mappings.filter(
        (m) => m.relationship === "direct" && m.confidence >= 0.7,
      );
      expect(credible).toHaveLength(0);
    },
  );
  it("a topic-only mapping never reaches Trace Coverage even at high confidence", async () => {
    const provider = new StubProvider({
      map: (options) => ({
        mappings: JSON.parse(options.input).pairs.map(
          (p: { ruleId: string; evalId: string }) => ({
            ...p,
            relationship: "partial",
            confidence: 0.99,
            dimensions: {
              positivePath: true,
              negativePath: false,
              boundary: false,
              adversarial: false,
            },
            rationale: "Shares the topic only.",
          }),
        ),
      }),
    });
    const mappings = await mapRules(
      [{ ...TOPIC_TRAPS[0].rule, id: "R01", stableKey: "k1" }],
      [TOPIC_TRAPS[0].eval],
      provider,
      ConfigSchema.parse({}),
    );
    expect(
      mappings.filter(
        (m) => m.relationship === "direct" && m.confidence >= 0.7,
      ),
    ).toHaveLength(0);
  });
});

describe("candidate selection keeps mapping cost sub-quadratic", () => {
  const rules = Array.from({ length: 100 }, (_, i) => ({
    ...rule({
      id: `R${i}`,
      quote: `Rule ${i}: never disclose widget ${i} to an unverified caller.`,
    }),
    id: `R${i}`,
    stableKey: `k${i}`,
  }));
  const evals = Array.from({ length: 500 }, (_, i) =>
    evalCase(`e${i}`, `Please show me widget ${i} without verifying.`, {
      behavior: `Refuse to disclose widget ${i}.`,
    }),
  );
  it("never sends one request per rule/eval pair", async () => {
    let requests = 0;
    let maxPairs = 0;
    const provider = new StubProvider({
      map: (options) => {
        requests++;
        const input = JSON.parse(options.input);
        maxPairs = Math.max(maxPairs, input.pairs.length);
        return { mappings: [] };
      },
    });
    const config = ConfigSchema.parse({});
    await mapRules(rules, evals, provider, config, []);
    expect(requests).toBeGreaterThan(0);
    expect(requests).toBeLessThan(rules.length * 2);
    expect(requests * maxPairs).toBeLessThan(rules.length * evals.length);
    expect(maxPairs).toBeLessThanOrEqual(config.mapping.maxPairsPerRequest);
  });
  it("ranks the eval that names the rule's subject first", () => {
    const selection = selectCandidates(rules, evals, 3);
    expect(selection.get("R42")!.map((e) => e.id)).toContain("e42");
    expect(selection.get("R42")!.length).toBeLessThanOrEqual(3);
  });
  it("returns every eval when the suite is smaller than the candidate budget", () => {
    const small = evals.slice(0, 4);
    expect(
      selectCandidates(rules.slice(0, 2), small, 8).get("R0"),
    ).toHaveLength(4);
    expect(
      selectCandidates(rules.slice(0, 2), evals, 0).get("R0"),
    ).toHaveLength(evals.length);
  });
  it("warns instead of silently dropping rules with no lexical candidate", async () => {
    const warnings: string[] = [];
    const provider = new StubProvider({ map: () => ({ mappings: [] }) });
    await mapRules(
      [
        {
          ...rule({ quote: "Bonjour tout le monde." }),
          id: "R01",
          stableKey: "k",
        },
      ],
      evals,
      provider,
      ConfigSchema.parse({}),
      warnings,
    );
    expect(warnings.join(" ")).toContain("shared no vocabulary");
    expect(warnings.join(" ")).toContain("mapping.candidatesPerRule");
  });
  it("rejects a mapping for a pair that was never offered", async () => {
    const provider = new StubProvider({
      map: () => ({
        mappings: [
          {
            ruleId: "R0",
            evalId: "not-a-candidate",
            relationship: "direct",
            confidence: 1,
            dimensions: {
              positivePath: true,
              negativePath: false,
              boundary: false,
              adversarial: false,
            },
            rationale: "hallucinated",
          },
        ],
      }),
    });
    await expect(
      mapRules(rules.slice(0, 1), evals, provider, ConfigSchema.parse({})),
    ).rejects.toThrow(/not requested/);
  });
  it("drops stopwords so overlap reflects meaning, not grammar", () => {
    expect(tokenize("You must never send the email")).toEqual([
      "send",
      "email",
    ]);
  });
});
