# Pi GUI 官网

Pi GUI 的静态展示站，纯 HTML / CSS / JavaScript，无构建步骤与外部运行时依赖（仅 Lenis 平滑滚动走 CDN，失败自动回落原生滚动）。

线上地址：https://pi-gui.881817.xyz/

## 文件

- `index.html` 页面结构（含 SEO 元信息、JSON-LD、主题初始化脚本）
- `style.css` 样式、响应式与双主题令牌
- `main.js` 主题切换、移动端菜单、平滑滚动、入场动画、交互示意、Releases 渲染、复制命令
- `release-data.js` GitHub Releases 数据解析的纯函数模块（供 main.js 与测试共用）
- `robots.txt` / `sitemap.xml` 搜索引擎抓取配置
- `assets/` favicon、apple-touch-icon、OG 分享图及生成源文件（`og.html` / `icon.html`）
- `test/` 单元测试与 Playwright 冒烟测试
- `.github/workflows/ci.yml` PR 与 main 的自动检查

## 主题系统

浅色 / 深色 / 跟随系统三态，选择保存在 `localStorage`（键 `pi-gui-theme`）。
颜色令牌集中定义在 `style.css` 的 `:root`，用 `light-dark()` 描述双值，
主题切换只改变 `html` 的 `color-scheme`；`<head>` 内联脚本在选择生效前解析主题避免闪屏。
不支持 `light-dark()` 的旧浏览器回落浅色（见 `@supports not` 兜底块）。

## Release 数据与校验说明

版本号、安装包文件名与体积、更新日志摘要均实时读取 GitHub Releases API：

- 过滤 Draft 与 Prerelease，只展示最新稳定版；
- 资产按 `Pi-GUI-Setup-*.exe` / `Pi-GUI-*-portable.zip` / `SHA256SUMS.txt` 精确匹配，
  找不到时入口回落为 Releases 页面链接，不使用过期资源冒充；
- 更新日志摘要优先取 Release 正文 `pi-gui-release-summary` 注释块，不展示 PR 清单；
- 下载区提供 `certutil` SHA-256 校验命令示例（随版本自动填充）与说明；
- 解析逻辑在 `release-data.js`，接口失败时页面整体降级为 GitHub Releases 链接。

签名说明以产品仓库实际发布状态为准：安装包尚未接入正式代码签名
（见 [CODE_SIGNING_POLICY.md](https://github.com/HYJ1817/pi-gui/blob/main/CODE_SIGNING_POLICY.md)）。

## 本地预览

```bash
python3 -m http.server 8000
```

打开 http://localhost:8000。注意首页通过 GitHub API 读取版本信息，本地直接打开 `file://` 时入口会降级为 Releases 链接。

## 本地测试

```bash
npm install          # 安装 Playwright（跳过浏览器下载：PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1）
npm run test:unit    # Node 单元测试：Release 解析 / HTML 结构 / 锚点与资源 / SEO / CSS 校验
npm run test:smoke   # Playwright 冒烟：Release 渲染与降级、场景切换、主题、移动菜单、多宽度溢出
npm test             # 两者都跑
```

浏览器测试优先使用系统 Chrome（`channel: chrome`），失败依次尝试 Edge 与 bundled Chromium；
Releases API 与 Lenis CDN 均 stub 为本地响应，测试不受网络与限流影响。

## 素材再生成

```bash
npm run gen:assets   # 截图 assets/og.html 与 assets/icon.html → og-image.png 等 (1200×630 / 180² / 64²)
```

## 部署

Cloudflare Pages 连接本仓库：

- Framework preset: None
- Build command: 留空
- Build output directory: /

绑定域名 pi-gui.881817.xyz。每次 push 到 main 自动重新部署。

## 常见改动提示

- 改动样式或脚本后记得更新 `index.html` 里的 `?v=` 查询参数（当前 style v11 / main v9 / release-data v1）。
- 新增站内锚点需同步 `test/static.test.mjs` 的锚点检查（自动扫描，无需手工登记）。
- 更新产品信息（如签名状态、安装命令）时保持与 [产品仓库 README](https://github.com/HYJ1817/pi-gui) 一致。
