# causeval

**Code has coverage. Your prompts should too.**

CausEval finds the behavioral rules your AI eval suite doesn't actually protect.
It extracts the behavioral contract from your system prompt, maps it to your
existing evals, then removes one rule at a time and re-runs the evals that were
supposed to cover it. If the tests still pass without the rule, they were never
protecting it.

```bash
npx causeval demo      # the whole idea in 30 seconds, no API key
```

## Install

```bash
npm install -D causeval
npx causeval init      # config, prompt and eval suite that run immediately
npx causeval scan      # behavioral contract + Trace Coverage. No evals executed.
npx causeval verify    # removes each rule, re-runs its evals, reports CRC.
```

`init` points at a bundled deterministic fixture, so both commands work with no
credentials. Switch to your own model when ready:

```ts
// causeval.config.ts
export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/**/*.yaml"],
  provider: { type: "openai", model: process.env.CAUSEVAL_MODEL },
};
```

Providers: OpenAI, Anthropic, any OpenAI-compatible endpoint, and Ollama. No
model name is hard-coded.

## What you get

```text
  Eval pass rate           100%     every mapped eval passes
  Trace Coverage            75%     9 of 12 rules have a test that could catch a violation
  Causal Rule Coverage      42%     5 of 12 rules actually fail when the rule is removed

  4 behaviors look tested. Removing their instruction changed nothing.
```

```text
RULE      R06  Never send an email without explicit user confirmation.

BASELINE  PASS PASS PASS   3/3
                v  remove this rule from the prompt
MUTANT    PASS PASS PASS   3/3

DETECTION EFFECT  0%   ->  PSEUDO-COVERED
```

Pseudo-coverage means one precise thing: under the tested model and
configuration, that eval did not detect removal of that instruction. It is not
proof the rule is untested — a model can keep the behavior without being told,
and another rule may still enforce it. Both confounds are attached to every
result.

## No eval suite yet?

That is a supported starting point, not an error. `scan` reports the behavioral
contract and its severity breakdown, then:

```bash
npx causeval generate            # drafts cases for the dimensions each rule is missing
npx causeval review --list
npx causeval review --accept all
```

Generated cases are marked `GENERATED — UNREVIEWED` and are excluded from every
coverage metric until you accept them.

## Commands

| Command         | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `demo`          | Run the bundled example end to end. No config, no API key.        |
| `init`          | Create a runnable project. `--prompt-only` starts without evals.  |
| `scan`          | Extract rules, map evals, measure Trace Coverage.                 |
| `generate`      | Draft candidate evals for missing test dimensions.                |
| `review`        | List, accept or reject generated candidates.                      |
| `verify`        | Remove each rule, re-run its evals, measure Causal Rule Coverage. |
| `report --open` | Re-render and open the standalone HTML report.                    |
| `badge`         | Write a static SVG badge (`--metric crc` or `trace`).             |
| `diff`          | Compare two reports, or the prompt at two Git refs.               |

Flags: `--config`, `--no-cache`, `--suggest`, `--runner`, `--runs`, `--strict`,
`--mutation boundary`, `--fail-on threshold`, `--emit-outputs`, `--verbose`.

## Privacy

No telemetry. Only your prompt, your eval definitions and (during `verify`)
model outputs sent to the judge leave your machine, and only to the provider
endpoint you configured. Your repository source is never uploaded. API keys
never appear in reports, logs, cache keys or error messages.

## Limits

CausEval measures whether existing evals detect controlled removal of behavioral
instructions. It is **not** proof of correctness, security, safety, compliance,
or the absence of harmful behavior, and it is not a certification. Results are
conditional on the model and configuration you tested. Causal verification
should run against mocked or sandboxed tools.

Full methodology, formulas and threats to validity:
<https://github.com/aravinda-1402/causeval/blob/main/docs/methodology.md>

## License

Apache-2.0.
