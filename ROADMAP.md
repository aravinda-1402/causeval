# Roadmap

## v0.1 — shipped

Behavioral rule extraction with verified source provenance. Trace Coverage.
Repeated-run causal removal testing with per-eval evidence, Wilson intervals and
stated confounds. Boundary mutation. Eval generation for missing dimensions,
gated behind human review. Redundancy detection. Deterministic assertions
including regex and a JSON Schema subset. Native and custom runners. Versioned
JSON report, standalone HTML report, Markdown summary and static badges. CLI,
GitHub Action, and a zero-config deterministic demo.

## v0.2 — next

- First-class Promptfoo and DeepEval adapters.
- Multi-rule mutation, so a redundant pair can be removed together and the
  redundancy confound resolved rather than only reported.
- Broader boundary mutation: enumerated values, units, time windows.
- Calibration work on mapper confidence, which is currently an uncalibrated
  self-report.
- Report diff as a first-class artifact rather than CLI output.

## v0.3 — later

- Behavioral contract history across commits.
- Semantic candidate retrieval for very large suites, to lift the recall limit
  that lexical pre-selection imposes.
- Atomicity diagnostics: flag rules the extractor probably should have split.
- Per-provider validation of extraction and judging quality.

## Research

Design and pre-register a study comparing conventional eval pass rate, Trace
Coverage and Causal Rule Coverage across open-source systems, across more than
one model. Publish data only after collection and independent review. **No
benchmark outcomes are claimed in this repository.**

## Deliberately out of scope

Accounts, billing, hosted dashboards, databases, generic observability, prompt
management, an agent framework, hosted execution of user code, and team
collaboration features. CausEval stays one thing: prompt to behavioral contract
to eval traceability to controlled mutation to causal coverage.
