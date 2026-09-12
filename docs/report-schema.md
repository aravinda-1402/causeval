# Report schema

`.causeval/report.json` is the stable, machine-readable output. It is intended
to be consumed by other tools: parse it, diff it, store it.

Current version: **`schemaVersion: "1.1"`**.

## Versioning policy

- **Minor bump** (`1.1` to `1.2`): fields added. Existing fields keep their
  names, types and meaning. Consumers should ignore unknown fields.
- **Major bump** (`1.x` to `2.0`): a field is removed, renamed, or its meaning
  changes.
- The literal `schemaVersion` value is validated on read, so a report written by
  a newer major version fails loudly instead of being misinterpreted.
- `report.run.causevalVersion` records the tool version separately from the
  schema version.

Serialization is deterministic: the same report object always produces the same
bytes, and `pnpm demo:generate` plus `git diff --exit-code` is a CI check that
the committed artifacts still match the engine.

## Top-level shape

```jsonc
{
  "schemaVersion": "1.1",
  "project": {/* display metadata */},
  "run": {/* everything needed to reproduce the run */},
  "summary": {/* the headline numbers */},
  "rules": [/* the behavioral contract */],
  "evals": [/* the eval suite that was actually counted */],
  "mappings": [/* rule to eval judgements */],
  "causalResults": [/* one per rule when verified, otherwise empty */],
  "redundancies": [/* rules that may be preserved by another rule */],
  "gaps": [/* which test dimensions each rule is missing */],
  "acceptedRisks": {/* stable key -> developer justification */},
  "warnings": [/* strings */],
  "suggestions": [/* generated, unreviewed candidate evals */],
}
```

## `run`

Records the run so a result can be reproduced or audited. Contains no secrets.

| Field                                      | Meaning                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `causevalVersion`                          | Tool version that produced the report.                                                                                                       |
| `mode`                                     | `scan`, `verify` or `generate`.                                                                                                              |
| `startedAt`                                | ISO-8601 UTC timestamp at the start of analysis.                                                                                             |
| `promptFile`, `promptHash`                 | Prompt path as configured, and `sha256:` prefixed digest.                                                                                    |
| `evalFiles`, `evalSuiteHash`               | Eval files matched by the glob, and a digest of the counted suite.                                                                           |
| `provider`, `model`, `temperature`, `seed` | Analysis provider configuration.                                                                                                             |
| `judgeProvider`, `judgeModel`              | Judge configuration, or `null` when no judge ran.                                                                                            |
| `runner`                                   | `{ kind: none \| fixture \| native \| custom, identity }`. A custom runner's identity is a SHA-256 digest of the command, never the command. |
| `runsPerEval`                              | Repetitions per mapped eval per phase.                                                                                                       |
| `thresholds`, `causal`                     | Every threshold in effect, echoed verbatim.                                                                                                  |
| `cache`                                    | `false` when `--no-cache` was used.                                                                                                          |

## `summary`

| Field                                                                     | Meaning                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `maturity`                                                                | `prompt-only`, `prompt-and-evals` or `prompt-evals-and-runner`.                                         |
| `evalSuiteDetected`                                                       | `false` means Trace Coverage is 0 by definition, not by measurement.                                    |
| `totalRules`, `totalEvals`                                                | Counts after exclusions.                                                                                |
| `generatedUnreviewed`                                                     | Generated cases present but not accepted. Always excluded from every other number here.                 |
| `traceCovered`, `traceCoverage`                                           | Rules with a credible mapping, and the fraction.                                                        |
| `causalCoverage`                                                          | Fraction, or `null` when verification did not run.                                                      |
| `causallyCovered`, `pseudoCovered`, `uncovered`, `flaky`, `indeterminate` | Classification counts.                                                                                  |
| `highRiskUnprotected`                                                     | High or critical rules without protection (after verify) or without a mapping (after scan).             |
| `untestedBoundaries`                                                      | Rules containing a number with no boundary-dimension mapping.                                           |
| `possibleRedundancies`                                                    | Length of `redundancies`.                                                                               |
| `baselinePassRate`                                                        | Pass rate of the mapped eval runs at baseline, or `null`. This is **not** your whole suite's pass rate. |
| `severity`                                                                | Rule counts by severity.                                                                                |

## `causalResults[]`

One entry per rule when `mode` is `verify`.

| Field                     | Meaning                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ruleId`, `mappedEvalIds` | What was tested.                                                                                                                       |
| `baseline`, `mutant`      | `{ runs, passes, passRate, interval }`. `interval` is a Wilson score interval, descriptive only. `mutant` also carries `mutationType`. |
| `detectionRate`           | `baseline.passRate - mutant.passRate`.                                                                                                 |
| `classification`          | See the methodology document.                                                                                                          |
| `diff`                    | The exact textual mutation, `-` for removed lines and `+` for replacements.                                                            |
| `perEval`                 | Per-eval baseline and mutant pass counts, so an aggregate cannot hide one test.                                                        |
| `thresholds`              | The thresholds this classification was judged against.                                                                                 |
| `interpretation`          | One sentence stating what the evidence supports, in plain language.                                                                    |
| `confounders`             | `model-prior` and `possible-redundancy` entries explaining what the experiment cannot separate.                                        |
| `reason`                  | Present when the experiment failed; explains why the result is indeterminate.                                                          |
| `evidence`                | Every run: phase, run number, and each outcome with `passed`, `output` (redacted) and `reason`.                                        |

## `evals[].causeval`

Present only on cases CausEval generated.

```jsonc
{
  "generated": true,
  "review": "unreviewed", // or "accepted" / "rejected"
  "ruleId": "R05",
  "ruleStableKey": "a6cecfeb...",
  "dimension": "boundary",
  "rationale": "why this case exists",
  "generatedBy": "openai/gpt-4o-mini",
  "generatedAt": "2026-09-11T00:00:00.000Z",
}
```

Any case whose `review` is not `accepted` is removed from the suite before
analysis and counted only in `summary.generatedUnreviewed`.

## Reading it from another tool

```bash
causeval verify --emit-outputs outputs.json
```

`--emit-outputs` writes a small, flat summary (coverage numbers, gate result,
gate reasons, Markdown summary, and absolute paths to every artifact). That is
the supported integration surface for CI: it avoids parsing the full report and
is what the bundled GitHub Action uses.

## Privacy

Reports can contain prompt text, eval inputs and model outputs. Values of
key-like fields are replaced with `[REDACTED]`, and known key patterns are
redacted from every string, but treat redaction as best effort, not as data-loss
prevention. Review a report before committing or sharing it.
