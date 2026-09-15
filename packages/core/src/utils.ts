import { createHash } from "node:crypto";
import { parse } from "yaml";
import {
  EvalSuiteSchema,
  type BehavioralRule,
  type EvalCase,
} from "./schemas.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export function stableKey(
  behavior: string,
  condition: string | null = null,
): string {
  return hash({
    behavior: behavior
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s$<>]/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
    condition: condition?.toLowerCase().replace(/\s+/g, " ").trim() ?? null,
  }).slice(0, 24);
}
export function validateSource(prompt: string, rule: BehavioralRule): boolean {
  const lines = prompt.split("\n");
  const s = rule.source;
  return (
    s.lineEnd >= s.lineStart &&
    s.lineEnd <= lines.length &&
    lines
      .slice(s.lineStart - 1, s.lineEnd)
      .join("\n")
      .includes(s.exactQuote)
  );
}
export function loadEvalText(
  text: string,
  filename = "evals.yaml",
): EvalCase[] {
  let data: unknown;
  try {
    data = filename.endsWith(".json") ? JSON.parse(text) : parse(text);
  } catch {
    throw new Error(
      `Invalid YAML/JSON in ${filename}. Check syntax and indentation.`,
    );
  }
  const parsed = EvalSuiteSchema.safeParse(data);
  if (!parsed.success)
    throw new Error(
      `Invalid eval suite ${filename}: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    );
  const ids = parsed.data.evals.map((e) => e.id);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      `Duplicate eval IDs in ${filename}. Give each test a unique ID.`,
    );
  return parsed.data.evals;
}
export function redact(text: string, secrets: string[] = []): string {
  let result = text;
  for (const s of secrets.filter((s) => s.length > 3))
    result = result.split(s).join("[REDACTED]");
  return (
    result
      .replace(
        /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g,
        "[REDACTED]",
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
      .replace(
        /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[REDACTED]",
      )
      .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED]")
      .replace(/\bxox[baprs]-[A-Za-z0-9-]+\b/g, "[REDACTED]")
      .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]")
      .replace(
        /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
        "$1[REDACTED]@",
      )
      .replace(/\b(sk-[\w-]{8,}|gh[pousr]_[\w]{12,})\b/g, "[REDACTED]")
      // Matches shell (api_key=x), YAML (token: x) and JSON ("apiKey":"x")
      // shapes, so a serialized config embedded in a string is covered too.
      .replace(
        /((?:[\w-]*(?:api[_-]?key|token|secret|password))["']?\s*[=:]\s*["']?)[^\s,"'}]+/gi,
        "$1[REDACTED]",
      )
  );
}
export function escapeHtml(text: unknown): string {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

/**
 * Wilson score interval for a binomial proportion. At three to five runs it is
 * wide on purpose: it communicates that the sample is small rather than
 * implying precision the run count cannot support.
 */
export function wilson(
  passes: number,
  runs: number,
  z = 1.96,
): [number, number] {
  if (runs <= 0) return [0, 1];
  const p = passes / runs;
  const denominator = 1 + (z * z) / runs;
  const centre = p + (z * z) / (2 * runs);
  const margin =
    z * Math.sqrt((p * (1 - p)) / runs + (z * z) / (4 * runs * runs));
  const round = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;
  return [
    round((centre - margin) / denominator),
    round((centre + margin) / denominator),
  ];
}

const STOPWORDS = new Set(
  (
    "a an and are as at be but by do does for from has have if in into is it its" +
    " must never no not of on or should that the their then there these this to" +
    " up use used user users was were what when which while who will with you your"
  ).split(" "),
);
/** Lowercased content tokens used for lexical candidate selection only. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}$][\p{L}\p{N}$.]*/gu) ?? [])
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
function evalText(test: EvalCase): string {
  return [
    test.id,
    test.description ?? "",
    test.input ?? "",
    (test.messages ?? []).map((m) => m.content).join(" "),
    test.expected.behavior,
    ...(test.expected.mustContain ?? []),
    ...(test.expected.mustNotContain ?? []),
    ...(test.tags ?? []),
  ].join(" ");
}
function ruleText(rule: BehavioralRule): string {
  return [
    rule.expectedBehavior,
    rule.condition ?? "",
    rule.source.exactQuote,
    ...rule.tags,
  ].join(" ");
}
/**
 * Rank evals per rule by inverse-document-frequency weighted token overlap so
 * the mapper only judges plausible pairs. This is a recall/cost trade-off: a
 * pair sharing no vocabulary is never shown to the model. Raise
 * mapping.candidatesPerRule, or set it to 0, to widen the search.
 */
export function selectCandidates(
  rules: BehavioralRule[],
  evals: EvalCase[],
  perRule: number,
): Map<string, EvalCase[]> {
  if (!perRule || evals.length <= perRule)
    return new Map(rules.map((r) => [r.id, evals]));
  const selection = new Map<string, EvalCase[]>();
  const documents = evals.map((test) => new Set(tokenize(evalText(test))));
  const frequency = new Map<string, number>();
  for (const document of documents)
    for (const token of document)
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const weight = (token: string) =>
    Math.log(1 + evals.length / (frequency.get(token) ?? evals.length));
  for (const rule of rules) {
    const wanted = new Set(tokenize(ruleText(rule)));
    const quote = rule.source.exactQuote.toLowerCase();
    const scored = evals.map((test, index) => {
      let score = 0;
      for (const token of wanted)
        if (documents[index].has(token)) score += weight(token);
      // An eval quoting the rule text is almost always an intended mapping.
      if (test.expected.behavior.toLowerCase().includes(quote)) score += 10;
      return { test, score };
    });
    scored.sort(
      (a, b) => b.score - a.score || a.test.id.localeCompare(b.test.id),
    );
    selection.set(
      rule.id,
      scored
        .slice(0, perRule)
        .filter((s) => s.score > 0)
        .map((s) => s.test),
    );
  }
  return selection;
}
