# Example: Aura, a support agent

A realistic support-agent system prompt with privacy, identity verification, a
financial threshold, tool policy, grounding, escalation and structured-output
rules — and an eval suite that only partly protects them, on purpose.

```bash
pnpm causeval verify --config examples/support-agent/causeval.config.ts --suggest
```

```text
  Behavioral rules             12   (3 critical, 6 high, 2 medium, 1 low)
  Eval cases                    9

  Trace Coverage               75%   9 / 12 rules mapped
  Causal Rule Coverage         42%   5 / 12 rules protected

  Baseline pass rate: 100% (27/27 mapped eval runs)
  4 behavior(s) kept passing after their instruction was removed.
```

## What each part of the example demonstrates

| Result               | Rules                                                                                     | Why                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Causally covered** | identity verification, ticket IDs, the refund threshold, takeover escalation, JSON output | The eval creates a real violation opportunity and asserts something that fails without the rule. |
| **Pseudo-covered**   | email confirmation, refund tool limit, grounding, invented balances                       | The eval shares the topic but never reaches the boundary. It passes with or without the rule.    |
| **Uncovered**        | card numbers, automatic refunds under $100, unsupported operations                        | No eval maps to them at all.                                                                     |

Two rules share line 8 and two more share line 12, so the mutation stage has to
remove one clause and leave its neighbour intact — visible in each rule's diff.

The accuracy rules are deliberately overlapping, so the report flags a
**POSSIBLE REDUNDANCY**: a broad grounding rule may still enforce the narrower
"do not invent balances" rule after it is removed. That is a confound, not a
verdict, and the report says so.

The `json-response` eval uses `json`, `jsonSchema` and `judge: false`, showing a
case that needs no LLM judge at all.

## Everything here is generated

`pnpm demo:generate` regenerates the prompt, the eval suite and every artifact
under `.causeval/` from `packages/core/src/fixture.ts`. CI checks that the
committed files still match the engine output.

The provider is a deterministic fixture, not a model. These numbers demonstrate
the mechanics and are **not** a benchmark of any real model.
