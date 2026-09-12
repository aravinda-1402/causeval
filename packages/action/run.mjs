/**
 * Composite-action entry point. It shells out to the CausEval CLI and reads a
 * machine-readable summary the CLI writes, so the action never has to import
 * the library and works both inside this repository and from a published
 * package. It posts a pull request comment only when explicitly asked to.
 */
import { spawnSync } from "node:child_process";
import { readFile, appendFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const actionDirectory = dirname(fileURLToPath(import.meta.url));
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const configPath = resolve(
  workspace,
  process.env.CAUSEVAL_ACTION_CONFIG || "causeval.config.ts",
);
const mode = process.env.CAUSEVAL_ACTION_MODE || "scan";
const failOn = process.env.CAUSEVAL_ACTION_FAIL_ON || "threshold";
if (!["scan", "verify"].includes(mode))
  throw new Error(`Invalid action mode "${mode}". Use scan or verify.`);
if (!["threshold", "never"].includes(failOn))
  throw new Error(`Invalid fail-on "${failOn}". Use threshold or never.`);
if (!existsSync(configPath))
  throw new Error(
    `No CausEval config at ${configPath}. Set the "config" input to the path inside your repository.`,
  );

/** Prefers an already-present CLI; falls back to the published package. */
function resolveCli() {
  const candidates = [
    process.env.CAUSEVAL_ACTION_CLI &&
      resolve(workspace, process.env.CAUSEVAL_ACTION_CLI),
    resolve(actionDirectory, "../cli/dist/index.js"),
    resolve(workspace, "node_modules/causeval/dist/index.js"),
    resolve(dirname(configPath), "node_modules/causeval/dist/index.js"),
  ].filter(Boolean);
  for (const candidate of candidates)
    if (existsSync(candidate))
      return {
        command: process.execPath,
        base: [candidate],
        source: candidate,
      };
  const version = process.env.CAUSEVAL_ACTION_VERSION || "latest";
  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    base: ["--yes", `causeval@${version}`],
    source: `npm causeval@${version}`,
  };
}
const cli = resolveCli();
const outputsPath = join(
  await mkdtemp(join(tmpdir(), "causeval-action-")),
  "outputs.json",
);
const result = spawnSync(
  cli.command,
  [
    ...cli.base,
    mode,
    "--config",
    configPath,
    "--fail-on",
    failOn,
    "--emit-outputs",
    outputsPath,
  ],
  { stdio: "inherit", env: process.env, cwd: workspace },
);
if (result.error)
  throw new Error(
    `Could not start the CausEval CLI (${cli.source}). Install causeval in the workspace, or set the cli-path input.`,
  );
if (!existsSync(outputsPath))
  throw new Error(
    `CausEval did not produce a report (exit code ${result.status}). The CLI output above explains why.`,
  );
const outputs = JSON.parse(await readFile(outputsPath, "utf8"));

const notes = [];
if (!outputs.evalSuiteDetected)
  notes.push(
    "**No eval suite detected.** Trace Coverage is 0% because there was nothing to map. Run `causeval generate` locally to draft a starter suite.",
  );
if (!outputs.verified)
  notes.push(
    "**Causal verification was skipped** (mode: `scan`). Causal Rule Coverage needs `mode: verify`, which executes your evals and costs model calls.",
  );
if (outputs.gateFailed)
  notes.push(
    "**Coverage gate failed:**\n" +
      outputs.gateReasons.map((r) => `- ${r}`).join("\n"),
  );
const summary =
  outputs.markdown +
  "\n" +
  (notes.length ? notes.join("\n\n") + "\n" : "") +
  (failOn === "never"
    ? "\nThresholds were not enforced for this run (`fail-on: never`).\n"
    : outputs.gateFailed
      ? ""
      : "\nCoverage gate passed.\n");

const values = {
  "trace-coverage": outputs.traceCoverage,
  "causal-coverage": outputs.causalCoverage ?? "not-verified",
  verified: outputs.verified,
  "eval-suite-detected": outputs.evalSuiteDetected,
  "uncovered-count": outputs.uncovered,
  "pseudo-covered-count": outputs.pseudoCovered,
  "high-risk-uncovered-count": outputs.highRiskUnprotected,
  "gate-failed": outputs.gateFailed,
  "report-path": outputs.paths.reportJson,
  "report-directory": outputs.paths.directory,
  "report-html-path": outputs.paths.reportHtml,
  "badge-path": outputs.paths.badge,
  "summary-path": outputs.paths.summaryMarkdown,
};
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, "")}`)
      .join("\n") + "\n",
  );
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);

const MARKER = "<!-- causeval-report -->";
if (
  process.env.CAUSEVAL_ACTION_COMMENT === "true" &&
  process.env.GITHUB_EVENT_PATH &&
  existsSync(process.env.GITHUB_EVENT_PATH)
) {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  if (event.pull_request) {
    try {
      const token = process.env.CAUSEVAL_ACTION_TOKEN;
      if (!token) throw new Error("no token supplied");
      const base = process.env.GITHUB_API_URL || "https://api.github.com";
      const repository = process.env.GITHUB_REPOSITORY;
      const request = async (path, method = "GET", body) => {
        const response = await fetch(base + path, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/vnd.github+json",
            "content-type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
        return response.json();
      };
      // Match on the marker alone: a PAT posts as a User, not a Bot, and
      // matching on account type would create a second comment every run.
      let existing;
      for (let page = 1; page <= 10 && !existing; page++) {
        const comments = await request(
          `/repos/${repository}/issues/${event.pull_request.number}/comments?per_page=100&page=${page}`,
        );
        existing = comments.find((c) => c.body?.includes(MARKER));
        if (comments.length < 100) break;
      }
      await (existing
        ? request(
            `/repos/${repository}/issues/comments/${existing.id}`,
            "PATCH",
            { body: summary },
          )
        : request(
            `/repos/${repository}/issues/${event.pull_request.number}/comments`,
            "POST",
            { body: summary },
          ));
    } catch (error) {
      console.warn(
        `CausEval could not update the pull request comment (${error.message}). Grant "pull-requests: write", or drop the comment input. The job summary and the uploaded artifact are unaffected.`,
      );
    }
  }
}
process.exitCode = result.status ?? 2;
