# Custom runner protocol

```bash
causeval verify --runner "node ./scripts/run-evals.js"
```

A custom runner lets CausEval drive your real agent — tools, retrieval,
orchestration and all — instead of calling the model directly. It is the
strongest evidence CausEval can collect, because it exercises the system you
actually ship.

The command runs locally, in the configuration directory, and **only** when you
pass `--runner`. It is never read from the config file, never discovered from the
repository under analysis, and never executed by the website or by CI unless you
wire it up yourself.

## Protocol

The runner receives one JSON object on stdin:

```json
{
  "promptPath": "/tmp/causeval-ab12/prompt.md",
  "evalIds": ["email-confirmation", "refund-approval"],
  "runId": "a1b2c3-baseline-1",
  "dryRun": true
}
```

Read the system prompt from `promptPath`. **Do not reuse your application's own
prompt**: the whole point is that this file is sometimes the mutant. The
temporary file is deleted when the run finishes.

Return only JSON on stdout:

```json
{
  "results": [
    {
      "id": "email-confirmation",
      "passed": false,
      "score": 0,
      "output": "Sent without asking"
    }
  ]
}
```

Exactly one result per requested id, each with a boolean `passed`. `score`
(0 to 1) and `output` are optional. Exit 0 whenever execution completed, even if
assertions failed: a failing assertion is data, a crashed runner is not.

## Failure handling

Every one of these becomes `indeterminate`, never a causal detection, and each
produces a message naming what to fix:

| Situation            | Message                                              |
| -------------------- | ---------------------------------------------------- |
| Nonzero exit code    | `exited with code N`, plus a redacted tail of stderr |
| Empty stdout         | `wrote nothing to stdout`                            |
| Unparsable stdout    | `Invalid custom runner response: <parser error>`     |
| Missing results      | `missing results for <ids>`                          |
| Extra results        | `unrequested results for <ids>`                      |
| Duplicate ids        | `duplicate results for <ids>`                        |
| Output over 5 MB     | `output exceeded 5 MB`                               |
| Timeout              | `timed out after Nms`, plus a redacted stderr tail   |
| Command cannot start | `Could not start custom runner`                      |

Stderr is captured as a bounded, redacted tail rather than being echoed, because
runner stderr commonly contains credentials. Timeouts kill the whole process
tree (`taskkill /T` on Windows, a detached process group elsewhere), so a hung
runner does not leave zombies behind. Default timeout is 30 seconds; configure
`runnerTimeoutMs`.

## Safety

**Run causal verification against mocked, sandboxed or otherwise non-production
tools.** CausEval sets `CAUSEVAL_DRY_RUN=1` in the runner's environment, but that
is cooperative: your runner must honour it. A mutation experiment that issues
real refunds or sends real email is your responsibility, not the tool's.

The runner is identified in the report by `sha256:<16 hex chars>` of the command,
never by the command itself, so a report is safe to share even if the command
embedded a credential.

## Wrapping an existing framework

A runner is a thin adapter, so Promptfoo, DeepEval, pytest or an in-house harness
all work: read the ids and the prompt path, run your suite with that prompt,
print the protocol JSON. The `EvalAdapter` and `EvalRunner` interfaces in
`@causeval/core` are the extension points if you would rather build in-process.
First-class adapters are future work, not a shipped feature.
