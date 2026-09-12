---
name: Wrong rule, mapping or classification
about: CausEval extracted, mapped or classified something incorrectly
labels: false positive
---

The most valuable issues here become test fixtures, so a minimal anonymised
reproduction matters more than a long description.

## Which stage got it wrong

- [ ] Extraction — a rule that should not exist, a missing rule, or a bad split
- [ ] Mapping — an eval marked as covering a rule it cannot falsify, or the reverse
- [ ] Classification — a causal result that does not match the evidence

## Minimal prompt snippet (anonymised)

```text

```

## Eval involved (anonymised), if any

```yaml

```

## What CausEval produced

Paste the relevant `rules[]`, `mappings[]` or `causalResults[]` entry.

## What it should have produced, and why

## Environment

Provider and model from `report.run`, and CausEval version.
