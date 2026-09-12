# Research notes

The full treatment — definitions, formulas, extraction, traceability, mutation,
repeated runs, pseudo-coverage, redundancy, model and judge dependence, and
threats to validity — is in [methodology](methodology.md). This page is the
short version plus what a study would need.

## Summary

Let `R` be the extracted rules after declared exclusions, `E` the accepted eval
suite, and `M(r)` the evals with a `direct` mapping at or above confidence `t`.

```text
TraceCoverage = |{ r in R : M(r) non-empty }| / |R|
D(r)          = baseline pass rate - mutant pass rate
CRC           = |{ r in R : stable baseline and D(r) >= delta }| / |R|
```

An empty `R` yields 0 and fails a gate. An empty `E` yields 0 by definition and
is labelled as such. A scan leaves CRC undefined (`null`).

Thresholds are descriptive heuristics, not confidence intervals or
certification. Severity is reported separately and enters neither metric.

## Known limitations

Small-sample noise, correlated evals, imperfect source atomicity, uncalibrated
mapper confidence, semantically unstable extraction, judge error, redundant
instructions, and behavior retained from model priors. Rule removal establishes
prompt dependence under sampled inputs; it does not establish universal
behavioral protection, and a lower CRC is not evidence that a model is unsafe.

## The bundled fixture

The example deliberately maps four weak, topic-only tests with high confidence.
Deterministic outputs and assertions then expose them as pseudo-covered, and one
rule pair is deliberately redundant so the redundancy confound is visible. The
fixture demonstrates the mechanics. It is not evidence about any real model, and
no number in this repository describes a real system.

## A possible study

Sample open-source systems with published prompts and eval suites. Compare
conventional pass rate, Trace Coverage and CRC. Pre-register the extraction
review protocol, mutation integrity review, run budget, thresholds and the model
set. Report confidence intervals, use more than one model, and have an
independent reviewer audit a sample of classifications.

The question is whether conventional eval pass rates overstate protection of the
behavioral contract. **No such study has been run and no results are claimed
here.**
