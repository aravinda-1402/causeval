import { test, expect } from "@playwright/test";
import data from "../../apps/web/lib/demo-data.json" with { type: "json" };

const summary = data.summary;
const pseudoRule = data.rules.find(
  (rule) =>
    data.causalResults.find((r) => r.ruleId === rule.id)?.classification ===
    "pseudo-covered",
)!;
const criticalRules = data.rules.filter(
  (r) => r.severity === "critical",
).length;
const percent = (n: number) => Math.round(n * 100) + "%";

test("landing communicates the coverage gap and opens the demo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Code has coverage.",
  );
  await expect(
    page.locator('a[href="https://github.com/aravinda-1402/causeval"]').first(),
  ).toHaveText(/GitHub/);
  await expect(page.locator(".start-code")).toContainText(
    "npm publication is pending",
  );
  await expect(page.locator(".start-code")).not.toContainText("npx causeval");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /social-preview\.png$/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  // The hook is the contrast: everything passes, coverage is still partial.
  const terminal = page.locator(".terminal-content");
  await expect(terminal).toContainText("Eval pass rate (mapped)");
  await expect(terminal).toContainText(
    String(Math.round(summary.baselinePassRate! * 100)),
  );
  await expect(terminal).toContainText("Trace Coverage");
  await expect(terminal).toContainText(
    String(Math.round(summary.traceCoverage * 100)),
  );
  await expect(terminal).toContainText("Causal Rule Coverage");
  await expect(terminal).toContainText(
    String(Math.round(summary.causalCoverage! * 100)),
  );
  await page.getByRole("link", { name: "Explore the live demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Coverage overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("matrix, drawer, evidence and generated cases work", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.locator("tbody tr")).toHaveCount(summary.totalRules);
  await page.getByLabel("Search behavioral rules").fill("email");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: new RegExp(pseudoRule.id + " Never send") })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("The instruction is gone. The eval still passes."),
  ).toBeVisible();
  // The exact wording matters: this is a statement about the experiment.
  await expect(page.getByRole("dialog")).toContainText(
    "did not detect removal",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "WHAT THIS CANNOT RULE OUT",
  );
  await expect(page.locator(".passes .pass-chip")).toHaveCount(6);
  await page.getByRole("tab", { name: /Suggested evals/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "GENERATED — UNREVIEWED",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Explain Causal Rule Coverage" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    `${summary.causallyCovered} / ${summary.totalRules} = ${percent(summary.causalCoverage!)}`,
  );
  await page.keyboard.press("Escape");
});
test("filtering, empty states, and responsive layout", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Severity", { exact: true }).selectOption("critical");
  await expect(page.locator("tbody tr")).toHaveCount(criticalRules);
  await page.getByLabel("Search behavioral rules").fill("does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No matching behaviors" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(summary.totalRules);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("button", { name: "Uncovered", exact: false })
      .first()
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(summary.uncovered);
  }
});
test("standalone HTML report is interactive and docs load", async ({
  page,
}) => {
  await page.goto("/report.html");
  await expect(page.getByRole("heading", { name: "CausEval." })).toBeVisible();
  await page.locator(`[data-rule="${pseudoRule.id}"]`).first().click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("pseudo-covered");
  await expect(dialog).toContainText("Where this rule came from");
  await expect(dialog).toContainText("Why CausEval classified it this way");
  await expect(dialog).toContainText("did not detect removal");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Run metadata and reproduction")).toBeVisible();
  await page.goto("/docs/");
  await expect(
    page.getByRole("heading", { name: "Make the contract visible." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
