## What this changes

## Why

## How it was validated

- [ ] `pnpm lint` and `pnpm format:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm test:web` (if the website changed)
- [ ] `pnpm demo:generate && git diff --exit-code` (if fixture or engine behavior changed)

## Claims and evidence

If this changes what a number means, a threshold, a classification, or what is
sent to a provider, say so explicitly and point at the test that pins it.

- [ ] No infrastructure error is treated as evidence of detection
- [ ] No new claim goes beyond what the evidence supports
- [ ] No secrets or private prompt content in fixtures, tests or docs
