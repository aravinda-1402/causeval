import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  CustomRunner,
  FixtureProvider,
  FixtureRunner,
  analyze,
  fixtureEvals,
  fixturePrompt,
  loadEvalText,
  redact,
  renderBadge,
  renderHTML,
  renderMarkdown,
  serializeReport,
} from "../packages/core/src/index.js";

const config = ConfigSchema.parse({ provider: { type: "fixture" } });
const provider = new FixtureProvider();
const payload = '<img src=x onerror="alert(1)">';
const example = () =>
  analyze({
    prompt: fixturePrompt,
    evals: fixtureEvals,
    provider,
    runner: new FixtureRunner(),
    config,
    verify: true,
  });

describe("report rendering escapes untrusted text", () => {
  it("escapes every field a prompt, eval or model can influence", async () => {
    const report = await example();
    report.project.name = payload;
    report.rules[0].expectedBehavior = payload;
    report.rules[0].rationale = payload;
    report.rules[0].source.exactQuote = payload;
    report.rules[0].tags = [payload];
    report.mappings[0].rationale = payload;
    report.causalResults[0].interpretation = payload;
    report.causalResults[0].diff = "- " + payload;
    report.causalResults[0].confounders = [
      { kind: "model-prior", detail: payload },
    ];
    report.causalResults[0].reason = payload;
    report.gaps[0].reason = payload;
    report.redundancies = [
      {
        ruleId: "R09",
        overlapsWithRuleId: "R08",
        confidence: 0.5,
        rationale: payload,
      },
    ];
    report.acceptedRisks = { [report.rules[0].stableKey]: payload };
    report.warnings = [payload];
    report.evals[0].id = payload;
    report.suggestions = [
      {
        ruleId: "R01",
        dimension: "negativePath",
        reason: payload,
        eval: { id: "x", input: payload, expected: { behavior: payload } },
      },
    ];
    const html = renderHTML(report);
    expect(html).not.toContain(payload);
    // The dangerous form is an unescaped attribute; the escaped text is inert.
    expect(html).not.toContain(String.raw`onerror="`);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
  it("escapes the badge label and never implies certification", async () => {
    const report = await example();
    expect(renderBadge(report)).not.toContain("<script");
    for (const badge of [renderBadge(report), renderBadge(report, "trace")])
      expect(badge).not.toMatch(/safe|secure|certified|approved/i);
  });
});
describe("secrets never reach an artifact", () => {
  it("redacts key patterns and configured values from reports", async () => {
    const report = await example();
    report.warnings.push(
      "failed with api_key=sk-live-0123456789abcdef and token: ghp_0123456789abcdef",
    );
    report.rules[0].rationale = "contact via my-secret-value";
    const json = serializeReport(report, ["my-secret-value"]);
    expect(json).not.toContain("sk-live-0123456789abcdef");
    expect(json).not.toContain("ghp_0123456789abcdef");
    expect(json).not.toContain("my-secret-value");
    expect(json).toContain("[REDACTED]");
  });
  it("replaces the value of any key-like field wholesale", async () => {
    const report = await example();
    const serialized = JSON.parse(
      serializeReport({
        ...report,
        // A provider that echoed configuration into the report must not leak.
        warnings: [JSON.stringify({ apiKey: "plain", nested: { token: "x" } })],
      }),
    );
    expect(serialized.warnings[0]).not.toContain("plain");
  });
  it("keeps the raw runner command out of the report", () => {
    const runner = new CustomRunner("node run.js --key sk-live-secretsecret");
    const described = runner.describe();
    expect(described.identity).not.toContain("sk-live");
    expect(described.identity).not.toContain("run.js");
    expect(described.identity).toMatch(/^sha256:[0-9a-f]{16}$/);
  });
  it("redacts plain strings without needing a configured secret list", () => {
    expect(redact("Authorization: Bearer sk-abcdefghijkl")).toContain(
      "[REDACTED]",
    );
    expect(redact("password: hunter2")).toContain("[REDACTED]");
    expect(redact("nothing sensitive here")).toBe("nothing sensitive here");
  });
  it("never writes a secret into the Markdown summary", async () => {
    const report = await example();
    report.project.name = "api_key=sk-live-0123456789abcdef";
    const safe = JSON.parse(serializeReport(report));
    expect(renderMarkdown(safe)).not.toContain("sk-live-0123456789abcdef");
  });
});
describe("malformed input is rejected, not executed", () => {
  it("refuses a YAML alias bomb rather than expanding it", () => {
    const bomb =
      "version: 1\na: &a [x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: [*c,*c,*c,*c,*c,*c,*c,*c,*c]\nevals: []";
    expect(() => loadEvalText(bomb, "bomb.yaml")).toThrow();
  });
  it("rejects an eval suite that is not an object", () => {
    for (const text of ["null", "[]", '"a string"', "42"])
      expect(() => loadEvalText(text, "x.json")).toThrow(/Invalid eval suite/);
  });
});
