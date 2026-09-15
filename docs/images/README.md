# README screenshots

These PNGs show the current CausEval interface using the bundled, deterministic
support-agent fixture. They do not show live model results.

| Image                   | Screen                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `coverage-overview.png` | `/demo/`, dark theme, 1440 × 1050 viewport.                   |
| `rule-evidence.png`     | `/demo/?rule=R06`, rule details drawer, 1440 × 1050 viewport. |
| `standalone-report.png` | `/report.html`, dark theme, 1440 × 1050 viewport.             |
| `causeval-launch.mp4`   | 30-second screenshot walkthrough of the public demo sequence. |

To refresh: run `pnpm build`, start `node scripts/serve-static.mjs`, and open
the routes above at `http://127.0.0.1:3000`. Capture with Playwright into
`output/playwright/`, inspect the images, then copy the selected captures here.
If the fixture changes, run `pnpm demo:generate` before building and update the
README captions to match the new results. The current capture workflow is kept
in `output/capture-launch-current.js`.

`social-preview.png` is a 1200 × 630 card using the existing logo, colors and
tagline. Regenerate with `node scripts/generate-social.mjs` after installing
Playwright Chromium. Its editable source is
`apps/web/public/social-preview.svg`; the PNG is also served by the website.
