// Keep optional build-tool telemetry disabled in every package-manager invocation.
import { spawn } from "node:child_process";
const [task, ...args] = process.argv.slice(2);
const allowed = {
  build: ["turbo/bin/turbo", "run", "build"],
  typecheck: ["turbo/bin/turbo", "run", "typecheck"],
  dev: [
    "next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
};
if (!allowed[task]) throw new Error("Unknown task");
const [binary, ...base] = allowed[task];
const { createRequire } = await import("node:module");
const require = createRequire(
  task === "dev"
    ? new URL("../apps/web/package.json", import.meta.url)
    : import.meta.url,
);
const child = spawn(
  process.execPath,
  [require.resolve(binary), ...base, ...args],
  {
    cwd:
      task === "dev" ? new URL("../apps/web", import.meta.url) : process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      TURBO_TELEMETRY_DISABLED: "1",
      DO_NOT_TRACK: "1",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
