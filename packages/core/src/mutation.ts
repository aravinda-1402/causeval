import type { BehavioralRule } from "./schemas.js";
import { validateSource } from "./utils.js";

export function mutatePrompt(
  prompt: string,
  rule: BehavioralRule,
  type: "removal" | "boundary" = "removal",
  others: BehavioralRule[] = [],
): { prompt: string; diff: string } {
  if (!validateSource(prompt, rule))
    throw new Error(
      "Mutation refused: source quote does not match its line range.",
    );
  const spans = rule.sources ?? [rule.source];
  const edits: Array<{
    start: number;
    end: number;
    replacement: string;
    quote: string;
  }> = [];
  for (const span of spans) {
    const lines = prompt.split("\n");
    const prefix = lines.slice(0, span.lineStart - 1).join("\n");
    const startOffset = prefix.length + (span.lineStart > 1 ? 1 : 0);
    const section = lines.slice(span.lineStart - 1, span.lineEnd).join("\n");
    const relative = section.indexOf(span.exactQuote);
    if (relative < 0 || section.indexOf(span.exactQuote, relative + 1) >= 0)
      throw new Error("Mutation refused: ambiguous or missing source clause.");
    const start = startOffset + relative;
    let replacement = "";
    if (type === "boundary") {
      const numbers = [...span.exactQuote.matchAll(/\b\d+(?:\.\d+)?\b/g)];
      if (
        numbers.length !== 1 ||
        !/(above|over|below|under|up to|at least|more than|less than)/i.test(
          span.exactQuote,
        )
      )
        throw new Error(
          "Boundary mutation requires one unambiguous numeric threshold.",
        );
      replacement = span.exactQuote.replace(
        numbers[0][0],
        String(Number(numbers[0][0]) * 10),
      );
      if (replacement === span.exactQuote)
        throw new Error("Boundary mutation would not change the threshold.");
    }
    edits.push({
      start,
      end: start + span.exactQuote.length,
      replacement,
      quote: span.exactQuote,
    });
  }
  for (const other of others.filter((r) => r.stableKey !== rule.stableKey)) {
    for (const span of other.sources ?? [other.source]) {
      const lines = prompt.split("\n");
      const prefix = lines.slice(0, span.lineStart - 1).join("\n");
      const section = lines.slice(span.lineStart - 1, span.lineEnd).join("\n");
      const at =
        (span.lineStart > 1 ? prefix.length + 1 : 0) +
        section.indexOf(span.exactQuote);
      if (
        edits.some((e) => e.start < at + span.exactQuote.length && e.end > at)
      )
        throw new Error(
          `Mutation refused: source overlaps unrelated rule ${other.id}. Refine the extraction into atomic clauses.`,
        );
    }
  }
  const ordered = edits.sort((a, b) => b.start - a.start);
  for (let i = 1; i < ordered.length; i++)
    if (ordered[i].end > ordered[i - 1].start)
      throw new Error("Mutation refused: overlapping source spans.");
  let mutant = prompt;
  for (const edit of ordered)
    mutant =
      mutant.slice(0, edit.start) + edit.replacement + mutant.slice(edit.end);
  return {
    prompt: mutant,
    diff: edits
      .map(
        (e) =>
          e.quote
            .split("\n")
            .map((l) => "- " + l)
            .join("\n") +
          (e.replacement
            ? "\n" +
              e.replacement
                .split("\n")
                .map((l) => "+ " + l)
                .join("\n")
            : ""),
      )
      .join("\n"),
  };
}
