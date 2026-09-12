import { mkdir, copyFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
const directory = resolve("output/clean-install-" + Date.now());
const files = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "packages/core/package.json",
  "packages/cli/package.json",
  "apps/web/package.json",
];
for (const file of files) {
  const dest = resolve(directory, file);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(file, dest);
}
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run using pnpm clean:install.");
await access(pnpm);
const result = spawnSync(
  process.execPath,
  [pnpm, "install", "--frozen-lockfile"],
  { cwd: directory, stdio: "inherit", env: process.env },
);
if (result.status !== 0)
  throw new Error("Clean dependency installation failed.");
console.log("Clean installation passed: " + directory);
