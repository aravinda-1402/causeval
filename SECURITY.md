# Security policy

## Reporting

Report vulnerabilities privately through GitHub's private vulnerability
reporting once it is enabled on the published repository, or contact the
repository owner privately. Please do not publish secrets or working exploits
before coordinated disclosure.

## Threat model

CausEval is a local developer tool. It reads your prompt and evals, calls the
provider endpoint you configured, and writes files under `.causeval/`.

**Trusted by design** — treat these exactly like a build config:

- `causeval.config.ts` is executed locally.
- A `--runner` command is executed locally, in a shell, with your environment.
  It runs only when you pass the flag: CausEval never discovers or executes
  anything found in a repository under analysis.
- Eval files, including regular expressions, are your own input.

**Untrusted by design** — never allowed to act as instructions:

- Your system prompt and eval text, when sent to a model for analysis.
- Model output, including output sent to the judge.
- Anything rendered into the HTML report, which is escaped.

## In scope

Secret disclosure in reports, caches, logs or error messages. Mutation integrity
(an edit that changes more than its target). HTML injection in the report.
Command or path injection in the CLI or the GitHub Action. Custom-runner
isolation assumptions. Path traversal when writing artifacts. Excessive GitHub
Action permissions.

## Out of scope

The website executes nothing and has no backend, so it has no server-side attack
surface. `CAUSEVAL_DRY_RUN=1` is a cooperative signal to your runner, not an OS
sandbox; a runner that ignores it and touches production is a configuration
mistake, not a tool vulnerability.

## Known limits

Redaction is best effort, not data-loss prevention. Reports and caches can
contain sensitive prompt and output text; review them before sharing. Provider
requests go only to the endpoint you configure. Dependencies should be reviewed
before release. No long-term support line is declared for pre-release v0.1.
