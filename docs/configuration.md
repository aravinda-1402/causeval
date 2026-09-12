# Configuration

The CLI loads TypeScript or JavaScript configuration with jiti and validates it
with Zod. Relative prompt, eval and output paths resolve from the config
directory, not the shell's working directory. **Config files execute locally and
must be trusted**, exactly like a build config.

`causeval init` writes a plain object so it works with no dependencies. Once
`causeval` is installed you can wrap it for editor types:

```ts
import { defineConfig } from "causeval";

export default defineConfig({
  prompt: "./prompts/system.md",
  evals: ["./evals/**/*.yaml"],
  provider: { type: "openai", model: process.env.CAUSEVAL_MODEL },
});
```

## Reference

| Setting                               | Default                                   | Notes                                                                                            |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `prompt`                              | `./prompts/system.md`                     | Path to the system prompt.                                                                       |
| `evals`                               | `["./evals/**/*.yaml"]`                   | Globs. No match is fine for `scan` and `generate`; `verify` requires at least one accepted eval. |
| `provider.type`                       | `openai`                                  | `openai`, `anthropic`, `compatible`, `ollama`, `fixture`.                                        |
| `provider.model`                      | `CAUSEVAL_MODEL`                          | No model name is hard-coded anywhere.                                                            |
| `provider.baseURL`                    | `CAUSEVAL_BASE_URL` or the vendor default |                                                                                                  |
| `provider.temperature`                | `0`                                       | Used for analysis and judging.                                                                   |
| `provider.seed`                       | unset                                     | Forwarded to providers that support it; recorded in the report.                                  |
| `provider.timeoutMs`                  | `60000`                                   |                                                                                                  |
| `provider.maxRetries`                 | `2`                                       | Bounded exponential backoff on network errors, 429 and 5xx.                                      |
| `judge`                               | unset                                     | Same shape as `provider`. When unset, the analysis provider judges, in its own cache namespace.  |
| `thresholds.mappingConfidence`        | `0.70`                                    | Minimum confidence for a `direct` mapping to count.                                              |
| `thresholds.minimumTraceCoverage`     | `0.70`                                    | Gate.                                                                                            |
| `thresholds.minimumCausalCoverage`    | `0.50`                                    | Gate, only checked after `verify`.                                                               |
| `thresholds.maximumHighRiskUncovered` | `0`                                       | Gate.                                                                                            |
| `causal.runsPerEval`                  | `3`                                       | Minimum 2, maximum 100.                                                                          |
| `causal.minimumBaselinePassRate`      | `0.80`                                    | Below this, aggregate or per eval, the rule is `flaky`.                                          |
| `causal.minimumDetectionEffect`       | `0.50`                                    | At or above this, the rule is causally covered.                                                  |
| `causal.pseudoCoverageCeiling`        | `0.10`                                    | At or below this, with a stable baseline, the rule is pseudo-covered.                            |
| `causal.candidateTemperature`         | `0`                                       | Temperature for the model under test. Raise it to sample real production variance.               |
| `causal.strictMutationValidation`     | `false`                                   | Re-extract each mutant and reject unsafe edits.                                                  |
| `causal.mutationType`                 | `removal`                                 | Or `boundary`.                                                                                   |
| `mapping.candidatesPerRule`           | `8`                                       | Lexical candidates offered to the mapper per rule. `0` sends every pair.                         |
| `mapping.maxPairsPerRequest`          | `60`                                      | Upper bound on rule/eval pairs per request.                                                      |
| `generate.casesPerRule`               | `4`                                       | Candidate cases requested per rule.                                                              |
| `generate.stagingFile`                | `.causeval/generated-evals.yaml`          | Unreviewed candidates live here.                                                                 |
| `generate.acceptedFile`               | `./evals/causeval-generated.yaml`         | Accepted cases are written here so `evals` picks them up.                                        |
| `redundancy.enabled`                  | `true`                                    | One cached call per scan that flags overlapping rules.                                           |
| `overrides.*`                         | `{}`                                      | See [manual overrides](overrides.md).                                                            |
| `output.json`                         | `.causeval/report.json`                   |                                                                                                  |
| `output.html`                         | `.causeval/report.html`                   |                                                                                                  |
| `runnerTimeoutMs`                     | `30000`                                   | Custom runner timeout.                                                                           |
| `maxPromptChars`                      | `24000`                                   | Soft chunk target for extraction.                                                                |

## Cost and caching

Analysis calls (extraction, mapping, redundancy, generation) and judge verdicts
are cached on disk in `.causeval/cache`, keyed on the CausEval version, provider,
model, temperature, seed and the full request. Changing model, provider,
endpoint or CausEval version invalidates the relevant entries automatically.
`--no-cache` bypasses both reads and writes.

Candidate generation during `verify` is deliberately **not** cached: repeated
runs must sample real variance.

Mapping cost is bounded by `mapping.maxPairsPerRequest` rather than growing with
rules times evals. Rules that share no vocabulary with any eval are reported
uncovered without a model call, and the report warns when that happens.

`--verbose` prints progress and cache hits so you can see how many requests a
run actually made.

## Exit codes

| Code | Meaning                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| `0`  | Completed.                                                                                                     |
| `1`  | Completed, but `--fail-on threshold` found a gate failure. Reasons are printed and stored in `--emit-outputs`. |
| `2`  | Configuration or execution error.                                                                              |

`--fail-on threshold` checks Trace Coverage, CRC (only after `verify`), the
high-risk unprotected count, an empty rule set, an absent eval suite, and any
flaky or indeterminate result.
