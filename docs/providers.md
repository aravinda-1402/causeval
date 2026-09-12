# Providers

Set `provider.type` and a model. No model name is hard-coded anywhere in the
core.

| Type         | Endpoint                               | Credentials         |
| ------------ | -------------------------------------- | ------------------- |
| `openai`     | OpenAI-compatible Chat Completions     | `OPENAI_API_KEY`    |
| `anthropic`  | Messages API, version `2023-06-01`     | `ANTHROPIC_API_KEY` |
| `compatible` | Explicit `baseURL` and `model`         | optional `apiKey`   |
| `ollama`     | `http://localhost:11434/v1` by default | none                |
| `fixture`    | The bundled deterministic definitions  | none                |

`fixture` answers only CausEval's own analysis requests and is not a
general-purpose provider. It backs `causeval demo`, `causeval init` and the test
suite.

```ts
export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/**/*.yaml"],
  provider: { type: "ollama", model: process.env.CAUSEVAL_MODEL },
};
```

## Determinism

Analysis and judging run at `temperature: 0`. `provider.seed` is forwarded to
providers that accept it and is recorded in the report either way. The model
under test uses `causal.candidateTemperature`, also 0 by default; raise it when
you want to measure the nondeterminism your production system actually has.

## A separate judge

```ts
judge: { type: "openai", model: "a-smaller-cheaper-model" },
```

The judge gets its own cache namespace, runs at temperature 0, and is recorded
in `report.run.judgeProvider` and `report.run.judgeModel`. It never sees the
system prompt, so it cannot tell a baseline run from a mutant run. Identical
outputs always receive an identical cached verdict.

Evals that declare `expected.judge: false` skip the judge entirely and rely on
deterministic assertions. Prefer that where you can.

## Reliability

Malformed structured output gets one repair retry and then fails with a message
naming the provider and model. Network failures, HTTP 429 and 5xx get bounded
exponential backoff up to `maxRetries`. Credentials and provider response bodies
never appear in error messages.

The wire contract for every provider type is covered by tests using mocked HTTP.
**No paid provider or running Ollama instance was called to validate model
quality**, so run a budgeted live smoke test against your chosen endpoint before
relying on its extraction or judging quality.

## Caching

Analysis and judge calls are cached in `.causeval/cache`, keyed on the CausEval
version, provider, model, temperature, seed and the full request. Changing any
of those invalidates the entry. Candidate generation during `verify` is never
cached, so repeated runs sample real variance. `--no-cache` bypasses reads and
writes.
