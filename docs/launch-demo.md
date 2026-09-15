# A 30-second CausEval walkthrough

Use the actual deterministic support fixture. Keep the saved-example notice
visible. Do not substitute invented pass rates or coverage.

A prepared 30-second walkthrough is available at
[`docs/images/causeval-launch.mp4`](images/causeval-launch.mp4). It uses the
actual overview, mutation-evidence, suggested-test and social-preview states;
the on-screen fixture disclaimer remains visible.

## Prepare

From the checkout (Node 22+, pnpm 10; `npx --yes pnpm@10.17.1` is the fallback):

```bash
pnpm causeval demo --dir output/launch-demo
pnpm causeval verify --config output/launch-demo/causeval.config.ts --suggest
node scripts/serve-static.mjs
```

Use an unused directory for `demo`; it intentionally refuses to overwrite work.
Open `http://127.0.0.1:3000/demo/?rule=R06` for the website evidence drawer.
The standalone report is `output/launch-demo/.causeval/report.html`.
Record a 1440-pixel-wide window, enlarge text if needed, and hide unrelated tabs.

## Recording sequence

| Time   | Show                                   | On-screen message                                                 |
| ------ | -------------------------------------- | ----------------------------------------------------------------- |
| 0–4s   | Landing page: one clear starting point | “Do your tests catch missing AI rules?”                           |
| 4–9s   | Example report: three result cards     | “Detected, missed, or no test linked.”                            |
| 9–14s  | Priority-sorted rules list             | “Start with the gaps that need attention.”                        |
| 14–21s | R06 Test results drawer                | “The instruction is gone. The test still passes.”                 |
| 21–26s | R06 Suggested tests                    | “Draft suggestions are for review, not included in coverage.”     |
| 26–30s | Landing page / repository              | “Simple to start. Technical detail when you need it.”             |
| 26–30s | Social card and repository URL         | “Code has coverage. Your prompts should too. Free + open source.” |

The mapped test asks for a draft, not a send. The fixture intentionally supplies
an overconfident mapping to show how verification can challenge it. This is not
an observed failure rate of a real model. Pseudo-coverage may also reflect model
priors or overlapping instructions; keep the evidence drawer's caveat visible.

## Screenshot states

- Rule list and Matrix: switch views in `/demo/`.
- Pseudo-covered rule / mutation diff: `/demo/?rule=R06`, open the rule details drawer.
- High-risk uncovered rule: `/demo/?rule=R03`.
- Suggested missing test: R06, Suggested tests tab.
- PR summary: `examples/support-agent/.causeval/summary.md` contains the actual
  fixture output, including named high-risk rules. Render it in a Markdown
  preview; do not present it as a posted PR comment.

Suggested post text:

> Your system prompt contains rules. Your evals are supposed to protect them.
> CausEval extracts that contract, maps it to your tests, then removes rules
> one at a time to see whether those tests notice. Try the zero-key demo and
> inspect the evidence. Results are conditional on the tested setup, not proof
> of correctness. Feedback on wrong rules and mappings is especially useful.

Link the deployed site and repository only after their launch checks pass.
