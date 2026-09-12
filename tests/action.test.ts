import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

const action = resolve("packages/action/run.mjs");
const builtCli = resolve("packages/cli/dist/index.js");
let workdir: string;
let example: string;
const runAction = (env: Record<string, string>) => {
  const id = Math.random().toString(36).slice(2);
  const outputs = join(workdir, `outputs-${id}.txt`);
  const summary = join(workdir, `summary-${id}.md`);
  const result = spawnSync(process.execPath, [action], {
    encoding: "utf8",
    timeout: 180000,
    env: {
      ...process.env,
      GITHUB_WORKSPACE: workdir,
      GITHUB_OUTPUT: outputs,
      GITHUB_STEP_SUMMARY: summary,
      CAUSEVAL_ACTION_COMMENT: "false",
      CAUSEVAL_ACTION_CLI: builtCli,
      ...env,
    },
  });
  return { result, outputs, summary };
};
const parseOutputs = async (path: string) =>
  Object.fromEntries(
    (await readFile(path, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
beforeAll(async () => {
  if (!existsSync(builtCli))
    throw new Error(
      "packages/cli/dist/index.js is missing. Run pnpm build before the action tests.",
    );
  // The action is exercised against a copy so committed example artifacts
  // never change as a side effect of running the tests.
  workdir = await mkdtemp(join(tmpdir(), "causeval-action-test-"));
  example = join(workdir, "project");
  await mkdir(example, { recursive: true });
  await cp("examples/support-agent/prompts", join(example, "prompts"), {
    recursive: true,
  });
  await cp("examples/support-agent/evals", join(example, "evals"), {
    recursive: true,
  });
  await cp(
    "examples/support-agent/causeval.config.ts",
    join(example, "causeval.config.ts"),
  );
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("GitHub Action", () => {
  it("runs the default cheap scan and says verification was skipped", async () => {
    const { result, outputs, summary } = runAction({
      CAUSEVAL_ACTION_CONFIG: join(example, "causeval.config.ts"),
      CAUSEVAL_ACTION_MODE: "scan",
      CAUSEVAL_ACTION_FAIL_ON: "threshold",
    });
    expect(result.status).toBe(0);
    const values = await parseOutputs(outputs);
    expect(values["trace-coverage"]).toBe("0.75");
    expect(values["causal-coverage"]).toBe("not-verified");
    expect(values.verified).toBe("false");
    expect(values["gate-failed"]).toBe("false");
    expect(values["report-path"]).toContain("report.json");
    const text = await readFile(summary, "utf8");
    expect(text).toContain("<!-- causeval-report -->");
    expect(text).toContain("Causal verification was skipped");
  }, 180000);
  it("exposes causal outputs when verification is explicitly requested", async () => {
    const { result, outputs, summary } = runAction({
      CAUSEVAL_ACTION_CONFIG: join(example, "causeval.config.ts"),
      CAUSEVAL_ACTION_MODE: "verify",
      CAUSEVAL_ACTION_FAIL_ON: "threshold",
    });
    expect(result.status).toBe(0);
    const values = await parseOutputs(outputs);
    expect(Number(values["causal-coverage"])).toBeCloseTo(5 / 12, 6);
    expect(values.verified).toBe("true");
    expect(values["pseudo-covered-count"]).toBe("4");
    expect(values["high-risk-uncovered-count"]).toBe("5");
    expect(await readFile(summary, "utf8")).not.toContain(
      "Causal verification was skipped",
    );
  }, 180000);
  it("fails the job and explains the gate when a threshold is not met", async () => {
    const directory = join(workdir, "strict");
    await mkdir(directory, { recursive: true });
    await cp(join(example, "prompts"), join(directory, "prompts"), {
      recursive: true,
    });
    await cp(join(example, "evals"), join(directory, "evals"), {
      recursive: true,
    });
    await writeFile(
      join(directory, "causeval.config.ts"),
      "export default { prompt: './prompts/system.md', evals: ['./evals/*.json'], provider: { type: 'fixture' }, thresholds: { minimumTraceCoverage: 0.99 } };\n",
    );
    const { result, outputs, summary } = runAction({
      CAUSEVAL_ACTION_CONFIG: join(directory, "causeval.config.ts"),
      CAUSEVAL_ACTION_MODE: "scan",
      CAUSEVAL_ACTION_FAIL_ON: "threshold",
    });
    expect(result.status).toBe(1);
    expect((await parseOutputs(outputs))["gate-failed"]).toBe("true");
    expect(await readFile(summary, "utf8")).toContain("Coverage gate failed");
  }, 180000);
  it("rejects an unknown mode, policy or missing config before running anything", () => {
    const config = join(example, "causeval.config.ts");
    for (const env of [
      { CAUSEVAL_ACTION_MODE: "destroy", CAUSEVAL_ACTION_CONFIG: config },
      { CAUSEVAL_ACTION_FAIL_ON: "always", CAUSEVAL_ACTION_CONFIG: config },
      { CAUSEVAL_ACTION_CONFIG: "does/not/exist.ts" },
    ]) {
      const { result } = runAction(env as Record<string, string>);
      expect(result.status).not.toBe(0);
    }
  }, 180000);
});
