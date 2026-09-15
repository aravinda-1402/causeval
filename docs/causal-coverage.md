# Causal Rule Coverage

For each credibly mapped rule:

1. Re-validate the exact quote inside its recorded source range.
2. Remove the smallest source clause. Refuse if it is ambiguous, or overlaps an
   unrelated rule.
3. In strict mode, re-extract the mutant and compare stable keys.
4. Execute every mapped eval `runsPerEval` times on the baseline prompt and
   `runsPerEval` times on the mutant.
5. Store every outcome, the per-eval breakdown, and the textual diff.

Detection effect `D = baseline pass rate - mutant pass rate`. Defaults:
`D >= 0.50` with a baseline at or above 0.80 is causally covered; `|D| <= 0.10`
with a stable baseline is pseudo-covered. An inverted effect below `-0.10`
is indeterminate and explicitly flagged; the positive band between 0.10 and
0.50 is also indeterminate. An
unstable baseline, aggregate or per eval, is flaky.

```text
Baseline pass rate: 100% (3/3)
Mutant pass rate:     0% (0/3)
Detection effect:   100%   ->  CAUSALLY COVERED
```

Every result carries the thresholds it was judged against, a Wilson interval on
each pass rate, a per-eval breakdown, and a one-sentence interpretation, so no
conclusion is hidden behind a score.

**Pseudo-coverage is a statement about this experiment, not a verdict on your
eval.** It means: under the tested model and configuration, this eval did not
detect removal of this instruction. A base model may keep the behavior without
being told, and another rule may still enforce it. Both confounds are attached
to the result. See [methodology](methodology.md) sections 7 and 8 for the full
treatment.

Rule removal is the default mutation. Boundary mutation multiplies a threshold
by ten and is restricted to a clause with exactly one number and a directional
comparator; ambiguous cases are refused rather than guessed.

Causal verification should run against mocked, sandboxed or otherwise
non-production tools.
