import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import {
  analyze,
  checkAssertions,
  classify,
  ConfigSchema,
  FixtureProvider,
  FixtureRunner,
  fixtureEvals,
  fixturePrompt,
  mutatePrompt,
  redact,
  renderMarkdown,
  RuleSchema,
  calculateSummary,
} from "../packages/core/src/index.js";
import { rule } from "./helpers.js";

const config = ConfigSchema.parse({ provider: { type: "fixture" } });

describe("independent prelaunch audit regressions", () => {
  it("uses all ten behavioral rules as the CRC denominator when four are protected", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider: new FixtureProvider(),
      runner: new FixtureRunner(),
      verify: true,
      config,
    });
    const rules = report.rules.slice(0, 10);
    const results = report.causalResults.slice(0, 10).map((result, i) => ({
      ...result,
      classification:
        i < 4 ? ("causally-covered" as const) : ("uncovered" as const),
    }));
    expect(
      calculateSummary(rules, fixtureEvals, [], results, config, true)
        .causalCoverage,
    ).toBe(0.4);
  });
  it("H1: the on-disk starter prompt has no fixture mismatch warning", async () => {
    const report = await analyze({
      prompt: fixturePrompt + "\n",
      evals: fixtureEvals,
      provider: new FixtureProvider(),
      config,
    });
    expect(report.warnings).toEqual([]);
  });

  it("H5: catastrophic regex execution is bounded and cannot become a verdict", () => {
    // Isolate the regression itself so a missing deadline cannot hang the test job.
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import { checkAssertions } from './packages/core/src/assertions.ts';
      const start = Date.now();
      try {
        checkAssertions('a'.repeat(30) + 'b', { behavior: 'b', mustMatch: ['(a+)+$'] });
        process.exitCode = 2;
      } catch (error) {
        if (!/regular expression evaluation exceeded 1000ms/.test(error.message)) throw error;
        console.log(Date.now() - start);
      }
    `,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(Number(child.stdout.trim())).toBeLessThan(2000);
  }, 8000);

  it("M8: every assertion sees the complete output, including violations after 200 KB", () => {
    const output = "x".repeat(250000) + "SECRETWORD";
    expect(
      checkAssertions(output, { behavior: "b", mustContain: ["SECRETWORD"] })
        .passed,
    ).toBe(true);
    expect(
      checkAssertions(output, { behavior: "b", mustMatch: ["SECRETWORD"] })
        .passed,
    ).toBe(true);
    expect(
      checkAssertions(output, { behavior: "b", mustNotMatch: ["SECRETWORD"] })
        .passed,
    ).toBe(false);
  });

  it("M7: refuses a stale sibling span instead of silently disabling overlap protection", () => {
    const target = RuleSchema.parse(
      rule({ quote: "Never reveal account numbers.", line: 1 }),
    );
    const sibling = RuleSchema.parse({
      ...rule({ quote: "Missing source quote.", line: 2 }),
      stableKey: "sibling",
    });
    expect(() =>
      mutatePrompt(
        "Never reveal account numbers.\nAsk for confirmation.",
        target,
        "removal",
        [sibling],
      ),
    ).toThrow(/unrelated rule/);
  });

  it("M9: an inverted effect is indeterminate, never pseudo-coverage", () => {
    expect(classify([1, 1, 1, 1, 0], [1, 1, 1, 1, 1], config.causal)).toBe(
      "indeterminate",
    );
  });

  it.each([
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    "AKIAIOSFODNN7EXAMPLE",
    ["xoxb", "1".repeat(12), "2".repeat(12), "test".repeat(6)].join("-"),
    "AIzaSyExampleKey0123456789012345678901234",
    "-----BEGIN RSA PRIVATE KEY-----\nprivate-material\n-----END RSA PRIVATE KEY-----",
    "postgres://user:hunter2@host/database",
  ])("M6: redacts common credential form %s", (value) => {
    const safe = redact(value);
    expect(safe).toContain("[REDACTED]");
    expect(safe).not.toContain(value);
    expect(safe).not.toContain("private-material");
    expect(safe).not.toContain("hunter2");
  });

  it("M5/L2: the Action summary names high-risk rules and escapes user text", async () => {
    const report = await analyze({
      prompt: fixturePrompt,
      evals: fixtureEvals,
      provider: new FixtureProvider(),
      runner: new FixtureRunner(),
      verify: true,
      config,
    });
    report.run.model = '<img src=x onerror="alert(1)">';
    const markdown = renderMarkdown(report);
    expect(markdown).toContain("Never include full payment card numbers");
    expect(markdown).not.toContain("<img");
  });
});
