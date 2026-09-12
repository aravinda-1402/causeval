---
name: Runner or adapter
about: Integrate CausEval with another eval framework
labels: adapter, help wanted
---

## Framework and version

## How it is normally invoked

## How it reports per-case pass or fail

## Can it accept a system prompt from a file path?

CausEval passes the prompt by path so the mutant can be substituted. If the
framework cannot take a prompt at runtime, say how it is configured today.

## Would a custom runner script be enough?

See [docs/custom-runner.md](../../docs/custom-runner.md). A shipped adapter is
only worth it when the wrapper script would be non-obvious.
