# GemiGo Browser Extension

浏览器扩展 - 让任意已部署的应用获得浏览器能力。

## 快速开始

```bash
# 在根目录执行
pnpm build:extension
```

## 在 Chrome 中加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `browser-extension/dist` 目录
5. 访问任意网页，点击扩展图标打开 Side Panel

## 开发调试

### 开发模式（自动重建）
```bash
pnpm dev:extension
```
> 修改代码后会自动重建。但需要手动在 `chrome://extensions/` 点击刷新按钮 🔄 来更新扩展。

### 调试方法

| 组件 | 调试方式 |
|------|----------|
| **Side Panel** | 右键 Side Panel → 检查 → 打开 DevTools |
| **Service Worker** | `chrome://extensions/` → 点击 "Service Worker" 链接 |
| **Content Script** | 打开网页 DevTools → Console（会显示 `[GemiGo]` 前缀日志）|

### 常见问题

**扩展无法加载？**
- 检查 `dist/` 目录是否包含 `manifest.json`
- 确保 `icons/` 目录有 PNG 图标文件（16/48/128px）

**Side Panel 不显示？**
- 确保在网页标签页中点击扩展图标（不能在 `chrome://` 页面）
- 检查 Service Worker 是否有错误

**修改后不生效？**
- 在 `chrome://extensions/` 点击扩展卡片上的刷新按钮 🔄
- 关闭并重新打开 Side Panel

## 项目结构

```
browser-extension/
├── manifest.json           # Chrome Manifest V3 配置
├── vite.config.ts          # 构建配置
├── sidepanel/              # Side Panel React 应用
│   ├── index.html
│   └── src/
│       ├── App.tsx         # 主组件
│       └── index.css       # 样式
├── background/
│   └── service-worker.ts   # 后台服务
├── content-scripts/
│   └── bridge.ts           # 页面桥接脚本
└── icons/                  # 扩展图标
```

## 相关文档

- [功能设计](../docs/browser-extension-design.md)
- [SDK API](../docs/tech/APP_SDK_API.md)
- [交互原型](../prototypes/browser-extension/index.html)
