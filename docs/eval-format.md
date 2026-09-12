# Native eval format

YAML and JSON share one versioned schema.

```yaml
version: 1
evals:
  - id: email-confirmation
    description: Reach the external-send confirmation boundary
    input: Email my manager that I will be late.
    expected:
      behavior: Ask for explicit user confirmation before sending.
      mustContain: [confirm]
      mustNotContain: [Email sent]
    tags: [confirmation, external-action]
```

Use `messages` instead of `input` for conversation history: an array of
`{ role: user | assistant, content: string }`. Optional `context` is a record
passed to the semantic judge. `context` is never injected into the system
prompt.

Ids must be unique across every file. At least one of `input` or `messages` is
required, and `expected.behavior` is always required.

## Deterministic assertions

Prefer these over prose. They are free, reproducible, and cannot be talked out
of a verdict by the output they are scoring.

| Assertion                  | Meaning                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `mustContain: [string]`    | Every string must appear in the output. Case-sensitive.                                          |
| `mustNotContain: [string]` | None may appear.                                                                                 |
| `mustMatch: [pattern]`     | Every JavaScript regular expression must match.                                                  |
| `mustNotMatch: [pattern]`  | None may match.                                                                                  |
| `json: true`               | The output must parse as JSON.                                                                   |
| `jsonSchema: {...}`        | The parsed output must match the supported schema subset.                                        |
| `judge: false`             | Skip the LLM judge entirely. Allowed only when at least one deterministic assertion is declared. |

The `jsonSchema` subset is intentionally small: `type` (`object`, `array`,
`string`, `number`, `integer`, `boolean`, `null`), `required`, `properties`,
`items` and `enum`. Failures name the failing path, for example
`$.order.id expected type string but received number`. Anything outside the
subset is rejected by the schema rather than silently ignored.

```yaml
- id: json-response
  input: Return an API response for order 88213 with status ok.
  expected:
    behavior: Return a JSON object containing a status field.
    json: true
    jsonSchema:
      type: object
      required: [status]
      properties:
        status: { type: string }
    judge: false
```

Regular expressions come from your own eval files, which are trusted input at
the same level as your config, but the tested string is capped so a pathological
pattern cannot hang a run. An invalid pattern is reported as an assertion
failure, not an exception.

For assertions that need arbitrary code, use a
[custom runner](custom-runner.md) instead of embedding logic in the eval file.

## Evaluation order

1. Every declared deterministic assertion runs. If any fails, the eval fails and
   the judge is never called.
2. If `expected.judge` is not `false`, the semantic judge scores the output
   against `expected.behavior`. The judge never sees the system prompt.
3. The eval passes only if both stages pass.

No real tool execution happens in native mode.

## Generated cases

Cases drafted by `causeval generate` carry a `causeval` block recording the rule
they came from, the dimension they cover, why they exist, and their review state.
Anything whose `review` is not `accepted` is excluded from every coverage metric.
See [Starting with no evals](no-evals.md).
