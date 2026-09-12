# Manual overrides

Rule extraction and eval mapping are model judgements. They are wrong sometimes,
and CausEval is built on the assumption that you will need to correct it. Every
override is declarative, lives in your config, and is reported.

## Ignore a falsely extracted rule

Rules are addressed by **stable key**, not by display id: `R07` is positional and
changes when the prompt changes, while the stable key is a hash of the
normalised behavior.

```ts
export default {
  overrides: {
    // "Be friendly and warm." is a persona statement, not a testable rule.
    ignoredRules: ["3f9c1a77b204d6e58c1e4b02"],
  },
};
```

The rule leaves both the numerator and the denominator of every metric, and the
report records a warning naming how many rules were excluded, so the exclusion
is never invisible.

Find the stable key in `report.json` under `rules[].stableKey`, or in the HTML
report's rule drawer.

## Force a rule to eval mapping

```ts
overrides: {
  mappings: {
    "a6cecfebceb037c5df9d4b94": ["refund-boundary", "refund-bypass"],
  },
},
```

This **replaces** every model mapping for that rule. Each entry is marked
`manual: true` in the report with the rationale "Manual mapping; dimensions not
automatically inferred." — dimensions are not guessed for manual mappings, so a
forced mapping will not silently claim to cover the boundary dimension. An
unknown eval id fails the run with a clear message rather than being dropped.

## Reject an incorrect mapping

To remove specific pairs while keeping the rest of the model's judgement:

```ts
overrides: {
  rejectedMappings: {
    "ffd3e769ed8dab093f15df72": ["identity-check"],
  },
},
```

Use this when the mapper was over-confident about one eval. Use `mappings` when
you want to take over the rule entirely.

## Annotate an intentional exception

Some rules are knowingly unprotected: the behavior is enforced elsewhere, or the
risk is accepted.

```ts
overrides: {
  acceptedRisks: {
    "07039fb53c5fb2e06ecf3c22":
      "Card numbers are masked by the gateway before the model ever sees them.",
  },
},
```

The justification is rendered in the rule's drawer in the HTML report. It is
deliberately **not** subtracted from any metric: an accepted risk is still an
uncovered rule, it just has a recorded reason. Hiding it from the count would
make the number mean something different for every project.

## Review generated evals

Generated cases are gated by `causeval review` rather than by config. See
[Starting with no evals](no-evals.md). The rule is the same: nothing counts as
coverage until a person says so.

## Tuning thresholds

Thresholds are not overrides, but they are the other honest lever:

```ts
thresholds: { mappingConfidence: 0.85 },   // demand stronger mapper confidence
causal: { runsPerEval: 5 },                // more evidence per rule
mapping: { candidatesPerRule: 0 },         // consider every rule/eval pair
```

Every threshold in effect is echoed into `report.run`, so a reader can always
see which settings produced a number.
