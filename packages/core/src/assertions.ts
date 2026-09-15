import { Script } from "node:vm";
import type { EvalCase, JsonShape } from "./schemas.js";

export interface AssertionResult {
  passed: boolean;
  failures: string[];
}
type Expectation = EvalCase["expected"];

/** Only this fixed program is executed; patterns and output are data, never
 * JavaScript source. V8's execution deadline interrupts regex backtracking.
 * This is a time bound, not a sandbox for executing user code. */
const regexAssertions = new Script(`
  const failures = [];
  for (const [patterns, shouldMatch] of groups) {
    for (const pattern of patterns) {
      let regex;
      try { regex = new RegExp(pattern); }
      catch { failures.push('invalid regular expression: ' + pattern); continue; }
      if (regex.test(subject) !== shouldMatch)
        failures.push((shouldMatch ? 'mustMatch: ' : 'mustNotMatch: ') + pattern);
    }
  }
  failures;
`);

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
/** Validates the documented JSON Schema subset: type, required, properties,
 * items and enum. Unsupported keywords are rejected by the Zod schema. */
export function matchesShape(
  value: unknown,
  shape: JsonShape,
  path = "$",
): string[] {
  const failures: string[] = [];
  if (shape.type) {
    const actual = typeOf(value);
    const ok =
      shape.type === "integer"
        ? typeof value === "number" && Number.isInteger(value)
        : actual === shape.type;
    if (!ok)
      failures.push(
        `${path} expected type ${shape.type} but received ${actual}`,
      );
  }
  if (
    shape.enum &&
    !shape.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))
  )
    failures.push(`${path} is not one of the allowed values`);
  if (shape.required)
    for (const key of shape.required)
      if (!value || typeof value !== "object" || !(key in value))
        failures.push(`${path} is missing required property ${key}`);
  if (shape.properties && value && typeof value === "object")
    for (const [key, child] of Object.entries(shape.properties))
      if (key in (value as Record<string, unknown>))
        failures.push(
          ...matchesShape(
            (value as Record<string, unknown>)[key],
            child,
            `${path}.${key}`,
          ),
        );
  if (shape.items && Array.isArray(value))
    value.forEach((item, index) =>
      failures.push(...matchesShape(item, shape.items!, `${path}[${index}]`)),
    );
  return failures;
}
export function hasDeterministicAssertions(expected: Expectation): boolean {
  return Boolean(
    expected.mustContain?.length ||
    expected.mustNotContain?.length ||
    expected.mustMatch?.length ||
    expected.mustNotMatch?.length ||
    expected.json ||
    expected.jsonSchema,
  );
}
/**
 * Runs every deterministic assertion an eval declares. These are preferred to
 * LLM judging: they are free, reproducible and cannot be talked out of a
 * verdict by the candidate output.
 */
export function checkAssertions(
  output: string,
  expected: Expectation,
): AssertionResult {
  const failures: string[] = [];
  for (const needle of expected.mustContain ?? [])
    if (!output.includes(needle))
      failures.push(`mustContain: missing ${JSON.stringify(needle)}`);
  for (const needle of expected.mustNotContain ?? [])
    if (output.includes(needle))
      failures.push(`mustNotContain: found ${JSON.stringify(needle)}`);
  if (expected.mustMatch?.length || expected.mustNotMatch?.length) {
    try {
      failures.push(
        ...(regexAssertions.runInNewContext(
          {
            subject: output,
            groups: [
              [expected.mustMatch ?? [], true],
              [expected.mustNotMatch ?? [], false],
            ],
          },
          { timeout: 1000 },
        ) as string[]),
      );
    } catch {
      // An evaluator timeout is not a behavioral failure: the engine must
      // classify the experiment as indeterminate, not count causal protection.
      throw new Error(
        "regular expression evaluation exceeded 1000ms or could not complete. Simplify mustMatch/mustNotMatch, or use literal assertions.",
      );
    }
  }
  if (expected.json || expected.jsonSchema) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(output.trim());
    } catch {
      failures.push("json: output is not valid JSON");
      return { passed: false, failures };
    }
    if (expected.jsonSchema)
      failures.push(...matchesShape(parsed, expected.jsonSchema));
  }
  return { passed: failures.length === 0, failures };
}
