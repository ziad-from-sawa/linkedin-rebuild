// Renders index.html to an MP4, one frame at a time, so the video is smooth
// no matter how slow the machine is. Needs Google Chrome and ffmpeg on PATH.
//   node render.mjs            -> out/linkedin-rebuild-demo.mp4
//   node render.mjs --fps 60   -> smoother, twice the frames
//   node render.mjs --from 10 --to 24 --out out/scan.mp4   -> one section
//   node render.mjs --workers 6  -> more parallel pages (default 4)
//   node render.mjs --p bussgang -> uses data-bussgang.js, writes out/linkedin-rebuild-demo-bussgang.mp4
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const fps = +arg("fps", 30);
const workers = +arg("workers", 4);
const prof = arg("p", "");
const outFile = resolve(here, arg("out", prof ? `out/linkedin-rebuild-demo-${prof}.mp4` : "out/linkedin-rebuild-demo.mp4"));
const partsDir = resolve(here, `out/parts${prof ? "-" + prof : ""}`);
mkdirSync(partsDir, { recursive: true });

const run = (args) => new Promise((ok, fail) => {
  const p = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))));
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = pathToFileURL(resolve(here, "index.html")).href + "?render=1" + (prof ? `&p=${prof}` : "");
const probe = await browser.newPage();
await probe.goto(url);
await probe.evaluate(() => window.__ready);
const dur = await probe.evaluate(() => window.__DUR);
await probe.close();

const from = +arg("from", 0);
const to = Math.min(+arg("to", dur), dur);
const total = Math.round((to - from) * fps);
const per = Math.ceil(total / workers);
let done = 0;
const started = Date.now();

async function renderPart(w) {
  const first = w * per;
  const last = Math.min(total, first + per);
  if (first >= last) return null;
  const file = resolve(partsDir, `part-${w}.mp4`);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(() => window.__ready);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(fps), file,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const closed = new Promise((r) => ff.on("close", r));
  for (let i = first; i < last; i++) {
    await page.evaluate((t) => window.__seek(t), from + i / fps);
    const jpg = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
    done++;
    if (done % fps === 0) {
      const secs = (Date.now() - started) / 1000;
      console.log(`${Math.round((done / total) * 100)}%  ${done}/${total} frames  ${Math.round(secs)}s elapsed, ~${Math.round((secs / done) * (total - done))}s left`);
    }
  }
  ff.stdin.end();
  await closed;
  await page.close();
  return file;
}

const parts = (await Promise.all([...Array(workers).keys()].map(renderPart))).filter(Boolean);
await browser.close();

const list = resolve(partsDir, "list.txt");
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
await run(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", outFile]);
rmSync(partsDir, { recursive: true, force: true });
console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${outFile}`);
