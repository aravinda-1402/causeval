# Contributing

Thanks for helping. CausEval makes claims about behavior, so the bar is that a
reader can check every claim — in the code, in a test, and in the report.

## Setup

Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm build          # the GitHub Action tests run the built CLI, so build first
pnpm test
pnpm dev            # website at http://127.0.0.1:3000
```

## Before opening a pull request

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:web
pnpm demo:generate && git diff --exit-code   # committed artifacts must match
```

CI runs exactly this. `pnpm format` fixes formatting.

## Where things live

| Path                            | What it owns                                                              |
| ------------------------------- | ------------------------------------------------------------------------- |
| `packages/core/src/analysis.ts` | Extraction, mapping, redundancy, gap analysis, and every analysis prompt. |
| `packages/core/src/mutation.ts` | Byte-level prompt mutation and its refusals.                              |
| `packages/core/src/engine.ts`   | The pipeline, classification, summary, gates and diffs.                   |
| `packages/core/src/runner.ts`   | Native and custom eval execution.                                         |
| `packages/core/src/fixture.ts`  | The deterministic example that backs `demo`, `init` and most tests.       |
| `packages/cli/src/index.ts`     | Config loading, commands, artifacts, exit codes.                          |
| `packages/action/`              | The composite GitHub Action.                                              |

## Rules of the road

These are the invariants the tests defend. Please do not loosen them.

- **An infrastructure error is never evidence.** A runner failure, a refused
  mutation or an unparsable response becomes `indeterminate`, never a detection.
- **Mutations stay minimal.** Removing a rule must change exactly the length of
  its quote and nothing else. Overlapping and ambiguous spans are refused.
- **Unstable baselines cannot hide.** Per-eval stability is checked as well as
  the aggregate.
- **Model output is validated, never trusted.** Every quote is checked against
  the source; stable keys are computed locally; mappings outside the requested
  pairs abort the run.
- **Generated evals never count until a human accepts them.**
- **No claim beyond the evidence.** Pseudo-coverage says "this eval did not
  detect removal under this model", not "this rule is untested". If you add a
  conclusion, add the confound that could explain it away.
- **No secrets in artifacts.** Reports, logs, cache keys and error messages are
  redacted; a custom runner is identified by a digest of its command.

New causal logic needs a deterministic test. `tests/helpers.ts` has a
`StubProvider` for scripting model responses, including hostile ones. Regenerate
fixture artifacts with `pnpm demo:generate` whenever fixture or engine behavior
changes.

## Good first contributions

- **`good first issue`** — error messages, docs, report accessibility, new
  worst-case fixtures in `tests/robustness.test.ts`.
- **`help wanted`** — anything on the roadmap that is not started.
- **`adapter`** — runners that wrap Promptfoo, DeepEval, pytest or an in-house
  harness.
- **`false positive`** — a rule extracted, mapped or classified wrongly. Include
  a minimal anonymised prompt and eval so it can become a fixture.
- **`research`** — methodology, thresholds, redundancy detection, confidence
  handling, study design.

## Reporting a wrong result

Open a `false positive` issue with the minimal prompt and eval that reproduces
it, the relevant slice of `report.json` (`rules`, `mappings`, or the
`causalResults` entry), and the provider and model from `report.run`. Remove
private prompt content, account identifiers and secrets first.

By contributing you agree your contributions are licensed under Apache-2.0.
