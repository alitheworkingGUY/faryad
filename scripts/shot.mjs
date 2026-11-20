// Dev helper: open a page in the installed Chrome, optionally run some steps, save a screenshot
// and print any console errors.
//   node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [js steps using `page`]
import { chromium } from "playwright-core";

const [, , url, out, w = "1920", h = "1080", wait = "5000", steps = ""] = process.argv;
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [steps]");
  process.exit(1);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
  isMobile: Number(w) < 600,
  hasTouch: Number(w) < 600,
});
const page = await context.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") problems.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => {
  const failure = r.failure()?.errorText ?? "";
  if (!failure.includes("ERR_ABORTED")) problems.push(`[requestfailed] ${r.url()} ${failure}`);
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(Number(wait));
  if (steps) {
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    await new AsyncFunction("page", "context", steps)(page, context);
  }
  await page.screenshot({ path: out });
  console.log(`saved ${out}`);
} finally {
  console.log(problems.length ? problems.join("\n") : "no console errors or warnings");
  await browser.close();
}
