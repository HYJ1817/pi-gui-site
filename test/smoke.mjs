// 浏览器冒烟测试：真实页面交互，Releases API 用本地夹具模拟，不受 GitHub 限流影响。
// 运行：npm run test:smoke   （CI 里设 BROWSER_CHANNEL=chrome 用系统 Chrome，无需浏览器下载）
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import PD from "../release-data.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "releases.json"), "utf8"));
const latest = PD.stableReleases(fixture)[0];
const setup = PD.findAsset(latest, "setup");
const portable = PD.findAsset(latest, "portable");
const sums = PD.findAsset(latest, "checksums");

const MIMES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown"
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "").split("?")[0]);
  if (p === "/favicon.ico") p = "/assets/favicon.png";
  const abs = path.join(root, p);
  const file = (p.endsWith("/") || !path.extname(abs)) ? path.join(abs, "index.html") : abs;
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIMES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  });
});

async function launchBrowser() {
  const cands = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ["chrome", "msedge"];
  let lastErr;
  for (const channel of cands) {
    try { return await chromium.launch({ channel }); } catch (err) { lastErr = err; }
  }
  try { return await chromium.launch(); } catch (err) { throw lastErr || err; }
}

function stubCdn(context) {
  context.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
}

function routeApiOk(context) {
  stubCdn(context);
  context.route("**/api.github.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }));
}

function routeApiFail(context, mode) {
  stubCdn(context);
  context.route("**/api.github.com/**", r =>
    mode === "rate" ? r.fulfill({ status: 429, contentType: "application/json", body: "{\"message\":\"rate limit\"}" }) : r.abort());
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (err) { results.push(["FAIL", name + " — " + (err && err.message ? err.message : err)]); }
}

const browser = await launchBrowser();
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

async function newPage(context) {
  const page = await context.newPage();
  page._errors = [];
  page.on("pageerror", e => page._errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") page._errors.push("console: " + m.text()); });
  return page;
}

const noJsErrors = (page, allow) => {
  const unexpected = page._errors.filter(e => !(allow || []).some(p => e.includes(p)));
  return assert.deepEqual(unexpected, []);
};

/* 1. 正常加载与 Releases 渲染 */
await check("Release 渲染：版本 / 文件 / 大小 / 链接", async () => {
  const context = await browser.newContext();
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  await page.waitForFunction(() => document.getElementById("ver") && /v\d+\.\d+\.\d+/.test(document.getElementById("ver").textContent));
  assert.equal(await page.textContent("#ver"), latest.tag_name);
  assert.equal(await page.textContent("#ver2"), latest.tag_name);
  assert.match(await page.textContent("#release-status"), /最新稳定版/);
  assert.equal((await page.textContent("#installer-filename")).trim(), setup.name);
  assert.match(await page.textContent("#installer-size"), /100\.7 MB/);
  const hrefI = await page.getAttribute("#download-installer", "href");
  assert.equal(hrefI, setup.browser_download_url);
  const hrefP = await page.getAttribute("#download-portable", "href");
  assert.equal(hrefP, portable.browser_download_url);
  assert.equal((await page.textContent("#portable-filename")).trim(), portable.name);
  assert.ok(await page.isVisible("#download-installer"));
  noJsErrors(page);
  await context.close();
});

await check("SHA-256 校验区：SUMS 链接与 certutil 命令", async () => {
  const context = await browser.newContext();
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  await page.waitForFunction(() => /certutil/.test(document.getElementById("sha-commands").textContent));
  const code = await page.textContent("#sha-commands");
  assert.ok(code.includes(`certutil -hashfile "${setup.name}" SHA256`));
  assert.ok(code.includes(`certutil -hashfile "${portable.name}" SHA256`));
  assert.equal(await page.getAttribute("#sha-sums-link", "href"), sums.browser_download_url);
  noJsErrors(page);
  await context.close();
});

await check("更新日志：展示 Release 摘要而非 PR 清单", async () => {
  const context = await browser.newContext();
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  await page.waitForSelector(".release-item");
  const rows = await page.locator(".release-item").count();
  assert.ok(rows >= 2 && rows <= 3, `行数异常：${rows}`);
  const firstTitle = await page.textContent(".release-item h3");
  assert.ok(firstTitle.includes(latest.tag_name));
  const firstBody = await page.textContent(".release-item p");
  assert.ok(firstBody.includes("PI-Desktop 全新桌面外壳"));
  assert.ok(!firstBody.includes("What's Changed"));
  assert.ok(!firstBody.includes("pull/48"));
  assert.ok(!firstBody.includes("交付物"));
  assert.ok(!firstBody.startsWith("本版摘要"));
  noJsErrors(page);
  await context.close();
});

await check("复制命令按钮与剪贴板内容", async () => {
  const context = await browser.newContext();
  context.grantPermissions(["clipboard-read", "clipboard-write"]);
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  await page.click('[aria-label="复制 Pi 安装命令"]');
  await page.waitForFunction(() => /已复制|手动复制/.test(document.querySelector('[aria-label="复制 Pi 安装命令"]').textContent));
  assert.match(await page.textContent('[aria-label="复制 Pi 安装命令"]'), /已复制 ✓/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.includes("npm install -g @earendil-works/pi-coding-agent"));
  noJsErrors(page);
  await context.close();
});

await check("演示场景切换（点击 + 键盘）", async () => {
  const context = await browser.newContext();
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  const tab = s => page.locator(`.demo-tab[data-scene="${s}"]`);
  await tab("models").click();
  await page.waitForFunction(() => document.getElementById("demo-thread-title").textContent === "供应商管理");
  assert.equal(await page.textContent("#demo-counter"), "02 / 04");
  assert.equal((await tab("models").getAttribute("aria-selected")), "true");
  assert.equal((await tab("sessions").getAttribute("aria-selected")), "false");
  assert.equal(await page.textContent("#demo-tool-name"), "select_model");
  assert.ok(await page.evaluate(() => document.getElementById("demo-window").dataset.scene === "models"));
  // 键盘：聚焦当前 tab 后按 →，进入下一个场景
  await tab("models").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.getElementById("demo-thread-title").textContent === "测试与验证");
  assert.equal((await tab("changes").getAttribute("aria-selected")), "true");
  assert.equal(await page.textContent("#demo-counter"), "03 / 04");
  noJsErrors(page);
  await context.close();
});

await check("主题切换与偏好保存（浅/深/自动）", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert.equal(await theme(), "light");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lightBg = await bg();
  // 顶栏分段控件切到深色
  await page.click(".theme-seg:not(.theme-seg-panel) [data-theme-choice='dark']");
  assert.equal(await theme(), "dark");
  const darkBg = await bg();
  assert.notEqual(lightBg, darkBg);
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-gui-theme")), "dark");
  // 面板内分组同步
  assert.equal(await page.getAttribute(".theme-seg-panel [data-theme-choice='dark']", "aria-pressed"), "true");
  noJsErrors(page);
  await page.reload();
  assert.equal(await theme(), "dark");
  // 「自动」跟随系统（桌面宽度下面板隐藏，用顶栏分组点击）
  await page.click(".theme-seg:not(.theme-seg-panel) [data-theme-choice='system']");
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-gui-theme")), "system");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
  await context.close();
});

await check("移动端菜单：开合 / Escape / 点链接 / 点外部", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  routeApiOk(context);
  const page = await newPage(context);
  await page.goto(base);
  const btn = page.locator("#menu-toggle");
  assert.ok(await btn.isVisible());
  assert.equal(await page.isHidden("#nav-panel"), true);
  await btn.click();
  assert.equal(await page.isVisible("#nav-panel"), true);
  assert.equal(await btn.getAttribute("aria-expanded"), "true");
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("menu-open")));
  // Escape 关闭并把焦点还给按钮
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.getElementById("nav-panel").hidden === true);
  assert.equal(await btn.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement.id), "menu-toggle");
  // 点击链接关闭并定位
  await btn.click();
  await page.click("#nav-panel a[href='#flow']");
  await page.waitForFunction(() => document.getElementById("nav-panel").hidden === true);
  assert.ok(await page.evaluate(() => window.location.hash === "#flow"));
  // 点击外部关闭
  await btn.click();
  await page.mouse.click(375 / 2, 600);
  await page.waitForFunction(() => document.getElementById("nav-panel").hidden === true);
  noJsErrors(page);
  await context.close();
});

await check("六个宽度 × 双主题无横向溢出", async () => {
  const context = await browser.newContext();
  routeApiOk(context);
  const page = await newPage(context);
  const widths = [320, 375, 390, 768, 1024, 1440];
  for (const theme of ["light", "dark"]) {
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: Math.max(640, w) });
      if (!page.url().startsWith(base)) await page.goto(base);
      await page.evaluate(t => {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem("pi-gui-theme", t === "dark" ? "dark" : "light");
      }, theme);
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(() => {
        const vw = window.innerWidth;
        const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        return { vw, sw };
      });
      assert.ok(overflow.sw <= overflow.vw + 1,
        `${w}px @${theme}: scrollWidth ${overflow.sw} > viewport ${overflow.vw}`);
    }
  }
  noJsErrors(page);
  await context.close();
});

await check("Releases API 失败时降级（网络错误 / 429）", async () => {
  for (const mode of ["abort", "rate"]) {
    const context = await browser.newContext();
    routeApiFail(context, mode);
    const page = await newPage(context);
    await page.goto(base);
    await page.waitForFunction(() => /暂时无法获取/.test(document.getElementById("release-status").textContent), null, { timeout: 15000 });
    // 版本号保持静态占位，不得伪造
    assert.equal(await page.textContent("#ver"), "v0.32");
    assert.match(await page.textContent("#installer-filename"), /<版本>/);
    const href = await page.getAttribute("#download-installer", "href");
    assert.equal(href, "https://github.com/HYJ1817/pi-gui/releases/latest");
    assert.match(await page.textContent("#sha-commands"), /<版本>/);
    assert.ok(await page.locator(".release-placeholder").count() >= 1);
    assert.ok(await page.locator(".release-placeholder a[href*='github.com/HYJ1817/pi-gui/releases']").count() >= 1);
    // 浏览器会把 fetch 失败记成 console error，这属于预期网络噪声，只放行该类消息
    noJsErrors(page, ["Failed to load resource"]);
    await context.close();
  }
});

/* 汇总 */
await browser.close();
server.close();
let failed = 0;
for (const [s, n] of results) {
  console.log(s, n);
  if (s === "FAIL") failed++;
}
console.log(`\n${results.length - failed}/${results.length} 项通过`);
process.exit(failed ? 1 : 0);
