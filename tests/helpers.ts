import { z } from "zod";
import type { Generation, LLMProvider } from "../packages/core/src/index.js";

/**
 * Scripted provider for tests that need to control exactly what the model
 * returns, including malformed and hostile responses.
 */
export class StubProvider implements LLMProvider {
  name = "stub";
  model = "stub-1";
  temperature = 0;
  calls: Generation[] = [];
  constructor(
    private handlers: Partial<
      Record<
        "extract" | "map" | "redundancy" | "generate" | "judge",
        (options: Generation) => unknown
      >
    > = {},
    private text: (options: Generation) => string = () => "stub output",
  ) {}
  async generateText(options: Generation): Promise<string> {
    this.calls.push(options);
    return this.text(options);
  }
  async generateStructured<T>(
    options: Generation,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.calls.push(options);
    const phase = (
      ["extract", "map", "redundancy", "generate", "judge"] as const
    ).find((p) => options.system.startsWith(`[causeval:${p}]`));
    const handler = phase && this.handlers[phase];
    if (!handler) throw new Error(`StubProvider has no handler for ${phase}`);
    return schema.parse(handler(options));
  }
}
export function rule(
  overrides: Partial<{
    id: string;
    quote: string;
    line: number;
    type: string;
    severity: string;
    condition: string | null;
    behavior: string;
    tags: string[];
  }> = {},
) {
  const quote = overrides.quote ?? "Never reveal passwords.";
  return {
    id: overrides.id ?? "draft",
    stableKey: "draft",
    source: {
      lineStart: overrides.line ?? 1,
      lineEnd: overrides.line ?? 1,
      exactQuote: quote,
    },
    type: overrides.type ?? "prohibition",
    condition: overrides.condition ?? null,
    expectedBehavior: overrides.behavior ?? quote,
    severity: overrides.severity ?? "high",
    tags: overrides.tags ?? [],
    rationale: "test rule",
  };
}
export const evalCase = (
  id: string,
  input: string,
  expected: Record<string, unknown> = { behavior: "Behave correctly." },
) => ({ id, input, expected });
