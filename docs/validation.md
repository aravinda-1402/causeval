# Validation record

What was actually run against this build, and what was not. Every claim here is
reproducible with the commands shown.

## Automated checks

| Check                                             | Command                                             | Result                                                   |
| ------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Clean dependency install, frozen lockfile         | `pnpm install --frozen-lockfile`                    | Passed                                                   |
| ESLint                                            | `pnpm lint`                                         | Passed                                                   |
| Prettier                                          | `pnpm format:check`                                 | Passed                                                   |
| TypeScript across core, CLI and web               | `pnpm typecheck`                                    | Passed                                                   |
| Production build (core, CLI, static site)         | `pnpm build`                                        | Passed                                                   |
| Unit and integration suite                        | `pnpm test`                                         | 153 passed across 13 files                               |
| Browser tests, desktop and mobile Chromium        | `pnpm test:web`                                     | 12 passed                                                |
| Artifacts regenerate byte for byte                | Clean-copy hashes before/after `pnpm demo:generate` | Passed                                                   |
| Packed CLI, fixture journeys, local GitHub Action | `pnpm release:check`                                | Passed in system temp outside the repository             |
| Production dependency advisories                  | `pnpm audit --prod --json`                          | Zero known vulnerabilities after PostCSS 8.5.28 override |

## What the test suite covers

- **Core** (39 tests): schema defaults, stable identity, canonical hashing,
  Wilson intervals, eval loading, extraction provenance, dimension gap analysis,
  redundancy detection and confounders, classification, the full evidence chain,
  reproduction metadata, strict mode, the no-eval path, manual overrides, gates,
  report round-tripping, deterministic serialization, badges, redaction, and
  regression-first diffs.
- **Mutation** (10 tests): minimality byte for byte, sibling clauses on a shared
  line, prose and headings preserved, refusals for overlap, ambiguity, a
  mismatched quote and an ambiguous boundary, and multi-span removal.
- **Mapping** (12 tests): four adversarial topic-trap fixtures that must map to
  `none`, a high-confidence partial mapping that must not reach coverage,
  candidate selection at 100 rules by 500 evals, warning when a rule has no
  candidate, and rejection of an unrequested pair.
- **Assertions and judging** (10 tests): literal, regex, JSON and JSON-Schema
  assertions with path-level failures, invalid patterns, judge isolation from
  the system prompt, a judge that cannot overrule a literal failure, and
  `judge: false`.
- **Generation and review** (7 tests): dimension targeting including boundary
  values, unreviewed marking and provenance, id collision handling, rejection of
  unrequested rules or dimensions, and proof that unreviewed and rejected cases
  are excluded from every metric while accepted ones count.
- **Robustness** (19 tests): empty prompt, no testable rules, one-line prompt,
  400-line prompt with chunking, duplicate instructions, conflicting
  instructions, five rules in one sentence, unicode and non-Latin scripts,
  multi-line rules, template placeholders, fuzzy style rules, fabricated
  extraction, malformed YAML and JSON, duplicate eval ids, 400 evals, and
  provider failure.
- **Custom runner** (12 tests): stdin protocol and dry-run signalling, digest
  identity, unparsable output, missing, extra and duplicate ids, empty stdout,
  nonzero exit with a redacted stderr tail, stderr noise on success, a command
  that cannot start, process-tree termination on timeout, secret redaction, and
  temporary file cleanup.
- **Provider** (10 tests): OpenAI and Anthropic wire formats, retries, no
  response bodies in errors, analysis caching, judge caching per distinct
  output, cache namespace isolation, and temperature and seed forwarding.
- **CLI** (6 tests): the three user journeys end to end plus actionable failures
  and gate exit codes.
- **GitHub Action** (4 tests): default scan with a skipped-verification notice,
  explicit verify, gate failure with exit code 1, and input validation.
- **Security** (9 tests): escaping, redaction, digest-only runner identity,
  malformed input and YAML alias bombs.
- **Audit regressions** (13 tests): starter warning, ten-rule CRC denominator,
  bounded regex evaluation, full-output assertions, stale sibling mutation
  spans, inverted detection effect, six credential forms and named Action risks.
- **Tool example** (2 tests): an actual custom runner subprocess against a
  loopback HTTP stub, checking use of the mutant prompt, forbidden tool calls,
  explicit confirmation and traversal. No live model quality is implied.

Browser coverage: landing page, navigation, coverage matrix, rule drawer,
mutation evidence, confounders, generated-case labelling, metric explanations,
filtering, empty states, mobile navigation, light and dark themes, the
standalone HTML report, runtime errors, and horizontal overflow. Screenshots are
written to `output/playwright/`.

## Scope of the evidence

These are the limits of what was validated, stated plainly.

- **No paid provider and no running Ollama instance were called.** Provider
  protocol compatibility is verified with mocked HTTP. Model-specific extraction
  quality, mapping quality and judge quality have **not** been measured. Run a
  budgeted live smoke test against your endpoint before relying on them.
- **The bundled fixture is not a benchmark.** It is a deterministic stand-in
  that demonstrates the mechanics. No number in this repository describes a real
  model or a real application.
- **No GitHub pull request comment was posted.** The action's output generation,
  summary, gate behavior and input validation were executed locally and in CI.
  Hosted permission behavior and the artifact service depend on the eventual
  repository settings.
- **Repository verified public.** The existing `v0` tag points to `c9c0124` on
  origin. Final commit `28e13af` passed hosted CI in [run 34918520357](https://github.com/aravinda-1402/causeval/actions/runs/34918520357).
  The owner reports an existing release; the unauthenticated releases API returned
  no visible releases during this pass. No release or tag was changed. npm still
  returns E404 and requires authentication. The static site is live at
  <https://causeval.arj142.chatgpt.site>; all five public routes and desktop/mobile
  interaction checks passed. The working tree prepares version 0.1.1; see
  [release](release.md).
- Testing is evidence, not a guarantee that every input or environment is
  error-free.

## Final completion evidence

The original audit remains byte-identical: SHA-256
`B2B026E49F9255EF46DC1BBE76A7099558E297A9B3B5CA665B66FEE156304886`.
See [audit resolution](../CAUSEVAL_AUDIT_RESOLUTION.md) for every finding and
[remaining launch actions](../LAUNCH_CHECKLIST.md) for external gates.

The final clean-copy verification log is kept locally in
`output/launch-validation/results.json`, with one command log per check.
`output/final-clean-check.mjs` copies tracked and untracked non-ignored source
files into a fresh system temp directory, installs the frozen lockfile, and runs
lint, format, typecheck, build, tests, browser tests, external package tests and
artifact drift verification. It never copies node_modules, build output or Git
history. This validates the current work, not just the earlier commit.

Visual review inspected desktop landing, mobile evidence, light/dark dashboard,
the standalone report with 500 eval columns and long source text, and the
1200 × 630 social card. The demo was also opened and inspected interactively.

Scripted mapping scale checks exercised 10 rules / 10 evals, 50 / 100, and
100 / 500. Candidate selection produced 80, 400, and 800 pairs in 2, 8, and 15
batched requests respectively. These are deterministic orchestration checks,
not measurements of live model cost, latency, or mapping accuracy.
