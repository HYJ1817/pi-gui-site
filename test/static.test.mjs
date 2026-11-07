// 静态结构校验：HTML 结构 / 站内锚点 / 资源引用 / 语法 / CSS 基本校验 / SEO 资产
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, "index.html"), "utf8");
const css = readFileSync(path.join(root, "style.css"), "utf8");
const mainJs = readFileSync(path.join(root, "main.js"), "utf8");

test("HTML 语法基本合法（单 root 闭合、无重复 id）", () => {
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<html [\s\S]*lang="zh-CN"/);
  assert.match(html, /<\/html>\s*$/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, "存在重复 id：");
});

test("站内锚点都有目标", () => {
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  const targets = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const h of new Set(hrefs)) {
    assert.ok(targets.has(h), `锚点 #${h} 没有对应目标`);
  }
  assert.ok(targets.has("top"), "主内容锚点缺失");
});

test("引用的本地资源都存在", () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
    .filter(u => !/^(https?:|mailto:|javascript:|#)/.test(u))
    .map(u => u.split("?")[0].split("#")[0]);
  for (const ref of refs) {
    const p = path.join(root, ref);
    assert.ok(existsSync(p), `资源不存在：${ref}`);
  }
  for (const f of ["style.css", "main.js", "release-data.js", "assets/favicon.svg",
    "assets/favicon.png", "assets/apple-touch-icon.png", "assets/og-image.png"]) {
    assert.ok(existsSync(path.join(root, f)), `缺少关键文件：${f}`);
  }
});

test("SEO：canonical / OG / Twitter / JSON-LD / theme-color 齐备", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/pi-gui\.881817\.xyz\/">/);
  assert.match(html, /meta property="og:title"/);
  assert.match(html, /meta property="og:image" content="https:\/\/pi-gui\.881817\.xyz\/assets\/og-image\.png"/);
  assert.match(html, /meta name="twitter:card" content="summary_large_image"/);
  assert.match(html, /meta name="theme-color"/);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "JSON-LD 缺失");
  const parsed = JSON.parse(ld[1]);
  assert.equal(parsed["@type"], "SoftwareApplication");
  assert.equal(parsed.offers.price, "0");
  // 不虚构评分 / 下载量 / 用户数
  assert.ok(!/"ratingValue"|"aggregateRating"|"downloadCount"|"userCount"/i.test(html));
});

test("结构化数据与文案不含虚假声明", () => {
  assert.ok(!/经 SignPath\.io 免费代码签名|已通过.*SignPath|证书由 SignPath Foundation 提供/.test(html),
    "不应声称已获得签名");
  assert.match(html, /尚未接入正式代码签名/);
  assert.match(html, /未知发布者/);
});

test("校验与复制入口存在", () => {
  assert.match(html, /id="sha-commands"/);
  assert.match(html, /id="sha-sums-link"/);
  const copies = [...html.matchAll(/class="[^"]*copy-command/g)].length;
  assert.ok(copies >= 4, `复制按钮数量不足：${copies}`);
  assert.match(html, /certutil -hashfile/);
});

test("JavaScript 语法检查", () => {
  for (const f of ["main.js", "release-data.js", "tools/gen-assets.mjs", "test/smoke.mjs"]) {
    execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" });
  }
});

test("CSS 基本校验：括号配平、双主题令牌、关键选择器", () => {
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  assert.equal(open, close, "花括号不配平");
  assert.match(css, /--bg: light-dark\(/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.menu-toggle/);
  assert.match(css, /\.nav-panel/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.theme-seg/);
  assert.match(css, /\.sha-block/);
});

test("JS 交互接线完整", () => {
  assert.match(mainJs, /data-theme-seg/);
  assert.match(mainJs, /aria-pressed/);
  assert.match(mainJs, /menu-toggle/);
  assert.match(mainJs, /aria-expanded/);
  assert.match(mainJs, /AbortController/);
  assert.match(mainJs, /sha-commands/);
  assert.match(mainJs, /checksumCommands/);
  assert.match(mainJs, /stableReleases/);
  assert.ok(!/getElementById\("copy-command"\)/.test(mainJs), "旧的单点复制逻辑应已移除");
  assert.ok(!/per_page=10/.test(mainJs));
});

function pngSize(file) {
  const d = readFileSync(path.join(root, file));
  return [d.readUInt32BE(16), d.readUInt32BE(20)];
}

test("图片资产尺寸正确且不能过大", () => {
  assert.deepEqual(pngSize("assets/og-image.png"), [1200, 630]);
  assert.deepEqual(pngSize("assets/apple-touch-icon.png"), [180, 180]);
  assert.deepEqual(pngSize("assets/favicon.png"), [64, 64]);
  const og = readFileSync(path.join(root, "assets/og-image.png"));
  assert.ok(og.length < 512 * 1024, "OG 图片超过 512KB");
});

test("robots.txt 与 sitemap.xml 指向规范域名", () => {
  const robots = readFileSync(path.join(root, "robots.txt"), "utf8");
  const sitemap = readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/pi-gui\.881817\.xyz\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/pi-gui\.881817\.xyz\//);
});
