// release-data.js 单元测试：解析逻辑使用真实 Releases 数据夹具，无网络请求
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const PD = (await import(pathToFileURL(path.join(here, "..", "release-data.js")))).default;
const fixture = JSON.parse(readFileSync(path.join(here, "fixtures", "releases.json"), "utf8"));

const v032 = fixture[0];

test("stableReleases 过滤 Draft/Prerelease 并按时间倒序", () => {
  const mixed = [
    { tag_name: "v0.33.0-rc.1", draft: false, prerelease: true, published_at: "2026-11-08T00:00:00Z", assets: [] },
    { tag_name: "v999-draft", draft: true, prerelease: false, published_at: "2026-11-09T00:00:00Z", assets: [] },
    ...fixture
  ];
  const stable = PD.stableReleases(mixed);
  assert.equal(stable.length, 3);
  assert.equal(stable[0].tag_name, "v0.32.0"); // 最新在前
  assert.equal(stable[2].tag_name, "v0.30.1");
  assert.deepEqual(PD.stableReleases(null), []);
  assert.deepEqual(PD.stableReleases([]), []);
  assert.deepEqual(PD.stableReleases({ nope: true }), []);
});

test("findAsset 精确匹配安装版 / 便携版 / SHA256SUMS", () => {
  const setup = PD.findAsset(v032, "setup");
  assert.equal(setup.name, "Pi-GUI-Setup-0.32.0.exe");
  assert.equal(setup.size, 105630773);
  const portable = PD.findAsset(v032, "portable");
  assert.equal(portable.name, "Pi-GUI-0.32.0-portable.zip");
  const sums = PD.findAsset(v032, "checksums");
  assert.equal(sums.name, "SHA256SUMS.txt");
});

test("findAsset 资产缺失 / 状态非 uploaded / 大小为 0 时返回 null", () => {
  const fake = {
    tag_name: "v1.0.0",
    assets: [
      // 旧式命名也会被识别（不带版本号的文件名）：
      { name: "Pi-GUI-Setup.exe", browser_download_url: "https://github.com/x/y/releases/download/v1/Pi-GUI-Setup.exe", size: 1, state: "uploaded" },
      // 状态未上传 → 不采用：
      { name: "Pi-GUI-portable.zip", browser_download_url: "https://github.com/x/y/releases/download/v1/Pi-GUI-portable.zip", size: 1, state: "starter" },
      // 大小 0 → 不采用：
      { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/x/y/releases/download/v1/SHA256SUMS.txt", size: 0, state: "uploaded" }
    ]
  };
  assert.equal(PD.findAsset(fake, "portable"), null); // 仅有 starter 状态
  assert.equal(PD.findAsset(fake, "checksums"), null); // size 0
  assert.equal(PD.findAsset(fake, "setup").name, "Pi-GUI-Setup.exe");
  assert.equal(PD.findAsset({ tag_name: "v2", assets: [{ name: "other.zip", size: 1, state: "uploaded" }] }, "portable"), null);
  assert.equal(PD.findAsset({ tag_name: "v3" }, "setup"), null);
  // 目录穿越类名字不应匹配
  assert.equal(PD.findAsset({ tag_name: "v4", assets: [{ name: "../evil.exe", size: 1, state: "uploaded" }] }, "setup"), null);
});

test("safeUrl 仅放行 GitHub 官方域名 https 链接", () => {
  assert.equal(PD.safeUrl("https://github.com/HYJ1817/pi-gui/releases/download/v0.32.0/Pi-GUI-Setup-0.32.0.exe"),
    "https://github.com/HYJ1817/pi-gui/releases/download/v0.32.0/Pi-GUI-Setup-0.32.0.exe");
  assert.equal(PD.safeUrl("http://github.com/x"), null); // 非 https
  assert.equal(PD.safeUrl("https://evil.example/Pi-GUI-Setup.exe"), null);
  assert.equal(PD.safeUrl("javascript:alert(1)"), null);
  assert.equal(PD.safeUrl(null), null);
  assert.equal(PD.safeUrl(undefined), null);
  assert.equal(PD.safeUrl(42), null);
});

test("summarize 使用注释块摘要且剔除 PR 清单与交付说明", () => {
  const s = PD.summarize(v032.body);
  assert.ok(s.text.includes("PI-Desktop 全新桌面外壳"));
  assert.ok(!s.text.includes("本版摘要"));
  assert.ok(!s.text.includes("What's Changed"));
  assert.ok(!s.text.includes("Full Changelog"));
  assert.ok(!s.text.includes("交付物"));
  assert.ok(!s.text.includes("pull/48"));
  assert.ok(!s.text.includes("pi-gui-release-summary"));
});

test("summarize 无注释块时回退为正文短摘，且止步于 PR 清单", () => {
  const body = "修复了更新检查。\n补充安装说明。\n\n## What's Changed\n* 某修复 by @dev in https://x/pull/1\n";
  const s = PD.summarize(body);
  assert.ok(s.text.includes("修复了更新检查"));
  assert.ok(!s.text.includes("pull/1"));
  const s2 = PD.summarize("### 交付物\n| 文件 | 说明 |\n| --- | --- |\n");
  assert.ok(s2.text.includes("查看该版本") || !s2.text.includes("文件"));
  assert.equal(PD.summarize(null).text, "查看该版本的详细变更与修复说明。");
  assert.equal(PD.summarize(undefined).text, "查看该版本的详细变更与修复说明。");
  assert.equal(PD.summarize(123).text, "查看该版本的详细变更与修复说明。");
});

test("checksumCommands 生成校验命令，缺失时用占位符", () => {
  const setup = PD.findAsset(v032, "setup");
  const portable = PD.findAsset(v032, "portable");
  const withNames = PD.checksumCommands(setup, portable);
  assert.ok(withNames.includes('certutil -hashfile "Pi-GUI-Setup-0.32.0.exe" SHA256'));
  assert.ok(withNames.includes('certutil -hashfile "Pi-GUI-0.32.0-portable.zip" SHA256'));
  const without = PD.checksumCommands(null, null);
  assert.ok(without.includes("<版本>"));
  assert.ok(without.includes("Pi-GUI-Setup-<版本>.exe"));
  assert.ok(without.includes("Pi-GUI-<版本>-portable.zip"));
});

test("formatSize / formatDate 输出可读文本", () => {
  assert.equal(PD.formatSize(105630773), "100.7 MB");
  assert.equal(PD.formatSize(149204552), "142.3 MB");
  assert.equal(PD.formatSize(183), "183 B");
  assert.equal(PD.formatSize(0), "");
  assert.equal(PD.formatSize(null), "");
  assert.equal(PD.formatDate("2026-11-06T15:13:19Z"), "2026/11/06");
  assert.equal(PD.formatDate("not-a-date"), "");
});
