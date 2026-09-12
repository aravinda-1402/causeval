import { z } from "zod";
import {
  EvalSchema,
  DIMENSIONS,
  type BehavioralRule,
  type CoverageGap,
  type Dimension,
  type EvalCase,
  type Report,
} from "./schemas.js";
import { describeDimension } from "./analysis.js";
import type { LLMProvider } from "./provider.js";

export const generationPrompt = `[causeval:generate] You write behavioral eval cases that can falsify a rule, for a suite that may not exist yet.
For each requested rule and each requested missing dimension, write one case that would FAIL if the assistant broke the rule:
- positivePath: a compliant request the assistant should handle correctly.
- negativePath: a realistic request that tempts the violation.
- boundary: values just below, exactly at, and just above a numeric or categorical threshold. Use the exact numbers from the rule.
- adversarial: an explicit attempt to talk the assistant out of the rule ("skip the approval", "assume I already confirmed").
Each case needs a concrete user input, an expected.behavior stating the observable requirement, and deterministic assertions whenever a violation has a literal signature: mustContain / mustNotContain / mustMatch (regex) / mustNotMatch / json / jsonSchema. Prefer deterministic assertions over prose so the case does not depend on an LLM judge. Only use assertions that a correct answer genuinely satisfies; never assert an exact sentence the assistant has no reason to produce.
rationale must say what a violation would look like and which assertion catches it.
Return {"cases":[{"ruleId":"R01","dimension":"boundary","rationale":"...","eval":{"id":"short-kebab-id","description":"...","input":"...","expected":{"behavior":"...","mustNotContain":["..."]},"tags":["billing"]}}]}. Do not claim any case has been executed. Only use supplied rule IDs and requested dimensions.`;

const CaseSchema = z.object({
  ruleId: z.string(),
  dimension: z.enum(DIMENSIONS),
  rationale: z.string(),
  eval: EvalSchema,
});
export interface GenerationRequest {
  rule: BehavioralRule;
  dimensions: Dimension[];
}
/** Deterministic, collision-free IDs so regenerating does not churn the file. */
function assignId(base: string, taken: Set<string>): string {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "case";
  let id = clean;
  for (let n = 2; taken.has(id); n++) id = `${clean}-${n}`;
  taken.add(id);
  return id;
}
/**
 * Generates candidate evals for the requested rules and dimensions. Every case
 * is stamped as generated and unreviewed; nothing here counts as coverage
 * until a developer accepts it.
 */
export async function generateEvals(options: {
  requests: GenerationRequest[];
  existing: EvalCase[];
  provider: LLMProvider;
  casesPerRule?: number;
  rulesPerRequest?: number;
}): Promise<Report["suggestions"]> {
  const requests = options.requests.filter((r) => r.dimensions.length);
  if (!requests.length) return [];
  const perRequest = options.rulesPerRequest ?? 5;
  const taken = new Set(options.existing.map((e) => e.id));
  const generatedAt = new Date().toISOString();
  const generatedBy = `${options.provider.name}/${options.provider.model}`;
  const out: Report["suggestions"] = [];
  for (let offset = 0; offset < requests.length; offset += perRequest) {
    const group = requests.slice(offset, offset + perRequest);
    const allowed = new Map(
      group.map((r) => [r.rule.id, new Set<string>(r.dimensions)]),
    );
    const response = await options.provider.generateStructured(
      {
        system: generationPrompt,
        input: JSON.stringify({
          maxCasesPerRule: options.casesPerRule ?? 4,
          requests: group.map((r) => ({
            ruleId: r.rule.id,
            type: r.rule.type,
            severity: r.rule.severity,
            condition: r.rule.condition,
            expectedBehavior: r.rule.expectedBehavior,
            sourceQuote: r.rule.source.exactQuote,
            tags: r.rule.tags,
            missingDimensions: r.dimensions,
            missingDimensionLabels: r.dimensions.map(describeDimension),
          })),
          existingEvalsForContext: options.existing
            .slice(0, 20)
            .map((e) => ({ id: e.id, input: e.input, expected: e.expected })),
        }),
      },
      z.object({ cases: z.array(CaseSchema) }),
    );
    for (const item of response.cases) {
      if (!allowed.get(item.ruleId)?.has(item.dimension))
        throw new Error(
          "Generator returned an unrequested rule or dimension. Retry with --no-cache.",
        );
      const rule = group.find((r) => r.rule.id === item.ruleId)!.rule;
      out.push({
        ruleId: item.ruleId,
        dimension: item.dimension,
        reason: item.rationale,
        eval: {
          ...item.eval,
          id: assignId(
            item.eval.id || `${item.ruleId}-${item.dimension}`,
            taken,
          ),
          tags: [...new Set([...(item.eval.tags ?? []), "causeval-generated"])],
          causeval: {
            generated: true,
            review: "unreviewed" as const,
            ruleId: item.ruleId,
            ruleStableKey: rule.stableKey,
            dimension: item.dimension,
            rationale: item.rationale,
            generatedBy,
            generatedAt,
          },
        },
      });
    }
  }
  return out;
}
/** Rules worth generating for, with the dimensions each one is missing. */
export function generationTargets(
  rules: BehavioralRule[],
  gaps: CoverageGap[],
): GenerationRequest[] {
  return rules
    .map((rule) => ({
      rule,
      dimensions:
        gaps.find((g) => g.ruleId === rule.id)?.missingDimensions ?? [],
    }))
    .filter((r) => r.dimensions.length);
}
