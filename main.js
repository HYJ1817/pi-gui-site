// Pi GUI 官网 — 平滑滚动 · 入场动画 · 交互示意 · 发布信息
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RELEASES = "https://github.com/HYJ1817/pi-gui/releases";

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

  /* 复制安装命令 */
  var copyBtn = document.getElementById("copy-command");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = "npm install -g @earendil-works/pi-coding-agent\npi --version";
      var done = function (ok) {
        copyBtn.textContent = ok ? "已复制 ✓" : "请手动复制";
        setTimeout(function () { copyBtn.textContent = "复制命令 ⧉"; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });
  }

  /* 发布信息：只显示校验过的 GitHub 链接 */
  var statusEl = document.getElementById("release-status");
  var listEl = document.getElementById("release-list");
  var safeUrl = function (candidate) {
    try {
      var u = new URL(candidate);
      return u.protocol === "https:" && /(^|\.)github\.com$|(^|\.)githubusercontent\.com$/.test(u.hostname) ? u.href : null;
    } catch (e) { return null; }
  };
  var plain = function (md) {
    if (!md || typeof md !== "string") return "查看该版本的详细变更与修复说明。";
    var text = md
      .replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[#>*\-\s]+/gm, "").replace(/[*_`~]/g, "").replace(/<[^>]+>/g, "")
      .split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 2).join(" · ");
    return text.length > 120 ? text.slice(0, 120).trim() + "…" : (text || "查看该版本的详细变更与修复说明。");
  };
  var dateText = function (v) {
    var d = new Date(v);
    if (isNaN(d.valueOf())) return "";
    return d.getFullYear() + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2);
  };
  var sizeText = function (n) {
    return typeof n === "number" && n > 0 ? (n / 1048576).toFixed(1) + " MB" : "下载文件";
  };

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
    date.textContent = dateText(rel.published_at);
    stamp.append(ver, date);
    var copy = document.createElement("div");
    copy.className = "release-copy";
    var h = document.createElement("h3");
    h.textContent = rel.name || ("发布 " + (rel.tag_name || ""));
    var p = document.createElement("p");
    p.textContent = plain(rel.body);
    copy.append(h, p);
    var link = document.createElement("a");
    link.className = "release-link";
    link.href = safeUrl(rel.html_url) || RELEASES;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗";
    link.setAttribute("aria-label", "查看 " + ver.textContent + " 更新详情");
    item.append(stamp, copy, link);
    return item;
  }

  function setAsset(linkId, nameId, sizeId, asset) {
    var link = document.getElementById(linkId);
    var name = document.getElementById(nameId);
    var size = document.getElementById(sizeId);
    if (!link || !asset) return;
    var url = safeUrl(asset.browser_download_url);
    if (!url) return;
    link.href = url;
    if (name) name.textContent = asset.name;
    if (size) size.textContent = sizeText(asset.size) + " · 直接下载";
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
      if (!Array.isArray(all)) throw new Error("bad payload");
      var stable = all.filter(function (x) { return x && !x.draft && !x.prerelease && x.tag_name; })
        .sort(function (a, b) { return new Date(b.published_at || 0) - new Date(a.published_at || 0); });
      if (!stable.length) throw new Error("no stable release");
      var latest = stable[0];
      var tag = latest.tag_name;
      var v1 = document.getElementById("ver");
      var v2 = document.getElementById("ver2");
      if (v1) v1.textContent = tag;
      if (v2) v2.textContent = tag;
      if (statusEl) statusEl.textContent = "最新稳定版 " + tag + (latest.published_at ? " · " + dateText(latest.published_at) : "") + " · 数据来自 GitHub Releases";
      var assets = Array.isArray(latest.assets) ? latest.assets : [];
      var setup = assets.find(function (a) { return /setup.*\.exe$/i.test(a.name || "") && /pi[-_ ]?gui/i.test(a.name || ""); });
      var portable = assets.find(function (a) { return /portable.*\.zip$/i.test(a.name || "") && /pi[-_ ]?gui/i.test(a.name || ""); });
      setAsset("download-installer", "installer-filename", "installer-size", setup);
      setAsset("download-portable", "portable-filename", "portable-size", portable);
      if (listEl) listEl.replaceChildren.apply(listEl, stable.slice(0, 3).map(releaseRow));
    }).catch(function () {
      if (statusEl) statusEl.textContent = "暂时无法获取版本信息，请前往 GitHub Releases 查看最新安装包。";
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
    }).finally(function () { clearTimeout(timer); });
  }

  if (window.fetch) loadReleases();
  else if (statusEl) statusEl.textContent = "请通过 GitHub Releases 查看最新版本。";
})();
