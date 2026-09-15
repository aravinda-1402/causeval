import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { CustomRunner, loadEvalText } from "../packages/core/src/index.js";

const cwd = resolve("examples/tool-agent");
const runner = new CustomRunner("node runner.mjs", 10000, cwd);
let prompt: string;
let evals: ReturnType<typeof loadEvalText>;
const received: string[] = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  received.push(body.messages[0].content);
  const guarded = body.messages[0].content.includes(
    "Never send an email without explicit user confirmation.",
  );
  const confirmed = body.messages[1].content.includes("I explicitly confirm");
  const tool = body.messages[1].content.includes("/etc/passwd")
    ? "read_file"
    : "send_email";
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      choices: [
        {
          message:
            guarded && !confirmed && tool === "send_email"
              ? { content: "Please confirm before I send." }
              : {
                  content: "I am following the policy.",
                  tool_calls: [
                    {
                      function: {
                        name: tool,
                        arguments: JSON.stringify(
                          tool === "read_file"
                            ? { path: "/workspace/../etc/passwd" }
                            : {
                                to: "manager@example.test",
                                body: "I will be late.",
                              },
                        ),
                      },
                    },
                  ],
                },
        },
      ],
    }),
  );
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  vi.stubEnv("CAUSEVAL_BASE_URL", `http://127.0.0.1:${address.port}/v1`);
  vi.stubEnv("CAUSEVAL_MODEL", "test-tool-model");
  vi.stubEnv("OPENAI_API_KEY", "");
  prompt = await readFile(resolve(cwd, "prompts/system.md"), "utf8");
  evals = loadEvalText(
    await readFile(resolve(cwd, "evals/tools.json"), "utf8"),
    "tools.json",
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it("tool example uses the supplied mutant and detects a forbidden action despite reassuring prose", async () => {
  const baseline = await runner.run(prompt, [evals[0]], "baseline");
  const mutant = prompt.replace(
    "Never send an email without explicit user confirmation.",
    "",
  );
  const removed = await runner.run(mutant, [evals[0]], "mutant");
  expect(baseline[0].passed).toBe(true);
  expect(removed[0].passed).toBe(false);
  expect(removed[0].reason).toContain("Forbidden tool");
  expect(received.slice(0, 2)).toEqual([prompt, mutant]);
});
it("tool example permits confirmed email and detects traversal in a proposed file read", async () => {
  expect((await runner.run(prompt, [evals[1]], "confirmed"))[0].passed).toBe(
    true,
  );
  const read = await runner.run(prompt, [evals[2]], "outside");
  expect(read[0].passed).toBe(false);
  expect(read[0].reason).toContain("outside workspace");
});
