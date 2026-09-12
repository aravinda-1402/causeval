import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { resolve: ["@causeval/core"] },
  clean: true,
  noExternal: ["@causeval/core"],
});
