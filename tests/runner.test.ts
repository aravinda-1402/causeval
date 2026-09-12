import { describe, it, expect } from "vitest";
import { CustomRunner } from "../packages/core/src/index.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

const evals = [{ id: "test", input: "test", expected: { behavior: "pass" } }];
async function withRunner(
  code: string,
  fn: (r: CustomRunner) => Promise<void>,
  timeout = 5000,
) {
  const directory = await mkdtemp(join(tmpdir(), "causeval-runner-test-"));
  try {
    await writeFile(join(directory, "runner.cjs"), code);
    await fn(new CustomRunner("node runner.cjs", timeout, directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const protocolReader =
  "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const r=JSON.parse(s);";

describe("custom runner protocol", () => {
  it("sends an isolated prompt file and signals dry run", async () => {
    await withRunner(
      protocolReader +
        "const p=require('fs').readFileSync(r.promptPath,'utf8');console.log(JSON.stringify({results:r.evalIds.map(id=>({id,passed:process.env.CAUSEVAL_DRY_RUN==='1'&&p==='isolated'}))}));});",
      async (r) => {
        expect((await r.run("isolated", evals, "run1"))[0].passed).toBe(true);
      },
    );
  });
  it("identifies itself by digest, never by the raw command", () => {
    const runner = new CustomRunner("node run.js --key sk-secret-value");
    const described = runner.describe();
    expect(described.kind).toBe("custom");
    expect(described.identity).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(described.identity).not.toContain("sk-secret");
  });
  it("reports unparsable stdout with the protocol it wanted", async () => {
    await withRunner("console.log('bad')", async (r) => {
      await expect(r.run("x", evals, "r")).rejects.toThrow(
        /Invalid custom runner response/,
      );
    });
  });
  it("names the eval IDs that were missing", async () => {
    await withRunner("console.log(JSON.stringify({results:[]}))", async (r) => {
      await expect(r.run("x", evals, "r")).rejects.toThrow(
        /missing results for test/,
      );
    });
  });
  it("names unrequested and duplicated eval IDs", async () => {
    await withRunner(
      "console.log(JSON.stringify({results:[{id:'test',passed:true},{id:'ghost',passed:true}]}))",
      async (r) => {
        await expect(r.run("x", evals, "r")).rejects.toThrow(
          /unrequested results for ghost/,
        );
      },
    );
    await withRunner(
      "console.log(JSON.stringify({results:[{id:'test',passed:true},{id:'test',passed:false}]}))",
      async (r) => {
        await expect(r.run("x", evals, "r")).rejects.toThrow(
          /duplicate results for test/,
        );
      },
    );
  });
  it("explains an empty stdout instead of a parse error", async () => {
    await withRunner("process.exit(0)", async (r) => {
      await expect(r.run("x", evals, "r")).rejects.toThrow(
        /wrote nothing to stdout/,
      );
    });
  });
  it("surfaces a nonzero exit code with a redacted stderr tail", async () => {
    await withRunner(
      "console.error('boom: could not reach the eval service');console.error('api_key=sk-live-abcdefghijklmno');process.exit(3)",
      async (r) => {
        const error = await r.run("x", evals, "r").catch((e) => e as Error);
        expect(error.message).toContain("exited with code 3");
        expect(error.message).toContain("could not reach the eval service");
        expect(error.message).not.toContain("sk-live-abcdefghijklmno");
        expect(error.message).toContain("[REDACTED]");
      },
    );
  });
  it("ignores stderr noise when the protocol output is valid", async () => {
    await withRunner(
      protocolReader +
        "console.error('warning: deprecated flag');console.log(JSON.stringify({results:r.evalIds.map(id=>({id,passed:true}))}));});",
      async (r) => {
        expect((await r.run("x", evals, "r"))[0].passed).toBe(true);
      },
    );
  });
  it("reports a command that cannot start", async () => {
    const runner = new CustomRunner(
      "definitely-not-a-real-binary-xyz",
      3000,
      tmpdir(),
    );
    await expect(runner.run("x", evals, "r")).rejects.toThrow(
      /Could not start custom runner|exited with code/,
    );
  });
  it("terminates a hanging runner and its children", async () => {
    await withRunner(
      "setInterval(()=>{},1000)",
      async (r) => {
        const started = Date.now();
        await expect(r.run("x", evals, "r")).rejects.toThrow(/timed out/);
        expect(Date.now() - started).toBeLessThan(4000);
      },
      300,
    );
  });
  it("redacts environment secrets out of returned outputs", async () => {
    process.env.CAUSEVAL_TEST_API_KEY = "super-secret-runner-value";
    try {
      await withRunner(
        protocolReader +
          "console.log(JSON.stringify({results:r.evalIds.map(id=>({id,passed:true,output:'leaked '+process.env.CAUSEVAL_TEST_API_KEY}))}));});",
        async (r) => {
          const result = await r.run("x", evals, "run");
          expect(result[0].output).not.toContain("super-secret-runner-value");
          expect(result[0].output).toContain("[REDACTED]");
        },
      );
    } finally {
      delete process.env.CAUSEVAL_TEST_API_KEY;
    }
  });
  it("removes the temporary prompt file once the run finishes", async () => {
    await withRunner(
      protocolReader +
        "console.log(JSON.stringify({results:r.evalIds.map(id=>({id,passed:true,output:r.promptPath}))}));});",
      async (r) => {
        const [result] = await r.run("isolated", evals, "run");
        expect(result.output).toContain("causeval-");
        expect(existsSync(result.output!)).toBe(false);
      },
    );
  });
});
