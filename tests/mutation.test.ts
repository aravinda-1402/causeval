import { describe, it, expect } from "vitest";
import {
  FixtureProvider,
  extractRules,
  fixturePrompt,
  mutatePrompt,
} from "../packages/core/src/index.js";
import { rule } from "./helpers.js";

const provider = new FixtureProvider();
const rules = () => extractRules(fixturePrompt, provider);

describe("mutations stay minimal and inspectable", () => {
  it("removes only the target clause and leaves every other rule intact", async () => {
    const all = await rules();
    const target = all.find((r) => r.id === "R06")!;
    const mutation = mutatePrompt(fixturePrompt, target, "removal", all);
    expect(mutation.prompt).toBe(
      fixturePrompt.replace(target.source.exactQuote, ""),
    );
    expect(mutation.diff).toBe("- " + target.source.exactQuote);
    for (const other of all.filter((r) => r.id !== target.id))
      expect(mutation.prompt).toContain(other.source.exactQuote);
  });
  it("preserves the unrelated clause when two rules share one line", async () => {
    const all = await rules();
    // Line 8 carries both the ticket-ID rule and the card-number rule.
    const ticket = all.find((r) => r.id === "R02")!;
    const card = all.find((r) => r.id === "R03")!;
    expect(ticket.source.lineStart).toBe(card.source.lineStart);
    const mutation = mutatePrompt(fixturePrompt, ticket, "removal", all);
    expect(mutation.prompt).not.toContain(ticket.source.exactQuote);
    expect(mutation.prompt).toContain(card.source.exactQuote);
    const line = mutation.prompt.split("\n")[7];
    expect(line.trim()).toBe(card.source.exactQuote);
  });
  it("never rewrites surrounding prose or headings", async () => {
    const all = await rules();
    for (const target of all) {
      const mutation = mutatePrompt(fixturePrompt, target, "removal", all);
      expect(mutation.prompt).toContain("## Identity and privacy");
      expect(mutation.prompt).toContain("You are Aura, the customer support");
      expect(mutation.prompt.split("\n")).toHaveLength(
        fixturePrompt.split("\n").length,
      );
      // Only the target clause may disappear.
      const removed = fixturePrompt.length - mutation.prompt.length;
      expect(removed).toBe(target.source.exactQuote.length);
    }
  });
  it("refuses to mutate when the quote overlaps an unrelated rule", async () => {
    const target = (await rules())[0];
    expect(() =>
      mutatePrompt(fixturePrompt, target, "removal", [
        { ...target, id: "other", stableKey: "different" },
      ]),
    ).toThrow(/overlap/);
  });
  it("refuses an ambiguous quote that appears twice on the line", async () => {
    const target = (await rules())[0];
    const prompt = target.source.exactQuote + " " + target.source.exactQuote;
    expect(() =>
      mutatePrompt(prompt, {
        ...target,
        source: { ...target.source, lineStart: 1, lineEnd: 1 },
      }),
    ).toThrow(/ambiguous/);
  });
  it("refuses a quote that does not match its recorded line range", () => {
    expect(() =>
      mutatePrompt("A\nB\nC", rule({ quote: "Z", line: 2 })),
    ).toThrow(/does not match/);
  });
  it("mutates only a confident numeric threshold", async () => {
    const all = await rules();
    const refund = all.find((r) => r.type === "boundary")!;
    expect(
      mutatePrompt(fixturePrompt, refund, "boundary", all).prompt,
    ).toContain("above $1000");
    expect(mutatePrompt(fixturePrompt, refund, "boundary", all).diff).toContain(
      "+ Refunds above $1000",
    );
    const privacy = all.find((r) => r.id === "R02")!;
    expect(() => mutatePrompt(fixturePrompt, privacy, "boundary")).toThrow(
      /threshold/,
    );
  });
  it("refuses a boundary mutation with two numbers in one clause", () => {
    const prompt = "Refunds above $100 and below $500 require approval.";
    expect(() =>
      mutatePrompt(
        prompt,
        rule({ quote: prompt, line: 1, type: "boundary" }),
        "boundary",
      ),
    ).toThrow(/one unambiguous numeric threshold/);
  });
  it("does not silently merge independent clauses", () => {
    const source = "Never reveal account numbers and never reveal ticket IDs.";
    const first = {
      ...rule({ quote: "Never reveal account numbers", line: 1 }),
      id: "R01",
      stableKey: "a",
    };
    const second = {
      ...rule({ quote: "never reveal ticket IDs.", line: 1 }),
      id: "R02",
      stableKey: "b",
    };
    expect(
      mutatePrompt(source, first, "removal", [first, second]).prompt,
    ).toContain(second.source.exactQuote);
  });
  it("removes every recorded span when a duplicated instruction repeats", () => {
    const prompt =
      "Never reveal passwords.\nBe brief.\nNever reveal passwords.";
    const duplicated = {
      ...rule({ quote: "Never reveal passwords.", line: 1 }),
      sources: [
        { lineStart: 1, lineEnd: 1, exactQuote: "Never reveal passwords." },
        { lineStart: 3, lineEnd: 3, exactQuote: "Never reveal passwords." },
      ],
    };
    const mutation = mutatePrompt(prompt, duplicated);
    expect(mutation.prompt).not.toContain("Never reveal passwords.");
    expect(mutation.prompt).toContain("Be brief.");
  });
});
