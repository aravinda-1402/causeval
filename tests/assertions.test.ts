import { describe, it, expect, vi } from "vitest";
import {
  checkAssertions,
  matchesShape,
  hasDeterministicAssertions,
  NativeRunner,
  judgePrompt,
} from "../packages/core/src/index.js";

describe("deterministic assertions", () => {
  it("checks literal containment case-sensitively", () => {
    expect(
      checkAssertions("I cannot share that.", {
        behavior: "refuse",
        mustContain: ["cannot share"],
      }).passed,
    ).toBe(true);
    expect(
      checkAssertions("I Cannot Share that.", {
        behavior: "refuse",
        mustContain: ["cannot share"],
      }).failures[0],
    ).toContain("mustContain");
    expect(
      checkAssertions("ticket TKT-1", {
        behavior: "refuse",
        mustNotContain: ["TKT-"],
      }).passed,
    ).toBe(false);
  });
  it("supports regular expressions in both directions", () => {
    expect(
      checkAssertions("Card ending 4242", {
        behavior: "mask",
        mustNotMatch: ["[0-9]{16}"],
        mustMatch: ["ending [0-9]{4}"],
      }).passed,
    ).toBe(true);
    expect(
      checkAssertions("4111111111111111", {
        behavior: "mask",
        mustNotMatch: ["[0-9]{16}"],
      }).failures[0],
    ).toContain("mustNotMatch");
  });
  it("reports an invalid pattern instead of throwing", () => {
    const result = checkAssertions("x", {
      behavior: "b",
      mustMatch: ["([unclosed"],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain("invalid regular expression");
  });
  it("validates JSON output and the documented schema subset", () => {
    const expected = {
      behavior: "structured",
      json: true,
      jsonSchema: {
        type: "object" as const,
        required: ["status", "items"],
        properties: {
          status: { type: "string" as const, enum: ["ok", "error"] },
          items: {
            type: "array" as const,
            items: { type: "integer" as const },
          },
        },
      },
    };
    expect(
      checkAssertions('{"status":"ok","items":[1,2]}', expected).passed,
    ).toBe(true);
    expect(checkAssertions("status is ok", expected).failures[0]).toContain(
      "not valid JSON",
    );
    expect(
      checkAssertions('{"status":"maybe","items":[1]}', expected).failures[0],
    ).toContain("allowed values");
    expect(
      checkAssertions('{"status":"ok","items":[1.5]}', expected).failures[0],
    ).toContain("expected type integer");
    expect(checkAssertions('{"items":[]}', expected).failures[0]).toContain(
      "missing required property status",
    );
  });
  it("reports nested paths so a failure is actionable", () => {
    expect(
      matchesShape(
        { order: { id: 7 } },
        {
          type: "object",
          properties: {
            order: { type: "object", properties: { id: { type: "string" } } },
          },
        },
      )[0],
    ).toBe("$.order.id expected type string but received number");
  });
  it("knows when an eval declares nothing deterministic", () => {
    expect(hasDeterministicAssertions({ behavior: "b" })).toBe(false);
    expect(
      hasDeterministicAssertions({ behavior: "b", mustContain: ["x"] }),
    ).toBe(true);
  });
});
describe("judge isolation", () => {
  const provider = (output: string) => ({
    name: "mock",
    model: "mock-1",
    generateText: vi.fn().mockResolvedValue(output),
    generateStructured: vi
      .fn()
      .mockResolvedValue({ passed: true, reason: "looks fine" }),
  });
  it("never shows the judge the system prompt", async () => {
    const p = provider("Please confirm before I send.");
    await new NativeRunner(p).run("SECRET SYSTEM PROMPT WITH THE RULE", [
      { id: "a", input: "send", expected: { behavior: "ask to confirm" } },
    ]);
    const judged = p.generateStructured.mock.calls[0][0];
    expect(judged.system).toBe(judgePrompt);
    expect(judged.input).not.toContain("SECRET SYSTEM PROMPT");
    expect(judged.temperature).toBe(0);
    expect(judgePrompt).toContain("you never see the system prompt");
  });
  it("a failed literal assertion cannot be overruled by the judge", async () => {
    const p = provider("Sent the email.");
    const result = await new NativeRunner(p).run("s", [
      {
        id: "a",
        input: "send",
        expected: { behavior: "ask", mustContain: ["confirm"] },
      },
    ]);
    expect(result[0].passed).toBe(false);
    expect(result[0].reason).toContain("mustContain");
    expect(p.generateStructured).not.toHaveBeenCalled();
  });
  it("skips the judge entirely when the eval opts out", async () => {
    const p = provider('{"status":"ok"}');
    const result = await new NativeRunner(p).run("s", [
      {
        id: "json",
        input: "api",
        expected: { behavior: "json", json: true, judge: false },
      },
    ]);
    expect(result[0].passed).toBe(true);
    expect(result[0].reason).toContain("judge not requested");
    expect(p.generateStructured).not.toHaveBeenCalled();
  });
  it("reports the judge model used in the runner identity", () => {
    const p = provider("x");
    expect(new NativeRunner(p).describe()).toEqual({
      kind: "native",
      identity: "mock/mock-1 judged by mock/mock-1",
    });
  });
});
