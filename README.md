# Pi GUI 官网

Pi GUI 的静态展示站，纯 HTML / CSS / JavaScript，无构建步骤与外部依赖（仅运行时可选用 Lenis CDN）。

## 文件

- `index.html` 页面结构
- `style.css` 样式与响应式
- `main.js` 平滑滚动、入场动画、交互示意、Releases 数据、复制命令

## 本地预览

```bash
python3 -m http.server 8000
```

打开 http://localhost:8000

## 部署

Cloudflare Pages 连接本仓库：

- Framework preset: None
- Build command: 留空
- Build output directory: /

绑定域名 pi-gui.881817.xyz。每次 push 到 main 自动重新部署。

## 数据来源

版本号、安装包文件名与体积、更新日志均实时读取 GitHub Releases API，接口不可用时退回 GitHub Releases 链接。
