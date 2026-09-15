# CausEval audit resolution

Final completion pass: 2026-09-14. Audited starting commit: `a944130`.
Prepared local patch: **0.1.1**, unpublished. The existing release, `v0` tag and
Git history were not changed. `CAUSEVAL_PRELAUNCH_AUDIT.md` is unchanged.

Counts use the audit's original severity headings: **1 BLOCKER, 5 HIGH,
12 MEDIUM, 8 LOW**. Its fix-order list promotes H1/H3/H4 to P0; all four items
in that P0 list are addressed. No confirmed P0/P1 code defect remains open.
Public promotion still has external gates in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## Findings

| Audit ID | Severity | Reproduction result                                                           | Fix / disposition                                                                                       | Regression / verification                                                                   | Final status                                                                            |
| -------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| B1       | BLOCKER  | CONFIRMED: npm registry E404, uncaveated site commands                        | Source-checkout onboarding on site and quick start; npm publication explicitly pending                  | Browser checks assert source instructions; external tarball install works                   | RESOLVED in source; npm publication remains manual                                      |
| H1       | HIGH     | CONFIRMED: newline in initialized prompt caused false warning                 | Compare trimmed fixture text; retain actionable mismatch warning for edited prompts                     | Audit regression, fresh CLI init/scan, external smoke                                       | RESOLVED                                                                                |
| H2       | HIGH     | CONFIRMED: fixture cannot execute accepted generated evals                    | Validate once before execution and explain provider/custom-runner handoff; document limitation          | Full generate/accept-all/verify CLI and packed flow                                         | RESOLVED; fixture execution scope is an EXPECTED LIMITATION                             |
| H3       | HIGH     | CONFIRMED: no GitHub URL in site navigation                                   | Real repository links in header/footer                                                                  | Browser link assertion and visual review                                                    | RESOLVED                                                                                |
| H4       | HIGH     | CONFIRMED: stale test totals and publication assertions                       | Correct validation record; distinguish public tag, owner-reported release, npm and deployment           | Actual test results, public GitHub API and remote tag query                                 | RESOLVED                                                                                |
| H5       | HIGH     | CONFIRMED: isolated child exceeded five-second watchdog                       | Fixed regex evaluator with 1000 ms V8 deadline; timeout is infrastructure error, not behavioral failure | Catastrophic `(a+)+$` regression completes under two seconds; assertion and security suites | RESOLVED                                                                                |
| M1       | MEDIUM   | CONFIRMED: init omitted privacy ignore policy                                 | New `.causeval/.gitignore`; preserve existing file; document older projects/custom output paths         | CLI regression inspects ignore file                                                         | RESOLVED                                                                                |
| M2       | MEDIUM   | CONFIRMED: generator bypassed prompt file loading                             | Generator reads shipped prompt file; packed check rejects false CLI warnings                            | Artifact regeneration and CLI checks                                                        | RESOLVED                                                                                |
| M3       | MEDIUM   | CONFIRMED: diff omitted available warnings                                    | Print base/current warnings; redaction on Git-ref reports                                               | CLI diff warning regression; stored-report diff in package smoke                            | RESOLVED                                                                                |
| M4       | MEDIUM   | CONFIRMED by shared-inner counter inspection                                  | Count default scoped judge requests once; separate judge still counted separately                       | Provider cache tests; CLI source review                                                     | RESOLVED                                                                                |
| M5       | MEDIUM   | CONFIRMED: summary named no high-risk rules                                   | Add up to ten named high-risk rules and analysis warnings to Markdown                                   | Audit regression and Action suite                                                           | RESOLVED                                                                                |
| M6       | MEDIUM   | CONFIRMED: all six credential forms survived redaction                        | Bearer/JWT, AWS, Slack, Google, PEM and inline URL credentials redacted                                 | Six corpus cases plus existing security/runner tests                                        | RESOLVED; redaction remains best effort                                                 |
| M7       | MEDIUM   | CONFIRMED: stale sibling spans could disable overlap guard                    | Refuse missing or ambiguous sibling spans                                                               | Audit regression and existing minimality/compound-clause tests                              | RESOLVED                                                                                |
| M8       | MEDIUM   | CONFIRMED: regex ignored violations after 200 KB                              | All assertion families inspect full output; regex has execution deadline                                | Positive/negative regex and literal tests over 250 KB                                       | RESOLVED                                                                                |
| M9       | MEDIUM   | CONFIRMED: 4/5 baseline → 5/5 mutant became pseudo-covered                    | Effect below negative ceiling becomes indeterminate with inversion explanation                          | Regression and classification suite; docs aligned                                           | RESOLVED                                                                                |
| M10      | MEDIUM   | PARTIALLY CONFIRMED: review gate works, fixture refund expectation misleading | Correct input-specific refund expectations; show accepted-generated provenance warning                  | Generation/review tests; fixture inspection                                                 | RESOLVED wording/data; fixture mappings remain illustrative, not model-quality evidence |
| M11      | MEDIUM   | CONFIRMED: engines permitted an untested floor                                | Node requirement consistently 22+                                                                       | Manifests, Node 22 builds and package install                                               | RESOLVED                                                                                |
| M12      | MEDIUM   | CONFIRMED: Action minimal example required unpublished package                | Source-build workflow precedes npm adoption; safe env binding for base ref                              | Guide reviewed against Action cli-path support                                              | RESOLVED                                                                                |
| L1       | LOW      | CONFIRMED: minimal removal may degrade grammar                                | Document prompt degradation as a validity threat; preserve minimal surgery                              | Existing mutation diffs and tests                                                           | EXPECTED LIMITATION                                                                     |
| L2       | LOW      | CONFIRMED by renderer inspection                                              | Escape user strings in Markdown summaries                                                               | Audit regression with hostile model field                                                   | RESOLVED                                                                                |
| L3       | LOW      | CONFIRMED: debug aliases verbose                                              | CLI help states the alias                                                                               | Help/source inspection                                                                      | RESOLVED                                                                                |
| L4       | LOW      | CONFIRMED by error-path inspection                                            | Bad Git refs explain fetching/checking ref or using saved JSON                                          | Code review; option-like refs remain rejected                                               | RESOLVED                                                                                |
| L5       | LOW      | EXPECTED LIMITATION: template is part of standard license appendix            | Keep Apache-2.0 text unchanged; actual copyright in NOTICE                                              | License/NOTICE comparison                                                                   | NO CHANGE REQUIRED                                                                      |
| L6       | LOW      | CONFIRMED: no-eval README command inconsistent                                | Use checkout command and explicit config                                                                | Documentation command scan                                                                  | RESOLVED                                                                                |
| L7       | LOW      | EXPECTED LIMITATION: any flaky/indeterminate result fails configured gate     | Explicitly document conservative gate behavior                                                          | Existing gate tests                                                                         | DOCUMENTED                                                                              |
| L8       | LOW      | CONFIRMED: copy command differed across surfaces                              | Consistent checkout-first demo instructions                                                             | Browser/source checks                                                                       | RESOLVED                                                                                |

## Additional completion work

- N1 (new dependency finding, HIGH/MEDIUM): the production dependency audit
  confirmed four advisories in Next.js's PostCSS dependency (two high, two
  moderate). Pin PostCSS to 8.5.28, already used by other tools in the original
  lockfile. Final `pnpm audit --prod --json`: zero advisories. Production build
  and browser checks validate compatibility. RESOLVED; not included in Claude's
  original finding counts.
- Replaced overclaiming phrases in package README and homepage with statements
  about the observed intervention. Preserved the Contract → Trace → Verify story.
- Added a focused tool-agent example with deterministic checks on proposed tool
  calls; exercised its subprocess with a loopback provider stub.
- Added social metadata, an optional configured canonical origin, the existing
  brand rendered to a 1200 × 630 PNG, contribution guidance and launch recording
  instructions. No users, benchmarks, testimonials or adoption metrics invented.
- Fixed the external smoke script: it previously created an install directory
  under `output/`; it now uses a real system temp directory outside the repo.
- Included separately configured judge endpoint identity in the cache namespace.
- Retained the static, no-backend website. No public endpoint can spend a
  maintainer key or execute a custom runner.

## Evidence boundaries

No live paid model or local model server was available. Extraction, trace
mapping and judging quality remain unmeasured against a real model. Protocol
tests and fixtures cannot establish that quality. A small owner-run live smoke
test is an explicit pre-promotion gate, not a claim of benchmark validity.

No PR comment was posted. Local Action execution validates outputs, thresholds,
summary and input handling; hosted permissions and comment delivery still need
the repository's configured credentials. Final commit `28e13af` was pushed and
hosted CI passed in [run 34918520357](https://github.com/aravinda-1402/causeval/actions/runs/34918520357).
The temporary hosted preview was subsequently made private at the owner's
request; its public routes are no longer exposed.

No P2 software finding is deliberately deferred. Remaining research limitations
are single-rule interventions, instruction redundancy, model priors, sampling,
imperfect extraction/mapping/judging and lexical candidate recall. No broad
architecture work, SaaS features or combinatorial mutation engine was added.
