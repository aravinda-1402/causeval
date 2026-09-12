# Concepts

## Three maturity levels

CausEval gives you something useful at each stage, and says plainly which stage
you are in (`summary.maturity`).

| You have                           | Command           | You get                                                                     |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| A system prompt                    | `causeval scan`   | The behavioral contract: atomic rules with exact source, type and severity. |
| Prompt + evals                     | `causeval scan`   | Trace Coverage: which rules a test could actually falsify.                  |
| Prompt + evals + a way to run them | `causeval verify` | Causal Rule Coverage: which rules your tests actually protect.              |

## Terms

A **behavioral rule** is one atomic, externally testable instruction with an
exact source quote. Display ids (`R01`) are positional; **stable keys** are
SHA-256 hashes of the normalised behavior and condition, and are what survives
across runs and commits. Exact semantic duplicates keep every source span;
paraphrases are not aggressively merged.

**Trace Coverage** = rules with a direct mapping above the confidence threshold,
divided by total rules. A topic-related test is not a falsifying test: the
mapper must believe the eval creates a real violation opportunity _and_ would
detect the violation.

**Causal Rule Coverage (CRC)** = rules with a stable baseline whose mutation is
reliably detected, divided by total rules.

## Classifications

| Label                | Meaning                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Causally covered** | Removing the instruction made the mapped evals fail.                                                                                                                       |
| **Pseudo-covered**   | Stable baseline, credible mapping, and removal went undetected. Under the tested model and configuration, the eval did not notice. That is not proof the rule is untested. |
| **Uncovered**        | No credible mapping, so no experiment ran.                                                                                                                                 |
| **Flaky**            | Unstable baseline. No causal claim is possible in either direction.                                                                                                        |
| **Indeterminate**    | Insufficient evidence, a runner error, an ambiguous effect, or an unsafe mutation.                                                                                         |

Severity affects neither metric's denominator. It drives the high-risk gate and
which dimensions a rule is expected to be tested along.

Rules explicitly ignored by stable key are excluded and reported as a warning.
Generated evals that have not been accepted are excluded from every metric and
counted separately. An empty rule set is 0% and fails a coverage gate; a scan
shows CRC as not verified rather than 0%.

CausEval measures whether existing evals detect controlled removal of behavioral
instructions. It provides testing evidence, not proof of correctness, security,
safety, compliance, or absence of harmful behavior. The full argument, including
threats to validity, is in [methodology](methodology.md).
