import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@causeval/core": new URL(
        "./packages/core/src/index.ts",
        import.meta.url,
      ).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"),
    },
  },
});
