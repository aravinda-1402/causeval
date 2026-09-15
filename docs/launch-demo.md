# The CausEval walkthrough

Use the actual deterministic support fixture. Keep the saved-example notice
visible. Do not substitute invented pass rates or coverage.

A prepared 43-second walkthrough is available at
[`docs/images/causeval-launch.mp4`](images/causeval-launch.mp4). It is a real
browser recording of the bundled example, with lower-third captions burned in;
the on-screen fixture disclaimer remains visible throughout.

Regenerate it with `node scripts/capture-media.mjs` (see
[`docs/images/README.md`](images/README.md)). The captions are anchored to marks
the recorder measures, so they stay aligned even though each run's timing
differs slightly.

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

`scripts/capture-media.mjs` records this sequence. Approximate times are from
the current recording; the script derives the real ones per run.

| Time   | Show                                     | Caption                                                        |
| ------ | ---------------------------------------- | -------------------------------------------------------------- |
| 0–5s   | Landing page: one clear starting point   | “Your prompt has rules. Do your tests actually check them?”    |
| 5–11s  | How it works, then the source quickstart | “Free and open source. Works with the tests you already have.” |
| 12–19s | Example report: three result cards       | “Removal detected, removal missed, or no test linked.”         |
| 19–23s | R06 drawer: what happened, what next     | “This test passed even after its rule was removed.”            |
| 23–26s | The before-and-after experiment          | “Same evals before and after. Three of three pass either way.” |
| 26–29s | Verdict and its stated limitations       | (no caption; the verdict text is the point)                    |
| 29–35s | R06 Suggested tests                      | “CausEval drafts the missing test cases for you to review.”    |
| 36–43s | Back to the landing page                 | “Code has coverage. Your prompts should too.”                  |

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
