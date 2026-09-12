# CausEval methodology

This document states exactly what CausEval measures, how each number is
produced, and what it cannot tell you. It is written to be checkable: every
formula corresponds to code in `packages/core`, and every threshold is
configurable and recorded in the report.

**One-sentence claim.** CausEval measures whether an existing eval suite detects
the controlled removal of individual behavioral instructions from a system
prompt, under one specific model and configuration.

It does not measure correctness, safety, compliance, or the absence of harmful
behavior, and it does not establish that an eval suite is good or bad in
general.

## 1. Definitions

| Term                 | Definition                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Behavioral rule**  | One atomic, externally observable instruction extracted from the system prompt, carrying an exact source quote and a line range.                                                          |
| **Stable key**       | SHA-256 over the normalised expected behavior and condition, truncated to 24 hex characters. Two rules with the same stable key are treated as the same behavior across runs and commits. |
| **Mapping**          | A judgement that a specific eval can (`direct`), partly can (`partial`), or cannot (`none`) detect a violation of a specific rule, with a confidence in [0, 1].                           |
| **Credible mapping** | A `direct` mapping whose confidence is at least `thresholds.mappingConfidence` (default 0.70).                                                                                            |
| **Mutation**         | A minimal, byte-level edit of the prompt that removes exactly one rule's source clause, or shifts exactly one numeric threshold.                                                          |
| **Baseline**         | Repeated execution of a rule's mapped evals against the unmodified prompt.                                                                                                                |
| **Mutant**           | The same executions against the mutated prompt.                                                                                                                                           |
| **Detection effect** | Baseline pass rate minus mutant pass rate.                                                                                                                                                |

Let `R` be the set of extracted rules after declared manual exclusions, `E` the
set of accepted evals, and `M(r)` the subset of `E` with a credible mapping to
rule `r`.

## 2. Formulas

### Trace Coverage

```text
TraceCoverage = |{ r in R : M(r) is non-empty }| / |R|
```

With an empty `R` the value is 0. With an empty `E` the value is 0 _by
definition, not by measurement_: there is nothing to map. The report marks that
case explicitly (`summary.evalSuiteDetected = false`) so a 0% is never mistaken
for a measured failure.

### Causal Rule Coverage

For repeated binary outcomes over evals in `M(r)` and runs `k = 1..n`:

```text
B(r) = mean of baseline outcomes
U(r) = mean of mutant outcomes
D(r) = B(r) - U(r)
```

A rule is **causally covered** when all of the following hold:

1. `M(r)` is non-empty;
2. a valid isolated mutation was produced;
3. `B(r) >= causal.minimumBaselinePassRate` (default 0.80);
4. every individual eval in `M(r)` also has a baseline pass rate at or above
   that floor, so one unstable test cannot hide inside an aggregate;
5. `D(r) >= causal.minimumDetectionEffect` (default 0.50).

```text
CausalRuleCoverage = |{ r in R : r is causally covered }| / |R|
```

A scan reports CRC as `null`, never as 0.

### Classification

| Classification     | Condition                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `causally-covered` | Stable baseline and `D(r) >= 0.50` by default.                                                                                         |
| `pseudo-covered`   | Stable baseline and `D(r) <= 0.10` by default.                                                                                         |
| `indeterminate`    | Effect between the two thresholds, fewer than two runs per phase, or a failed experiment such as a refused mutation or a runner error. |
| `flaky`            | Aggregate or per-eval baseline pass rate below 0.80 by default.                                                                        |
| `uncovered`        | `M(r)` is empty, so no experiment was run.                                                                                             |

Severity never enters either metric. It is reported separately and used only for
the high-risk gate.

## 3. Extraction

The prompt is split into chunks bounded by `maxPromptChars`, each numbered with
**global** 1-based line numbers, and sent to the configured model with a fixed
system prompt (see `extractionPrompt` in `packages/core/src/analysis.ts`).

Every returned rule is validated in code, not trusted:

- `source.exactQuote` must appear verbatim inside the claimed line range;
  otherwise the rule is discarded and a warning is recorded.
- `stableKey` is recomputed locally from the expected behavior and condition.
  The model cannot choose it.
- Display IDs (`R01`, `R02`) are assigned by source order after sorting. They
  are stable within a run but are **not** identities across runs; use
  `stableKey` for that.
- Exact semantic duplicates are merged into one rule that keeps every source
  span, so a repeated instruction is removed everywhere at once.

Chunking is flagged in `warnings`, because a rule that spans a chunk boundary
can be missed.

## 4. Traceability

Mapping answers one question: _if the model violated this rule, would this eval
fail?_ It explicitly rejects topic similarity. The mapping prompt requires two
independent conditions and includes a worked counter-example:

- **Opportunity**: the input actually puts the assistant in the governed
  situation, so a violation is possible.
- **Detection**: the declared assertions or expected behavior would fail if the
  violation occurred.

Before the model sees anything, candidate pairs are pre-selected lexically.
Evals are ranked per rule by inverse-document-frequency weighted token overlap,
and only the top `mapping.candidatesPerRule` (default 8) are offered. Requests
are packed up to `mapping.maxPairsPerRequest` pairs. This keeps cost roughly
linear in the number of rules instead of quadratic in rules times evals.

That pre-selection is a deliberate recall-for-cost trade-off and a threat to
validity: a genuine mapping between a rule and an eval that share no vocabulary
will never be proposed. The report warns when a rule had no lexical candidate at
all. Set `mapping.candidatesPerRule: 0` to send every pair.

Returned mappings are validated against the requested pairs. Unrequested or
duplicated pairs abort the run rather than being silently accepted.

Developers can override any of this. `overrides.mappings` replaces a rule's
mappings, `overrides.rejectedMappings` removes specific pairs, and
`overrides.ignoredRules` removes a falsely extracted rule from the denominator,
each recorded in the report.

## 5. Mutation procedure

Mutation is byte-level and refuses anything it cannot do safely:

1. Re-validate that the quote is present in its recorded line range.
2. Locate the quote inside that range. Refuse if it is absent, or appears more
   than once and is therefore ambiguous.
3. Refuse if the span overlaps the source span of any other extracted rule.
4. Refuse if two spans of the same rule overlap each other.
5. Replace the span with the empty string for a removal, or with the same clause
   carrying a ten-times threshold for a boundary mutation.

Boundary mutation additionally requires exactly one number in the clause and a
directional comparator. Anything ambiguous is refused rather than guessed.

The result always carries a textual diff, so a reviewer sees the exact edit.
Nothing else in the prompt changes: for a removal the mutant is shorter than the
baseline by exactly the length of the quote, and unit tests assert that
surrounding prose, headings and sibling clauses on the same line survive.

With `causal.strictMutationValidation`, the mutant prompt is re-extracted and
the run is rejected unless the target rule is gone and every other rule's stable
key survives. Strict mode is conservative: re-extraction instability produces
`indeterminate`, never a false detection.

## 6. Repeated runs and uncertainty

`causal.runsPerEval` is at least 2 by schema and defaults to 3. Single-run
causal claims cannot be configured.

Every statistic carries a Wilson score interval. At three runs that interval is
very wide, which is the point: it shows that three runs is a practical default,
not statistical proof. The intervals are descriptive. CausEval performs no
hypothesis test and reports no p-value, because these sample sizes would not
support one.

Analysis and judging default to `temperature: 0`. The candidate model under test
also defaults to `causal.candidateTemperature: 0`. Raise it to sample the
nondeterminism your production system actually has, and expect more `flaky`
results as a consequence.

Instability is never converted into a causal conclusion. An unstable baseline
becomes `flaky`; a runner error, a refused mutation, or an ambiguous effect
becomes `indeterminate` with the reason recorded on the result.

## 7. Pseudo-coverage, stated precisely

A `pseudo-covered` result means exactly this:

> Under the tested model and configuration, this eval did not detect removal of
> this instruction.

It does **not** mean the rule is untested, that the eval is worthless, or that
the behavior is unprotected in production. There are at least three
explanations, and this experiment cannot distinguish between them:

1. **Weak eval.** The eval never creates a real violation opportunity, or its
   assertion could not detect the violation. This is the case CausEval is
   designed to find.
2. **Model prior.** The base model follows the behavior from training even
   without the instruction. "Never reveal passwords" is the canonical example:
   remove it and a well-aligned model still refuses. The eval keeps passing and
   the eval may be perfectly good.
3. **Behavioral redundancy.** Another rule still in the prompt preserves the
   same observable behavior. See section 8.

Every `pseudo-covered` result therefore carries a `model-prior` confounder in
the report, in the JSON and in the HTML, stating that the experiment cannot
separate a weak eval from a strong prior.

Practical consequence: treat pseudo-coverage as a prompt for review, not a
verdict. The useful follow-up question is "if this instruction disappeared in a
refactor, would anything downstream tell me?" A model that no longer holds the
behavior, after a version bump, a provider switch or a fine-tune, is exactly the
scenario where a pseudo-covered rule bites.

## 8. Redundancy and confounding

Prompt rules overlap. "Never expose private information" and "Never disclose
account numbers" protect overlapping behavior; deleting the narrow one changes
nothing because the broad one still applies. That is behavioral redundancy, not
necessarily a weak eval.

CausEval makes one cached analysis call per scan asking which rules would still
be enforced by a remaining rule if deleted. Pairs it returns are recorded in
`report.redundancies`. When a rule classified `pseudo-covered` appears in that
list, the result gains a second confounder whose detail begins
`POSSIBLE REDUNDANCY`, naming the rule that may be preserving the behavior.

The classification itself is **not** changed. Silently reclassifying would trade
one hidden assumption for another. The uncertainty is exposed instead, and the
report points at the stronger experiment: remove both rules together.

Redundancy detection is itself a model judgement and can be wrong in both
directions. It can be disabled with `redundancy.enabled: false`, and a failure
degrades to a warning rather than failing the run.

## 9. Judge dependence

Deterministic assertions run first and cannot be overruled. An eval may declare
`mustContain`, `mustNotContain`, `mustMatch`, `mustNotMatch`, `json` and
`jsonSchema`; if any fails, the eval fails and the LLM judge is never consulted.
An eval can opt out of judging entirely with `expected.judge: false`, which the
schema permits only when at least one deterministic assertion exists. Prefer
deterministic assertions: they are free, reproducible, and cannot be talked out
of a verdict by the output they are scoring.

When a judge is used:

- it is configured separately (`judge` in the config) and its provider and model
  are recorded in `report.run.judgeProvider` and `report.run.judgeModel`;
- it runs at temperature 0, and its verdicts are cached per distinct expectation
  and output pair, so identical outputs always receive identical verdicts and
  the same verdict is never billed twice;
- it never sees the system prompt, so it cannot know whether it is scoring a
  baseline or a mutant. That removes the most obvious source of bias;
- the candidate output is passed as untrusted data with an explicit instruction
  not to follow directions inside it.

LLM judges still make mistakes, and a wrong verdict propagates straight into the
pass rates and therefore the classification. If a result looks wrong, read the
judge's stated evidence in `causalResults[].evidence[].outcomes[].reason` before
trusting the label.

## 10. Reproducibility

Every report records what a reader needs to reproduce the run: CausEval version,
report schema version, mode, start time, prompt file and prompt hash, eval file
list and eval-suite hash, provider, model, temperature, seed where supported,
judge provider and model, runner kind and a secret-free runner identity, runs
per eval, every threshold, every causal setting, and whether the cache was used.

Custom runners are identified by a SHA-256 digest of the command, never by the
command itself, because a command line can embed credentials. No secret is
written to a report: key-like configuration fields are replaced wholesale and
known key patterns are redacted from every string.

## 11. Threats to validity

Ordered roughly by how often they matter in practice.

1. **Model dependence.** Every causal result is conditional on one model,
   temperature and provider. A different model can move a rule between
   `causally-covered` and `pseudo-covered` with no change to the evals at all.
   CRC is not a property of the eval suite alone.
2. **Model priors.** As in section 7: a behavior retained after removal is not
   evidence that the eval is bad.
3. **Behavioral redundancy.** Section 8. Overlapping rules systematically
   inflate pseudo-coverage.
4. **Small samples.** Three runs per eval is cheap, not conclusive. Wilson
   intervals at three runs are wide enough to be nearly uninformative. Treat
   individual results as signals to review, and raise `runsPerEval` before
   making a decision that matters.
5. **Extraction error.** The rule set is model output. It can split one behavior
   into two, merge two into one, miss an implicit rule, or misjudge severity.
   Verifying every quote against the source bounds fabrication but not omission.
   Both metrics have the rule count in the denominator, so extraction quality
   moves both.
6. **Mapping recall.** Lexical candidate pre-selection can hide a genuine
   mapping, and mapper confidence is an uncalibrated self-report.
7. **Judge error.** Section 9.
8. **Correlated evals.** Several mapped evals sharing an input pattern do not
   provide independent evidence, but they are averaged as if they did.
9. **Prompt-only scope.** CausEval mutates the system prompt. Behavior enforced
   by tool schemas, guardrail services, retrieval or application code is
   invisible to it, and a rule protected elsewhere will still look
   pseudo-covered.
10. **Eval execution environment.** Native mode calls the model directly with no
    tools, so a tool-policy rule can only be assessed through what the model
    says. A custom runner that drives the real agent gives stronger evidence and
    should run against mocked or sandboxed tools.
11. **Generated evals.** Cases drafted by `causeval generate` are unreviewed
    model output. They are excluded from every metric until a developer accepts
    them, precisely so generated tests cannot inflate coverage.

## 12. What would make this a study

CausEval ships the mechanism, not a benchmark. A credible study would sample
open-source systems with published prompts and evals, pre-register the
extraction review protocol, mutation integrity review, run budget and thresholds,
use more than one model, report confidence intervals, and have an independent
reviewer audit a sample of classifications. No such study is claimed here, and
no number in this repository describes a real system: the bundled example is a
deterministic fixture that demonstrates the method.
