import { z } from "zod";
import { REPORT_SCHEMA_VERSION } from "./version.js";

export const SourceSpanSchema = z.object({
  file: z.string().optional(),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  exactQuote: z.string().min(1),
});
export const RuleSchema = z.object({
  id: z.string().min(1),
  stableKey: z.string().min(1),
  source: SourceSpanSchema,
  sources: z.array(SourceSpanSchema).optional(),
  type: z.enum([
    "requirement",
    "prohibition",
    "conditional",
    "boundary",
    "escalation",
    "tool_policy",
    "privacy",
    "security",
    "output_constraint",
    "fallback",
    "other",
  ]),
  condition: z.string().nullable(),
  expectedBehavior: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  tags: z.array(z.string()),
  rationale: z.string(),
});
export type BehavioralRule = z.infer<typeof RuleSchema>;

export const DIMENSIONS = [
  "positivePath",
  "negativePath",
  "boundary",
  "adversarial",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/**
 * Supported JSON Schema subset for deterministic structured-output assertions.
 * Deliberately small: enough to assert the shape of an API response without
 * pulling in a full validator or evaluating user-supplied code.
 */
export type JsonShape = {
  type?:
    "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  required?: string[];
  properties?: Record<string, JsonShape>;
  items?: JsonShape;
  enum?: unknown[];
};
export const JsonShapeSchema: z.ZodType<JsonShape> = z.lazy(() =>
  z
    .object({
      type: z
        .enum([
          "object",
          "array",
          "string",
          "number",
          "integer",
          "boolean",
          "null",
        ])
        .optional(),
      required: z.array(z.string()).optional(),
      properties: z.record(JsonShapeSchema).optional(),
      items: JsonShapeSchema.optional(),
      enum: z.array(z.unknown()).optional(),
    })
    .strict(),
);

/** Provenance for an eval CausEval generated. Unreviewed cases never count. */
export const GeneratedMetaSchema = z.object({
  generated: z.literal(true),
  review: z.enum(["unreviewed", "accepted", "rejected"]).default("unreviewed"),
  ruleId: z.string().optional(),
  ruleStableKey: z.string(),
  dimension: z.enum(DIMENSIONS),
  rationale: z.string(),
  generatedBy: z.string().optional(),
  generatedAt: z.string().optional(),
});
export type GeneratedMeta = z.infer<typeof GeneratedMetaSchema>;

export const ExpectationSchema = z
  .object({
    behavior: z.string().min(1),
    mustContain: z.array(z.string()).optional(),
    mustNotContain: z.array(z.string()).optional(),
    mustMatch: z.array(z.string().max(512)).optional(),
    mustNotMatch: z.array(z.string().max(512)).optional(),
    json: z.boolean().optional(),
    jsonSchema: JsonShapeSchema.optional(),
    /** false disables the LLM judge and relies only on deterministic checks. */
    judge: z.boolean().optional(),
  })
  .refine(
    (e) =>
      e.judge !== false ||
      Boolean(
        e.mustContain?.length ||
        e.mustNotContain?.length ||
        e.mustMatch?.length ||
        e.mustNotMatch?.length ||
        e.json ||
        e.jsonSchema,
      ),
    "expected.judge: false requires at least one deterministic assertion.",
  );

export const EvalSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    messages: z
      .array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string() }),
      )
      .optional(),
    input: z.string().optional(),
    context: z.record(z.unknown()).optional(),
    expected: ExpectationSchema,
    tags: z.array(z.string()).optional(),
    causeval: GeneratedMetaSchema.optional(),
  })
  .refine(
    (e) => Boolean(e.input?.trim() || e.messages?.length),
    "An eval needs input or messages.",
  );
export type EvalCase = z.infer<typeof EvalSchema>;
export const EvalSuiteSchema = z.object({
  version: z.literal(1),
  evals: z.array(EvalSchema).min(1),
});
export const MappingSchema = z.object({
  ruleId: z.string(),
  evalId: z.string(),
  relationship: z.enum(["direct", "partial", "none"]),
  confidence: z.number().min(0).max(1),
  dimensions: z.object({
    positivePath: z.boolean(),
    negativePath: z.boolean(),
    boundary: z.boolean(),
    adversarial: z.boolean(),
  }),
  rationale: z.string(),
  manual: z.boolean().optional(),
});
export type RuleEvalMapping = z.infer<typeof MappingSchema>;
const StatsSchema = z.object({
  runs: z.number().int().nonnegative(),
  passes: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(1),
  /** Wilson score interval; descriptive only at these sample sizes. */
  interval: z.tuple([z.number(), z.number()]).optional(),
});
export const OutcomeSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1).optional(),
  output: z.string().optional(),
  reason: z.string().optional(),
});
export type EvalOutcome = z.infer<typeof OutcomeSchema>;
export const CONFOUNDERS = ["possible-redundancy", "model-prior"] as const;
export const CausalResultSchema = z.object({
  ruleId: z.string(),
  mappedEvalIds: z.array(z.string()),
  baseline: StatsSchema,
  mutant: StatsSchema.extend({ mutationType: z.string() }),
  detectionRate: z.number().min(-1).max(1),
  classification: z.enum([
    "causally-covered",
    "pseudo-covered",
    "uncovered",
    "flaky",
    "indeterminate",
  ]),
  diff: z.string().optional(),
  reason: z.string().optional(),
  /** Plain-language statement of exactly what the evidence supports. */
  interpretation: z.string().optional(),
  thresholds: z
    .object({
      minimumBaselinePassRate: z.number(),
      minimumDetectionEffect: z.number(),
      pseudoCoverageCeiling: z.number(),
    })
    .optional(),
  perEval: z
    .array(
      z.object({
        evalId: z.string(),
        baselinePasses: z.number().int().nonnegative(),
        baselineRuns: z.number().int().nonnegative(),
        mutantPasses: z.number().int().nonnegative(),
        mutantRuns: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  confounders: z
    .array(z.object({ kind: z.enum(CONFOUNDERS), detail: z.string() }))
    .default([]),
  evidence: z
    .array(
      z.object({
        phase: z.enum(["baseline", "mutant"]),
        run: z.number(),
        outcomes: z.array(OutcomeSchema),
      }),
    )
    .optional(),
});
export type CausalResult = z.infer<typeof CausalResultSchema>;
export const ProviderConfigSchema = z.object({
  type: z
    .enum(["openai", "anthropic", "compatible", "ollama", "fixture"])
    .default("openai"),
  model: z.string().optional(),
  baseURL: z.string().url().optional(),
  apiKey: z.string().optional(),
  /** Analysis and judging default to 0 so repeated runs stay comparable. */
  temperature: z.number().min(0).max(2).default(0),
  /** Forwarded to providers that support it; recorded for reproducibility. */
  seed: z.number().int().optional(),
  timeoutMs: z.number().int().positive().default(60000),
  maxRetries: z.number().int().min(0).max(5).default(2),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export const ConfigSchema = z.object({
  prompt: z.string().default("./prompts/system.md"),
  evals: z.array(z.string()).min(1).default(["./evals/**/*.yaml"]),
  provider: ProviderConfigSchema.default({}),
  judge: ProviderConfigSchema.optional(),
  thresholds: z
    .object({
      mappingConfidence: z.number().min(0).max(1).default(0.7),
      minimumTraceCoverage: z.number().min(0).max(1).default(0.7),
      minimumCausalCoverage: z.number().min(0).max(1).default(0.5),
      maximumHighRiskUncovered: z.number().int().nonnegative().default(0),
    })
    .default({}),
  causal: z
    .object({
      runsPerEval: z.number().int().min(2).max(100).default(3),
      minimumBaselinePassRate: z.number().min(0).max(1).default(0.8),
      minimumDetectionEffect: z.number().positive().max(1).default(0.5),
      /** Detection at or below this counts as pseudo-coverage. */
      pseudoCoverageCeiling: z.number().min(0).max(1).default(0.1),
      strictMutationValidation: z.boolean().default(false),
      mutationType: z.enum(["removal", "boundary"]).default("removal"),
      /** Sampling temperature for the candidate model under test. */
      candidateTemperature: z.number().min(0).max(2).default(0),
    })
    .default({}),
  mapping: z
    .object({
      /** Lexical candidates offered to the mapper per rule; 0 sends all. */
      candidatesPerRule: z.number().int().min(0).max(500).default(8),
      /** Upper bound on rule/eval pairs in one mapping request. */
      maxPairsPerRequest: z.number().int().min(4).max(2000).default(60),
    })
    .default({}),
  generate: z
    .object({
      /** Candidate cases requested per rule. */
      casesPerRule: z.number().int().min(1).max(12).default(4),
      /** Where accepted cases are written so config.evals can pick them up. */
      acceptedFile: z.string().default("./evals/causeval-generated.yaml"),
      /** Staging file holding unreviewed candidates. */
      stagingFile: z.string().default(".causeval/generated-evals.yaml"),
    })
    .default({}),
  redundancy: z
    .object({
      /** One extra cached analysis call that flags overlapping rules. */
      enabled: z.boolean().default(true),
    })
    .default({}),
  output: z
    .object({
      json: z.string().default(".causeval/report.json"),
      html: z.string().default(".causeval/report.html"),
    })
    .default({}),
  overrides: z
    .object({
      mappings: z.record(z.array(z.string())).default({}),
      rejectedMappings: z.record(z.array(z.string())).default({}),
      ignoredRules: z.array(z.string()).default([]),
      /** Stable key to free-text justification, shown in the report. */
      acceptedRisks: z.record(z.string()).default({}),
    })
    .default({}),
  runnerTimeoutMs: z.number().int().positive().default(30000),
  maxPromptChars: z.number().int().min(1000).default(24000),
});
export type Config = z.infer<typeof ConfigSchema>;
export function defineConfig(config: z.input<typeof ConfigSchema>) {
  return config;
}
export const MATURITY = [
  "prompt-only",
  "prompt-and-evals",
  "prompt-evals-and-runner",
] as const;
export const SummarySchema = z.object({
  maturity: z.enum(MATURITY),
  evalSuiteDetected: z.boolean(),
  totalRules: z.number(),
  totalEvals: z.number(),
  generatedUnreviewed: z.number().default(0),
  traceCovered: z.number(),
  traceCoverage: z.number(),
  causalCoverage: z.number().nullable(),
  causallyCovered: z.number(),
  pseudoCovered: z.number(),
  uncovered: z.number(),
  flaky: z.number(),
  indeterminate: z.number(),
  highRiskUnprotected: z.number(),
  untestedBoundaries: z.number(),
  possibleRedundancies: z.number().default(0),
  /** Baseline pass rate of the mapped evals actually executed, or null. */
  baselinePassRate: z.number().nullable().default(null),
  severity: z
    .object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    })
    .default({ critical: 0, high: 0, medium: 0, low: 0 }),
});
export const RunMetadataSchema = z.object({
  causevalVersion: z.string(),
  mode: z.enum(["scan", "verify", "generate"]),
  startedAt: z.string(),
  promptFile: z.string().nullable(),
  promptHash: z.string(),
  evalFiles: z.array(z.string()).default([]),
  evalSuiteHash: z.string(),
  provider: z.string(),
  model: z.string(),
  temperature: z.number(),
  seed: z.number().nullable(),
  judgeProvider: z.string().nullable(),
  judgeModel: z.string().nullable(),
  runner: z.object({
    kind: z.enum(["none", "fixture", "native", "custom"]),
    /** Never the raw command: a custom runner is identified by hash only. */
    identity: z.string().nullable(),
  }),
  runsPerEval: z.number(),
  thresholds: z.record(z.number()),
  causal: z.record(z.union([z.number(), z.string(), z.boolean()])),
  cache: z.boolean(),
});
export type RunMetadata = z.infer<typeof RunMetadataSchema>;
export const RedundancySchema = z.object({
  ruleId: z.string(),
  overlapsWithRuleId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});
export type Redundancy = z.infer<typeof RedundancySchema>;
export const GapSchema = z.object({
  ruleId: z.string(),
  coveredDimensions: z.array(z.enum(DIMENSIONS)),
  missingDimensions: z.array(z.enum(DIMENSIONS)),
  reason: z.string(),
});
export type CoverageGap = z.infer<typeof GapSchema>;
export const ReportSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  project: z.object({
    name: z.string(),
    generatedAt: z.string(),
    provider: z.string(),
    model: z.string(),
    fixture: z.boolean(),
    verified: z.boolean(),
    mappingConfidence: z.number().min(0).max(1).default(0.7),
  }),
  run: RunMetadataSchema,
  summary: SummarySchema,
  rules: z.array(RuleSchema),
  evals: z.array(EvalSchema),
  mappings: z.array(MappingSchema),
  causalResults: z.array(CausalResultSchema),
  redundancies: z.array(RedundancySchema).default([]),
  gaps: z.array(GapSchema).default([]),
  /** Stable key to the justification a developer recorded for an exception. */
  acceptedRisks: z.record(z.string()).default({}),
  warnings: z.array(z.string()),
  suggestions: z
    .array(
      z.object({
        ruleId: z.string(),
        dimension: z.enum(DIMENSIONS),
        reason: z.string(),
        eval: EvalSchema,
      }),
    )
    .default([]),
});
export type Report = z.infer<typeof ReportSchema>;
