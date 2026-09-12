import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import data from "../../apps/web/lib/demo-data.json" with { type: "json" };

const pseudoRuleId = data.rules.find(
  (rule) =>
    data.causalResults.find((r) => r.ruleId === rule.id)?.classification ===
    "pseudo-covered",
)!.id;
test("capture and inspect responsive product surfaces", async ({
  page,
}, testInfo) => {
  await mkdir("output/playwright", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, name] of [
    ["/", "landing"],
    ["/demo/", "dashboard"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await page.screenshot({
      path: `output/playwright/${name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`/demo/?rule=${pseudoRuleId}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: `output/playwright/evidence-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({
    path: `output/playwright/light-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
