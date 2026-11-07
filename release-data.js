/* Pi GUI — GitHub Releases 数据解析（纯函数，供 main.js 与测试共用） */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; }
  else { root.PiReleaseData = api; }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* 过滤 Draft / Prerelease，并按发布时间倒序 */
  function stableReleases(payload) {
    if (!Array.isArray(payload)) return [];
    return payload.filter(function (r) {
      return r && typeof r === "object" && !r.draft && !r.prerelease && typeof r.tag_name === "string" && r.tag_name.trim() !== "";
    }).sort(function (a, b) {
      return new Date(b.published_at || 0) - new Date(a.published_at || 0);
    });
  }

  /* 按类型挑选资产：仅接受已上传且大小有效的文件 */
  var ASSET_PATTERNS = {
    setup: /^Pi[-_ ]?GUI[-_ ]?Setup[^\/\\]*\.exe$/i,
    portable: /^Pi[-_ ]?GUI[^\/\\]*portable[^\/\\]*\.zip$/i,
    checksums: /^SHA256SUMS\.txt$/i
  };

  function assetReady(a) {
    var state = a.state || "uploaded";
    return state === "uploaded" && typeof a.size === "number" && a.size > 0;
  }

  function findAsset(release, kind) {
    if (!release || !Array.isArray(release.assets)) return null;
    var pattern = ASSET_PATTERNS[kind];
    if (!pattern) return null;
    for (var i = 0; i < release.assets.length; i++) {
      var a = release.assets[i];
      if (!a || !assetReady(a) || !pattern.test(a.name || "")) continue;
      if (!safeUrl(a.browser_download_url)) continue;
      return a;
    }
    return null;
  }

  /* 只信任官方 GitHub 下载地址 */
  function safeUrl(candidate) {
    if (typeof candidate !== "string") return null;
    try {
      var u = new URL(candidate);
      if (u.protocol !== "https:") return null;
      if (/(^|\.)github\.com$|(^|\.)githubusercontent\.com$/.test(u.hostname)) return u.href;
      return null;
    } catch (e) { return null; }
  }

  /* 清理一行 Markdown，保留纯文本 */
  function cleanLine(line) {
    var t = String(line || "");
    return t
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^[#>\-*•\s]+/, "")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  var CAP = 150;
  var FALLBACK_TITLE = "查看该版本的详细变更与修复说明。";
  var STOP = /^(what'?s changed|full changelog|交付物|notes|assets)$/i;

  var MARKER_START = "pi-gui-release-summary:start";
  var MARKER_END = "pi-gui-release-summary:end";

  /* 优先使用 Release 正文中的「本版摘要」注释块，
     否则回退为普通正文首行短摘；始终剔除 PR 清单与交付说明 */
  function summarize(body) {
    var md = typeof body === "string" ? body : "";
    var lines = [];
    if (md && md.indexOf(MARKER_START) !== -1) {
      var start = md.indexOf(MARKER_START) + MARKER_START.length;
      var end = md.indexOf(MARKER_END, start);
      var seg = md.slice(start, end > start ? end : md.length);
      var seen = 0;
      seg.split(/\n+/).forEach(function (raw) {
        if (lines.length >= 2) return;
        var t = cleanLine(raw);
        if (!t || t === "本版摘要") return;
        if (seen === 0 && t.length > 96) t = t.slice(0, 96).trim() + "…";
        seen += 1;
        lines.push(t);
      });
    } else if (md) {
      var text = md
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "");
      outer: for (var i = 0; i < 12; i++) {
        var line = (text.split(/\n/)[i] || "");
        if (!lines.length && /^(---|[\s|]+)$/.test(line.trim())) continue;
        var clean = line && cleanLine(line);
        if (!clean) continue;
        if (STOP.test(clean.split(/[：（:]/)[0].trim())) break outer;
        if (/^[\|<]/.test(clean)) break outer;
        if (clean.length > 96) clean = clean.slice(0, 96).trim() + "…";
        lines.push(clean);
        if (lines.length >= 2) break outer;
      }
    }
    var text = lines.length ? lines.join(" · ") : "";
    if (text.length > CAP) text = text.slice(0, CAP).trim() + "…";
    return { lines: lines, text: text || FALLBACK_TITLE };
  }

  /* 文件大小与日期 formatting */
  function formatSize(n) {
    if (typeof n !== "number" || n <= 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function formatDate(v) {
    var d = new Date(v);
    if (isNaN(d.valueOf())) return "";
    return d.getFullYear() + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2);
  }

  /* 校验命令示例：真实文件名可查时逐行生成，否则用版本占位符 */
  function checksumCommands(setup, portable) {
    var rows = [];
    if (setup) { rows.push('certutil -hashfile "' + setup.name + '" SHA256'); }
    else { rows.push("certutil -hashfile \"Pi-GUI-Setup-<版本>.exe\" SHA256"); }
    if (portable) { rows.push('certutil -hashfile "' + portable.name + '" SHA256'); }
    else { rows.push("certutil -hashfile \"Pi-GUI-<版本>-portable.zip\" SHA256"); }
    return rows.join("\n");
  }

  return {
    stableReleases: stableReleases,
    findAsset: findAsset,
    safeUrl: safeUrl,
    summarize: summarize,
    formatSize: formatSize,
    formatDate: formatDate,
    checksumCommands: checksumCommands
  };
});
