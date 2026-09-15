# Quick start

## First demo, no API key

**npm publication is pending.** Use Git and Node.js 22+ to run from source:

```bash
git clone https://github.com/aravinda-1402/causeval.git
cd causeval
npx --yes pnpm@10.17.1 install --frozen-lockfile
npx --yes pnpm@10.17.1 build
npx --yes pnpm@10.17.1 causeval demo
```

Runs the bundled support-agent example end to end against a deterministic
fixture and prints one causally covered rule, one pseudo-covered rule and one
uncovered rule, with the baseline and mutant runs behind each. It also writes an
editable copy of the demo project and a full HTML report.

## Your own project

The remaining commands run from the checkout. If pnpm is not installed, replace
`pnpm` with `npx --yes pnpm@10.17.1`.

```bash
pnpm causeval init --dir my-agent
```

`init` writes `causeval.config.ts`, `prompts/system.md` and `evals/example.yaml`,
all pointed at the fixture provider so `scan` and `verify` work immediately. Use
`pnpm causeval init --dir my-agent --prompt-only` if you want to start from a prompt with no eval
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
pnpm causeval scan --config my-agent/causeval.config.ts
pnpm causeval verify --config my-agent/causeval.config.ts
```

`scan` is cheap: it makes a small number of cached analysis calls and never
executes your evals. `verify` executes them repeatedly and costs real model
calls, so run it deliberately.

## No eval suite yet?

That is a supported starting point, not an error:

```bash
pnpm causeval scan --config my-agent/causeval.config.ts
pnpm causeval generate --config my-agent/causeval.config.ts
pnpm causeval review --config my-agent/causeval.config.ts --list
pnpm causeval review --config my-agent/causeval.config.ts --accept r05-boundary
```

Generated cases are marked `GENERATED - UNREVIEWED` and are excluded from every
coverage metric until you review and accept them. The last command is an example
candidate ID; use an ID from your list. Generated/custom eval execution requires
your provider or runner, while the fixture executes only bundled evals. See [Starting with no
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
