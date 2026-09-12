# Starting from a system prompt with no evals

Most AI applications have a system prompt long before they have a formal eval
suite. CausEval is designed for that state, not just for teams that already have
tests.

```text
SYSTEM PROMPT                         causeval scan
      |                               extract the behavioral contract
      v
BEHAVIORAL CONTRACT                   causeval generate
      |                               draft candidate evals for what is missing
      v
REVIEWED EVAL SUITE                   causeval review --accept
      |                               only accepted cases count as coverage
      v
TRACE COVERAGE                        causeval scan
      |
      v
CAUSAL RULE COVERAGE                  causeval verify
```

## 1. Scan a prompt with no evals

```bash
causeval scan
```

No eval files is a supported state, not an error:

```text
  No eval suite detected.

  CausEval extracted 12 behavioral rules from your system prompt.

    Critical  3
    High      6
    Medium    2
    Low       1

  You can generate a starter behavioral eval suite with:

    causeval generate
```

Trace Coverage is reported as 0% and the report states that this is 0% _by
definition_ — there was nothing to map — rather than a measured failure.

## 2. Generate candidate evals

```bash
causeval generate
```

For every rule, CausEval works out which **test dimensions** the rule needs and
which are currently missing, then drafts a case for each:

| Dimension     | What it exercises                                         | Required for                                                                        |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| normal path   | a compliant request handled correctly                     | every rule                                                                          |
| negative path | a realistic request that tempts the violation             | every rule                                                                          |
| boundary      | values just below, at, and just above a threshold         | rules with a numeric threshold and a comparator                                     |
| adversarial   | an explicit attempt to talk the assistant out of the rule | high and critical severity, and security, privacy, tool-policy and escalation rules |

For `Refunds above $100 require manager approval.` that means cases for `$50`,
`$100`, `$101`, `$250` and an attempt to bypass approval — not five random
prompts about refunds.

Generated cases prefer deterministic assertions (`mustContain`,
`mustNotContain`, `mustMatch`, `json`, `jsonSchema`) over prose, so the resulting
suite depends on an LLM judge as little as possible.

Everything is written to `.causeval/generated-evals.yaml` under a header that
says exactly what it is:

```yaml
# GENERATED - UNREVIEWED
# CausEval drafted these cases from your system prompt. They do NOT count as
# coverage until you accept them.
```

## 3. Review: accept, edit, reject

```bash
causeval review --list
```

```text
  [UNREVIEWED] r05-boundary
     rule R05 · boundary
     input: Refund exactly $100, and then refund $101 on the next order.
     why:   No existing eval exercises the boundary of this rule.
```

- **Accept**: `causeval review --accept r05-boundary` (or `--accept all`).
  Accepted cases are written to `evals/causeval-generated.yaml`, which your
  `config.evals` glob already matches, and they start counting as coverage.
- **Edit**: open `.causeval/generated-evals.yaml`, change the case, then accept
  it. Re-running `causeval generate` preserves your review decisions and does not
  overwrite an id you have already judged.
- **Reject**: `causeval review --reject r05-boundary`. The case stays in the
  staging file marked `rejected` so it is not proposed again, and is removed
  from the accepted suite file.

## Why unreviewed cases never count

A generated test is model output. Counting it as coverage would mean the tool
grades its own homework and reports a higher number for having produced more
text. So:

- the eval schema carries `causeval.review`, and anything other than `accepted`
  is stripped out of the suite before any metric is computed;
- the count of excluded cases appears in `summary.generatedUnreviewed`, in the
  CLI output, and in the HTML report;
- `causeval verify` refuses to run on a suite that contains only unreviewed
  cases, and tells you to review them.

This holds even if you point `config.evals` directly at the staging file: the
exclusion is in the engine, not in the glob.

## 4. Then the normal flow

```bash
causeval scan     # Trace Coverage over the reviewed suite
causeval verify   # Causal Rule Coverage, once you can execute the evals
```

`causeval generate` is also useful once you _do_ have evals: it targets only the
dimensions your existing suite leaves uncovered, and after `causeval verify` it
prioritises the rules that came back `uncovered` or `pseudo-covered`.
