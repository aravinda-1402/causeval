import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let root: string;
const cli = resolve("packages/cli/src/index.ts");
const run = (...args: string[]) =>
  execFileSync(process.execPath, ["--import", "tsx", cli, ...args], {
    encoding: "utf8",
    timeout: 120000,
  });
const readJson = async (path: string) =>
  JSON.parse(await readFile(path, "utf8"));
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "causeval-cli-"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("user B and C: an existing eval suite, then causal verification", () => {
  it("initialises, scans, verifies and publishes inspectable artifacts", async () => {
    const directory = join(root, "userBC");
    expect(run("init", "--dir", directory)).toContain("CausEval initialised");
    const config = join(directory, "causeval.config.ts");
    const scan = run("scan", "--config", config, "--no-cache");
    expect(scan).toContain("Trace Coverage");
    expect(scan).toContain("75%");
    expect(scan).toContain("Causal verification did not run");
    const scanned = await readJson(join(directory, ".causeval/report.json"));
    expect(scanned.summary.causalCoverage).toBeNull();
    expect(scanned.warnings).toEqual([]);
    expect(scan).not.toContain("Warning:");
    expect(
      await readFile(join(directory, ".causeval/.gitignore"), "utf8"),
    ).toContain("*\n!.gitignore");
    expect(scanned.summary.maturity).toBe("prompt-and-evals");

    const verify = run(
      "verify",
      "--config",
      config,
      "--strict",
      "--suggest",
      "--emit-outputs",
      join(directory, "outputs.json"),
    );
    expect(verify).toContain("42%");
    expect(verify).toContain("Baseline pass rate: 100%");
    const report = await readJson(join(directory, ".causeval/report.json"));
    expect(report.schemaVersion).toBe("1.1");
    expect(report.summary.pseudoCovered).toBe(4);
    expect(report.summary.causallyCovered).toBe(5);
    expect(report.run.runner.kind).toBe("fixture");
    expect(report.suggestions.length).toBeGreaterThan(0);
    const html = await readFile(
      join(directory, ".causeval/report.html"),
      "utf8",
    );
    expect(html).toContain("Where this rule came from");
    expect(html).toContain("Run metadata and reproduction");

    const outputs = await readJson(join(directory, "outputs.json"));
    expect(outputs.verified).toBe(true);
    expect(outputs.pseudoCovered).toBe(4);
    expect(outputs.markdown).toContain("<!-- causeval-report -->");
    expect(existsSync(outputs.paths.reportHtml)).toBe(true);

    expect(run("report", "--config", config)).toContain("report.html");
    expect(run("badge", "--config", config)).toContain("badge.svg");
    expect(
      await readFile(join(directory, ".causeval/badge.svg"), "utf8"),
    ).toContain("CRC 42%");
    run("badge", "--config", config, "--metric", "trace");
    expect(
      await readFile(join(directory, ".causeval/badge-trace.svg"), "utf8"),
    ).toContain("Trace 75%");

    const reportPath = join(directory, ".causeval/report.json");
    expect(run("diff", reportPath, reportPath)).toContain(
      "No new uncovered or unprotected behaviors",
    );
    expect(() => run("init", "--dir", directory)).toThrow();
  }, 180000);
});

describe("user A: a system prompt with no eval suite", () => {
  it("scans, generates, reviews and only then counts coverage", async () => {
    const directory = join(root, "userA");
    run("init", "--dir", directory, "--prompt-only");
    const config = join(directory, "causeval.config.ts");
    const scan = run("scan", "--config", config, "--no-cache");
    expect(scan).toContain("No eval suite detected");
    expect(scan).toContain("CausEval extracted 12 behavioral rules");
    expect(scan).toContain("Critical  3");
    expect(scan).toContain("causeval generate");
    // The metrics banner is replaced by the no-eval guidance, and the
    // warning still explains why Trace Coverage would be 0%.
    expect(scan).not.toContain("CAUSEVAL  /");
    expect(scan).toContain(
      "Trace Coverage is 0% because there is nothing to map",
    );

    expect(() => run("verify", "--config", config, "--no-cache")).toThrow();

    const generated = run("generate", "--config", config, "--no-cache");
    expect(generated).toContain("GENERATED - UNREVIEWED");
    expect(generated).toContain("normal path");
    expect(generated).toContain("negative path");
    expect(generated).toContain("adversarial");
    expect(generated).toContain("boundary");
    const staging = join(directory, ".causeval/generated-evals.yaml");
    expect(await readFile(staging, "utf8")).toContain(
      "# GENERATED - UNREVIEWED",
    );

    const listed = run("review", "--config", config, "--list");
    expect(listed).toContain("[UNREVIEWED]");
    expect(listed).toContain("Only accepted cases count as coverage");
    expect(() =>
      run("review", "--config", config, "--accept", "not-a-real-id"),
    ).toThrow();

    const accepted = run(
      "review",
      "--config",
      config,
      "--accept",
      "r01-negativepath,r02-negativepath,r05-boundary",
    );
    expect(accepted).toContain("Accepted 3");
    const afterAccept = run("scan", "--config", config, "--no-cache");
    expect(afterAccept).toContain("Trace Coverage");
    expect(afterAccept).toContain("25%");

    run("review", "--config", config, "--accept", "all");
    expect(() => run("verify", "--config", config)).toThrow(
      /Generated or custom evals need a real provider/,
    );

    run("review", "--config", config, "--reject", "all");
    const afterReject = run("scan", "--config", config, "--no-cache");
    expect(afterReject).toContain("No eval suite detected");
  }, 180000);
});
describe("zero-config demo", () => {
  it("shows one causally covered, one pseudo-covered and one uncovered rule", async () => {
    const directory = join(root, "demo");
    const output = run("demo", "--dir", directory);
    expect(output).toContain("CAUSALLY COVERED");
    expect(output).toContain("PSEUDO-COVERED");
    expect(output).toContain("UNCOVERED");
    expect(output).toContain("DETECTION EFFECT");
    expect(output).toContain("did not detect removal");
    expect(output).toContain("deterministic fixture");
    expect(existsSync(join(directory, ".causeval/report.html"))).toBe(true);
    expect(existsSync(join(directory, "prompts/system.md"))).toBe(true);
  }, 180000);
});
describe("actionable failures", () => {
  it("explains a missing config, a missing prompt and a bad flag", async () => {
    expect(() => run("scan", "--config", join(root, "nope.ts"))).toThrow(
      /causeval init/,
    );
    const directory = join(root, "broken");
    run("init", "--dir", directory);
    await writeFile(
      join(directory, "causeval.config.ts"),
      "export default { prompt: './missing.md', evals: ['./evals/**/*.yaml'], provider: { type: 'fixture' } };\n",
    );
    expect(() =>
      run("scan", "--config", join(directory, "causeval.config.ts")),
    ).toThrow(/System prompt not found/);
    expect(() =>
      run(
        "verify",
        "--config",
        join(root, "userBC/causeval.config.ts"),
        "--runs",
        "1",
      ),
    ).toThrow();
  }, 180000);
  it("fails the gate with the measured numbers and exit code 1", async () => {
    const directory = join(root, "gate");
    run("init", "--dir", directory);
    await writeFile(
      join(directory, "causeval.config.ts"),
      "export default { prompt: './prompts/system.md', evals: ['./evals/**/*.yaml'], provider: { type: 'fixture' }, thresholds: { minimumTraceCoverage: 0.95 } };\n",
    );
    try {
      run(
        "scan",
        "--config",
        join(directory, "causeval.config.ts"),
        "--fail-on",
        "threshold",
      );
      throw new Error("expected a gate failure");
    } catch (error) {
      const e = error as { status?: number; stderr?: string };
      expect(e.status).toBe(1);
      expect(e.stderr).toContain(
        "Trace Coverage 75% is below the 95% threshold",
      );
    }
  }, 180000);
  it("warns when the fixture provider is left pointed at a real prompt", async () => {
    const directory = join(root, "fixture-trap");
    run("init", "--dir", directory, "--prompt-only");
    await writeFile(
      join(directory, "prompts/system.md"),
      "You are my assistant.\nNever wire funds without a second approver.\n",
    );
    const output = run(
      "scan",
      "--config",
      join(directory, "causeval.config.ts"),
      "--no-cache",
    );
    expect(output).toContain("only recognises the example prompt");
    expect(output).toContain("Set provider.type");
    const reportPath = join(directory, ".causeval/report.json");
    expect(run("diff", reportPath, reportPath)).toContain(
      "results are incomplete",
    );
  }, 180000);
});
