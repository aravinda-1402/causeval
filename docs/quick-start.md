# Quick start

## 60 seconds, no API key

```bash
npx causeval demo
```

Runs the bundled support-agent example end to end against a deterministic
fixture and prints one causally covered rule, one pseudo-covered rule and one
uncovered rule, with the baseline and mutant runs behind each. It also writes an
editable copy of the demo project and a full HTML report.

## Your own project

```bash
npm install -D causeval
npx causeval init
```

`init` writes `causeval.config.ts`, `prompts/system.md` and `evals/example.yaml`,
all pointed at the fixture provider so `scan` and `verify` work immediately. Use
`npx causeval init --prompt-only` if you want to start from a prompt with no eval
suite.

Replace the prompt and evals with your own, then point the config at your model:

```ts
export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/**/*.yaml"],
  provider: { type: "openai", model: process.env.CAUSEVAL_MODEL },
};
```

Set `CAUSEVAL_MODEL` and `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) in your
shell, then:

```bash
npx causeval scan      # behavioral contract + Trace Coverage. No evals executed.
npx causeval verify    # removes each rule, re-runs its evals, reports CRC.
```

`scan` is cheap: it makes a small number of cached analysis calls and never
executes your evals. `verify` executes them repeatedly and costs real model
calls, so run it deliberately.

## No eval suite yet?

That is a supported starting point, not an error:

```bash
npx causeval scan       # shows the contract and its severity breakdown
npx causeval generate   # drafts candidate cases for the missing dimensions
npx causeval review --list
npx causeval review --accept all
```

Generated cases are marked `GENERATED - UNREVIEWED` and are excluded from every
coverage metric until you accept them. See [Starting with no
evals](no-evals.md).

## Working in this repository

```bash
pnpm install
pnpm build
pnpm causeval verify --config examples/support-agent/causeval.config.ts --suggest
pnpm dev
```

Open <http://127.0.0.1:3000> for the website, `/demo` for the interactive report
and `/docs` for the documentation. The generated offline report is at
`examples/support-agent/.causeval/report.html`.

The bundled fixture produces 12 rules, 9 evals, 75% Trace Coverage and 42%
Causal Rule Coverage, with 4 pseudo-covered and 3 uncovered rules. Those numbers
come from executing the fixture's prompt-dependent responses and assertions;
they are not invented scores, and they are not a benchmark of any real model.
