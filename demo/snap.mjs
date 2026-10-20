// Saves still frames for a quick look: node snap.mjs 5 12.5 30 -> out/snap-5.png ...
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, "out"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
const args = process.argv.slice(2);
const pi = args.indexOf("--p");
const prof = pi > -1 ? args.splice(pi, 2)[1] : "";
await page.goto(pathToFileURL(resolve(here, "index.html")).href + "?render=1" + (prof ? `&p=${prof}` : ""));
await page.evaluate(() => window.__ready);
for (const t of args) {
  await page.evaluate((t) => window.__seek(t), +t);
  const file = resolve(here, `out/snap${prof ? "-" + prof : ""}-${t}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
