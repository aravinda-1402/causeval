import { fileURLToPath } from "node:url";
export default {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};
