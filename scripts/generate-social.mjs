// Rasterise the existing brand and typography for crawlers that require PNG.
// No generated usage claims, remote fonts or image-generation service.
import { chromium } from "@playwright/test";
import { readFile, copyFile } from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    "<style>body{margin:0}</style>" +
      (await readFile("apps/web/public/social-preview.svg", "utf8")),
  );
  await page.screenshot({ path: "apps/web/public/social-preview.png" });
  await copyFile(
    "apps/web/public/social-preview.png",
    "docs/images/social-preview.png",
  );
} finally {
  await browser.close();
}
