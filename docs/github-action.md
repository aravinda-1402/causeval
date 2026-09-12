# GitHub Action

A composite action that runs the CausEval CLI, publishes the report as an
artifact, writes a job summary, and optionally maintains a single pull request
comment.

## Minimal usage

```yaml
permissions:
  contents: read
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm install -D causeval
      - uses: aravinda-1402/causeval/packages/action@v0
        with:
          config: causeval.config.ts
          mode: scan
```

`contents: read` is enough. Add `pull-requests: write` **only** if you set
`comment: true`.

## Inputs

| Input      | Default              | Notes                                                                                                                                                      |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`   | `causeval.config.ts` | Path inside the checked-out workspace.                                                                                                                     |
| `mode`     | `scan`               | `scan` makes a few cached analysis calls and never executes evals. `verify` executes them repeatedly and costs real model calls, so it must be opted into. |
| `fail-on`  | `threshold`          | `threshold` or `never`.                                                                                                                                    |
| `comment`  | `"false"`            | Create or update one PR comment.                                                                                                                           |
| `version`  | `latest`             | npm version to run when `causeval` is not already installed.                                                                                               |
| `cli-path` | `""`                 | Path to a prebuilt CLI entry point; skips npm entirely.                                                                                                    |
| `token`    | `github.token`       | Used only when `comment` is true.                                                                                                                          |

## Outputs

`trace-coverage`, `causal-coverage` (or `not-verified`), `verified`,
`eval-suite-detected`, `uncovered-count`, `pseudo-covered-count`,
`high-risk-uncovered-count`, `gate-failed`, `report-path`.

```yaml
- uses: aravinda-1402/causeval/packages/action@v0
  id: coverage
- run: echo "Trace ${{ steps.coverage.outputs.trace-coverage }}"
```

## How the CLI is located

In order: the `cli-path` input, a sibling `packages/cli/dist/index.js` (when the
action runs from a checkout of this repository), `node_modules/causeval` in the
workspace or next to the config, and finally `npx causeval@<version>`. If none
resolve, the step fails with a message naming what to install. The action never
imports the library, so it cannot drift from the CLI's behavior: it reads a
machine-readable summary the CLI writes with `--emit-outputs`.

## What it reports

The job summary and PR comment always state when causal verification was
skipped, so a `scan` result is never mistaken for a causal one:

> **Causal verification was skipped** (mode: `scan`). Causal Rule Coverage needs
> `mode: verify`, which executes your evals and costs model calls.

It also states when no eval suite was detected, which makes Trace Coverage 0% by
definition rather than by measurement, and lists each gate failure reason.

## One comment, not many

Comments are matched by the `<!-- causeval-report -->` marker alone, not by the
posting account type, so a token that posts as a user still updates its previous
comment instead of adding a new one each run. Fork pull requests often cannot
receive comments at all; the job summary and the uploaded artifact are
unaffected, and a comment failure is a warning, never a job failure.

## Running it from a checkout of this repository

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with: { node-version: "22" }
- run: pnpm install --frozen-lockfile
- run: pnpm --filter causeval... build
- uses: ./packages/action
  with:
    config: examples/support-agent/causeval.config.ts
    mode: scan
    cli-path: packages/cli/dist/index.js
```

To use CausEval from another repository before a release tag exists, check this
repository out to a subdirectory at a pinned commit, build it, and point at
`./tools/causeval/packages/action`. No remote action tag is claimed to exist
until it has been published.

## Safety

Causal verification should run against mocked, sandboxed or otherwise
non-production tools. Avoid `pull_request_target` with untrusted pull request
code and secrets. The action executes only the CausEval CLI and your own
configured runner command; nothing is discovered or executed from the repository
under analysis.

## Coverage diff on a pull request

The action reports the pull request's own coverage. To lead with what the pull
request _changed_ — new behavioral rules that nothing tests — run `causeval diff`
against the base branch. `diff` reports new uncovered and newly unprotected
rules first, because a new critical rule with no test matters more than a
percentage moving two points.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # diff needs the base branch
- run: npm install -D causeval
- name: Behavioral contract diff
  run: npx causeval diff "origin/${{ github.base_ref }}" HEAD
```

```text
  BEHAVIORAL CONTRACT DIFF
  ────────────────────────────────────────────────────

  2 new high-risk rule(s) introduced without eval coverage:
    [CRITICAL] Never wire funds without a second approver.
    [HIGH] Escalate repeated failed logins to the security team.

  Rules       +2 / -0 (12 unchanged)
  Trace       78% → 74%  -4%
  CRC         not comparable (one side was not verified)
```

Two-ref mode re-extracts the prompt at each commit, which costs a second
extraction and mapping pass; both are cached. To compare stored reports instead,
pass two JSON paths: `causeval diff base-report.json pr-report.json`.
