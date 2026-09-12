/**
 * Regenerates every committed demo artifact from the bundled fixture so the
 * website, the example project and the README always show the same numbers the
 * engine actually produces. Run with `pnpm demo:generate`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stringify } from "yaml";
import {
  ConfigSchema,
  FixtureProvider,
  FixtureRunner,
  analyze,
  fixturePrompt,
  fixtureEvals,
  suggestEvals,
  serializeReport,
  renderHTML,
  renderMarkdown,
  renderBadge,
} from "../packages/core/src/index.js";

const config = ConfigSchema.parse({
  provider: { type: "fixture" },
  prompt: "./prompts/system.md",
  evals: ["./evals/*.json"],
  thresholds: {
    minimumTraceCoverage: 0.7,
    minimumCausalCoverage: 0.4,
    maximumHighRiskUncovered: 5,
  },
});
const provider = new FixtureProvider();
const report = await analyze({
  prompt: fixturePrompt,
  evals: fixtureEvals,
  provider,
  runner: new FixtureRunner(),
  verify: true,
  config,
  name: "Aura support agent",
  file: "prompts/system.md",
  evalFiles: ["evals/support.json"],
});
report.suggestions = await suggestEvals(report, provider, config);
// Frozen timestamps keep the committed artifacts byte-stable across runs.
report.project.generatedAt = "2026-09-11T00:00:00.000Z";
report.run.startedAt = "2026-09-11T00:00:00.000Z";
for (const suggestion of report.suggestions)
  if (suggestion.eval.causeval)
    suggestion.eval.causeval.generatedAt = "2026-09-11T00:00:00.000Z";

const json = serializeReport(report);
const files: Record<string, string> = {
  "examples/support-agent/prompts/system.md": fixturePrompt + "\n",
  "examples/support-agent/evals/support.json":
    JSON.stringify({ version: 1, evals: fixtureEvals }, null, 2) + "\n",
  "examples/support-agent/.causeval/report.json": json,
  "examples/support-agent/.causeval/report.html": renderHTML(report),
  "examples/support-agent/.causeval/summary.md": renderMarkdown(report),
  "examples/support-agent/.causeval/badge.svg": renderBadge(report),
  "examples/support-agent/.causeval/badge-trace.svg": renderBadge(
    report,
    "trace",
  ),
  "examples/support-agent/.causeval/suggested-evals.yaml":
    "# GENERATED - UNREVIEWED: review with causeval review before counting these as coverage.\n" +
    stringify({ version: 1, evals: report.suggestions.map((s) => s.eval) }),
  "apps/web/public/demo.json": json,
  "apps/web/public/report.html": renderHTML(report),
  "apps/web/lib/demo-data.json": json,
};
for (const [path, content] of Object.entries(files)) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
console.log(JSON.stringify(report.summary, null, 2));
