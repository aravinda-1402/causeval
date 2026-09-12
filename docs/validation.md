# Validation record

What was actually run against this build, and what was not. Every claim here is
reproducible with the commands shown.

## Automated checks

| Check                                        | Command                                      | Result                                          |
| -------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Clean dependency install, frozen lockfile    | `pnpm install --frozen-lockfile`             | Passed                                          |
| ESLint                                       | `pnpm lint`                                  | Passed                                          |
| Prettier                                     | `pnpm format:check`                          | Passed                                          |
| TypeScript across core, CLI and web          | `pnpm typecheck`                             | Passed                                          |
| Production build (core, CLI, static site)    | `pnpm build`                                 | Passed                                          |
| Unit and integration suite                   | `pnpm test`                                  | 125 passed across 9 files                       |
| Browser tests, desktop and mobile Chromium   | `pnpm test:web`                              | 10 passed                                       |
| Committed artifacts match the engine         | `pnpm demo:generate && git diff --exit-code` | Passed                                          |
| Packed CLI, all four journeys, GitHub Action | `pnpm release:check`                         | Passed except the intentional placeholder guard |

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
- **Mapping** (11 tests): three adversarial topic-trap fixtures that must map to
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
- **Robustness** (18 tests): empty prompt, no testable rules, one-line prompt,
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
- **Provider** (9 tests): OpenAI and Anthropic wire formats, retries, no
  response bodies in errors, analysis caching, judge caching per distinct
  output, cache namespace isolation, and temperature and seed forwarding.
- **CLI** (5 tests): the three user journeys end to end plus actionable failures
  and gate exit codes.
- **GitHub Action** (4 tests): default scan with a skipped-verification notice,
  explicit verify, gate failure with exit code 1, and input validation.

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
- **Nothing has been published.** No npm package, no GitHub repository, no
  release tag and no website deployment. See [release](release.md).
- Testing is evidence, not a guarantee that every input or environment is
  error-free.
