import { fileURLToPath } from "node:url";
// Project-site hosting (GitHub Pages) serves under /<repo>. Empty by default so
// local dev and scripts/serve-static.mjs keep working at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export default {
  output: "export",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};
