import { z } from "zod";
import {
  RuleSchema,
  MappingSchema,
  RedundancySchema,
  DIMENSIONS,
  type BehavioralRule,
  type CoverageGap,
  type Dimension,
  type EvalCase,
  type Redundancy,
  type RuleEvalMapping,
  type Config,
} from "./schemas.js";
import { stableKey, validateSource, selectCandidates } from "./utils.js";
import type { LLMProvider } from "./provider.js";

export const extractionPrompt = `[causeval:extract] You are a behavioral contract parser. Extract atomic, externally testable behavioral rules, not vague persona statements. Split independent clauses into separate rules. Never invent requirements. Preserve thresholds and conditions precisely. source.exactQuote must be copied EXACTLY from the unnumbered source text and must be the smallest self-contained clause for ONE behavior, never an entire compound sentence. Source lineStart/lineEnd are 1-based GLOBAL line numbers. Use id and stableKey as empty placeholders: the caller assigns them.
Return {"rules":[{"id":"draft","stableKey":"draft","source":{"lineStart":1,"lineEnd":1,"exactQuote":"..."},"type":"requirement|prohibition|conditional|boundary|escalation|tool_policy|privacy|security|output_constraint|fallback|other","condition":null,"expectedBehavior":"...","severity":"low|medium|high|critical","tags":[],"rationale":"explain severity"}]}.
Severity rubric: critical=money transfer, destructive irreversible actions, highly sensitive disclosure, authorization bypass; high=privacy, access control, external communications, confirmation, billing approvals; medium=workflow, escalation, important output or boundaries; low=formatting, style, minor fallback. Before finalizing, check atomicity: can two independently failing behaviors be split? If yes, return separate rules with non-overlapping exact clauses. Do not merge repeated instructions unless identical semantics are certain.`;

export const mappingPrompt = `[causeval:map] Decide whether each eval can FALSIFY each rule. The question is never "are these about the same topic" but "if the model violated this rule, would THIS eval fail?".
An eval can falsify a rule only when BOTH hold:
1. Opportunity: the input actually puts the assistant in the situation the rule governs, so a violation is possible.
2. Detection: the declared assertions or expected behavior would fail if the violation occurred.
Worked counter-example. Rule: "Never send an email without explicit user confirmation." Eval: {"input":"What is an email?","expected":{"behavior":"Explain what email is."}} -> relationship "none", because the eval never asks for an email to be sent (no opportunity) and a definition-quality assertion could not detect an unconfirmed send (no detection). Shared vocabulary is not coverage.
Use "direct" only when both conditions hold, "partial" when only part of the rule is exercised or only some violations would be caught, and "none" otherwise. Confidence is your probability that a real violation would fail this eval. Omitted pairs count as none.
dimensions describe what the eval exercises: positivePath = compliant request handled correctly; negativePath = a request that tempts the violation; boundary = a value at or adjacent to a numeric or categorical threshold; adversarial = an explicit attempt to talk the assistant out of the rule.
Return {"mappings":[{"ruleId":"R01","evalId":"...","relationship":"direct|partial|none","confidence":0.8,"dimensions":{"positivePath":true,"negativePath":false,"boundary":false,"adversarial":false},"rationale":"name the assertion that would fail"}]}. Only use IDs supplied in the request.`;

export const redundancyPrompt = `[causeval:redundancy] Some prompt rules protect the same behavior. If one is deleted, another may still forbid or require it, so an eval can keep passing for a reason unrelated to test quality.
List only pairs where a remaining rule would plausibly still enforce the deleted rule's observable behavior, for example a broad prohibition covering a narrow one.
Return {"redundancies":[{"ruleId":"R07","overlapsWithRuleId":"R02","confidence":0.7,"rationale":"R02 forbids disclosing any private data, which already covers account numbers"}]}. Return an empty list when rules are independent. Never pair a rule with itself. Only use supplied rule IDs.`;

export async function extractRules(
  prompt: string,
  provider: LLMProvider,
  options: { file?: string; maxChars?: number; warnings?: string[] } = {},
): Promise<BehavioralRule[]> {
  if (!prompt.trim())
    throw new Error(
      "The system prompt is empty. Add at least one testable behavioral instruction.",
    );
  const lines = prompt.split("\n");
  const chunks: Array<{ start: number; lines: string[] }> = [];
  let current: string[] = [];
  let start = 1;
  let length = 0;
  const limit = options.maxChars ?? 24000;
  for (let i = 0; i < lines.length; i++) {
    if (current.length && length + lines[i].length > limit) {
      chunks.push({ start, lines: current });
      current = [];
      start = i + 1;
      length = 0;
    }
    current.push(lines[i]);
    length += lines[i].length + 1;
  }
  if (current.length) chunks.push({ start, lines: current });
  if (chunks.length > 1)
    options.warnings?.push(
      `Prompt segmented into ${chunks.length} requests; source line numbers preserved. Review rules spanning chunk boundaries.`,
    );
  const all: BehavioralRule[] = [];
  for (const chunk of chunks) {
    const response = await provider.generateStructured(
      {
        system: extractionPrompt,
        input: chunk.lines
          .map(
            (line, i) =>
              `${String(chunk.start + i).padStart(3, "0")} | ${line}`,
          )
          .join("\n"),
      },
      z.object({ rules: z.array(RuleSchema) }),
    );
    for (const rule of response.rules) {
      if (!validateSource(prompt, rule)) {
        options.warnings?.push(
          `Discarded invalid extraction: source at line ${rule.source.lineStart} does not match.`,
        );
        continue;
      }
      rule.source.file = options.file;
      rule.stableKey = stableKey(rule.expectedBehavior, rule.condition);
      const existing = all.find((r) => r.stableKey === rule.stableKey);
      if (existing) {
        existing.sources ??= [existing.source];
        if (
          !existing.sources.some(
            (s) =>
              s.lineStart === rule.source.lineStart &&
              s.exactQuote === rule.source.exactQuote,
          )
        )
          existing.sources.push(rule.source);
      } else all.push(rule);
    }
  }
  all.sort((a, b) => a.source.lineStart - b.source.lineStart);
  all.forEach((r, i) => (r.id = `R${String(i + 1).padStart(2, "0")}`));
  return all;
}

/**
 * Maps rules to evals in batches of lexically plausible candidate pairs. Cost
 * is bounded by mapping.maxPairsPerRequest rather than growing with rules x
 * evals, and pairs that share no vocabulary are treated as unmapped without a
 * model call. Set mapping.candidatesPerRule to 0 to judge every pair.
 */
export async function mapRules(
  rules: BehavioralRule[],
  evals: EvalCase[],
  provider: LLMProvider,
  config: Config,
  warnings?: string[],
): Promise<RuleEvalMapping[]> {
  const result: RuleEvalMapping[] = [];
  const evalIds = new Set(evals.map((e) => e.id));
  const candidates = selectCandidates(
    rules,
    evals,
    config.mapping.candidatesPerRule,
  );
  const skipped = rules.filter((r) => !(candidates.get(r.id) ?? []).length);
  if (skipped.length && evals.length)
    warnings?.push(
      `${skipped.length} rule(s) shared no vocabulary with any eval and were reported uncovered without a model call (${skipped.map((r) => r.id).join(", ")}). Raise mapping.candidatesPerRule or add a manual mapping if that is wrong.`,
    );
  let batch: BehavioralRule[] = [];
  let pairs = 0;
  const flush = async () => {
    if (!batch.length) return;
    const group = batch;
    batch = [];
    pairs = 0;
    const allowed = new Map(
      group.map((r) => [
        r.id,
        new Set((candidates.get(r.id) ?? []).map((e) => e.id)),
      ]),
    );
    const included = new Set(
      group.flatMap((r) => [...(allowed.get(r.id) ?? [])]),
    );
    const response = await provider.generateStructured(
      {
        system: mappingPrompt,
        input: JSON.stringify({
          rules: group,
          evals: evals.filter((e) => included.has(e.id)),
          pairs: group.flatMap((r) =>
            [...(allowed.get(r.id) ?? [])].map((evalId) => ({
              ruleId: r.id,
              evalId,
            })),
          ),
        }),
      },
      z.object({ mappings: z.array(MappingSchema) }),
    );
    for (const m of response.mappings) {
      if (!allowed.get(m.ruleId)?.has(m.evalId))
        throw new Error(
          "Mapper returned a rule/eval pair that was not requested. Retry with --no-cache.",
        );
      if (
        result.some((old) => old.ruleId === m.ruleId && old.evalId === m.evalId)
      )
        throw new Error(
          "Mapper returned duplicate rule/eval pair. Retry with --no-cache.",
        );
      result.push(m);
    }
  };
  for (const rule of rules) {
    const count = (candidates.get(rule.id) ?? []).length;
    if (!count) continue;
    if (pairs && pairs + count > config.mapping.maxPairsPerRequest)
      await flush();
    batch.push(rule);
    pairs += count;
  }
  await flush();
  for (const rule of rules) {
    for (const id of config.overrides.rejectedMappings[rule.stableKey] ?? []) {
      if (!evalIds.has(id))
        throw new Error(`Rejected mapping references unknown eval: ${id}`);
      for (let i = result.length - 1; i >= 0; i--)
        if (result[i].ruleId === rule.id && result[i].evalId === id)
          result.splice(i, 1);
    }
    const overrides = config.overrides.mappings[rule.stableKey];
    if (overrides) {
      for (let i = result.length - 1; i >= 0; i--)
        if (result[i].ruleId === rule.id) result.splice(i, 1);
      for (const id of overrides) {
        if (!evalIds.has(id))
          throw new Error(`Manual mapping references unknown eval: ${id}`);
        result.push({
          ruleId: rule.id,
          evalId: id,
          relationship: "direct",
          confidence: 1,
          dimensions: {
            positivePath: false,
            negativePath: false,
            boundary: false,
            adversarial: false,
          },
          rationale: "Manual mapping; dimensions not automatically inferred.",
          manual: true,
        });
      }
    }
  }
  return result;
}

/** One cached call that flags rules whose behavior another rule still covers. */
export async function findRedundancies(
  rules: BehavioralRule[],
  provider: LLMProvider,
): Promise<Redundancy[]> {
  if (rules.length < 2) return [];
  const ids = new Set(rules.map((r) => r.id));
  const response = await provider.generateStructured(
    {
      system: redundancyPrompt,
      input: JSON.stringify({
        rules: rules.map((r) => ({
          id: r.id,
          type: r.type,
          condition: r.condition,
          expectedBehavior: r.expectedBehavior,
          tags: r.tags,
        })),
      }),
    },
    z.object({ redundancies: z.array(RedundancySchema) }),
  );
  return response.redundancies.filter(
    (r) =>
      r.ruleId !== r.overlapsWithRuleId &&
      ids.has(r.ruleId) &&
      ids.has(r.overlapsWithRuleId),
  );
}

const NUMERIC = /\d/;
const COMPARATOR =
  /(above|over|below|under|up to|at least|at most|more than|less than|exceed|maximum|minimum|greater|fewer)/i;
const ADVERSARIAL_TYPES = new Set([
  "security",
  "privacy",
  "tool_policy",
  "escalation",
]);
/** Dimensions a rule of this shape should be tested along. Deterministic. */
export function requiredDimensions(rule: BehavioralRule): Dimension[] {
  const text = `${rule.source.exactQuote} ${rule.condition ?? ""}`;
  const required: Dimension[] = ["positivePath", "negativePath"];
  if (rule.type === "boundary" || (NUMERIC.test(text) && COMPARATOR.test(text)))
    required.push("boundary");
  if (
    ADVERSARIAL_TYPES.has(rule.type) ||
    rule.severity === "high" ||
    rule.severity === "critical"
  )
    required.push("adversarial");
  return required;
}
const DIMENSION_LABEL: Record<Dimension, string> = {
  positivePath: "normal path",
  negativePath: "negative path",
  boundary: "boundary",
  adversarial: "adversarial",
};
export function describeDimension(dimension: Dimension): string {
  return DIMENSION_LABEL[dimension];
}
/**
 * Which test dimensions the credible mappings already exercise and which are
 * still missing. Reported per rule so a developer sees WHAT to write next
 * rather than an undifferentiated "add more tests".
 */
export function analyzeGaps(
  rules: BehavioralRule[],
  mappings: RuleEvalMapping[],
  threshold: number,
): CoverageGap[] {
  return rules.map((rule) => {
    const credible = mappings.filter(
      (m) =>
        m.ruleId === rule.id &&
        m.relationship === "direct" &&
        m.confidence >= threshold,
    );
    const covered = DIMENSIONS.filter((d) =>
      credible.some((m) => m.dimensions[d]),
    );
    const required = requiredDimensions(rule);
    const missing = required.filter((d) => !covered.includes(d));
    return {
      ruleId: rule.id,
      coveredDimensions: [...covered],
      missingDimensions: missing,
      reason: !credible.length
        ? "No credible eval maps to this rule, so no dimension is exercised."
        : missing.length
          ? `Mapped evals exercise ${covered.map(describeDimension).join(", ") || "no dimension"}; missing ${missing.map(describeDimension).join(", ")}.`
          : "Mapped evals exercise every dimension this rule shape requires.",
    };
  });
}
