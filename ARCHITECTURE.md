# Architecture

A TypeScript monorepo: pnpm workspaces, Turborepo, Vitest, Playwright.

```text
prompt ──▶ extract ──▶ rules ──▶ map ──▶ mappings ──▶ mutate ──▶ run ──▶ classify ──▶ report
             │                    │                     │          │
      validated quotes     candidate pre-selection   minimal    repeated
      + local stable keys  + pair-bounded batches    byte edit  baseline/mutant
```

## Packages

| Package                  | Responsibility                                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`          | The engine. Zod contracts, provider protocol, disk cache, extraction, mapping, redundancy, gap analysis, eval generation, mutation, native and custom runners, classification, report rendering. No filesystem discovery, no process spawning except the custom runner. |
| `packages/cli`           | The boundary: config loading, globbing, commands, artifacts, review workflow, exit codes. Core is bundled into the published CLI, so `causeval` has no unpublished runtime dependency.                                                                                  |
| `packages/action`        | Composite GitHub Action. Spawns the CLI and reads the JSON it writes with `--emit-outputs`; it never imports the library, so it cannot drift from CLI behavior.                                                                                                         |
| `apps/web`               | Next.js App Router static export. Renders committed report artifacts. No server, no database, no execution.                                                                                                                                                             |
| `examples/support-agent` | The bundled example, generated from the fixture by `pnpm demo:generate`.                                                                                                                                                                                                |

## Boundaries that matter

- **Model output is data.** Extraction quotes are verified against the source,
  stable keys are computed locally, and mappings outside the requested pairs
  abort the run. Analysis prompts carry a `[causeval:<phase>]` marker so the
  deterministic fixture dispatches on an explicit contract rather than on
  incidental wording.
- **Scan never claims CRC.** `causalCoverage` is `null` until verification runs.
- **Errors are not evidence.** Every failure path lands in `indeterminate` with
  a stated reason.
- **Cost is bounded by construction.** Mapping pre-selects lexical candidates and
  packs requests to a pair budget, so it does not grow with rules × evals.
  Analysis and judge calls are cached; candidate generation deliberately is not.
- **Unreviewed generated evals are filtered in the engine**, not by a glob, so no
  configuration mistake can let them inflate coverage.
- **Only the custom runner executes anything**, and only from an explicit
  `--runner` flag. Nothing is discovered or executed from the analysed
  repository. The website executes nothing at all.

## Determinism

`FixtureProvider` and `FixtureRunner` implement the same interfaces as the HTTP
provider and the native runner, so the whole pipeline runs offline and the
example numbers are reproducible. The fixture deliberately contains
over-confident mappings and one redundant rule pair, so causal verification has
real mistakes to expose. `pnpm demo:generate` followed by `git diff --exit-code`
is a CI check that the committed artifacts still match the engine.
