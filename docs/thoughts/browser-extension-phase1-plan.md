---
title: Browser Extension Phase 1 Plan
status: draft
scope: MVP release
---

# Browser Extension Phase 1（可发布 MVP）方案 + 执行计划

目标：在**不牺牲可维护性与合规风险控制**的前提下，让插件具备“平台最小闭环形态”：

- Side Panel 内 iframe 运行应用（平台定位不变）
- 插件只展示 `platforms` 包含 `extension` 的应用（其它仅 Web 使用，插件不显示）
- 不要求插件登录；应用自身在 Web 域名下自行处理登录态
- 移除 demo/本地硬编码应用，改为从平台 Catalog 拉取（由 API Worker 提供）
- 安装时只申请最小权限（`activeTab`），站点访问权限改为按需授权（optional host permissions）

---

## 1. Phase 1 设计形态（最终交付物）

### 1.1 Side Panel（Host）

- 三个核心页签（或同等信息架构）：
  - **Home**：已安装应用（来自 `chrome.storage.local`）
  - **Explore**：复用平台 Explore 接口，但只拉取“支持插件端”的应用，支持一键安装
  - **Settings（可选）**：Catalog URL 配置、权限撤销入口（Phase 1 可先不做 UI，只保留最小可用）

### 1.2 App Manifest（平台侧/插件侧的共识）

Phase 1 最小字段（复用 `GET /api/v1/projects/explore` 返回的 `Project`）：

- `id` / `name` / `description`
- `url`（或 `providerUrl`）：应用部署地址（必须是可被 `frame-src` 允许的域名）
- `isExtensionSupported`：是否允许在插件端展示与运行

平台侧 Phase 1 推荐实现（最轻量、最可维护）：
- 复用 `GET /api/v1/projects/explore`，新增查询参数 `is_extension_supported=1` 用于筛选
- 数据层新增字段 `projects.is_extension_supported`（历史数据默认不支持，且不需要迁移）

### 1.3 能力边界（Phase 1 只承诺）

对应用（iframe）侧：

- 通过 `@gemigo/app-sdk` 调用 Host 能力（Read/Storage/Network 为主）
- 不承诺所有能力都在 Phase 1 可用（更高风险能力后置：截图、写页面等）

对用户侧：

- 插件安装时不默认获得“读所有网站”的权限
- 首次需要读取网页 DOM 时，引导用户点击按钮授权当前网站（optional host permission）

---

## 2. 安全/合规策略（为什么要这么做）

### 2.1 不再 `<all_urls>` 常驻注入

- 过去：安装即对所有网页注入 content script（高风险、易被审核关注）
- 现在：只保留 `activeTab`，并在需要时注入（或在用户授权后注入）

### 2.2 使用 optional host permissions 做“按需授权”

- 安装时不申请站点访问权限
- 用户在 Side Panel 中点击“启用当前网站”后，申请该网站的 origin 权限
- 授权后可稳定执行 `chrome.scripting.executeScript` 注入 content script

例外（Phase 1 推荐）：
- 对 `https://*.gemigo.io/*`、`https://*.gemigo.app/*` 这种自有域名，可直接放到 `host_permissions`，避免你在自家页面里测试时还需要点一次授权

### 2.3 CSP 收敛

- `connect-src`：只允许连接 `*.gemigo.io`、`*.gemigo.app`
- `frame-src`：只允许加载 `https://*.gemigo.app`（应用运行域名）

---

## 3. 执行计划（工程步骤）

### Step A：Manifest 收敛（可发布基线）

- 移除 `host_permissions: ["<all_urls>"]`
- 移除 `content_scripts` 的 `<all_urls>` 常驻注入
- 增加 `optional_host_permissions`（按需授权用）
- 收敛 `content_security_policy.extension_pages` 的 `connect-src` 和 `frame-src`
- 收敛 `web_accessible_resources` 到必要文件（避免 `*`）

验收点：
- build 后 `dist/manifest.json` 符合 Phase 1 策略

### Step B：Side Panel 接入平台 Catalog（替换硬编码）

- 删除/禁用本地 `defaultApps` 和 `marketApps`
- `Explore` 直接调用 `GET /api/v1/projects/explore?is_extension_supported=1`
- 用户点击 Install 后写入 `chrome.storage.local.installedApps`

验收点：
- 未配置/拉取失败时有清晰提示（不崩）
- 过滤逻辑正确（默认不支持插件端的历史项目不显示）

### Step C：optional host permission 的用户流程

- 在运行应用时，如果未授权当前网站，展示 banner：
  - “启用当前网站后，应用才能读取网页内容”
  - 按钮触发 `chrome.permissions.request({ origins: [origin + "/*"] })`
- 授权成功后，触发一次 content script `ping`（确保注入）

验收点：
- 未授权时不会默默失败（有 UI 提示）
- 授权后读取类 API 能正常工作（至少 `getPageText/getSelection`）

---

## 4. 验证清单（必须跑）

### 4.1 代码质量

- `pnpm lint`
- `pnpm typecheck`

### 4.2 构建

- `pnpm --filter @gemigo/browser-extension build`
 - `pnpm package:extension`（生成 Web Store 上传用 zip）

### 4.3 功能自测（人工）

1. Chrome → Extensions → Load unpacked → 选择 `browser-extension/dist`
2. 打开任意网页 → 点击扩展图标 → 打开 Side Panel
3. Explore 页面把 API Base URL 设为平台域名（或本地调试地址），Refresh 列表并安装 App
4. 打开该 App：
   - 未授权时应看到“启用当前网站”提示
   - 点击授权按钮后：App 能读取页面文本/选区（至少一个可见功能）

本地调试说明：
- 插件页面的 `connect-src` 默认只允许 `*.gemigo.io`、`*.gemigo.app`；如果你要在插件里直接请求 `http://127.0.0.1:*`，需要使用 dev manifest 构建：`GEMIGO_EXTENSION_DEV=1 pnpm --filter @gemigo/browser-extension build`

---

## 5. 未来 Phase 2 的自然延伸（不在本期实现）

- 插件登录/账号同步：用于“个人已安装 App 列表、私有 App、付费”等
- 权限可视化/撤销 UI（Settings）
- 更高风险能力：`extension.modify`、`capture`、自动化类能力
