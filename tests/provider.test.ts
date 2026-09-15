import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ConfigSchema,
  HTTPProvider,
  CachedProvider,
  NativeRunner,
} from "../packages/core/src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(() => vi.unstubAllGlobals());
describe("provider protocol", () => {
  it("invalidates analysis caches for inputs, provider, model, namespace and relevant settings; no-cache bypasses storage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "causeval-cache-variants-"));
    const generateStructured = vi.fn().mockResolvedValue({ value: 1 });
    const schema = z.object({ value: z.number() });
    const request = { system: "extract", input: "prompt + eval" };
    const base = {
      name: "compatible",
      model: "m1",
      temperature: 0,
      seed: 1,
      generateStructured,
      generateText: vi.fn(),
    };
    try {
      const cached = new CachedProvider(base, dir, "endpoint-a");
      await cached.generateStructured(request, schema);
      await cached.generateStructured(request, schema);
      expect(generateStructured).toHaveBeenCalledTimes(1);
      for (const variant of [
        { ...request, input: "changed prompt + eval" },
        { ...request, input: "prompt + changed eval" },
        { ...request, temperature: 0.2 },
      ])
        await cached.generateStructured(variant, schema);
      for (const variant of [
        { ...base, name: "openai" },
        { ...base, model: "m2" },
        { ...base, seed: 2 },
      ])
        await new CachedProvider(variant, dir, "endpoint-a").generateStructured(
          request,
          schema,
        );
      await new CachedProvider(base, dir, "endpoint-b").generateStructured(
        request,
        schema,
      );
      expect(generateStructured).toHaveBeenCalledTimes(8);
      const uncached = new CachedProvider(base, dir, "endpoint-a", false);
      await uncached.generateStructured(request, schema);
      await uncached.generateStructured(request, schema);
      expect(generateStructured).toHaveBeenCalledTimes(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("sends configured OpenAI-compatible models and validates JSON", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"passed":true}' } }],
        }),
      ),
    );
    vi.stubGlobal("fetch", mock);
    const provider = new HTTPProvider(
      ConfigSchema.parse({
        provider: {
          type: "compatible",
          model: "local-test",
          baseURL: "http://127.0.0.1:11434/v1",
        },
      }).provider,
    );
    expect(
      await provider.generateStructured(
        { system: "judge", input: "x" },
        z.object({ passed: z.boolean() }),
      ),
    ).toEqual({ passed: true });
    expect(mock.mock.calls[0][0]).toContain("/chat/completions");
    expect(JSON.parse(mock.mock.calls[0][1].body).model).toBe("local-test");
  });
  it("uses Anthropic Messages headers and content blocks", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ content: [{ type: "text", text: "hello" }] }),
        ),
      );
    vi.stubGlobal("fetch", mock);
    const provider = new HTTPProvider(
      ConfigSchema.parse({
        provider: {
          type: "anthropic",
          model: "configured-model",
          apiKey: "test-key",
        },
      }).provider,
    );
    expect(
      await provider.generateText({ system: "rules", input: "input" }),
    ).toBe("hello");
    expect(mock.mock.calls[0][0]).toContain("/messages");
    expect(mock.mock.calls[0][1].headers["anthropic-version"]).toBe(
      "2023-06-01",
    );
  });
  it("retries rate limits and surfaces malformed structured output", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ choices: [{ message: { content: "not-json" } }] }),
          ),
      );
    vi.stubGlobal("fetch", mock);
    const provider = new HTTPProvider(
      ConfigSchema.parse({
        provider: { type: "compatible", model: "x", maxRetries: 1 },
      }).provider,
    );
    await expect(
      provider.generateStructured(
        { system: "s", input: "i" },
        z.object({ passed: z.boolean() }),
      ),
    ).rejects.toThrow(/structured response/);
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it("never includes provider response bodies in errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("secret-private-prompt", { status: 401 }),
        ),
    );
    const provider = new HTTPProvider(
      ConfigSchema.parse({ provider: { type: "compatible", model: "x" } })
        .provider,
    );
    await expect(
      provider.generateText({ system: "s", input: "i" }),
    ).rejects.toThrow(/HTTP 401/);
  });
  it("caches analysis but never model execution", async () => {
    const dir = await mkdtemp(join(tmpdir(), "causeval-cache-test-"));
    try {
      const inner = {
        name: "test",
        model: "m",
        generateStructured: vi.fn().mockResolvedValue({ value: 1 }),
        generateText: vi.fn().mockResolvedValue("x"),
      };
      const cached = new CachedProvider(inner, dir, "unit");
      const schema = z.object({ value: z.number() });
      await cached.generateStructured({ system: "s", input: "i" }, schema);
      await cached.generateStructured({ system: "s", input: "i" }, schema);
      await cached.generateText({ system: "s", input: "i" });
      await cached.generateText({ system: "s", input: "i" });
      expect(inner.generateStructured).toHaveBeenCalledTimes(1);
      expect(inner.generateText).toHaveBeenCalledTimes(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("caches judge verdicts per distinct output but never candidate generation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "causeval-judge-test-"));
    try {
      let call = 0;
      const inner = {
        name: "mock",
        model: "mock",
        generateText: vi.fn(async () => `Please confirm. Attempt ${++call}`),
        generateStructured: vi
          .fn()
          .mockResolvedValue({ passed: true, reason: "asks for confirmation" }),
      };
      const cached = new CachedProvider(inner, directory, "run");
      const runner = new NativeRunner(cached, cached.scoped("judge"));
      const evals = [
        {
          id: "confirm",
          input: "send",
          expected: { behavior: "ask for confirmation" },
        },
      ];
      await runner.run("rule", evals);
      await runner.run("rule", evals);
      // Candidate generation always re-runs so real variance is sampled.
      expect(inner.generateText).toHaveBeenCalledTimes(2);
      // Each distinct output is judged once; identical outputs reuse the verdict.
      expect(inner.generateStructured).toHaveBeenCalledTimes(2);
      await runner.run("rule", evals);
      expect(inner.generateStructured).toHaveBeenCalledTimes(3);
      const stable = {
        name: "mock2",
        model: "mock2",
        generateText: vi.fn().mockResolvedValue("Please confirm."),
        generateStructured: vi
          .fn()
          .mockResolvedValue({ passed: true, reason: "ok" }),
      };
      const stableCache = new CachedProvider(stable, directory, "stable");
      const stableRunner = new NativeRunner(
        stableCache,
        stableCache.scoped("judge"),
      );
      await stableRunner.run("rule", evals);
      await stableRunner.run("rule", evals);
      expect(stable.generateText).toHaveBeenCalledTimes(2);
      expect(stable.generateStructured).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps judge and analysis caches in separate namespaces", async () => {
    const directory = await mkdtemp(join(tmpdir(), "causeval-ns-test-"));
    try {
      const inner = {
        name: "mock",
        model: "mock",
        generateStructured: vi.fn().mockResolvedValue({ value: 1 }),
        generateText: vi.fn().mockResolvedValue("x"),
      };
      const analysis = new CachedProvider(inner, directory, "analysis");
      const judge = analysis.scoped("judge");
      const schema = z.object({ value: z.number() });
      const call = { system: "[causeval:judge] same", input: "same" };
      await analysis.generateStructured(call, schema);
      await judge.generateStructured(call, schema);
      expect(inner.generateStructured).toHaveBeenCalledTimes(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("sends temperature 0 for analysis and forwards a configured seed", async () => {
    const mock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
          }),
        ),
    );
    vi.stubGlobal("fetch", mock);
    const provider = new HTTPProvider(
      ConfigSchema.parse({
        provider: { type: "compatible", model: "m", seed: 7, temperature: 0.9 },
      }).provider,
    );
    await provider.generateStructured(
      { system: "[causeval:map] s", input: "i" },
      z.object({ ok: z.boolean() }),
    );
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0);
    expect(body.seed).toBe(7);
    await provider.generateText({ system: "s", input: "i" });
    expect(JSON.parse(mock.mock.calls[1][1].body).temperature).toBe(0.9);
  });
  it("literal assertion failure cannot be overruled by a judge", async () => {
    const provider = {
      name: "mock",
      model: "mock",
      generateText: vi.fn().mockResolvedValue("Sent the email."),
      generateStructured: vi
        .fn()
        .mockResolvedValue({ passed: true, reason: "bad judge" }),
    };
    const result = await new NativeRunner(provider).run("s", [
      {
        id: "a",
        input: "send",
        expected: { behavior: "ask", mustContain: ["confirm"] },
      },
    ]);
    expect(result[0].passed).toBe(false);
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });
});
