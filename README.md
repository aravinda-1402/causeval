# CausEval

**Code has coverage. Your prompts should too.**

CausEval finds the behavioral rules your AI eval suite doesn't actually protect.
It extracts the behavioral contract from your system prompt, maps it to your
existing evals, then removes one rule at a time and re-runs the evals that were
supposed to cover it. If the tests still pass without the rule, they were never
protecting it.

```bash
npx causeval demo     # the whole idea in 30 seconds, no API key
```

## The problem

```text
  Eval pass rate           100%     every mapped eval passes
  Trace Coverage            75%     9 of 12 rules have a test that could catch a violation
  Causal Rule Coverage      42%     5 of 12 rules actually fail when the rule is removed

  4 behaviors look tested. Removing their instruction changed nothing.
```

A suite can be green while whole sections of your prompt are behaviorally
untested. The gap between those second and third numbers is what CausEval
measures.

```text
RULE      R06  Never send an email without explicit user confirmation.
               prompts/system.md:16

BASELINE  PASS PASS PASS   3/3
                ↓  remove this rule from the prompt
MUTANT    PASS PASS PASS   3/3

DETECTION EFFECT  0%   →  PSEUDO-COVERED
```

> Under the tested model and configuration, this eval did not detect removal of
> this behavioral instruction.

That wording is deliberate. A pseudo-covered rule means the experiment found no
dependence — which can mean a weak eval, _or_ a model that keeps the behavior
without being told. CausEval says which of those it cannot distinguish instead
of pretending it can. See [methodology](docs/methodology.md).

## 60-second quickstart

```bash
npm install -D causeval
npx causeval init        # writes a config, prompt and eval suite that run immediately
npx causeval scan        # behavioral contract + Trace Coverage. No evals executed.
npx causeval verify      # removes each rule, re-runs its evals, reports CRC.
```

`init` points at a bundled deterministic fixture, so both commands work with no
API key. Point `provider` at your own model when you are ready:

```ts
export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/**/*.yaml"],
  provider: { type: "openai", model: process.env.CAUSEVAL_MODEL },
};
```

## No eval suite yet? Start there.

Most applications have a system prompt long before they have tests. CausEval
treats that as a first-class starting point:

```text
$ npx causeval scan

  No eval suite detected.

  CausEval extracted 12 behavioral rules from your system prompt.

    Critical  3
    High      6
    Medium    2
    Low       1

  You can generate a starter behavioral eval suite with:

    causeval generate
```

```bash
npx causeval generate            # drafts cases for the dimensions each rule is missing
npx causeval review --list       # see every candidate and why it exists
npx causeval review --accept all # or --accept <id>, or edit the YAML first
```

For `Refunds above $100 require manager approval.` that means `$50`, `$100`,
`$101`, `$250`, and an attempt to bypass approval — targeted at the missing
dimension, not five random refund prompts.

Generated cases are written as **`GENERATED — UNREVIEWED`** and are excluded from
every coverage metric until you accept them. The exclusion lives in the engine,
not in a glob: a generated test can never inflate your coverage number.
See [Starting with no evals](docs/no-evals.md).

## Core concepts

| You have                  | Command  | You get                                                                     |
| ------------------------- | -------- | --------------------------------------------------------------------------- |
| A system prompt           | `scan`   | The behavioral contract: atomic rules with exact source, type and severity. |
| Prompt + evals            | `scan`   | **Trace Coverage** — which rules have a test that could falsify them.       |
| Prompt + evals + a runner | `verify` | **Causal Rule Coverage** — which rules your tests actually protect.         |

| Classification            | Meaning                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Causally covered**      | Removing the instruction made the mapped evals fail.                                                |
| **Pseudo-covered**        | Stable baseline, credible mapping, removal went undetected.                                         |
| **Uncovered**             | No credible mapping, so no experiment ran.                                                          |
| **Flaky / indeterminate** | Unstable baseline, or an experiment that could not be trusted. Never converted into a causal claim. |

The evidence chain is inspectable at every step:

```text
PROMPT → BEHAVIORAL RULES → TRACE → MUTATE → VERIFY
```

## Every finding is traceable

For any rule, the report answers all six questions without a mysterious score:

1. **Where did this rule come from?** File, line range and the exact quote.
2. **Which evals mapped to it, and why?** Rationale, confidence against the
   threshold, and which test dimensions each eval exercises.
3. **What is still missing?** The dimensions this rule needs and does not have.
4. **What was mutated?** The exact textual diff.
5. **What changed?** Baseline and mutant pass rates with Wilson intervals, a
   per-eval breakdown, and every individual run.
6. **Why this classification?** A plain-language interpretation, the thresholds
   it was judged against, and any confound the experiment could not rule out.

```bash
npx causeval report --open
```

## GitHub Action

```yaml
permissions:
  contents: read
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm install -D causeval
      - uses: aravinda-1402/causeval/packages/action@v0
        with:
          config: causeval.config.ts
          mode: scan # verify executes your evals; opt in deliberately
```

Default CI is `scan`: a few cached analysis calls, no eval execution. `verify`
costs real model calls and must be requested explicitly. The job summary always
states when causal verification was skipped, so a scan result is never mistaken
for a causal one. Optional PR comments update a single comment.
[Details](docs/github-action.md).

## Privacy

No telemetry, no analytics, no version check, no phone-home. There is no
CausEval server.

Only three things leave your machine, and only to the provider endpoint you
configured: your system prompt, your eval definitions, and — during `verify` —
model outputs sent to the judge. Your repository source, git history and
environment are never uploaded. Use a local `ollama` or `compatible` endpoint if
data must stay on your machine.

API keys never appear in reports, logs, cache keys or error messages. Custom
runners are identified in the report by a hash of the command, never the command
itself. [What exactly is sent](docs/privacy.md).

## Methodology and limits

**CausEval measures whether existing evals detect controlled removal of
behavioral instructions.** Causal Rule Coverage provides evidence about
behavioral regression protection under the tested model and configuration.

It is not proof of correctness, security, safety, compliance, or the absence of
harmful behavior, and it is not a certification of anything.

Known confounds, all documented and surfaced in the report: model priors,
redundant rules, small samples, extraction error, mapping recall, judge error,
and behavior enforced outside the prompt. [Full methodology and threats to
validity](docs/methodology.md).

## CLI

| Command         | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `demo`          | Run the bundled example end to end. No config, no API key.         |
| `init`          | Create a runnable project. `--prompt-only` to start without evals. |
| `scan`          | Extract rules, map evals, measure Trace Coverage.                  |
| `generate`      | Draft candidate evals for the dimensions your rules are missing.   |
| `review`        | List, accept or reject generated candidates.                       |
| `verify`        | Remove each rule, re-run its evals, measure Causal Rule Coverage.  |
| `report --open` | Re-render and open the standalone HTML report.                     |
| `badge`         | Write a static SVG badge (`--metric crc` or `trace`).              |
| `diff`          | Compare two reports, or the prompt at two Git refs.                |

Useful flags: `--config`, `--no-cache`, `--suggest`, `--runner`, `--runs`,
`--strict`, `--mutation boundary`, `--fail-on threshold`, `--emit-outputs`,
`--verbose`.

## Documentation

[Quick start](docs/quick-start.md) ·
[Concepts](docs/concepts.md) ·
[No evals yet](docs/no-evals.md) ·
[Causal coverage](docs/causal-coverage.md) ·
[Eval format](docs/eval-format.md) ·
[Custom runner](docs/custom-runner.md) ·
[Configuration](docs/configuration.md) ·
[Manual overrides](docs/overrides.md) ·
[Providers](docs/providers.md) ·
[GitHub Action](docs/github-action.md) ·
[Report schema](docs/report-schema.md) ·
[Privacy](docs/privacy.md) ·
[Methodology](docs/methodology.md) ·
[Research notes](docs/research.md) ·
[Deployment](docs/deployment.md)

## Working on CausEval

Requires Node.js 22+ and pnpm 10. If pnpm is unavailable, use
`npx --yes pnpm@10.17.1` in its place.

```bash
pnpm install
pnpm build
pnpm test
pnpm causeval verify --config examples/support-agent/causeval.config.ts --suggest
pnpm dev     # website at http://127.0.0.1:3000
```

The test suite never calls a paid API. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

Version 0.1. The npm package has not been published from this build; after
release the install above is the intended path. Provider wire protocols are
covered by mocked tests, but **live model quality has not been measured** — run
a budgeted smoke test against your own endpoint before relying on extraction or
judging quality. See [docs/release.md](docs/release.md).

## Citation

If you use CausEval in research, cite the project via
[CITATION.cff](CITATION.cff). There is no associated paper or DOI.

## License

Apache-2.0. See [LICENSE](LICENSE).
