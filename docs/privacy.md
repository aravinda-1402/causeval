# Privacy

## What leaves your machine

Exactly three things, and only to the provider endpoint you configured:

| Stage      | Sent                                                                                                                                           | When                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Extraction | Your system prompt, line-numbered, in chunks                                                                                                   | `scan`, `verify`, `generate`                        |
| Mapping    | The extracted rules, plus the candidate evals for each rule (id, description, input or messages, expected behavior, declared assertions, tags) | `scan`, `verify`, `generate` when evals exist       |
| Redundancy | The extracted rules only: id, type, condition, expected behavior, tags                                                                         | `scan`, `verify` unless `redundancy.enabled: false` |
| Generation | The targeted rules and their missing dimensions, plus up to 20 existing evals for style context                                                | `generate`, or `--suggest`                          |
| Execution  | The prompt (baseline or mutant) and each eval input, then the model output to the judge                                                        | `verify` only                                       |

Nothing else. Your repository source, git history, file tree, environment and
config file are never uploaded. There is no CausEval server: the CLI talks only
to the provider `baseURL` you set.

If data must stay local, use `provider.type: "ollama"` or `compatible` with a
local endpoint. The same workflow applies; model compatibility and analysis
quality still need validation against your endpoint.

## Telemetry

There is none. No analytics, no crash reporting, no version check, no
phone-home. The workspace build and dev scripts additionally set
`NEXT_TELEMETRY_DISABLED`, `TURBO_TELEMETRY_DISABLED` and `DO_NOT_TRACK` so the
upstream build tools stay quiet too.

The website is a static export. It has no database, no accounts, no uploads, no
server-side execution, and stores only a theme preference in the browser.

## Secrets

- API keys are read from the environment or config and are never written to a
  report, a cache file or a log line.
- Report serialization replaces the value of any key-like field
  (`apiKey`, `token`, `secret`, `password` and suffixed variants) with
  `[REDACTED]`, and redacts known key patterns from every string.
- Cache keys are SHA-256 hashes of the request content. A key is never part of a
  cache key, in plaintext or otherwise, because keys are not part of the request
  body.
- Custom runner stderr is captured only as a bounded, redacted tail for
  diagnostics, and the runner is identified in the report by a digest of its
  command, never the command itself.
- CLI errors are redacted before printing, using both the known patterns and the
  values of key-like environment variables.

Treat redaction as best effort, not as data-loss prevention.

## Things that can contain private data

- `.causeval/report.json` and `report.html` contain your prompt text, eval
  inputs and model outputs.
- `.causeval/cache/` contains raw analysis responses. New `causeval init`
  projects include `.causeval/.gitignore` to exclude artifacts in that directory;
  existing ignore files are preserved. For projects created by older versions,
  add `.causeval/` to your project's `.gitignore`. Check custom output paths too;
  cache files are written with restrictive permissions where the platform
  supports them.
- `.causeval/generated-evals.yaml` contains model-drafted inputs derived from
  your prompt.

Review these before committing or sharing them.

## Execution safety

Causal verification should run against mocked, sandboxed or otherwise
non-production tools. Custom runners receive `CAUSEVAL_DRY_RUN=1`, but that is a
cooperative signal your runner must honour, not an OS sandbox. CausEval never
discovers or executes commands found in a repository; a custom runner only ever
runs when you pass `--runner` yourself.
