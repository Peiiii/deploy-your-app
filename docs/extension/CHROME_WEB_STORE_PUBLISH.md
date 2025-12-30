# Chrome Web Store 发布（GemiGo Browser Extension）

目标：生成可上传的 zip 包，并完成 Web Store 提交所需材料。

## 1) 产物构建与打包（你可以直接跑）

1. 构建（生产版）：
   - `pnpm build:extension`
2. 打包 zip（会拒绝 Dev build / localhost CSP）：
   - `pnpm package:extension`
3. 产物位置：
   - `browser-extension/release/gemigo-v0.1.0.zip`（版本号以 `browser-extension/dist/manifest.json` 为准）

## 2) 本地验收（上传前必须）

1. Chrome → `chrome://extensions` → Developer mode
2. Load unpacked → 选择 `browser-extension/dist`
3. 验收点：
   - Side Panel 能打开
   - Explore 能正常加载（默认 API Base URL 为 `https://gemigo.io`）
   - 打开任意 App 后，在外站能通过「页面权限」条授权并重试成功

## 3) Web Store 提交（你需要做）

你需要准备并填写：

- 开发者账号：Chrome Web Store Developer（包含一次性费用）
- Store Listing：
  - 名称、简介、详细描述、分类
  - 截图（至少 1–3 张），建议包含 Side Panel / Explore / App 运行页
- 权限用途说明（建议明确写“用户触发后读取页面内容用于 AI 分析”，并说明可撤销）
- 隐私政策 URL（必须是可访问的网页）
- 版本管理：每次重新上传需要提升 `browser-extension/manifest.json` 的 `version`

## 4) 常见坑（提前规避）

- 不要用 Dev 包上传：Dev manifest 的名字包含 `(Dev)`，而且 CSP 允许 localhost
- 如果你打算让插件只运行 `https://*.gemigo.app` 的应用：确保上架应用的 URL 与 `frame-src` 一致

