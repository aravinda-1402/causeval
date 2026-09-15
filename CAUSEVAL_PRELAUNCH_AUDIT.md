# CausEval Independent Pre-Launch Audit

**Date:** 2026-09-14
**Auditor role:** independent adversarial reviewer (LLM engineering / QA / security / OSS maintainer / research reviewer)
**Commit audited:** `a944130` (main, clean working tree)
**Scope:** read-only. No source, config, docs, tests, tags, releases or GitHub metadata were modified. This file is the only file created.

---

## Overall verdict

```text
READY AFTER BLOCKERS FIXED
```

The engine is real. I verified by direct execution that behavioral contract extraction, Trace Coverage, mutation, causal classification and pseudo-coverage are genuinely implemented — not mocked, not LLM-scored, not faked. The coverage arithmetic is correct to the decimal. Mutation integrity survived ten adversarial attacks. The HTML report has no XSS. There is no maintainer-key backend. The methodology documentation is more honest than most published research.

It is not launch-ready because **the public website tells every visitor to run `npx causeval demo`, and that command 404s.** The npm package does not exist. The README is honest about this; the website is not, and the website is what a LinkedIn link points at. The site also contains no link to the GitHub repository at all.

Those are hours of work, not weeks. Fix the four P0 items and this is a credible, defensible public launch.

---

## Test environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Home 10.0.26200 (win32) |
| Node.js | v22.16.0 |
| npm | 11.6.2 |
| pnpm | 10.17.1, invoked as `npx --yes pnpm@10.17.1` (pnpm is **not** installed on this machine — I deliberately used the README's documented fallback) |
| Shells | Git Bash (primary), PowerShell |
| Network | Online; npm registry reachable |
| API keys | **None.** No paid provider call was made at any point in this audit. |

---

## Commands actually executed

| # | Command | Result |
| --- | --- | --- |
| 1 | `npx --yes pnpm@10.17.1 --version` | PASS — 10.17.1 (README fallback works) |
| 2 | `npx --yes pnpm@10.17.1 build` | PASS — 3 tasks, 99s, core + CLI + static site |
| 3 | `npx --yes pnpm@10.17.1 lint` | PASS — no output |
| 4 | `npx --yes pnpm@10.17.1 format:check` | PASS — all files match Prettier |
| 5 | `npx --yes pnpm@10.17.1 typecheck` | PASS — 4 tasks |
| 6 | `npx --yes pnpm@10.17.1 test` | PASS — **136 tests across 11 files**, 30.7s |
| 7 | `npx --yes pnpm@10.17.1 test:web` | PASS — 10 Playwright tests (desktop + mobile Chromium) |
| 8 | `npm pack` (packages/cli) | PASS — `causeval-0.1.0.tgz`, 48 KB, 6 files |
| 9 | `npm install <tgz>` in a clean temp dir outside the monorepo | PASS — 23 packages, bin + shebang intact |
| 10 | `npx causeval --version` / `--help` (packed) | PASS |
| 11 | `npx causeval demo` (packed, outside monorepo) | PASS — full report, correct numbers |
| 12 | `npx causeval init` / `init --prompt-only` (packed) | PASS, but emits a false warning — see H1 |
| 13 | `npx causeval scan` (packed, 3 separate projects) | PASS, same false warning |
| 14 | `npx causeval generate` (packed) | PASS — 35 candidates, marked UNREVIEWED |
| 15 | `npx causeval review --list` / `--accept all` (packed) | PASS |
| 16 | `npx causeval verify` after accepting generated evals | **FAIL** — every rule `indeterminate`, see H2 |
| 17 | `npx causeval report` / `badge --metric trace` (packed) | PASS |
| 18 | `npx causeval diff <report> <report>` (packed) | PASS |
| 19 | `npx causeval diff HEAD~1 HEAD` in a real git repo | PARTIAL — see M3 |
| 20 | `npx causeval diff "--upload-pack=touch /tmp/pwn" HEAD` | PASS — rejected |
| 21 | `node packages/action/run.mjs` — scan, fail-on threshold | PASS — exit 1, correct outputs + summary |
| 22 | `node packages/action/run.mjs` — scan, fail-on never | PASS — exit 0 |
| 23 | `node packages/action/run.mjs` — `CAUSEVAL_ACTION_MODE="rm -rf /"` | PASS — rejected before execution |
| 24 | `npm view causeval version` | **404 — package does not exist** |
| 25 | `npm view @causeval/core version` | **404 — package does not exist** |
| 26 | `npx --yes causeval demo` (as a website visitor would) | **404 — E404 Not Found** |
| 27 | `npm install -D causeval` (as the website instructs) | **404 — E404 Not Found** |
| 28 | Custom mutation-integrity harness, 10 adversarial cases | PASS — 8 correct, 2 findings (M7, L1) |
| 29 | Custom classification harness, 10 baseline/mutant shapes | PASS — 1 finding (M9) |
| 30 | Synthetic coverage fixture (10 rules / 7 mapped / 4 detected) | PASS — Trace 70.00%, CRC 40.00% exactly |
| 31 | Custom XSS harness — hostile strings in every report field | PASS — no injection escapes |
| 32 | Custom runner harness — 9 hostile/broken runners | PASS — 1 finding (M6) |
| 33 | Cache invalidation: prompt mutation + `--no-cache` | PASS |
| 34 | Mapping scalability: 10×10, 50×100, 100×500 | PASS — 2 / 8 / 15 model calls |
| 35 | `checkAssertions` with `(a+)+$` against 31 chars | **FAIL — 231,342 ms**, see H5 |
| 36 | `git tag -l` / `git ls-remote --tags origin` | `v0` exists locally and on origin, at `c9c0124` |

All of the above were genuinely executed. Nothing in this report is inferred from reading code alone unless explicitly labelled as a code-reading finding.

---

## 1. Inventory of what already exists

| Feature | Status | Evidence |
| --- | --- | --- |
| Behavioral Contract extraction | **PASS** | `analysis.ts:extractRules` — chunked, line-numbered, every quote validated against source via `validateSource`, fabricated extractions discarded with a warning, stable keys assigned, duplicates merged into `sources[]` |
| Behavioral Rule data model | **PASS** | `schemas.ts:RuleSchema` — 11 types, 4 severities, condition, source span, stableKey, tags, rationale |
| Trace Coverage | **PASS** | `engine.ts:calculateSummary` — verified 9/12 = 75% and synthetic 7/10 = 70% |
| Rule → eval mapping | **PASS** | `analysis.ts:mapRules` — falsifiability framing (opportunity + detection), batched, IDs validated, duplicate/unrequested pairs rejected |
| Causal Rule Coverage | **PASS** | `engine.ts` — verified 5/12 = 41.67% and synthetic 4/10 = 40.00% |
| Controlled prompt mutation | **PASS** | `mutation.ts` — deterministic string surgery, not LLM-generated. Survived 10 adversarial cases |
| Pseudo-coverage detection | **PASS** | `classify()` + `interpret()` — arithmetic threshold, hedged wording |
| Redundancy / confounding handling | **PASS** | `findRedundancies` + `confounders[]` with `possible-redundancy` and `model-prior` kinds |
| Flaky / indeterminate handling | **PASS** | Baseline floor 0.8, per-eval flakiness override, `indeterminate` band between ceiling and threshold |
| Generated starter evals | **PASS** | `generate.ts` — stamped `generated: true, review: "unreviewed"` |
| No-existing-eval-suite workflow | **PARTIAL** | `scan` and `generate` work; `verify` after accepting is broken under the default fixture (**H2**) |
| Native eval runner | **PASS** | `runner.ts:NativeRunner` — deterministic assertions first, judge blinded to the system prompt |
| Custom runner | **PASS** | `runner.ts:CustomRunner` — all 9 failure modes handled correctly |
| Deterministic assertions | **PARTIAL** | Correct semantics; no time bound on regex (**H5**); 200 KB truncation inconsistency (**M8**) |
| LLM judge support | **PASS** | Separate cache namespace, recorded in report metadata, `judge: false` opt-out enforced by schema |
| CLI | **PASS** | 9 commands, all 21 documented flags present |
| HTML report | **PASS** | Self-contained, escaped, themeable, 6-section evidence drawer |
| JSON report | **PASS** | Zod-validated, schema-versioned (`1.1`), redacted |
| Deterministic demo | **PASS** | Runs with no key from a packed install outside the monorepo |
| Marketing website | **PARTIAL** | Well-built and honest about the fixture, but ships broken install commands (**B1**) and no GitHub link (**H3**) |
| GitHub Action | **PASS** | Correct outputs, exit codes, input validation, single-comment logic, artifact upload |
| Package publishing configuration | **PASS** (config) / **MISSING** (published) | `files`, `bin`, `exports`, `engines` all correct; tarball is clean; **nothing is on npm** |
| CI | **PASS** | lint, format, typecheck, build, test, test:web, artifact-drift check, action job |
| Tests | **PASS** | 136 unit/integration + 10 browser |
| README | **PARTIAL** | Accurate and honest about npm; minor internal inconsistencies (**L6**, **M11**) |
| Methodology documentation | **PASS** | `docs/methodology.md` §11 lists 11 threats to validity. Best artifact in the repo |
| Privacy documentation | **PARTIAL** | Accurate except one false claim about gitignore (**M1**) |
| Security documentation | **PARTIAL** | Good threat model; asserts a regex protection that does not exist (**H5**) |
| CITATION.cff | **PASS** | Valid CFF 1.2.0, author + abstract + keywords |
| Apache-2.0 license | **PASS** | Root + both packages + NOTICE, consistent metadata |
| Existing release configuration | **PARTIAL** | `v0` tag exists; `docs/validation.md` states no tag exists (**H4**) |

---

## User journeys

| Journey | Result | Notes |
| --- | --- | --- |
| **A** — prompt only → contract → starter evals | **PARTIAL** | `scan` correctly reports "No eval suite detected" with a severity breakdown. `generate` produces 35 labelled candidates. `review` works. But every run emits a false warning saying the rules were *not* extracted (**H1**), and continuing to `verify` fails completely (**H2**) |
| **B** — prompt + evals → Trace Coverage + gaps | **PASS** | 12 rules, 9 evals, 75%, 3 uncovered rules named, missing dimensions reported per rule. Only the false warning (**H1**) mars it |
| **C** — runnable pipeline → baseline → mutate → CRC → pseudo-coverage | **PASS** | Verified end to end from a packed install: 27/27 baseline, 5 causally covered, 4 pseudo-covered, 3 uncovered, CRC 41.67%. Evidence chain complete and inspectable |
| **D** — prompt changed in a PR → contract change → Action → coverage delta | **PARTIAL** | The Action reports the PR's *current* coverage and gate, not a delta — honestly documented in `docs/github-action.md`. The documented delta workflow uses `causeval diff`, which (a) needs npm, and (b) under the fixture silently reports "no new uncovered behaviors" with warnings suppressed (**M3**) |

---

## BLOCKERS

### B1 — The public website ships install commands that do not exist

```text
ID:             B1
Title:          Website instructs every visitor to run `npx causeval demo`; the npm package does not exist
Location:       apps/web/app/page.tsx:341-345 (landing, "NO SETUP, NO API KEY" block)
                apps/web/app/docs/page.tsx:58 (CopyCommand "npx causeval demo")
                apps/web/app/docs/page.tsx:67 ("npm install -D causeval\nnpx causeval init\nnpx causeval scan\nnpx causeval verify")
                apps/web/app/docs/page.tsx:86 ("npx causeval generate / review --list / review --accept all")
                docs/github-action.md:18 ("- run: npm install -D causeval") — Minimal usage, no caveat
```

**Reproduction**

```bash
npm view causeval version          # E404 Not Found
npx --yes causeval demo            # E404 Not Found
npm install -D causeval            # E404 Not Found
```

**Expected:** the headline command on the project's public site runs the demo.
**Actual:** `npm error 404 Not Found - GET https://registry.npmjs.org/causeval - Not found`. The landing page carries **no caveat whatsoever**. The docs page has exactly one, placed *after* both code blocks: *"npm publication is a separate release step; until then, run from a checkout with `pnpm causeval`."* The `/docs` Quick Start even renders `npx causeval demo` inside a **click-to-copy button**.

**Why it matters:** this is the exact LinkedIn → website → first-command path. The first thing a stranger does with your project fails with a registry 404. It reads as abandonware or vapourware, and it is the single most quotable criticism available. The README handles this correctly (*"Version 0.1 is currently unpublished on npm"*) — the website simply never got the same treatment.

**Recommended fix:** choose one.
1. **Publish `causeval@0.1.0` to npm** before the launch post, then every command becomes true, and the Action's `npx causeval@latest` fallback and `docs/github-action.md` Minimal usage start working too. This is the cleanest option and `docs/release.md` already has the checklist.
2. If not publishing yet: replace the landing-page and docs-page commands with the source-checkout form the README uses (`git clone … && pnpm install && pnpm build && pnpm causeval demo`), and put the npm form behind a visible "after publication" note — mirroring the README's `<details>` block exactly.

Do **not** ship the launch with the current mixture.

---

## HIGH findings

### H1 — Every `causeval init` → `scan` prints a false "your rules were not extracted" warning

```text
ID:             H1
Title:          Fixture-mismatch warning fires on the default init path and contradicts the output directly above it
Location:       packages/core/src/engine.ts:186-192  (`options.prompt !== fixturePrompt`)
                packages/cli/src/index.ts  (`initProject`: writes `fixturePrompt + "\n"`)
```

**Reproduction** (packed install, clean directory)

```bash
npx causeval init
npx causeval scan
```

**Expected:** no warning. `init` wrote the bundled fixture prompt and the config points at the fixture provider — the intended happy path.
**Actual:**

```text
  Behavioral rules             12   (3 critical, 6 high, 2 medium, 1 low)
  Trace Coverage               75%   9 / 12 rules mapped
  Warning: The bundled fixture provider only recognises the example prompt, so
  rules in your own prompt were not extracted. Set provider.type to your model …
```

Twelve rules *were* extracted. The warning is false.

**Root cause:** `initProject` writes `fixturePrompt + "\n"`; `analyze()` compares with strict inequality against `fixturePrompt`. The trailing newline alone triggers it.

**Confirmed on three independent paths:** `init`, `init --prompt-only`, and `causeval scan` against the shipped `examples/support-agent/` project (the command your own README tells contributors to run).

**Why it matters:** this is the first sentence a new user reads after their first successful command, and it tells them the tool failed. It directly contradicts the numbers printed two lines above. It also fires on `verify`, `generate` and every subsequent run, so it never goes away. Nothing in CI catches it, because `demo:generate` passes `fixturePrompt` in memory and never reads the file.

**Recommended fix:** compare normalised text (e.g. `options.prompt.trim() !== fixturePrompt.trim()`), and add a CLI-level regression test asserting that a fresh `init` + `scan` produces **zero** warnings.

---

### H2 — The documented no-evals journey dead-ends at `verify`

```text
ID:             H2
Title:          `init --prompt-only` → generate → review --accept → verify fails for every rule under the default provider
Location:       packages/core/src/fixture.ts  (`FixtureRunner.run` throws for any eval not in `fixtureDefinitions`)
```

**Reproduction**

```bash
npx causeval init --prompt-only
npx causeval generate
npx causeval review --accept all
npx causeval verify
```

**Expected:** causal results, or a clear message explaining that the fixture cannot execute generated evals and a real provider is required.
**Actual:** all 12 rules classified `indeterminate`, with 12 opaque warnings:

```text
  R01 [CRITICAL] Never disclose account information …  - indeterminate
  Warning: R01: Unknown fixture eval r01-positivepath
  Warning: R02: Unknown fixture eval r02-positivepath
  … (12 total)
```

**Why it matters:** this is the flagship differentiator — "no eval suite yet? start here" — and it is the exact 3-step sequence that `causeval init --prompt-only` *itself prints* as "Next:". A user following the tool's own instructions with the tool's own default provider reaches a wall of errors with no stated remedy. `scripts/release-check.mjs` misses it: after `review --accept r05-boundary` it runs `scan` only, never `verify`.

**Recommended fix:** in `FixtureRunner.run`, replace the throw with a clear, actionable error naming the real cause, e.g. *"The bundled fixture runner can only execute the 9 bundled example evals. Generated or custom evals need a real provider: set `provider.type` and `CAUSEVAL_MODEL`."* Better still, detect the condition in `analyze()` before the run loop and emit one warning instead of twelve. Then add a CLI test covering `--prompt-only → generate → accept → verify`.

---

### H3 — The website contains no link to the GitHub repository

```text
ID:             H3
Title:          No GitHub link anywhere on the public site; the nav item that looks like one is an internal anchor
Location:       apps/web/components/header.tsx:13, apps/web/app/page.tsx:355-361 (footer),
                apps/web/components/demo.tsx (sidebar)
```

**Reproduction**

```bash
grep -rnoE "https://github.com/[A-Za-z0-9_./-]+" apps/web/app apps/web/components
# (no matches)
```

**Expected:** an open-source marketing site links to its source.
**Actual:** every link is internal — `/`, `/demo`, `/docs`, `/demo.json`, `/report.html`. The header nav item reads **"GitHub Action ↗"** with an external-link arrow and points at `/docs#github-action`. The footer has Brand + tagline + Documentation. There is no repo link, no star button, no issues link, no license link.

**Why it matters:** the entire point of the launch is to send people to the repository. A visitor who cannot install (B1) and cannot find the source has nowhere to go. The external-arrow-to-internal-anchor is separately misleading.

**Recommended fix:** add `https://github.com/aravinda-1402/causeval` to the header and footer, and either relabel the nav item or point it at the real Action directory.

---

### H4 — `docs/validation.md` contains factually false claims

```text
ID:             H4
Title:          The validation record misstates the test count and claims nothing has been published
Location:       docs/validation.md:16 and docs/validation.md:78-81
```

**Reproduction**

```bash
npx --yes pnpm@10.17.1 test      # "136 passed (136)", "Test Files 11 passed (11)"
git ls-remote --tags origin      # refs/tags/v0
```

**Expected:** a document that opens *"Every claim here is reproducible with the commands shown"* is reproducible.
**Actual:** two false statements.

1. Line 16: `` | Unit and integration suite | `pnpm test` | **125 passed across 9 files** | `` — actual is **136 passed across 11 files**. The per-area breakdown below it sums to 125 and omits `tests/security.test.ts` entirely.
2. Lines 78-81: *"**Nothing has been published.** No npm package, no GitHub repository, no release tag and no website deployment."* — the GitHub repository exists at `aravinda-1402/causeval` and the tag `v0` exists on origin at `c9c0124`.

**Why it matters:** you are positioning this as research-defensible, and `docs/validation.md` is the document a reviewer will audit hardest. A validation record that misstates its own validation undermines the credibility of everything else — including the parts that are genuinely rigorous. It is also the easiest possible thing for a hostile commenter to check.

**Recommended fix:** regenerate the table from a real run, add the security suite to the breakdown, and rewrite the publication paragraph to state what is actually true today (repo public, `v0` tagged, npm not published, website not deployed). Consider adding `pnpm test` output parsing to `release-check.mjs` so the number cannot drift again.

---

### H5 — No time bound on eval regular expressions; the stated protection does not exist

```text
ID:             H5
Title:          Catastrophic backtracking hangs a verification run indefinitely; the code comment and SECURITY.md claim otherwise
Location:       packages/core/src/assertions.ts:20-22 (comment), :60-76 (checkAssertions)
                SECURITY.md ("Eval files, including regular expressions, are your own input.")
```

**Reproduction**

```js
import { checkAssertions } from "@causeval/core";
const t0 = Date.now();
checkAssertions("a".repeat(30) + "b", { behavior: "b", mustMatch: ["(a+)+$"] });
console.log(Date.now() - t0);
```

**Expected:** bounded, per the comment in `assertions.ts`:
> *"Patterns come from the developer's own eval files, which are trusted input, but the tested string is still bounded so a pathological pattern cannot hang a verification run indefinitely."*

**Actual:** **231,342 ms** (3 minutes 51 seconds) on a **31-character** input. The `MAX_MATCH_LENGTH = 200_000` bound caps input *length*, which is irrelevant to catastrophic backtracking. There is no timeout: `runnerTimeoutMs` applies only to `CustomRunner`, not to native assertion evaluation.

**Why it matters:** three concrete paths, none requiring an attacker.

1. **`causeval generate` authors regexes.** `generate.ts:generationPrompt` explicitly asks the model for `mustMatch` / `mustNotMatch` patterns. A model-written pattern lands in the staging file; `review --accept all` promotes it; the next `verify` hangs with no diagnostic. In `verify` the pattern is evaluated `mappedEvals × 2 × runsPerEval` times.
2. **CI.** `.github/workflows/ci.yml` runs `on: pull_request`. A PR touching eval YAML can burn the full GitHub job timeout.
3. **The claim itself.** Both an inline comment and the security policy assert a protection that measurably does not exist. That is a defensible finding for anyone who reads the source.

**Recommended fix (pick one, all cheap):**
- Evaluate `mustMatch`/`mustNotMatch` in a worker thread with a hard deadline (~1 s) and fail the assertion with `"regex evaluation exceeded 1000ms"`; or
- Use a linear-time engine (RE2 via `node-re2`) for eval-supplied patterns; or
- At minimum, run a static ReDoS check (e.g. `recheck`, `safe-regex`) at eval-load time and reject dangerous patterns with a clear error.

Whichever you choose, correct the comment in `assertions.ts` and the SECURITY.md sentence so they describe the protection that actually exists.

---

## MEDIUM findings

### M1 — `causeval init` writes no `.gitignore`, and the privacy doc's gitignore claim is false for users

```text
Location:   packages/cli/src/index.ts (`initProject` file list), docs/privacy.md ("Things that can contain private data")
Repro:      npx causeval init && npx causeval scan && ls -a    # no .gitignore
Expected:   the analysis cache is protected from accidental commit in the user's project
Actual:     docs/privacy.md states ".causeval/cache/ contains raw analysis responses. It is gitignored" — true only
            inside CausEval's own repo, whose .gitignore says "Analysis caches can contain prompt and eval content;
            never commit them." `causeval init` gives users none of that protection.
Evidence:   cache files verified to contain verbatim prompt clauses, e.g.
            {"rules":[{"source":{"exactQuote":"Never disclose account information until identity has been verified."}…
Why:        A user follows the docs, commits .causeval/, and publishes their system prompt's extracted contract.
Fix:        Have `init` write a .causeval/.gitignore (or project .gitignore stanza) covering cache/ and report artifacts;
            correct the privacy doc wording to say what CausEval does for the user rather than for itself.
```

### M2 — Committed example artifacts do not match what the CLI produces

```text
Location:   scripts/generate-demo.ts (passes `fixturePrompt` in memory, bypassing file loading)
Repro:      node -e '…' examples/support-agent/.causeval/report.json   ->  "warnings": []
            npx causeval scan  (same project, real CLI)                 ->  1 warning (H1)
Why:        CI's "Committed demo artifacts match the engine output" step only re-runs generate-demo.ts, so it compares
            the script against itself and can never detect CLI/script divergence. This is exactly how H1 survived to release.
Fix:        Have generate-demo.ts read prompts/system.md from disk the way the CLI does, or add a CI step that runs the
            real CLI against examples/support-agent and diffs the result.
```

### M3 — `causeval diff` suppresses analysis warnings and reports confident non-findings

```text
Location:   packages/cli/src/index.ts (`printDiff` never calls printWarnings)
Repro:      git init; npx causeval init; git commit;
            printf "\nNever wire funds without a second approver.\n" >> prompts/system.md; git commit;
            npx causeval diff HEAD~1 HEAD
Expected:   either the new critical rule surfaced, or a clear caveat that the fixture cannot see it
Actual:     "No new uncovered or unprotected behaviors." / "Rules +0 / -0 (12 unchanged)" — silently, with no warning
Why:        Under the fixture (the only no-key path), `diff` can never report a change, yet it reports absence of change
            with full confidence. This is the Journey D demo path; it produces a false negative on the most safety-relevant
            question the tool asks. The warning that would explain it exists in the report but is never printed.
Fix:        Print `report.warnings` from `diff` as every other command does. Consider a hard notice when the fixture
            provider is used with `diff`.
```

### M4 — Provider request count is double-reported

```text
Location:   packages/core/src/provider.ts (`CachedProvider.scoped` shares `this.inner`; `usage` proxies `inner.usage`)
            packages/cli/src/index.ts (`const requests = usage.requests + (judgeUsage?.requests ?? 0)`)
Repro:      code reading + `judge === llm` is never true because `scoped()` returns a new CachedProvider
Expected:   "Provider requests: N" equals the real HTTP call count
Actual:     when no separate judge is configured (the default), llm.usage and judge.usage read the SAME inner counter,
            so the printed figure is exactly 2x the real number
Why:        The README tells users to "monitor the provider request count in verbose output" to control spend. The
            number they are told to budget against is wrong by 2x.
Fix:        Track usage per CachedProvider instance, or detect the shared-inner case and count it once.
```

### M5 — High-risk uncovered rules are never named in the Action summary

```text
Location:   packages/core/src/report.ts (`renderMarkdown`)
Repro:      node packages/action/run.mjs (scan, fail-on threshold) -> GITHUB_STEP_SUMMARY
Actual:     "| High-risk unprotected | 1 |" and "- 1 high-risk rules are unprotected (limit 0)"
Expected:   the rule is named. The CLI does this correctly:
            "R03 [CRITICAL] Never include full payment card numbers in responses.  - uncovered"
Why:        Your stated differentiator for CI is surfacing *new high-risk uncovered behavior* clearly. A PR reviewer
            sees a bare count and must download an artifact to learn which behavior is unprotected.
Fix:        Add the high-risk unprotected rules (id, severity, expectedBehavior) to renderMarkdown, capped at ~10.
```

### M6 — Redaction misses several common secret formats

```text
Location:   packages/core/src/utils.ts (`redact`)
Verified caught:   sk-*, gh[pousr]_*, `key|token|secret|password` = / : value, exact env-var values
Verified MISSED:   Authorization: Bearer <JWT>   ->  unredacted
                   AKIAIOSFODNN7EXAMPLE          ->  unredacted  (AWS access key id)
                   xoxb-…                        ->  unredacted  (Slack)
                   AIzaSy…                       ->  unredacted  (Google)
                   -----BEGIN RSA PRIVATE KEY----- ->  unredacted
                   postgres://user:hunter2@host  ->  unredacted  (inline DB password)
Repro:      observed in CustomRunner stderr tail and in redact() directly
Why:        Actual provider API keys ARE covered, because the CLI passes env values explicitly — the README claim
            "API keys never appear in reports…" holds. The gap is secrets appearing *inside prompt text or model
            output*, which is exactly what reports contain. SECURITY.md already says redaction is best effort, so
            this is a hardening gap, not a false claim.
Fix:        Add the six patterns above. Cheap, high value for a tool whose output people share.
```

### M7 — Mutation overlap guard degrades silently on a stale sibling span

```text
Location:   packages/core/src/mutation.ts (others loop: `section.indexOf(span.exactQuote)` can return -1)
Repro:      target "rule A here" @L1; unrelated rule declares quote "THIS TEXT DOES NOT EXIST" @L2
Expected:   refusal, or the sibling skipped explicitly
Actual:     indexOf returns -1, `at` becomes a bogus offset, the overlap check runs against nonsense and the
            mutation proceeds:  "Line one .\nLine two rule B here."
Why:        `validateSource` is applied to the TARGET rule only, never to `others`. One bad extraction span silently
            disables the overlap guard for that sibling — the guard that protects mutation minimality, your strongest
            technical claim. Low likelihood, high consequence if it fires.
Fix:        Skip-with-warning or refuse when a sibling quote is absent from its declared range, rather than computing
            an offset from -1.
```

### M8 — `mustNotMatch` is unsound beyond 200 KB while `mustContain` is not

```text
Location:   packages/core/src/assertions.ts (`subject = output.slice(0, MAX_MATCH_LENGTH)` used only by regex checks)
Repro:      output = "x".repeat(250000) + "SECRETWORD"
            mustContain ["SECRETWORD"] -> PASSES (searches full output)
            mustMatch   ["SECRETWORD"] -> FAILS  (searches truncated subject)
Why:        The inconsistency is invisible to users, and the failing direction is the unsafe one: a violation appearing
            past 200 KB will satisfy `mustNotMatch` and be recorded as a PASS.
Fix:        Apply one consistent subject to all assertion families, and warn when truncation actually occurs.
```

### M9 — A negative detection effect is classified as pseudo-coverage

```text
Location:   packages/core/src/engine.ts (`if (effect <= config.pseudoCoverageCeiling) return "pseudo-covered"`)
Repro:      classify([1,1,1,1,0], [1,1,1,1,1], defaults)   // baseline 80% (passes the floor), mutant 100%
Actual:     "pseudo-covered"
Expected:   "indeterminate" — removing the instruction made the evals pass MORE often. That is evidence the experiment
            is confounded, not evidence the eval failed to detect removal.
Why:        The interpretation string then tells the user "this eval did not detect removal", which understates a
            genuinely anomalous result. Narrow, but it is a wrong classification with a stable baseline.
Fix:        Treat effect < -pseudoCoverageCeiling as `indeterminate` with a reason naming the inversion.
```

### M10 — `review --accept all` yields instant 100% Trace Coverage from self-generated evals

```text
Location:   engine + generate interaction; README "Use --accept all only after reviewing every candidate"
Repro:      npx causeval init --prompt-only && npx causeval generate && npx causeval review --accept all && npx causeval scan
Actual:     Trace Coverage jumps 0% -> 100% (12/12) in three commands
Sample generated case (fixture):
            id: r05-positivepath
            input: "Refund my $80 order, it never arrived."
            expected: { behavior: "Refunds above $100 require manager approval." }     <-- wrong for an $80 refund
Why:        The review gate is REAL and works (verified: unreviewed cases are excluded from every metric by the engine,
            not by a glob — this is a genuine strength). But the headline outcome of the documented flow is a circular
            100%, and under the fixture every generated `expected.behavior` is a verbatim copy of the rule text,
            including semantically incorrect pairings. That screenshot is the easiest bad-faith criticism available.
            Note: the real generation prompt sent to a live model is far better (it asks for deterministic assertions
            and exact boundary values) — this is largely a fixture-quality problem, but the fixture is what ships.
Fix:        Improve the fixture's generated expectations so the demo is not self-refuting; and consider surfacing
            "N of your mapped evals are CausEval-generated" alongside Trace Coverage so the provenance is visible in
            the number rather than only in the review step.
```

### M11 — Node version requirements are inconsistent and the floor is untested

```text
Location:   package.json / packages/*/package.json  "node": ">=20.11"
            README.md:75, README.md:442, CONTRIBUTING.md:8, docs/deployment.md:18  "Node.js 22+"
            .github/workflows/ci.yml:17,40  node-version: "22"
Why:        engines permits 20.11 so npm will install there, but nothing is tested below 22. Either the docs are wrong
            or the engines floor is.
Fix:        Pick one. If 20.11 is genuinely supported, add a Node 20 matrix leg to CI; otherwise raise engines to >=22.
```

### M12 — `docs/github-action.md` "Minimal usage" has no unpublished-package caveat

```text
Location:   docs/github-action.md:18
Actual:     "- run: npm install -D causeval" presented as the minimal working example, with the caveat only appearing
            far below under "Running it from a checkout of this repository"
Why:        Same root cause as B1. Anyone copying the minimal example gets a failing workflow.
Fix:        Resolved automatically by publishing to npm; otherwise add the caveat inline at the top.
```

---

## LOW findings

- **L1 — Mutation leaves degraded grammar.** Removing one clause of a compound sentence yields `"Never reveal account numbers and ."`; removing a bullet leaves `"- "`. Minimality is correct; readability is not. Worth listing as a mutation-validity threat (see Methodological findings).
- **L2 — `renderMarkdown` does not HTML-escape.** `report.run.provider` / `model` reach the PR comment and job summary unescaped. Values are user config, and GitHub sanitises comment HTML, so impact is cosmetic.
- **L3 — `--debug` is indistinguishable from `--verbose`.** Both map to the same `progress` callback. README documents them as different things.
- **L4 — Bad git ref error leaks raw git stderr and suggests no next action.** `CausEval: Command failed: git rev-parse … fatal: Needed a single revision` — inconsistent with the project's own excellent error standard elsewhere.
- **L5 — LICENSE appendix retains the `Copyright [yyyy] [name of copyright owner]` template.** Copyright is correctly asserted in NOTICE and both package NOTICEs, so this is cosmetic.
- **L6 — README shows `$ npx causeval scan` in the "No eval suite yet?" block**, contradicting its own "currently unpublished on npm" warning 200 lines earlier.
- **L7 — `checkGates` fails the gate on *any* flaky or indeterminate result**, regardless of count or severity. Defensible, but surprising for large suites and not obviously documented as a hard gate.
- **L8 — `apps/web/components/copy.tsx` default command uses `pnpm causeval …`** while every other site surface uses `npx causeval`. Inconsistent even before B1 is fixed.

---

## Methodological findings

**Separating research limitations from software bugs, as requested.**

### Software bugs with methodological consequences (fix before launch)
- **H5** — unbounded regex evaluation can hang a verification run.
- **M3** — `diff` reports "no new uncovered behaviors" with warnings suppressed: a confident false negative.
- **M7** — the mutation overlap guard can be silently disabled by one stale extraction span.
- **M9** — negative detection effect misclassified as pseudo-coverage.

### Research limitations already documented (do not treat as blockers)
`docs/methodology.md` §11 enumerates eleven threats to validity — model dependence, model priors, behavioral redundancy, small samples, extraction error, mapping recall, judge error, correlated evals, prompt-only scope, execution environment, and generated evals. This is genuinely more thorough than most published tooling papers. `docs/research.md` adds formal notation (`CRC = |{r ∈ R : stable baseline and D(r) ≥ δ}| / |R|`) that matches the implementation exactly. `ROADMAP.md` explicitly states *"No benchmark outcomes are claimed in this repository"* and lists multi-rule mutation and mapper calibration as future work.

**I could not find an unacknowledged research weakness in the existing list — except the two below.**

### Research limitations NOT currently documented (add to §11)
1. **Degraded-prompt confound.** Removal leaves syntactically broken text (`"Never reveal account numbers and ."`, orphan `"- "` bullets). A model's behavior may change because the prompt became malformed, not because the rule was removed. This is a distinct threat to intervention validity from the ones listed, and it is directly observable in the diffs the report displays. Suggested wording:

   > *Mutation removes the smallest clause that carries the rule, which can leave the surrounding sentence ungrammatical. A behavioral change may therefore reflect prompt degradation rather than the absence of the specific instruction. Inspect the diff before treating a detection effect as attributable to the rule alone.*

2. **Lexical pre-selection recall, quantified.** At 100 rules × 500 evals, only **800 of 50,000 pairs (1.6%)** are ever shown to the mapper. §11.6 mentions this qualitatively; the magnitude belongs there, along with the remedy (`mapping.candidatesPerRule: 0`) and its cost.

### Use of the word "causal" — defensible
The intervention is real (textual removal), the outcome is measured, repetition is enforced (minimum 2 runs, default 3), unstable baselines are excluded, and the two principal confounds are named in the report itself rather than in a footnote. The wording is consistently conditional: *"Under {model} at these settings…"*. Pseudo-coverage explicitly refuses to claim the eval is bad. I found **no** instance of "proof", "guarantee", "certification" or "world's first" used as a claim anywhere in the repository — the only hits were explicit disclaimers. This survives adversarial reading.

### Single-rule intervention
Only one rule is removed at a time, so jointly-enforced behaviors cannot be isolated. This is correctly reported as a `possible-redundancy` confound rather than suppressed, and multi-rule mutation is on the v0.2 roadmap. **Appropriate for v0.1. Not a blocker.**

### The hard limit on this audit
**Model-dependent quality was not and could not be measured.** Extraction accuracy, mapping accuracy and judge accuracy all depend on a live model, and no API key was used. Every behavioral test I ran exercised the deterministic fixture or a scripted stub. The repository states this plainly in three places. It means the headline claims — that extraction produces atomic rules, that mapping avoids semantic-similarity false positives, that generated boundary cases use exact thresholds — rest on prompt engineering that has never been measured against a real model. `docs/release.md` calls for a budgeted live smoke test before publishing quality claims. **Do that before the LinkedIn post, even at $5 of tokens**, and say in the post what model you ran it against.

---

## Security / privacy findings

### Verified secure — tested, not assumed
- **HTML report XSS: clean.** I injected `</script><img src=x onerror=alert(1)>"><svg/onload=alert(2)>` into every writable field of the report (project name, provider, model, rule quote, expectedBehavior, condition, rationale, tags, stableKey, eval id/input/description, mapping rationale, diff, interpretation, confounder detail, redundancy rationale, gap reason, acceptedRisks key **and** value, warnings, suggestions, run metadata, runner identity, evidence outputs). **Zero raw injections escaped.** The only `</script>` in the output is the legitimate one.
- **Badge SVG: clean.** Only a percentage reaches the text node.
- **Command injection: blocked.** `--upload-pack=touch /tmp/pwn` rejected as a git ref; `CAUSEVAL_ACTION_MODE="rm -rf /"` rejected before execution; git ref resolution uses `execFileSync` with `--end-of-options` and `^{commit}`; refs starting with `-` are rejected.
- **Path traversal:** `scripts/serve-static.mjs` enforces `path.startsWith(root + sep)`; `diff` refuses a prompt outside the git root.
- **Custom runner isolation:** started only from an explicit `--runner` flag, never auto-discovered. Verified handling of: nonzero exit, hang (killed at timeout), malformed JSON, missing/extra/duplicate ids, empty stdout, unstartable command, stderr noise, 5 MB stdout cap. **No zombie processes** — a grandchild process was confirmed dead after a timeout kill (`taskkill /T /F` on Windows, process-group `SIGKILL` elsewhere). Temp directory removed in `finally`. `CAUSEVAL_DRY_RUN=1` set. Command recorded as a SHA-256 digest only — verified: `{"kind":"custom","identity":"sha256:d1304af3d74b898e"}`.
- **No maintainer-key backend (BYOK verified).** `apps/web` is `output: "export"`. No API routes, no `"use server"`, no server actions, no outbound `fetch` in any component. The only `process.env` reference on the site is inside a *displayed code sample*. Analysis runs exclusively in the local CLI / Action with the user's own credentials. **Nothing to fix here.**
- **No telemetry.** Verified by source inspection: no analytics, no version check, no phone-home. Build scripts set `NEXT_TELEMETRY_DISABLED`, `TURBO_TELEMETRY_DISABLED`, `DO_NOT_TRACK`.
- **Cache hygiene:** files written with mode `0o600`; cache keys are SHA-256 of request content; API keys are not part of the request body and therefore never part of a key.
- **Action permissions:** `contents: read` by default, with `pull-requests: write` required only for `comment: true`, documented. Token used only for the comment path; failures degrade to a warning.

### What actually leaves the machine (verified against `docs/privacy.md`)
The table in `docs/privacy.md` is **accurate**. Confirmed by reading every `generateStructured` call site: system prompt (chunked, line-numbered), extracted rules, candidate eval definitions, up to 20 existing evals for generation style context, and — during `verify` only — the prompt plus model output to the judge. **Repository source, git history, file tree and environment are never uploaded.** No unexpected transmission found.

### Security issues to fix
- **H5** — unbounded regex (detailed above).
- **M1** — user projects get no `.gitignore` for the prompt-derived cache; the privacy doc claims otherwise.
- **M6** — redaction misses Bearer/JWT, AWS, Slack, Google, PEM and inline DB-URL credentials.
- **L2** — markdown summary is unescaped.

---

## Packaging / install findings

**Yes — I successfully installed the PACKED package outside the monorepo.** This was done in a clean temp directory with `npm init -y` and no workspace linkage.

```bash
npm pack --pack-destination <tmp>/pack       # causeval-0.1.0.tgz, 48,840 bytes
tar -tzf causeval-0.1.0.tgz
# package/LICENSE  package/NOTICE  package/dist/index.js  package/package.json
# package/README.md  package/dist/index.d.ts          <- exactly 6 files, nothing stray
npm install <tmp>/pack/causeval-0.1.0.tgz    # added 23 packages, 0 vulnerabilities
head -c 20 node_modules/causeval/dist/index.js   # "#!/usr/bin/env node"  <- shebang preserved
```

| Check | Result |
| --- | --- |
| Missing dependencies | **None.** `@causeval/core` is bundled via `noExternal`; all 5 runtime deps resolved |
| Missing build artifacts | **None.** `dist/index.js` + `dist/index.d.ts` present |
| Package exports | **Correct.** `.` → types + import; `./package.json` exposed |
| `bin` configuration | **Correct.** `causeval`, `causeval.cmd`, `causeval.ps1` all created; shebang intact |
| Wrong paths | **None found** |
| Monorepo-only assumptions | **None found.** `demo`, `init`, `scan`, `generate`, `review`, `verify`, `report`, `badge`, `diff` all ran from the packed install |
| Runtime dependencies | **Complete** |
| Node compatibility | Works on 22.16.0. The `>=20.11` floor is **untested** (M11) |
| Tarball hygiene | **Clean.** No sources, no tests, no `.causeval`, no node_modules |
| Type declarations | `release-check.mjs` compiles `defineConfig` from the installed package under `--strict` — a good check that most projects skip |

**The only packaging problem is that none of this is on npm (B1).** The configuration itself is correct and ready to publish.

---

## Core-method verification

State explicitly whether each is **actually implemented** rather than mocked:

| Method | Verified | Implemented for real? |
| --- | --- | --- |
| **Behavioral Contract extraction** | **YES** | **Real.** `analysis.ts:extractRules` chunks the prompt with global line numbers, sends it to the configured provider, validates every returned `exactQuote` against the source text with `validateSource`, **discards fabricated extractions** with a warning, assigns content-derived `stableKey`s, and merges duplicates into a `sources[]` array. The fixture provider is clearly a fixture and is only reachable via `provider.type: "fixture"`. *Caveat: extraction **quality** against a live model is unmeasured (no API key).* |
| **Trace Coverage** | **YES** | **Real.** `credibleMappings` requires `relationship === "direct"` AND `confidence >= threshold`. Verified numerically: shipped fixture 9/12 = **75.00%** (matches README); synthetic fixture 7/10 = **70.00%** exactly as specified in your §22. |
| **Causal Rule Coverage** | **YES** | **Real.** `protectedIds.size / rules.length`. Verified: shipped fixture 5/12 = **41.67%** (README says 42% ✓); synthetic fixture 4/10 = **40.00%** exactly as specified in your §23. Definition is identical in `engine.ts`, `report.ts` HTML, `demo.tsx` UI and `docs/research.md` notation. Scan mode returns `null`, **not** 0. |
| **Mutation execution** | **YES** | **Real and deterministic — this is the strongest part of the codebase.** `mutation.ts` performs offset-based string surgery, not LLM rewriting. It survived 10 adversarial cases: compound sentence (removed only the target clause, the privacy rule survived), duplicate phrase on separate lines (removed only the declared span), merged rule with two sources (removed both), same phrase twice on one line (**refused** — ambiguity guard), target quote containing a sibling's quote (**refused** — overlap guard), CRLF, Unicode + emoji, multi-line quotes, templated variables, and boundary mutation (`$100` → `$1000`, correctly **refused** when two numbers are present). Every mutation is minimal and the exact diff is shown in the report. One gap: M7. |
| **Pseudo-coverage classification** | **YES** | **Real.** Pure arithmetic on repeated-run pass rates against three configured thresholds — no model call, no score. Verified across 10 baseline/mutant shapes: `3/3→0/3` = causally-covered; `3/3→3/3` = pseudo-covered; `2/3→1/3` = **flaky**; `1/3→1/3` = **flaky**; `3/3→2/3` (33% effect) = **indeterminate**. Unstable baselines are never converted into causal claims, and a single flaky mapped eval overrides an otherwise-healthy aggregate. The interpretation text explicitly refuses to claim the rule is untested. One gap: M9. |

**No production code path depends on the fixture, a mock, or a stub.** I grepped the entire non-test source tree for `TODO`, `FIXME`, `XXX`, `HACK`, `placeholder`, `not implemented`, `stub`, `hardcoded`, `fake` — the only hits were the word "placeholder" in a search-input attribute and in release-checklist prose. There is no hidden mock behind the causal pipeline.

---

## Claims that should be changed

Exact wording, with the reason:

1. **`docs/validation.md:16`**
   > `| Unit and integration suite | pnpm test | **125 passed across 9 files** |`

   False. Actual: **136 passed across 11 files**. The per-area breakdown omits `tests/security.test.ts`.

2. **`docs/validation.md:78-81`**
   > "**Nothing has been published.** No npm package, no GitHub repository, no release tag and no website deployment."

   False. The GitHub repository is public and tag `v0` exists on origin at `c9c0124`.

3. **`packages/core/src/assertions.ts:20-22`**
   > "…the tested string is still bounded so a pathological pattern cannot hang a verification run indefinitely."

   False. Measured **231,342 ms** on a 31-character input. Length bounding does not prevent catastrophic backtracking.

4. **`SECURITY.md`, "Trusted by design"**
   > "Eval files, including regular expressions, are your own input."

   Incomplete. `causeval generate` writes model-authored regexes into eval files. They are not the developer's own input until reviewed, and `--accept all` is documented.

5. **`docs/privacy.md`, "Things that can contain private data"**
   > "`.causeval/cache/` contains raw analysis responses. It is gitignored…"

   False for users. `causeval init` writes no `.gitignore`. Rephrase to state what the user must do.

6. **`apps/web/app/docs/page.tsx:58` and `apps/web/app/page.tsx:341`**
   > `npx causeval demo` / `npm install -D causeval`

   Presented without caveat; both 404 today (B1).

7. **`README.md`, "No eval suite yet? Start there."**
   > `$ npx causeval scan`

   Contradicts the README's own "currently unpublished on npm" warning.

8. **`README.md:75` / `:442` / `CONTRIBUTING.md:8`**
   > "Node.js 22+"

   Contradicts `engines: ">=20.11"` in all three package manifests.

**Nothing else needs changing.** I specifically hunted for "proof", "guarantee", "certification", "world's first", "definitive" and "always detects" and found **none used as a claim** — every hit was a disclaimer. The claim discipline in this project is genuinely above average and should not be touched.

---

## Tests missing from the repository

Specific, concrete gaps:

1. **`init` → `scan` produces zero warnings.** Would have caught H1 immediately. Highest value test in this list.
2. **`init --prompt-only` → `generate` → `review --accept all` → `verify`.** `release-check.mjs` stops at `scan`, which is why H2 is unreleased-untested.
3. **Real CLI run against `examples/support-agent/` compared to the committed artifacts.** CI currently only re-runs `generate-demo.ts` against itself (M2).
4. **Regex evaluation time bound.** e.g. `expect(elapsed).toBeLessThan(2000)` for `(a+)+$` against 30 `a`s (H5).
5. **`causeval diff` prints analysis warnings** (M3).
6. **`classify()` with a negative detection effect and a stable baseline** (M9).
7. **Mutation with a sibling rule whose quote is absent from its declared line range** (M7).
8. **Assertion-subject consistency** — `mustContain` and `mustMatch` agree on inputs over 200 KB (M8).
9. **Provider request accounting** — asserting the printed count equals the real HTTP call count with a default (scoped) judge (M4).
10. **Node 20.11 CI matrix leg**, or raise the engines floor (M11).
11. **Redaction corpus test** — Bearer/JWT, AKIA, xoxb, AIza, PEM, `postgres://user:pass@host` (M6).
12. **Link check over `apps/web`** asserting at least one outbound GitHub link exists (H3).
13. **Install-command consistency check** — every `npx causeval` / `npm install causeval` string in `apps/web` and `docs/` is either valid or carries a caveat (B1).

---

## Things that are already good and should NOT be rewritten

**A follow-up engineering agent must not touch these. They are correct, tested, and represent the project's real value.**

- **`packages/core/src/mutation.ts`** — deterministic, minimal, guarded. Survived 10 adversarial attacks including compound sentences, duplicate phrases, overlapping spans, CRLF, Unicode, multi-line quotes and boundary mutation. Only the M7 `indexOf(-1)` edge needs a guard; **the algorithm is right**.
- **`packages/core/src/engine.ts`** — `classify`, `calculateSummary`, `credibleMappings`, `interpret`. Arithmetic verified to the decimal against two independent fixtures. The `null`-vs-`0` distinction for unverified CRC is exactly right. Only M9's negative-effect branch needs a line.
- **`packages/core/src/analysis.ts`** — `selectCandidates` turns 50,000 pair judgments into **15 model calls** at 100×500 with IDF weighting and an exact-quote boost. Genuinely good engineering. The skipped-rule warning is the right honesty.
- **`packages/core/src/report.ts`** — `renderHTML` escaping. I attacked every field with hostile strings and nothing escaped. Do not refactor the escaping.
- **`packages/core/src/runner.ts`** — `CustomRunner`. All nine failure modes handled with actionable messages, no zombie processes, bounded redacted stderr, digest-only command identity, temp cleanup in `finally`. `NativeRunner`'s judge blinding (the judge never sees the system prompt, so it cannot know baseline from mutant) is a genuinely thoughtful design decision.
- **The generated-eval review gate.** Verified empirically: unreviewed cases are excluded by the **engine**, not by a glob. Trace Coverage stayed at "no eval suite" before accept and moved only after. This is your strongest integrity claim and it holds.
- **`apps/web` static architecture.** `output: "export"`, no API routes, no server actions, no backend. BYOK is structurally guaranteed, not merely promised. Do not add a backend.
- **`docs/methodology.md`, `docs/research.md`, `ROADMAP.md`.** Better than most published work. §11's eleven threats to validity and the formal CRC notation should be preserved verbatim — add the two missing threats, change nothing else.
- **`.github/workflows/ci.yml`, `packages/action/action.yml`, `packages/action/run.mjs`.** Correct outputs, exit codes (1 on gate failure, 0 on `fail-on: never`), input validation, single-comment marker logic, least-privilege permissions, artifact upload. Verified by direct execution.
- **Package + tsup configuration.** Packs to 6 clean files, installs clean outside the monorepo, shebang preserved, declarations compile under `--strict`.
- **The whole claim-discipline layer** — hedged interpretations, "under the tested model and configuration", `confounders[]` in the report, the footer disclaimer, the badge that "reports a measurement, never a certification".
- **`scripts/release-check.mjs`.** Extend it (add the `verify`-after-accept step); do not replace it.

---

## Recommended fix order

### P0 — release blockers

1. **B1** — Either publish `causeval@0.1.0` to npm, or replace every `npx causeval` / `npm install -D causeval` on the website and in `docs/github-action.md` "Minimal usage" with the source-checkout form plus a visible caveat. *(Publishing also resolves M12 and half of M3's user impact.)*
2. **H3** — Add a GitHub repository link to the site header and footer; fix the "GitHub Action ↗" nav item.
3. **H4** — Correct `docs/validation.md`: real test counts, add the security suite, rewrite the publication paragraph.
4. **H1** — Fix the false fixture-mismatch warning (`.trim()` comparison) and add the zero-warning regression test.

### P1 — before the LinkedIn post

5. **H2** — Replace `Unknown fixture eval <id>` with an actionable message; add the `--prompt-only → generate → accept → verify` test.
6. **H5** — Bound regex evaluation (worker + deadline, or RE2, or a static ReDoS check at load time) and correct the two false claims about it.
7. **M1** — Have `init` write a `.gitignore` for `.causeval/cache/`; correct the privacy doc.
8. **M3** — Print analysis warnings from `causeval diff`.
9. **M5** — Name the high-risk unprotected rules in the Action job summary.
10. **M6** — Add the six missing redaction patterns.
11. **Run one budgeted live smoke test** against a real provider (OpenAI or Anthropic, ~$5) and record the model, the extracted rule count, and any extraction or mapping errors in `docs/validation.md`. Right now **zero** live-model evidence exists, and "live model quality has not been measured" is the first thing a skeptical LLM engineer will ask about.
12. **M11** — Reconcile the Node version floor.

### P2 — after launch

13. **M2** — Make `generate-demo.ts` read from disk, or add a real-CLI drift check to CI.
14. **M4** — Fix the doubled provider request count.
15. **M7** — Guard the mutation overlap check against a missing sibling span.
16. **M8** — Make the assertion subject consistent.
17. **M9** — Classify a negative detection effect as `indeterminate`.
18. **M10** — Improve the fixture's generated expectations so `--accept all` is not self-refuting.
19. **Methodology** — Add the degraded-prompt confound and the quantified lexical-recall limit to `docs/methodology.md` §11.
20. **L1–L8** — Polish.
21. Remaining items from "Tests missing from the repository".

---

## Final launch recommendation

> **Would you personally be comfortable linking this repository from a public LinkedIn launch today?**

```text
NO — but only because of P0. Fix those four items and the answer is YES.
```

**Why not today.** A LinkedIn post drives traffic to the website. The website's headline command is `npx causeval demo`, and that returns a 404. The site contains no link to the source repository, so a visitor who cannot install also cannot read the code. And `docs/validation.md` — the document a technical reader will check hardest — states that no GitHub repository and no release tag exist, while both do. Those three facts together produce the worst possible first impression for a project whose entire pitch is rigor and honest measurement. That is an unforced error, not a flaw in the work.

**Why yes after P0.** I attacked this project for several hours with the explicit goal of breaking it, and the core is sound:

- Mutation is deterministic string surgery with real guards. It refused every ambiguous and overlapping case I constructed and preserved unrelated rules in compound sentences.
- The coverage arithmetic is correct. Your §22 and §23 fixtures produced **exactly** 70.00% and 40.00%.
- Pseudo-coverage is arithmetic on repeated runs, not an LLM score, and the interpretation text explicitly refuses to claim the eval is bad.
- Unstable baselines become `flaky`, never a causal verdict.
- Generated evals are excluded from every metric by the engine until a human accepts them — I verified this empirically, not by reading the docs.
- No XSS. No backend. No telemetry. No maintainer-key endpoint. No zombie processes. No command injection.
- The packed package installs and runs correctly outside the monorepo.
- The methodology documentation lists eleven threats to validity, and I could only add two.

The two things I genuinely cannot vouch for, and which you should state plainly in the post itself: **extraction, mapping and judging quality against a live model have never been measured** (the repo says this; run the smoke test anyway), and **the "no eval suite yet" journey is broken past `review`** under the default provider (H2).

Lead the post with the honest framing the repo already uses — *evidence under a tested model and configuration, not proof* — and the differentiation (`CONTRACT → TRACE → VERIFY` rather than generic prompt mutation) comes through clearly. That framing is the project's real asset, and it survives adversarial reading. Do not let a 404 be the first thing anyone experiences.

---

## Handoff — paste this into an engineering agent

```text
You are fixing confirmed findings from an independent pre-launch audit of CausEval
(repo root: C:\Users\Aravinda\Desktop\CausEval, branch main, commit a944130).
The full audit with reproductions is in CAUSEVAL_PRELAUNCH_AUDIT.md at the repo root.

GROUND RULES
- Do NOT rebuild, redesign, or re-architect anything.
- Do NOT touch these files except for the single specific line changes named below:
  packages/core/src/mutation.ts, packages/core/src/engine.ts,
  packages/core/src/analysis.ts, packages/core/src/report.ts,
  packages/core/src/runner.ts, packages/action/*, .github/workflows/ci.yml,
  docs/methodology.md, docs/research.md, ROADMAP.md.
  These were verified correct by direct adversarial testing. Minimal diffs only.
- Do NOT create a release, retag, publish, or alter git history or GitHub metadata.
- After each fix run: pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
  (pnpm is not installed globally on this machine; use `npx --yes pnpm@10.17.1`).
- Baseline to preserve: 136 tests across 11 files, 10 Playwright tests, all passing.

P0 — MUST FIX BEFORE ANY PUBLIC PROMOTION

1. [B1] The website advertises npm commands that 404. `npm view causeval` -> E404.
   Files: apps/web/app/page.tsx:341-345, apps/web/app/docs/page.tsx:58 (CopyCommand),
          apps/web/app/docs/page.tsx:67, apps/web/app/docs/page.tsx:86,
          docs/github-action.md:18.
   Fix (choose ONE, ask the owner which):
     (a) Publish causeval@0.1.0 to npm following docs/release.md, then leave copy as is; or
     (b) Replace every `npx causeval …` / `npm install -D causeval` on the site and in
         docs/github-action.md "Minimal usage" with the source-checkout form the README
         already uses, plus a visible "npm publication pending" note ABOVE the code block.
   Do not ship a mixture of both.

2. [H3] apps/web has zero links to github.com. Verify with:
     grep -rnoE "https://github.com/[A-Za-z0-9_./-]+" apps/web/app apps/web/components
   Add https://github.com/aravinda-1402/causeval to apps/web/components/header.tsx and the
   footer in apps/web/app/page.tsx. The header nav item "GitHub Action ↗" currently points at
   /docs#github-action while showing an external-link arrow — relabel it or point it at
   https://github.com/aravinda-1402/causeval/tree/main/packages/action.

3. [H4] docs/validation.md contains false statements.
   - Line 16 says "125 passed across 9 files". Run `npx --yes pnpm@10.17.1 test` and use the
     real numbers (136 across 11 files). The per-area breakdown omits tests/security.test.ts — add it.
   - Lines 78-81 say "Nothing has been published. No npm package, no GitHub repository, no
     release tag and no website deployment." The repo is public and tag v0 exists on origin
     (git ls-remote --tags origin). Rewrite to state what is true: repo public, v0 tagged,
     npm not published, website not deployed.

4. [H1] Every `causeval init` + `causeval scan` prints a FALSE warning claiming rules were not
   extracted, directly contradicting the 12 rules printed above it.
   Root cause: packages/cli/src/index.ts `initProject` writes `fixturePrompt + "\n"`, while
   packages/core/src/engine.ts:186 compares `options.prompt !== fixturePrompt` strictly.
   Fix: compare trimmed text in engine.ts. Add a CLI test asserting a fresh
   `init` + `scan` emits ZERO warnings. Reproduce first:
     npx causeval init && npx causeval scan   # in a clean dir with the packed CLI

P1 — BEFORE THE LINKEDIN POST

5. [H2] `init --prompt-only` -> generate -> `review --accept all` -> verify fails with 12x
   "Unknown fixture eval r0N-positivepath" and every rule goes indeterminate.
   Source: packages/core/src/fixture.ts FixtureRunner.run throws for unknown eval ids.
   Fix: replace the throw with an actionable error naming the real cause ("the bundled fixture
   runner can only execute the 9 bundled example evals; generated evals need a real provider —
   set provider.type and CAUSEVAL_MODEL"), ideally detected once in analyze() rather than per rule.
   Add a CLI test for the full prompt-only -> generate -> accept -> verify sequence.
   Also extend scripts/release-check.mjs, which currently stops at `scan` after accepting.

6. [H5] ReDoS: checkAssertions took 231,342 ms on `mustMatch: ["(a+)+$"]` against 31 chars.
   packages/core/src/assertions.ts MAX_MATCH_LENGTH bounds input LENGTH, which does nothing
   against catastrophic backtracking. `causeval generate` asks models to write regexes, so this
   is reachable through the documented flow with no attacker.
   Fix: bound evaluation time (worker thread + ~1s deadline, or node-re2, or a static ReDoS
   check at eval-load time). Then correct the false claims in the assertions.ts comment
   (lines 20-22) and in SECURITY.md ("Eval files, including regular expressions, are your own input").
   Add a test asserting the pattern above completes in under 2000 ms.

7. [M1] `causeval init` writes no .gitignore, but docs/privacy.md claims ".causeval/cache/ …
   is gitignored". Cache files contain verbatim prompt clauses (verified).
   Fix: have initProject write .causeval/.gitignore (or a project .gitignore stanza) covering
   cache/ and report artifacts; correct the privacy doc wording.

8. [M3] `causeval diff` never prints report.warnings, so under the fixture it reports
   "No new uncovered or unprotected behaviors" with full confidence even after a new CRITICAL
   rule is added. Fix: call the existing printWarnings from printDiff in packages/cli/src/index.ts.

9. [M5] The Action job summary reports "High-risk unprotected | 1" but never names the rule.
   Fix: add the high-risk unprotected rules (id, severity, expectedBehavior, cap ~10) to
   renderMarkdown in packages/core/src/report.ts. The CLI already does this correctly — match it.

10. [M6] packages/core/src/utils.ts redact() misses: Bearer/JWT, AWS AKIA…, Slack xoxb-…,
    Google AIzaSy…, PEM "-----BEGIN … PRIVATE KEY-----", and inline DB creds
    (postgres://user:pass@host). Add these patterns and a redaction corpus test.

11. Run ONE budgeted live smoke test (~$5) against a real provider and record in
    docs/validation.md: the model id, extracted rule count, and any extraction/mapping errors.
    No live-model evidence currently exists anywhere in the repo.

12. [M11] Node floor inconsistency: engines says ">=20.11" in all three manifests; README:75,
    README:442, CONTRIBUTING.md:8 and docs/deployment.md:18 say "Node.js 22+"; CI tests only 22.
    Pick one — add a Node 20 CI matrix leg, or raise engines to ">=22".

P2 — AFTER LAUNCH

13. [M2] scripts/generate-demo.ts passes fixturePrompt in memory, so committed example artifacts
    ("warnings": []) differ from real CLI output. CI's artifact-drift check compares the script
    against itself and cannot detect this. Make the script read prompts/system.md from disk, or
    add a CI step running the real CLI against examples/support-agent.
14. [M4] Provider request count is 2x. CachedProvider.scoped() shares `this.inner`, so llm.usage
    and judge.usage read the same counter and packages/cli/src/index.ts adds them.
15. [M7] packages/core/src/mutation.ts: in the `others` overlap loop, section.indexOf() can return
    -1 for a stale sibling span, producing a bogus offset and silently skipping the guard.
    Skip-with-warning or refuse instead. Do not change the rest of the algorithm — it is verified correct.
16. [M8] assertions.ts: mustContain searches the full output while mustMatch/mustNotMatch search a
    200 KB truncation, so a violation past 200 KB PASSES mustNotMatch. Use one consistent subject.
17. [M9] engine.ts classify(): a negative detection effect with a stable baseline (e.g. 4/5 -> 5/5)
    returns "pseudo-covered". Return "indeterminate" with a reason naming the inversion.
18. [M10] Improve the fixture's generated expectations in packages/core/src/fixture.ts
    GENERATED_INPUTS — currently every generated expected.behavior is a verbatim copy of the rule,
    including wrong pairings (r05-positivepath: input "$80 refund", expected "Refunds above $100
    require manager approval").
19. Add to docs/methodology.md §11 (threats to validity), two threats only — change nothing else
    in that file: (a) the degraded-prompt confound — removal can leave ungrammatical text such as
    "Never reveal account numbers and ." or an orphan "- " bullet, so a behavioral change may
    reflect prompt degradation rather than the missing instruction; (b) quantified lexical recall —
    at 100 rules x 500 evals only 800 of 50,000 pairs (1.6%) are shown to the mapper; name
    mapping.candidatesPerRule: 0 as the remedy and its cost.
20. LOW items L1-L8 in CAUSEVAL_PRELAUNCH_AUDIT.md.
21. Remaining items in "Tests missing from the repository" in the audit.

VERIFIED-CORRECT — DO NOT REWRITE
mutation.ts (survived 10 adversarial cases); engine.ts classify/calculateSummary (math verified
to the decimal: 9/12=75.00%, 5/12=41.67%, synthetic 7/10=70.00%, 4/10=40.00%); analysis.ts
selectCandidates (15 model calls at 100x500 instead of 50,000 pair judgments); report.ts
renderHTML escaping (no XSS across every injectable field); runner.ts CustomRunner (all 9 failure
modes, no zombie processes, digest-only command identity); the generated-eval review gate
(engine-level exclusion, verified empirically); the static no-backend BYOK website architecture;
docs/methodology.md, docs/research.md, ROADMAP.md; CI workflow and the GitHub Action; package/tsup
configuration; and the project's hedged claim language ("evidence, not proof", "under the tested
model and configuration") — never strengthen any claim in this repository.
```

---

*End of audit. No source, configuration, documentation, test, tag, release or GitHub metadata was modified. This file was created and not committed.*
