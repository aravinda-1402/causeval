// Regenerates the README screenshots and the captioned walkthrough recording.
//
//   pnpm build
//   node scripts/serve-static.mjs        # in a second terminal
//   node scripts/capture-media.mjs       # needs ffmpeg on PATH
//
// Captures land in output/media/ for inspection. Copy the ones you want into
// docs/images/ yourself; this script never overwrites committed media.
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";

const BASE = process.env.CAUSEVAL_MEDIA_URL || "http://127.0.0.1:3000";
const OUT = "output/media";
const FONT_SOURCE =
  process.env.CAUSEVAL_CAPTION_FONT || "C:/Windows/Fonts/segoeuib.ttf";
// ffmpeg cannot parse a Windows drive-letter colon inside a filter argument, so
// the font is copied next to the frames and referenced by a relative path.
const FONT = `${OUT}/caption-font.ttf`;
const SPEEDUP = 1.25;

// Lower-third captions, anchored to marks the recorder measures rather than to
// fixed timestamps: navigation and scroll durations vary by a second or two
// between runs, which is enough to slide a caption off the moment it describes.
// Colons, apostrophes, percent signs and backslashes would need filter
// escaping, so the captions avoid them and assertCaption enforces that.
const captionsFor = (mark, end) => [
  [
    mark.ready + 0.6,
    mark.ideaVisible - 0.4,
    "Your prompt has rules. Do your tests actually check them?",
  ],
  [
    mark.ideaVisible + 0.3,
    mark.ideaDone - 0.3,
    "Free and open source. Works with the tests you already have.",
  ],
  [
    mark.reportReady + 0.6,
    mark.drawerOpen - 0.4,
    "Removal detected, removal missed, or no test linked.",
  ],
  [
    mark.drawerOpen + 0.6,
    mark.experimentVisible - 0.3,
    "This test passed even after its rule was removed.",
  ],
  [
    mark.experimentVisible + 0.4,
    // Ends before the verdict scrolls into view, which sits under the caption.
    mark.verdictVisible - 0.4,
    "Same evals before and after. Three of three pass either way.",
  ],
  [
    mark.suggestionsVisible + 0.4,
    mark.suggestionsVisible + 5,
    "CausEval drafts the missing test cases for you to review.",
  ],
  [mark.finale + 0.4, end, "Code has coverage. Your prompts should too."],
];

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", args, {
    stdio: ["ignore", "ignore", "inherit"],
    windowsHide: true,
  });
  if (result.error) throw new Error("ffmpeg is not on PATH");
  if (result.status !== 0) throw new Error("ffmpeg failed");
}

function assertCaption(text) {
  if (/[:'\\%]/.test(text)) throw new Error("caption needs escaping: " + text);
  return text;
}

async function captureScreenshots(browser) {
  // deviceScaleFactor 1 keeps the flat interface colors compressible.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (event) => errors.push(event.message));

  await page.goto(BASE + "/");
  await page.evaluate(() => {
    localStorage.setItem("causeval-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await page.reload();
  await page.getByRole("link", { name: "Explore the example" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/landing.png` });

  await page.goto(BASE + "/demo/");
  await page.getByRole("button", { name: /See a missed removal/ }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/coverage-overview.png` });

  // Click through rather than deep-linking ?rule=R06: the deep link leaves a
  // focus ring on the close button.
  await page.getByRole("button", { name: /See a missed removal/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.locator(".drawer-content").evaluate((el) => (el.scrollTop = 330));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/rule-evidence.png` });

  await page.getByRole("button", { name: /Suggested tests/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/suggestions.png` });
  await page.keyboard.press("Escape");

  await page.goto(BASE + "/report.html");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/standalone-report.png` });

  await context.close();
  if (errors.length) throw new Error("page errors: " + errors.join("; "));
}

async function recordWalkthrough(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (event) => errors.push(event.message));

  const hold = (ms) => page.waitForTimeout(ms);
  // Ease the scroll so the recording reads as a person reading the page.
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const glide = async (target, steps = 34) => {
    const from = await page.evaluate(() => window.scrollY);
    for (let i = 1; i <= steps; i++) {
      const y = from + (target - from) * ease(i / steps);
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await hold(22);
    }
  };
  const glideDrawer = async (target, steps = 30) => {
    const drawer = page.locator(".drawer-content");
    const from = await drawer.evaluate((el) => el.scrollTop);
    for (let i = 1; i <= steps; i++) {
      const y = from + (target - from) * ease(i / steps);
      await drawer.evaluate((el, to) => (el.scrollTop = to), y);
      await hold(24);
    }
  };

  await page.goto(BASE + "/");
  await page.evaluate(() => {
    localStorage.setItem("causeval-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await page.reload();
  await page.getByRole("link", { name: "Explore the example" }).waitFor();

  // The recording's first usable frame is the landing page, so time every mark
  // from here. Marks are real seconds; renderVideo divides them by SPEEDUP.
  const start = Date.now();
  const mark = {};
  const at = (name) => (mark[name] = (Date.now() - start) / 1000);

  at("ready");
  await hold(2600);
  await glide(760);
  await hold(1500);
  await glide(1560);
  at("ideaVisible");
  await hold(2200);
  at("ideaDone");
  await glide(0, 22);
  await hold(700);

  await page
    .getByRole("link", { name: "Explore the example", exact: true })
    .click();
  await page.getByRole("button", { name: /See a missed removal/ }).waitFor();
  at("reportReady");
  await hold(2800);
  await glide(240);
  await hold(2400);

  await page.getByRole("button", { name: /See a missed removal/ }).click();
  await page.getByRole("dialog").waitFor();
  at("drawerOpen");
  await hold(2600);
  await glideDrawer(330);
  at("experimentVisible");
  await hold(3000);
  await glideDrawer(690);
  at("verdictVisible");
  await hold(3200);

  await page.getByRole("button", { name: /Suggested tests/ }).click();
  at("suggestionsVisible");
  await hold(2800);
  await glideDrawer(260);
  await hold(2200);

  await page.keyboard.press("Escape");
  await hold(900);
  await glide(0, 18);
  await page.goto(BASE + "/");
  at("finale");
  await hold(2400);
  await glide(1560, 40);
  await hold(2000);

  await context.close();
  if (errors.length) throw new Error("page errors: " + errors.join("; "));

  const recordings = (await readdir(OUT)).filter((name) =>
    name.endsWith(".webm"),
  );
  if (recordings.length !== 1)
    throw new Error("expected one recording, found " + recordings.length);
  return { webm: `${OUT}/${recordings[0]}`, mark };
}

function durationOf(file) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8", windowsHide: true },
  );
  if (probe.status !== 0) throw new Error("ffprobe failed on " + file);
  return Number(probe.stdout.trim());
}

function renderVideo({ webm, mark }) {
  const encode =
    "-c:v libx264 -preset slow -pix_fmt yuv420p -movflags +faststart -an";
  const base = `${OUT}/walkthrough-base.mp4`;
  ffmpeg([
    "-y",
    "-v",
    "error",
    "-i",
    webm,
    "-vf",
    `setpts=PTS/${SPEEDUP},scale=1280:800:flags=lanczos,fps=30`,
    "-crf",
    "23",
    ...encode.split(" "),
    base,
  ]);

  const end = durationOf(base);
  const scaled = Object.fromEntries(
    Object.entries(mark).map(([name, seconds]) => [name, seconds / SPEEDUP]),
  );
  const captions = captionsFor(scaled, end);
  for (const [from, to, text] of captions) {
    if (!(to > from))
      throw new Error(`caption window collapsed (${from} to ${to}): ${text}`);
  }
  const drawtext = captions
    .map(
      ([from, to, text]) =>
        `drawtext=fontfile='${FONT}':text='${assertCaption(text)}':` +
        "fontsize=30:fontcolor=white:box=1:boxcolor=0x0d141b@0.93:boxborderw=20:" +
        `x=(w-text_w)/2:y=h-96:` +
        `enable='between(t,${from.toFixed(2)},${to.toFixed(2)})'`,
    )
    .join(",");
  ffmpeg([
    "-y",
    "-v",
    "error",
    "-i",
    base,
    "-vf",
    drawtext,
    "-crf",
    "24",
    ...encode.split(" "),
    `${OUT}/causeval-launch.mp4`,
  ]);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await copyFile(FONT_SOURCE, FONT);
const browser = await chromium.launch();
try {
  await captureScreenshots(browser);
  renderVideo(await recordWalkthrough(browser));
} finally {
  await browser.close();
}
console.log(
  `Media written to ${OUT}/. Review it, then copy into docs/images/.`,
);
