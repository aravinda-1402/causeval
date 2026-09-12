/**
 * Packs the CLI, installs it into a clean project outside the workspace and
 * drives every user journey against the installed binary. This is the check
 * that catches packaging mistakes the monorepo hides.
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const directory = resolve("output/package-smoke-" + Date.now());
await mkdir(directory, { recursive: true });
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this with: pnpm release:check");

function pnpmRun(args, cwd = directory) {
  const result = spawnSync(process.execPath, [pnpm, ...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0)
    throw new Error(
      `pnpm ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  return result.stdout;
}
function causeval(args, { expectFailure = false } = {}) {
  const result = spawnSync(
    process.execPath,
    [pnpm, "exec", "causeval", ...args],
    {
      cwd: directory,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (expectFailure ? result.status === 0 : result.status !== 0)
    throw new Error(
      `causeval ${args.join(" ")} unexpectedly ${expectFailure ? "succeeded" : "failed"}:\n${result.stdout}\n${result.stderr}`,
    );
  return result.stdout + result.stderr;
}
function check(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. Release placeholders must be gone.
const placeholders = [];
for (const file of [
  "packages/cli/package.json",
  "packages/core/package.json",
  "CITATION.cff",
  ".github/ISSUE_TEMPLATE/config.yml",
  "packages/cli/README.md",
  "README.md",
  "docs/github-action.md",
]) {
  const text = await readFile(join(root, file), "utf8");
  if (/\bOWNER\b|REPLACE-BEFORE-RELEASE/.test(text)) placeholders.push(file);
}

// 2. Pack and install into a clean project with no workspace linkage.
pnpmRun(
  ["--filter", "causeval", "pack", "--pack-destination", directory],
  root,
);
const archive = (await readdir(directory)).find((p) => p.endsWith(".tgz"));
check(archive, "Package archive missing.");
await writeFile(
  join(directory, "package.json"),
  JSON.stringify({ name: "causeval-smoke", private: true, type: "module" }),
);
pnpmRun(["add", "./" + archive, "--ignore-workspace"]);

// 3. Journey A: a prompt with no eval suite.
causeval(["init", "--dir", "prompt-only", "--prompt-only"]);
const promptOnlyConfig = [
  "--config",
  join(directory, "prompt-only/causeval.config.ts"),
];
const scanEmpty = causeval(["scan", ...promptOnlyConfig]);
check(
  scanEmpty.includes("No eval suite detected") &&
    scanEmpty.includes("causeval generate"),
  "Installed CLI did not offer the no-eval workflow.",
);
causeval(["verify", ...promptOnlyConfig], { expectFailure: true });
const generated = causeval(["generate", ...promptOnlyConfig]);
check(
  generated.includes("GENERATED - UNREVIEWED"),
  "Installed CLI did not mark generated cases as unreviewed.",
);
check(
  causeval(["review", ...promptOnlyConfig, "--list"]).includes("[UNREVIEWED]"),
  "Installed CLI could not list generated candidates.",
);
causeval(["review", ...promptOnlyConfig, "--accept", "r05-boundary"]);
check(
  causeval(["scan", ...promptOnlyConfig]).includes("Trace Coverage"),
  "Accepted generated case did not become coverage.",
);

// 4. Journey B and C: init, scan, verify against the bundled example.
causeval(["init"]);
causeval(["scan"]);
causeval(["verify", "--strict", "--suggest", "--emit-outputs", "outputs.json"]);
const report = JSON.parse(
  await readFile(join(directory, ".causeval/report.json"), "utf8"),
);
check(report.schemaVersion === "1.1", "Unexpected report schema version.");
check(
  report.summary.pseudoCovered === 4 && report.summary.causallyCovered === 5,
  "Installed CLI returned unexpected coverage.",
);
check(
  Math.abs(report.summary.causalCoverage - 5 / 12) < 1e-9,
  "Installed CLI returned unexpected CRC.",
);
check(
  !JSON.stringify(report).includes("OPENAI_API_KEY="),
  "Report contained an environment secret.",
);
const outputs = JSON.parse(
  await readFile(join(directory, "outputs.json"), "utf8"),
);
check(outputs.verified === true, "--emit-outputs did not record verification.");
check(
  existsSync(outputs.paths.reportHtml) && existsSync(outputs.paths.badge),
  "--emit-outputs pointed at missing artifacts.",
);
causeval(["report"]);
causeval(["badge", "--metric", "trace"]);
causeval(["demo", "--dir", "demo-check", "--quiet"]);
check(
  existsSync(join(directory, "demo-check/.causeval/report.html")),
  "causeval demo did not produce a report.",
);

// 5. The published type declarations must compile with no workspace packages.
await writeFile(
  join(directory, "config-check.ts"),
  "import { defineConfig } from 'causeval';\nexport default defineConfig({ provider: { type: 'fixture' } });\n",
);
const typecheck = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--moduleResolution",
    "bundler",
    "--module",
    "esnext",
    "--target",
    "es2022",
    join(directory, "config-check.ts"),
  ],
  { cwd: root, encoding: "utf8" },
);
check(
  typecheck.status === 0,
  "Installed declarations failed to typecheck:\n" +
    typecheck.stdout +
    typecheck.stderr,
);

// 6. The GitHub Action must work against the installed package.
const outputPath = join(directory, "action-outputs.txt");
const action = spawnSync(
  process.execPath,
  [resolve("packages/action/run.mjs")],
  {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_WORKSPACE: directory,
      CAUSEVAL_ACTION_CONFIG: "causeval.config.ts",
      CAUSEVAL_ACTION_MODE: "verify",
      CAUSEVAL_ACTION_FAIL_ON: "never",
      CAUSEVAL_ACTION_COMMENT: "false",
      CAUSEVAL_ACTION_CLI: "node_modules/causeval/dist/index.js",
      GITHUB_OUTPUT: outputPath,
      GITHUB_STEP_SUMMARY: join(directory, "action-summary.md"),
    },
  },
);
check(
  action.status === 0,
  "Action smoke test failed:\n" + action.stdout + action.stderr,
);
check(
  (await readFile(outputPath, "utf8")).includes("verified=true"),
  "Action outputs were incorrect.",
);

console.log(
  `\nPacked package, declarations, all four user journeys and the GitHub Action passed.\n${directory}\n`,
);
if (placeholders.length)
  throw new Error(
    `Release placeholders still present in: ${placeholders.join(", ")}. Replace OWNER and the CITATION.cff author before publishing.`,
  );
