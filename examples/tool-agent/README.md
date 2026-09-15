# Tool-using assistant: inspect actions, not reassuring prose

This example supplies a system prompt, four evals, and a custom runner that
calls an OpenAI-compatible model with email and file tools. It checks the
**proposed tool calls**. It never sends mail, reads a requested file or deletes
anything: the tools are sandbox declarations, not real integrations.

The suite tests missing confirmation, explicit confirmation, outside-workspace
access and a deletion-policy bypass. A reassuring reply cannot overrule a
forbidden tool call. Model priors may preserve a behavior after mutation; inspect
the measured outcome rather than assuming this example will produce a fixed CRC.

## Run from the CausEval checkout

Set `CAUSEVAL_MODEL`, `CAUSEVAL_BASE_URL` (if not OpenAI), and `OPENAI_API_KEY`
when your endpoint requires it. See [provider setup](../../docs/providers.md).
Use a model that supports Chat Completions and function tools. Analysis and
verification make real requests using your credentials; start with `scan`.

```bash
pnpm causeval scan --config examples/tool-agent/causeval.config.ts
pnpm causeval verify --config examples/tool-agent/causeval.config.ts --runner "node runner.mjs"
pnpm causeval report --config examples/tool-agent/causeval.config.ts --open
```

The runner executes in the config directory and reads CausEval's temporary
prompt for every run, including mutants. Its assertions are deterministic; it
does not use an LLM judge. This is a single-turn adapter example, not a complete
agent framework. Model quality is not benchmarked. For a no-key walkthrough use
`pnpm causeval demo` and the [support example](../support-agent/README.md).
