// 从 assets/*.html 生成静态 PNG 素材（og-image / apple-touch-icon / favicon）。
// 用法：npm run gen:assets  （执行前需 npm install 且本机装有 Chrome 或 Edge）
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url)) + path.sep + "..";
const CHANNELS = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ["chrome", "msedge"];

async function launch() {
  let lastErr;
  for (const channel of CHANNELS) {
    try { return await chromium.launch({ channel }); } catch (err) { lastErr = err; }
  }
  try { return await chromium.launch(); } catch (err) { throw lastErr || err; }
}

const jobs = [
  { src: "assets/og.html", file: "assets/og-image.png", size: [1200, 630], sel: "body" },
  { src: "assets/icon.html", file: "assets/apple-touch-icon.png", size: [180, 180], sel: ".tile" },
  {
    src: "assets/icon.html", file: "assets/favicon.png", size: [64, 64], sel: ".tile",
    style: ".tile { width: 64px; height: 64px; border-radius: 14px; } .pi { font-size: 38px; padding-bottom: 5px; }"
  }
];

const browser = await launch();
for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: job.size[0], height: job.size[1] },
    deviceScaleFactor: 1
  });
  await page.goto("file:///" + path.resolve(root, job.src).replace(/\\/g, "/"));
  if (job.style) await page.addStyleTag({ content: job.style });
  await page.waitForTimeout(120);
  await page.locator(job.sel).screenshot({ path: path.resolve(root, job.file) });
  console.log("generated", job.file);
  await page.close();
}
await browser.close();
