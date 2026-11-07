// Pi GUI 官网 — 主题切换 · 导航 · 入场动画 · 交互示意 · 发布信息
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RELEASES = "https://github.com/HYJ1817/pi-gui/releases";
  var PD = window.PiReleaseData || {};

  /* ===== 主题：浅色 / 深色 / 跟随系统 ===== */
  var THEME_KEY = "pi-gui-theme";
  var schemeMq = window.matchMedia("(prefers-color-scheme: dark)");
  var themeMode = "system";
  try { themeMode = localStorage.getItem(THEME_KEY) || ""; } catch (e) {}
  if (themeMode !== "light" && themeMode !== "dark" && themeMode !== "system") themeMode = "system";

  function resolveTheme(mode) {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return schemeMq.matches ? "dark" : "light";
  }

  function applyTheme() {
    var resolved = resolveTheme(themeMode);
    document.documentElement.setAttribute("data-theme", resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#14141a" : "#fafaf7");
  }

  function syncThemeButtons() {
    document.querySelectorAll("[data-theme-seg] button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeChoice === themeMode));
    });
  }

  function onSchemeChange() { if (themeMode === "system") applyTheme(); }
  if (schemeMq.addEventListener) schemeMq.addEventListener("change", onSchemeChange);

  document.querySelectorAll("[data-theme-seg] button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      themeMode = btn.dataset.themeChoice || "system";
      try { localStorage.setItem(THEME_KEY, themeMode); } catch (e) {}
      applyTheme();
      syncThemeButtons();
    });
  });
  applyTheme();
  syncThemeButtons();

  /* ===== 移动端菜单：点击 / Escape / 外部点击 / 链接点击关闭 ===== */
  var menuBtn = document.getElementById("menu-toggle");
  var menuPanel = document.getElementById("nav-panel");
  var menuOpen = false;

  function setMenu(open) {
    if (!menuBtn || !menuPanel) return;
    menuOpen = open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    menuPanel.hidden = !open;
    document.documentElement.classList.toggle("menu-open", open);
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    menuPanel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (menuOpen && e.key === "Escape") { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!menuOpen) return;
      var t = e.target;
      if (!t.closest || (!t.closest(".nav") && !t.closest("#nav-panel"))) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (menuOpen && window.innerWidth > 859) setMenu(false);
    });
    setMenu(false);
  }

  /* 平滑滚动：外部脚本异步注入，失败回落原生 */
  if (!reduced) {
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js";
    s.crossOrigin = "anonymous";
    s.onload = function () { initLenis(); };
    document.head.appendChild(s);
  }

  function initLenis() {
    if (!window.Lenis) return;
    try {
      var lenis = new Lenis({
        duration: 1.15,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        touchMultiplier: 1.6
      });
      (function loop(time) { lenis.raf(time); requestAnimationFrame(loop); })(performance.now());
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var id = a.getAttribute("href");
          var target = id && id.length > 1 ? document.querySelector(id) : null;
          if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -56, duration: 1.4 }); }
        });
      });
    } catch (err) { /* 原生滚动 */ }
  }

  /* 导航反色 + 阅读进度 */
  var nav = document.getElementById("nav");
  var prog = document.getElementById("prog");
  var darkBand = document.getElementById("privacy");
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = requestAnimationFrame(function () {
      queued = false;
      nav.classList.toggle("scrolled", window.scrollY > 12);
      if (darkBand) {
        var r = darkBand.getBoundingClientRect();
        nav.classList.toggle("on-dark", r.top < 64 && r.bottom > 64);
      }
      if (prog) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (max > 0 ? Math.min(1, window.scrollY / max) * 100 : 0).toFixed(2) + "%";
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* 入场动画 */
  var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window) || reduced) {
    items.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* 交互示意：只换前端文案与颜色，不执行任何真实任务 */
  var scenes = {
    sessions: {
      title: "恢复会话逻辑", prompt: "帮我梳理这个仓库的会话恢复逻辑，并指出需要修改的文件。",
      response: "正在检查会话状态与恢复流程，已定位相关模块。",
      followup: "已找到 3 处关键调用，接下来核对恢复路径。",
      tool: "read_file", path: "lib/session-recovery.js", state: "完成 ✓",
      model: "Claude Sonnet", file: "session-recovery.js", count: "2 个文件", status: "变更可审阅",
      active: 0,
      caption: "在同一窗口管理多个项目与会话，随时切换工作上下文。纯前端演示，不会执行真实任务。",
      diff: [
        ["context", "@@ -42,6 +42,8 @@"], ["normal", "  const session = load(id)"],
        ["remove", "- if (!session) return"], ["add", "+ if (!session) {"],
        ["add", "+   return restore(id)"], ["add", "+ }"], ["normal", "  session.resume()"]
      ]
    },
    models: {
      title: "供应商管理", prompt: "切换到备用模型，继续完成供应商配置页面。",
      response: "已切换当前会话模型。可以按任务需要配置不同供应商与思考等级。",
      followup: "模型设置仅影响当前演示场景，实际使用请在 Pi GUI 中配置。",
      tool: "select_model", path: "provider / model", state: "已切换 ✓",
      model: "DeepSeek Chat", file: "provider-config.js", count: "1 个文件", status: "配置待审阅",
      active: 1,
      caption: "按会话切换供应商、模型与思考等级，集中管理 Agent 使用配置。纯前端示意。",
      diff: [
        ["context", "@@ model configuration @@"], ["normal", '  provider: "openai"'],
        ["remove", '- model: "default"'], ["add", '+ model: "deepseek-chat"'],
        ["normal", '  reasoning: "medium"'], ["add", "+ fallback: true"]
      ]
    },
    changes: {
      title: "测试与验证", prompt: "检查本次修改的 Diff，找出需要回退的部分。",
      response: "已整理本次修改，右侧可以查看逐行变更并进行审阅。",
      followup: "撤销前请确认变更边界，避免覆盖其他会话的工作。",
      tool: "git_diff", path: "src/workspace.js", state: "完成 ✓",
      model: "Claude Sonnet", file: "workspace.js", count: "3 个文件", status: "等待审阅",
      active: 2,
      caption: "逐文件审阅 Git Diff，检查 Agent 所做的修改，配合受控撤销降低误操作风险。",
      diff: [
        ["context", "@@ -25,5 +25,7 @@"], ["normal", "  function openWorkspace() {"],
        ["remove", "-   showChanges(false)"], ["add", "+   showChanges(true)"],
        ["add", "+   await syncDiff()"], ["normal", "    renderWorkspace()"],
        ["normal", "  }"]
      ]
    },
    tools: {
      title: "恢复会话逻辑", prompt: "读取会话模块，并运行测试验证修复结果。",
      response: "工具执行过程会按时间线显示，文件读取、命令运行及结果都可以追踪。",
      followup: "检查完成，测试结果可与修改记录一起审阅。",
      tool: "run_command", path: "npm test", state: "通过 ✓",
      model: "Claude Sonnet", file: "session.test.js", count: "1 个文件", status: "验证已完成",
      active: 0,
      caption: "展示工具调用、运行状态与验证结果，帮助理解 Agent 的执行过程。纯前端示意。",
      diff: [
        ["context", "$ npm test"], ["add", "✓ Session recovery"],
        ["add", "✓ Workspace state"], ["add", "✓ File changes"],
        ["normal", "  Tests passed"], ["normal", "  Exit code: 0"]
      ]
    }
  };

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".demo-tab"));
  var win = document.getElementById("demo-window");
  var names = Object.keys(scenes);
  var mapping = {
    "demo-thread-title": "title", "demo-prompt": "prompt", "demo-response": "response",
    "demo-followup": "followup", "demo-tool-name": "tool", "demo-tool-path": "path",
    "demo-tool-state": "state", "demo-model": "model", "demo-file-name": "file",
    "demo-file-count": "count", "demo-panel-status": "status", "demo-caption": "caption"
  };

  function switchScene(name, focus) {
    var scene = scenes[name];
    if (!scene || !win) return;
    win.dataset.scene = name;
    Object.keys(mapping).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = scene[mapping[id]];
    });
    var counter = document.getElementById("demo-counter");
    if (counter) counter.textContent = "0" + (names.indexOf(name) + 1) + " / 04";

    var diff = document.getElementById("demo-diff");
    if (diff) {
      diff.replaceChildren.apply(diff, scene.diff.map(function (row) {
        var div = document.createElement("div");
        div.className = "diff-line " + row[0];
        div.textContent = row[1];
        return div;
      }));
    }
    Array.prototype.forEach.call(document.querySelectorAll(".rail-session"), function (el, i) {
      el.classList.toggle("active", i === scene.active);
    });
    tabs.forEach(function (btn) {
      var on = btn.dataset.scene === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
      btn.tabIndex = on ? 0 : -1;
      if (on && focus) btn.focus();
    });
    win.classList.remove("scene-enter");
    void win.offsetWidth;
    win.classList.add("scene-enter");
  }

  tabs.forEach(function (btn, i) {
    btn.addEventListener("click", function () { switchScene(btn.dataset.scene); });
    btn.addEventListener("keydown", function (e) {
      var next = i;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i + tabs.length - 1) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      switchScene(tabs[next].dataset.scene, true);
    });
  });

  /* 复制命令：所有 .code-wrap 内的复制按钮通用 */
  document.querySelectorAll(".copy-command").forEach(function (btn) {
    btn.dataset.fallbackLabel = btn.textContent;
    btn.addEventListener("click", function () {
      var wrap = btn.closest(".code-wrap");
      var code = wrap && wrap.querySelector("code");
      var text = code ? code.textContent : (btn.getAttribute("data-copy") || "");
      var done = function (ok) {
        btn.textContent = ok ? "已复制 ✓" : "请手动复制";
        setTimeout(function () { btn.textContent = btn.dataset.fallbackLabel || "复制 ⧉"; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });
  });

  /* 发布信息：数据解析在 release-data.js 中（可测试），此处只负责渲染与降级 */
  var statusEl = document.getElementById("release-status");
  var listEl = document.getElementById("release-list");
  var shaLink = document.getElementById("sha-sums-link");
  var shaCode = document.getElementById("sha-commands");

  function releaseRow(rel) {
    var item = document.createElement("article");
    item.className = "release-item";
    var stamp = document.createElement("div");
    stamp.className = "release-stamp";
    var ver = document.createElement("span");
    ver.className = "release-version";
    ver.textContent = rel.tag_name || "版本更新";
    var date = document.createElement("span");
    date.className = "release-date";
    date.textContent = PD.formatDate ? PD.formatDate(rel.published_at) : "";
    stamp.append(ver, date);
    var copy = document.createElement("div");
    copy.className = "release-copy";
    var h = document.createElement("h3");
    h.textContent = rel.name || ("发布 " + (rel.tag_name || ""));
    var summary = PD.summarize ? PD.summarize(rel.body) : { text: "查看该版本的详细变更与修复说明。" };
    var p = document.createElement("p");
    p.textContent = summary.text;
    copy.append(h, p);
    var link = document.createElement("a");
    link.className = "release-link";
    link.href = (PD.safeUrl && PD.safeUrl(rel.html_url)) || RELEASES;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗";
    link.setAttribute("aria-label", "查看 " + ver.textContent + " 更新详情");
    item.append(stamp, copy, link);
    return item;
  }

  /* 资产写入：找到对应文件才算数，找不到一律指向 Releases 页面，不用过期资源顶替 */
  function setAsset(linkId, nameId, sizeId, asset) {
    var link = document.getElementById(linkId);
    var name = document.getElementById(nameId);
    var size = document.getElementById(sizeId);
    if (!link) return;
    var url = asset && PD.safeUrl ? PD.safeUrl(asset.browser_download_url) : null;
    if (!url) {
      if (name) name.textContent = "见 Releases 页面获取";
      if (size) size.textContent = "未找到对应文件";
      return;
    }
    link.href = url;
    if (name) name.textContent = asset.name;
    if (size) size.textContent = (PD.formatSize ? PD.formatSize(asset.size) : "") + " · 直接下载";
  }

  function applyVersion(latest, stable) {
    var tag = latest.tag_name;
    var v1 = document.getElementById("ver");
    var v2 = document.getElementById("ver2");
    if (v1) v1.textContent = tag;
    if (v2) v2.textContent = tag;
    if (statusEl) {
      statusEl.textContent = "最新稳定版 " + tag +
        (latest.published_at ? " · " + PD.formatDate(latest.published_at) : "") +
        " · 数据来自 GitHub Releases";
    }
    var setup = PD.findAsset(latest, "setup");
    var portable = PD.findAsset(latest, "portable");
    var sums = PD.findAsset(latest, "checksums");
    setAsset("download-installer", "installer-filename", "installer-size", setup);
    setAsset("download-portable", "portable-filename", "portable-size", portable);
    if (shaCode) shaCode.textContent = PD.checksumCommands(setup, portable);
    if (shaLink) {
      var sumsUrl = sums ? PD.safeUrl(sums.browser_download_url) : null;
      if (sumsUrl) {
        shaLink.href = sumsUrl;
        shaLink.textContent = "下载 SHA256SUMS.txt (" + tag + ") ↗";
      }
    }
    if (listEl && PD.stableReleases) {
      listEl.replaceChildren.apply(listEl, stable.slice(0, 3).map(releaseRow));
    }
  }

  function degrade() {
    if (statusEl) statusEl.textContent = "暂时无法获取版本信息，请前往 GitHub Releases 查看最新安装包。";
    if (shaLink) shaLink.textContent = "从 Releases 页面下载 SHA256SUMS.txt ↗";
    if (listEl) {
      listEl.replaceChildren();
      var ph = document.createElement("div");
      ph.className = "release-placeholder";
      ph.textContent = "更新记录暂时无法加载，请前往 ";
      var a = document.createElement("a");
      a.href = RELEASES; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = "GitHub Releases ↗";
      ph.append(a, " 查看。");
      listEl.append(ph);
    }
  }

  function loadReleases() {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 6500);
    fetch("https://api.github.com/repos/HYJ1817/pi-gui/releases?per_page=8", {
      headers: { Accept: "application/vnd.github+json" }, signal: ctrl.signal
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (all) {
      var stable = PD.stableReleases ? PD.stableReleases(all) : [];
      if (!stable.length) throw new Error("no stable release");
      applyVersion(stable[0], stable);
    }).catch(degrade).finally(function () { clearTimeout(timer); });
  }

  if (window.fetch) loadReleases();
  else degrade();
})();
