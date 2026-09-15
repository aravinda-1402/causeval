# README screenshots

These PNGs show the current CausEval interface using the bundled, deterministic
support-agent fixture. They do not show live model results.

| Image                   | Screen                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| `coverage-overview.png` | `/demo/`, dark theme, 1440 × 1050 viewport.                                 |
| `rule-evidence.png`     | `/demo/` with the R06 rule drawer open, scrolled to the removal experiment. |
| `standalone-report.png` | `/report.html`, dark theme, 1440 × 1050 viewport.                           |
| `causeval-launch.mp4`   | 45-second captioned screen recording of the demo walkthrough.               |

To refresh: run `pnpm build`, start `node scripts/serve-static.mjs`, and open
the routes above at `http://127.0.0.1:3000`. Capture with Playwright at
`deviceScaleFactor: 1` so the flat interface colors stay compressible, inspect
the images, then copy the selected captures here. Open the rule drawer by
clicking **See a missed removal** rather than deep-linking `?rule=R06`; the
deep link leaves a focus ring on the close button.

If the fixture changes, run `pnpm demo:generate` before building and update the
README captions to match the new results.

`causeval-launch.mp4` is a real browser recording, not a slideshow: Playwright
records the walkthrough with `recordVideo`, ffmpeg retimes it and burns in the
lower-third captions. Regenerate it whenever the interface or the caption
timings drift; the captions are positioned against specific on-screen moments.

`social-preview.png` is a 1200 × 630 card using the existing logo, colors and
tagline. Regenerate with `node scripts/generate-social.mjs` after installing
Playwright Chromium. Its editable source is
`apps/web/public/social-preview.svg`; the PNG is also served by the website.
