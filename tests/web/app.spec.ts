import { test, expect } from "@playwright/test";
import data from "../../apps/web/lib/demo-data.json" with { type: "json" };
const s = data.summary;
const missed = data.rules.find((rule) =>
  data.causalResults.some(
    (result) =>
      result.ruleId === rule.id && result.classification === "pseudo-covered",
  ),
)!;

test("landing gives one clear path into the example", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Do your tests catch",
  );
  await expect(
    page.getByText("No setup. No API key. Saved example results."),
  ).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /social-preview\.png$/,
  );
  // The repository has to be reachable from every page, not just the footer,
  // and the link keeps its name at mobile width where the label is hidden.
  await expect(
    page.getByRole("link", { name: "Star CausEval on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/aravinda-1402/causeval");
  // Developers need a copyable source path without leaving the landing page.
  const quickstart = page.locator(".copy-block");
  await expect(quickstart).toContainText(
    "git clone https://github.com/aravinda-1402/causeval.git",
  );
  await expect(quickstart).toContainText("pnpm causeval demo");
  await page
    .getByRole("link", { name: "Explore the example", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "See what your tests catch." }),
  ).toBeVisible();
  await expect(page.locator(".rule-row")).toHaveCount(s.totalRules);
  await expect(page.locator(".coverage-matrix")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("rule results preserve evidence and suggested tests", async ({ page }) => {
  await page.goto("/demo/");
  await page.getByRole("button", { name: /^Removal missed/ }).click();
  await expect(page.locator(".rule-row")).toHaveCount(s.pseudoCovered);
  await page.getByLabel("Search rules", { exact: true }).fill(missed.id);
  const row = page.locator(".rule-row");
  await expect(row).toHaveCount(1);
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "What happened" }),
  ).toBeVisible();
  await expect(dialog).toContainText(
    "The tests still passed after this instruction was removed.",
  );
  await expect(dialog).toContainText("What to do next");
  await expect(dialog).toContainText("WHAT THIS CANNOT RULE OUT");
  await expect(page).toHaveURL(new RegExp("rule=" + missed.id));
  await dialog.getByRole("button", { name: /Suggested tests/ }).click();
  await expect(dialog).toContainText("Draft suggestions — review before use.");
  await dialog.getByRole("button", { name: "Technical details" }).click();
  await expect(dialog).toContainText("Eval mappings");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect(page).not.toHaveURL(/rule=/);
});

test("filters and matrix share state and recover from an empty search", async ({
  page,
}) => {
  await page.goto("/demo/");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Priority", { exact: true }).selectOption("critical");
  const count = data.rules.filter(
    (rule) => rule.severity === "critical",
  ).length;
  await expect(page.locator(".rule-row")).toHaveCount(count);
  await page.getByRole("button", { name: "Matrix", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(count);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".rule-row")).toHaveCount(count);
  await page.getByLabel("Search rules", { exact: true }).fill("does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No rules match these filters." }),
  ).toBeVisible();
  await page
    .locator(".simple-empty")
    .getByRole("button", { name: "Clear all filters" })
    .click();
  await expect(page.locator(".rule-row")).toHaveCount(s.totalRules);
  await page.getByRole("button", { name: /^No test linked/ }).click();
  await expect(page.locator(".rule-row")).toHaveCount(s.uncovered);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("linked rules, explanation dialogs, and download links work", async ({
  page,
}) => {
  await page.goto("/demo/?rule=" + missed.id);
  await expect(page.getByRole("dialog")).toContainText(missed.expectedBehavior);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Search rules", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Explain Removal detected" }).click();
  await expect(page.getByRole("dialog")).toContainText("causal rule coverage");
  await page.keyboard.press("Escape");
  await page.getByText("Download report", { exact: true }).click();
  await expect(page.getByRole("link", { name: "JSON data" })).toHaveAttribute(
    "href",
    "/demo.json",
  );
  await expect(
    page.getByRole("link", { name: "Full HTML report" }),
  ).toHaveAttribute("href", "/report.html");
});

test("standalone report and guide remain available", async ({ page }) => {
  await page.goto("/report.html");
  await expect(page.getByRole("heading", { name: "CausEval." })).toBeVisible();
  await page
    .locator('[data-rule="' + missed.id + '"]')
    .first()
    .click();
  await expect(page.locator("dialog[open]")).toContainText(
    "did not detect removal",
  );
  await page.keyboard.press("Escape");
  await page.goto("/docs/");
  await expect(
    page.getByRole("heading", { name: "From a rule to a useful test." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reading your results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Developer setup" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the start-here action opens a rule with before-and-after evidence", async ({
  page,
}) => {
  await page.goto("/demo/");
  await page.getByRole("button", { name: /See a missed removal/ }).click();
  const dialog = page.getByRole("dialog");
  // An uncovered rule has an empty drawer, which teaches a first reader nothing.
  await expect(dialog).toContainText("BEFORE AND AFTER");
  await expect(dialog.locator(".pass-chip, .fail-chip").first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp("rule=" + missed.id));
});
